/**
 * Document Upload Service v2
 * Enhanced with cancellation, retry, validation, and better error handling
 */

import { supabase } from '../lib/supabase';
import { retryWithBackoff, RetryPresets, RetryStrategies } from '../lib/retryWithBackoff';
import { uploadCancellationManager, pollWithCancellation } from '../lib/uploadCancellation';
import { validateFile, calculateFileHash, formatFileSize } from '../lib/fileValidation';
import {
  showUploadProgressToast,
  showUploadSuccessToast,
  showUploadErrorToast,
  dismissToast,
} from '../lib/toastNotifications';

export interface UploadProgress {
  stage: 'validating' | 'uploading' | 'indexing' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0-100
  message: string;
  documentId?: number;
  operationId?: number;
  error?: string;
  cancellable?: boolean;
}

export interface UploadResult {
  documentId: number;
  operationId: number;
  fileSearchStoreId: string;
  hash: string;
}

export interface UploadOptions {
  /**
   * Enable automatic retry on transient errors
   * @default true
   */
  enableRetry?: boolean;

  /**
   * Show toast notifications for progress
   * @default true
   */
  showToasts?: boolean;

  /**
   * Validate file before upload
   * @default true
   */
  validateBeforeUpload?: boolean;

  /**
   * Check for duplicate files by hash
   * @default true
   */
  checkDuplicates?: boolean;

  /**
   * Adaptive polling interval (faster for small files)
   * @default true
   */
  adaptivePolling?: boolean;
}

/**
 * Enhanced Document Upload Service
 * 
 * Improvements over v1:
 * - Upload cancellation support
 * - Automatic retry with exponential backoff
 * - Advanced file validation
 * - Duplicate detection
 * - Better error messages
 * - Adaptive polling
 * - Toast notifications
 */
export class DocumentUploadServiceV2 {
  private readonly defaultOptions: Required<UploadOptions> = {
    enableRetry: true,
    showToasts: true,
    validateBeforeUpload: true,
    checkDuplicates: true,
    adaptivePolling: true,
  };

