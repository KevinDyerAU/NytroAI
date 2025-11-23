import { supabase } from '../lib/supabase';

export interface UploadProgress {
  stage: 'ready' | 'uploading' | 'indexing' | 'validating' | 'completed' | 'failed';
  progress: number; // 0-100
  message: string;
  documentId?: number;
  operationId?: number;
  error?: string;
}

export interface UploadResult {
  documentId: number;
  operationId: number;
  fileSearchStoreId: string;
}

/**
 * Document Upload Service
 * 
 * Handles the complete document upload and validation flow:
 * 1. Upload file to Supabase Storage
 * 2. Trigger Gemini indexing via edge function
 * 3. Poll operation status until complete
 * 4. Trigger validation when ready
 * 
 * All operations are async with proper progress tracking.
 */
export class DocumentUploadService {
  private pollInterval = 2000; // 2 seconds
  private maxPollAttempts = 150; // 5 minutes max (150 * 2s)

  /**
   * Upload a file and track progress
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
      // Stage 1: Upload to Supabase Storage
      onProgress?.({
        stage: 'uploading',
        progress: 10,
        message: 'Uploading file to storage...',
      });

      const storagePath = await this.uploadToStorage(file, rtoCode, unitCode);
      console.log('[Upload] File uploaded to storage, path:', storagePath);

      // Verify file exists in storage
      const { data: fileList, error: listError } = await supabase.storage
        .from('documents')
        .list(storagePath.substring(0, storagePath.lastIndexOf('/')));
      
      if (listError) {
        console.error('[Upload] Error verifying file in storage:', listError);
      } else {
        console.log('[Upload] Files in storage:', fileList?.map(f => f.name));
      }

      onProgress?.({
        stage: 'uploading',
        progress: 30,
        message: 'File uploaded to storage',
      });

      // Stage 2: Trigger Gemini indexing
      onProgress?.({
        stage: 'indexing',
        progress: 40,
        message: 'Starting document indexing...',
      });

      const { documentId, operationId, fileSearchStoreId } = await this.triggerIndexing(
        file.name,
        storagePath,
        rtoCode,
        unitCode,
        documentType,
        validationDetailId
      );

      onProgress?.({
        stage: 'indexing',
        progress: 50,
        message: 'Indexing in progress...',
        documentId,
        operationId,
      });

      // Stage 3: Poll operation status
      await this.pollOperationStatus(operationId, (pollProgress) => {
        onProgress?.({
          stage: 'indexing',
          progress: 50 + (pollProgress * 0.4), // 50% to 90%
          message: `Indexing document... ${Math.floor(pollProgress)}%`,
          documentId,
          operationId,
        });
      });

      onProgress?.({
        stage: 'completed',
        progress: 100,
        message: 'Document indexed successfully',
        documentId,
        operationId,
      });

      return { documentId, operationId, fileSearchStoreId };
    } catch (error) {
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
    console.log('[Upload] uploadToStorage called');
    console.log('[Upload] File details:', {
      name: file.name,
      size: file.size,
      type: file.type
    });
    
    const timestamp = Date.now();
    const fileExt = file.name.split('.').pop();
    const fileName = `${timestamp}.${fileExt}`;
    const storagePath = `${rtoCode}/${unitCode}/${fileName}`;
    
    console.log('[Upload] Uploading to storage path:', storagePath);
    console.log('[Upload] Calling supabase.storage.upload...');

    const { data, error } = await supabase.storage
      .from('documents')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    console.log('[Upload] Storage upload completed');
    console.log('[Upload] Upload result:', { data, error });

    if (error) {
      console.error('[Upload] Storage upload error:', error);
      throw new Error(`Storage upload failed: ${error.message}`);
    }

    console.log('[Upload] Storage upload successful, path:', data.path);
    return data.path;
  }

  /**
   * Trigger Gemini indexing via edge function
   */
  private async triggerIndexing(
    fileName: string,
    storagePath: string,
    rtoCode: string,
    unitCode: string,
    documentType: string,
    validationDetailId?: number
  ): Promise<{ documentId: number; operationId: number; fileSearchStoreId: string }> {
    const { data, error } = await supabase.functions.invoke('upload-document-async', {
      body: {
        rtoCode,
        unitCode,
        documentType,
        fileName,
        storagePath,
        displayName: fileName,
        metadata: {},
        validationDetailId,
      },
    });

    if (error) {
      console.error('[Upload] Edge function error:', error);
      console.error('[Upload] Error details:', JSON.stringify(error, null, 2));
      
      // Try to extract the actual error message from the response
      let errorMessage = error.message || 'Unknown error';
      
      // Try to get response body if available
      if (error.context && error.context instanceof Response) {
        try {
          const responseText = await error.context.text();
          console.error('[Upload] Edge function response body:', responseText);
          
          try {
            const responseJson = JSON.parse(responseText);
            errorMessage = responseJson.error || responseJson.message || responseText;
            console.error('[Upload] Parsed error:', errorMessage);
          } catch {
            errorMessage = responseText;
          }
        } catch (e) {
          console.error('[Upload] Could not read response body:', e);
        }
      }
      
      console.error('[Upload] Final error message:', errorMessage);
      throw new Error(`Failed to trigger indexing: ${errorMessage}`);
    }
    
    if (!data) {
      console.error('[Upload] No data returned from edge function');
      throw new Error('Failed to trigger indexing: No response data');
    }

    if (!data?.document?.id || !data?.operation?.id) {
      throw new Error('Invalid response from upload service');
    }

    return {
      documentId: data.document.id,
      operationId: data.operation.id,
      fileSearchStoreId: data.document.fileSearchStoreId,
    };
  }

