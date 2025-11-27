import { supabase } from '../lib/supabase';

export interface UploadProgress {
  stage: 'pending' | 'uploading' | 'completed' | 'failed';
  progress: number; // 0-100
  message: string;
  documentId?: number;
  error?: string;
}

export interface UploadResult {
  documentId: number;
  fileName: string;
  storagePath: string;
}

/**
 * Simplified Document Upload Service
 * 
 * New Flow:
 * 1. Upload file to Supabase Storage
 * 2. Create document record in DB
 * 3. DB trigger automatically handles:
 *    - Gemini indexing
 *    - Validation triggering
 *    - Status updates
 * 
 * The Dashboard polls for status updates.
 * On failure, user can retry using the same document.
 */
export class DocumentUploadServiceSimplified {
  
  /**
   * Upload a file - simple and fast
   */
  async uploadDocument(
    file: File,
    rtoCode: string,
    unitCode: string,
    documentType: 'assessment' | 'unit_requirement' | 'training_package' | 'other',
    validationDetailId?: number,
    onProgress?: (progress: UploadProgress) => void
  ): Promise<UploadResult> {
    try {
      console.log('[Upload] Starting upload for:', file.name, 'Size:', file.size, 'bytes');
      
      // Stage 1: Upload to Supabase Storage
      onProgress?.({
        stage: 'uploading',
        progress: 10,
        message: 'Uploading to storage...',
      });

      // Simulate progress during storage upload
      const progressInterval = setInterval(() => {
        onProgress?.({
          stage: 'uploading',
          progress: Math.min(90, Math.random() * 20 + 50),
          message: 'Uploading to storage...',
        });
      }, 500);

      try {
        const storagePath = await this.uploadToStorage(file, rtoCode, unitCode);
        clearInterval(progressInterval);
        console.log('[Upload] File uploaded to storage:', storagePath);

        // Stage 1.5: Creating document record
        onProgress?.({
          stage: 'uploading',
          progress: 95,
          message: 'Creating document record...',
        });

        // Stage 2: Trigger indexing in background (fast)
        const documentId = await this.triggerIndexingBackground(
          file.name,
          storagePath,
          rtoCode,
          unitCode,
          documentType,
          validationDetailId
        );

        // Done! User can continue working
        onProgress?.({
          stage: 'completed',
          progress: 100,
          message: 'Upload complete - processing in background',
        });

        return {
          documentId: documentId || 0,
          fileName: file.name,
          storagePath,
        };
      } catch (innerError) {
        clearInterval(progressInterval);
        throw innerError;
      }

    } catch (error) {
      console.error('[Upload] Error:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      
      onProgress?.({
        stage: 'failed',
        progress: 0,
        message: errorMessage,
        error: errorMessage,
      });

      throw error;
    }
  }

  /**
   * Upload file to Supabase Storage
   */
  private async uploadToStorage(
    file: File,
    rtoCode: string,
    unitCode: string
  ): Promise<string> {
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${rtoCode}/${unitCode}/${timestamp}_${sanitizedFileName}`;

    console.log('[Upload] Starting storage upload:', storagePath);
    console.log('[Upload] File size:', file.size, 'bytes', `(${(file.size / 1024).toFixed(2)} KB)`);

    const startTime = Date.now();

    const { data, error } = await supabase.storage
      .from('documents')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    const duration = Date.now() - startTime;
    console.log(`[Upload] Storage upload took ${duration}ms`);

    if (error) {
      console.error('[Upload] Storage error:', error);
      console.error('[Upload] Error details:', JSON.stringify(error, null, 2));
      throw new Error(`Failed to upload file: ${error.message}`);
    }

    if (!data) {
      throw new Error('Upload succeeded but no data returned');
    }

    console.log('[Upload] Storage upload successful:', data.path);
    return data.path;
  }

  /**
   * Create document record and trigger background indexing (fast, non-blocking)
   */
  private async triggerIndexingBackground(
    fileName: string,
    storagePath: string,
    rtoCode: string,
    unitCode: string,
    documentType: string,
    validationDetailId?: number
  ): Promise<number | null> {
    console.log('[Upload] Creating document record (fast path)...');
    console.log('[Upload] validationDetailId:', validationDetailId);
    
    // Use new function name to bypass CDN cache
    const { data, error } = await supabase.functions.invoke('create-document-fast', {
      body: {
        rtoCode,
        unitCode,
        documentType,
        fileName,
        storagePath,
        validationDetailId,
      },
    });
    
    if (error) {
      console.error('[Upload] create-document-fast error:', error);
      
      // Fallback to upload-document-async if still having issues
      console.warn('[Upload] Falling back to upload-document-async...');
      
      const fallbackPayload: Record<string, any> = {
        rtoCode,
        unitCode,
        documentType,
        fileName,
        storagePath,
      };
      
      if (validationDetailId) {
        fallbackPayload.validationDetailId = validationDetailId;
      }
      
      const { data: fallbackData, error: fallbackError } = await supabase.functions.invoke('upload-document-async', {
        body: fallbackPayload,
      });
      
      if (fallbackError) {
        console.error('[Upload] Fallback also failed:', fallbackError);
        throw new Error(`Failed to create document: ${fallbackError.message}`);
      }
      
      console.log('[Upload] Fallback successful:', fallbackData);
      return fallbackData?.document?.id || fallbackData?.documentId || null;
    }
    
    console.log('[Upload] Document record created successfully (fast path):', data);
    
    // Don't trigger n8n here - let the component trigger it once after ALL documents are uploaded
    // This prevents multiple n8n calls for each document
    
    return data?.document?.id || null;
  }

  /**
   * Retry indexing for a failed document
   * Simply updates the status to trigger the DB trigger again
   */
  async retryIndexing(documentId: number): Promise<void> {
    const { error } = await supabase
      .from('document')
      .update({
        embedding_status: 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    if (error) {
      console.error('[Upload] Retry error:', error);
      throw new Error(`Failed to retry indexing: ${error.message}`);
    }

    console.log('[Upload] Retry triggered for document:', documentId);
  }
}

// Export singleton instance
export const documentUploadService = new DocumentUploadServiceSimplified();