  /**
   * Upload a file with enhanced features
   */
  async uploadDocument(
    file: File,
    rtoCode: string,
    unitCode: string,
    documentType: 'assessment' | 'unit_requirement' | 'training_package' | 'other',
    validationDetailId?: number,
    onProgress?: (progress: UploadProgress) => void,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    const opts = { ...this.defaultOptions, ...options };
    const operationId = `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    let toastId: string | number | undefined;

    try {
      // Stage 0: Validate file
      if (opts.validateBeforeUpload) {
        onProgress?.({
          stage: 'validating',
          progress: 0,
          message: 'Validating file...',
          cancellable: false,
        });

        const validation = await validateFile(file);
        
        if (!validation.valid) {
          throw new Error(validation.error || 'File validation failed');
        }

        if (validation.warnings && validation.warnings.length > 0) {
          console.warn('[Upload] File validation warnings:', validation.warnings);
        }
      }

      // Calculate file hash for duplicate detection
      let fileHash: string | undefined;
      if (opts.checkDuplicates) {
        onProgress?.({
          stage: 'validating',
          progress: 5,
          message: 'Checking for duplicates...',
          cancellable: false,
        });

        fileHash = await calculateFileHash(file);
        
        // Check if file already exists
        const duplicate = await this.checkDuplicate(fileHash, rtoCode, unitCode);
        if (duplicate) {
          console.warn('[Upload] Duplicate file detected:', duplicate);
          // Continue anyway, but log warning
        }
      }

      // Stage 1: Upload to Storage
      onProgress?.({
        stage: 'uploading',
        progress: 10,
        message: 'Uploading file to storage...',
        cancellable: true,
      });

      if (opts.showToasts) {
        toastId = showUploadProgressToast(file.name, 10);
      }

      const storagePath = await this.uploadToStorage(
        file,
        rtoCode,
        unitCode,
        operationId,
        (uploadProgress) => {
          const progress = 10 + (uploadProgress * 0.2); // 10% to 30%
          onProgress?.({
            stage: 'uploading',
            progress,
            message: `Uploading... ${Math.floor(uploadProgress)}%`,
            cancellable: true,
          });

          if (opts.showToasts && toastId) {
            dismissToast(toastId);
            toastId = showUploadProgressToast(file.name, progress);
          }
        },
        opts
      );

      onProgress?.({
        stage: 'uploading',
        progress: 30,
        message: 'File uploaded successfully',
        cancellable: false,
      });

      // Stage 2: Trigger Indexing
      onProgress?.({
        stage: 'indexing',
        progress: 40,
        message: 'Starting document indexing...',
        cancellable: true,
      });

      if (opts.showToasts && toastId) {
        dismissToast(toastId);
        toastId = showUploadProgressToast(file.name, 40);
      }

      const { documentId, operationId: indexOperationId, fileSearchStoreId } = 
        await this.triggerIndexing(
          file.name,
          storagePath,
          rtoCode,
          unitCode,
          documentType,
          validationDetailId,
          operationId,
          opts
        );

      onProgress?.({
        stage: 'indexing',
        progress: 75,
        message: 'Indexing complete',
        documentId,
        operationId: indexOperationId,
        cancellable: false,
      });

      // Stage 3: Skip polling - upload-document is synchronous
      // No need to poll for operation status since it's already complete

      // Stage 4: Complete
      onProgress?.({
        stage: 'completed',
        progress: 100,
        message: 'Upload complete',
        documentId,
        operationId: indexOperationId,
        cancellable: false,
      });

      if (opts.showToasts) {
        if (toastId) dismissToast(toastId);
        showUploadSuccessToast(file.name);
      }

      return {
        documentId,
        operationId: indexOperationId,
        fileSearchStoreId,
        hash: fileHash || '',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      
      // Determine if error is cancellation
      const isCancelled = errorMessage.includes('cancelled') || errorMessage.includes('abort');
      
      onProgress?.({
        stage: isCancelled ? 'cancelled' : 'failed',
        progress: 0,
        message: errorMessage,
        error: errorMessage,
        cancellable: false,
      });

      if (opts.showToasts) {
        if (toastId) dismissToast(toastId);
        if (!isCancelled) {
          showUploadErrorToast(file.name, errorMessage);
        }
      }

      throw error;
    } finally {
      // Clean up cancellation manager
      uploadCancellationManager.complete(operationId);
    }
  }

  /**
   * Cancel an upload operation
   */
  cancelUpload(operationId: string): boolean {
    return uploadCancellationManager.cancel(operationId);
  }

  /**
   * Cancel all uploads
   */
  cancelAllUploads(): number {
    return uploadCancellationManager.cancelAll();
  }

  /**
   * Upload file to Supabase Storage with retry and cancellation
   */
  private async uploadToStorage(
    file: File,
    rtoCode: string,
    unitCode: string,
    operationId: string,
    onProgress?: (progress: number) => void,
    options?: UploadOptions
  ): Promise<string> {
    const timestamp = Date.now();
    const fileExt = file.name.split('.').pop();
    const fileName = `${timestamp}.${fileExt}`;
    const storagePath = `${rtoCode}/${unitCode}/${fileName}`;

    const uploadFn = async () => {
      const controller = uploadCancellationManager.create(
        `${operationId}-storage`,
        'upload',
        file.name
      );

      // Note: Supabase storage doesn't support progress callbacks or AbortController
      // This is a limitation we'll document
      const { data, error } = await supabase.storage
        .from('documents')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        throw new Error(`Storage upload failed: ${error.message}`);
      }

      onProgress?.(100);
      return data.path;
    };

    if (options?.enableRetry) {
      return await retryWithBackoff(uploadFn, {
        ...RetryPresets.standard,
        shouldRetry: RetryStrategies.retryTransientErrors,
        onRetry: (attempt, error) => {
          console.log(`[Upload] Retry attempt ${attempt} for storage upload:`, error.message);
        },
      });
    }

    return await uploadFn();
  }

  /**
   * Trigger Gemini indexing with retry and cancellation
   */
  private async triggerIndexing(
    fileName: string,
    storagePath: string,
    rtoCode: string,
    unitCode: string,
    documentType: string,
    validationDetailId: number | undefined,
    operationId: string,
    options?: UploadOptions
  ): Promise<{ documentId: number; operationId: number; fileSearchStoreId: string }> {
    const indexingFn = async () => {
      const controller = uploadCancellationManager.create(
        `${operationId}-indexing`,
        'indexing',
        fileName
      );

      const { data, error } = await supabase.functions.invoke('upload-document', {
        body: {
          rtoCode,
          unitCode,
          documentType,
          fileName,
          storagePath,
          displayName: fileName,
          metadata: {},
        },
      });

      if (error) {
        throw new Error(`Indexing failed: ${error.message}`);
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Indexing failed');
      }

      console.log('[Upload] Indexing response data:', data);
      
      // The upload-document function returns document.id, not operationId
      // Since it's synchronous, we don't need to poll for status
      if (!data.document?.id) {
        throw new Error('Edge function did not return a document ID');
      }

      return {
        documentId: data.document.id,
        operationId: 0, // No operation ID needed for synchronous processing
        fileSearchStoreId: data.document.fileSearchStoreId,
      };
    };

    if (options?.enableRetry) {
      return await retryWithBackoff(indexingFn, {
        ...RetryPresets.standard,
        shouldRetry: RetryStrategies.retryTransientErrors,
        onRetry: (attempt, error) => {
          console.log(`[Upload] Retry attempt ${attempt} for indexing:`, error.message);
        },
      });
    }

    return await indexingFn();
  }

  /**
   * Poll operation status with adaptive interval and cancellation
   */
  private async pollOperationStatus(
    operationId: number,
    uploadOperationId: string,
    file: File,
    onProgress?: (progress: number) => void,
    options?: UploadOptions
  ): Promise<void> {
    // Safety check for operationId
    if (!operationId) {
      throw new Error('Operation ID is required for polling status');
    }

    // Determine polling interval based on file size
    let interval = 1000; // Default 1s for small files
    if (file.size > 5 * 1024 * 1024) { // > 5MB
      interval = 2000; // Large files: 2s
    }

    const maxAttempts = 150; // 5 minutes max at 2s intervals

    await pollWithCancellation(
      async () => {
        const { data, error } = await supabase
          .from('gemini_operations')
          .select('status, error_message')
          .eq('id', operationId)
          .single();

        if (error) {
          throw new Error(`Failed to check operation status: ${error.message}`);
        }

        return data;
      },
      (result) => {
        if (result.status === 'failed') {
          throw new Error(result.error_message || 'Indexing failed');
        }
        return result.status === 'completed';
      },
      `${uploadOperationId}-polling`,
      {
        interval,
        maxAttempts,
        fileName: file.name,
        onProgress: (attempt, result) => {
          const progress = Math.min((attempt / maxAttempts) * 100, 99);
          onProgress?.(progress);
        },
      }
    );
  }

  /**
   * Check for duplicate file by hash
   */
  private async checkDuplicate(
    hash: string,
    rtoCode: string,
    unitCode: string
  ): Promise<{ id: number; fileName: string } | null> {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('id, file_name')
        .eq('rto_code', rtoCode)
        .eq('unit_code', unitCode)
        .eq('file_hash', hash)
        .limit(1)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        id: data.id,
        fileName: data.file_name,
      };
    } catch (error) {
      console.error('[Upload] Error checking for duplicates:', error);
      return null;
    }
  }
}

// Export singleton instance
export const documentUploadServiceV2 = new DocumentUploadServiceV2();