  /**
   * Poll operation status until complete
   */
  private async pollOperationStatus(
    operationId: number,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    let attempts = 0;
    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 5;

    console.log(`[Upload] Starting to poll operation ${operationId}, max attempts: ${this.maxPollAttempts}`);

    while (attempts < this.maxPollAttempts) {
      await this.sleep(this.pollInterval);
      attempts++;

      try {
        console.log(`[Upload] Poll attempt ${attempts}/${this.maxPollAttempts} for operation ${operationId}`);

        const { data, error } = await supabase.functions.invoke('check-operation-status', {
          body: { operationId },
        });

        if (error) {
          consecutiveErrors++;
          console.error(`[Upload] Error checking operation status (consecutive error ${consecutiveErrors}/${maxConsecutiveErrors}):`, error);
          
          // Fail fast after multiple consecutive errors
          if (consecutiveErrors >= maxConsecutiveErrors) {
            throw new Error(
              `❌ Unable to check indexing status after ${maxConsecutiveErrors} attempts. ` +
              `Error: ${error.message}. The 'check-operation-status' edge function may not be deployed. ` +
              `Please check Supabase dashboard at https://supabase.com/dashboard`
            );
          }
          continue;
        }

        // Reset error counter on successful response
        consecutiveErrors = 0;

        const operation = data?.operation;
        if (!operation) {
          console.error('[Upload] Invalid operation response:', data);
          throw new Error('⚠️ Invalid operation status response - operation data missing');
        }

        console.log(`[Upload] Operation ${operationId} status:`, {
          status: operation.status,
          progress: operation.progress || 0,
          error: operation.error,
          attempts: attempts
        });

        onProgress?.(operation.progress || 0);

        if (operation.status === 'completed') {
          console.log(`[Upload] ✅ Operation ${operationId} completed successfully after ${attempts} attempts (${attempts * this.pollInterval / 1000}s)`);
          return;
        }

        if (operation.status === 'failed' || operation.status === 'timeout') {
          const errorMsg = operation.error || 'Unknown error occurred during indexing';
          console.error(`[Upload] ❌ Operation ${operationId} failed:`, errorMsg);
          throw new Error(`❌ Document indexing failed: ${errorMsg}`);
        }

        // Continue polling if status is 'processing' or 'pending'
      } catch (err) {
        // If we explicitly threw an error with emoji, re-throw it
        if (err instanceof Error && (err.message.includes('❌') || err.message.includes('⚠️'))) {
          throw err;
        }
        // Otherwise log and continue
        console.error('[Upload] Unexpected error in polling:', err);
        consecutiveErrors++;
        if (consecutiveErrors >= maxConsecutiveErrors) {
          throw new Error(`❌ Polling failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      }
    }

    const timeoutSeconds = this.maxPollAttempts * this.pollInterval / 1000;
    console.error(`[Upload] ⏱️ Operation ${operationId} timed out after ${attempts} attempts (${timeoutSeconds}s)`);
    throw new Error(
      `⏱️ Document indexing timeout: Exceeded ${timeoutSeconds}s waiting for completion. ` +
      `The operation may still be processing. Operation ID: ${operationId}. ` +
      `Please check the dashboard or try again later.`
    );
  }

  /**
   * Trigger validation after documents are indexed
   */
  async triggerValidation(validationDetailId: number): Promise<void> {
    const { data, error } = await supabase.functions.invoke('trigger-validation', {
      body: { validationDetailId },
    });

    if (error) {
      throw new Error(`Failed to trigger validation: ${error.message}`);
    }

    return data;
  }

  /**
   * Upload multiple files and track overall progress
   */
  async uploadMultipleDocuments(
    files: File[],
    rtoCode: string,
    unitCode: string,
    documentType: string,
    validationDetailId?: number,
    onProgress?: (fileIndex: number, progress: UploadProgress) => void
  ): Promise<UploadResult[]> {
    const results: UploadResult[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      const result = await this.uploadDocument(
        file,
        rtoCode,
        unitCode,
        documentType as any,
        validationDetailId,
        (progress) => onProgress?.(i, progress)
      );

      results.push(result);
    }

    return results;
  }

  /**
   * Get operation status from database (for UI polling)
   */
  async getOperationStatus(operationId: number) {
    const { data, error } = await supabase
      .from('gemini_operations')
      .select('*')
      .eq('id', operationId)
      .single();

    if (error) {
      throw new Error(`Failed to get operation status: ${error.message}`);
    }

    return data;
  }

  /**
   * Get document status from database
   */
  async getDocumentStatus(documentId: number) {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (error) {
      throw new Error(`Failed to get document status: ${error.message}`);
    }

    return data;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const documentUploadService = new DocumentUploadService();
