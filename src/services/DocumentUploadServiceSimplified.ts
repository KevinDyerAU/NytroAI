import { supabase } from '../lib/supabase';

export interface UploadProgress {
  stage: 'uploading' | 'completed' | 'failed';
  progress: number; // 0-100
  message: string;
  documentId?: number;
  error?: string;
}

export interface UploadResult {
  documentId: number;
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
      // Stage 1: Upload to Supabase Storage
      onProgress?.({
        stage: 'uploading',
        progress: 30,
        message: 'Uploading file...',
      });

      const storagePath = await this.uploadToStorage(file, rtoCode, unitCode);
      console.log('[Upload] File uploaded to storage:', storagePath);

      // Done! User can continue working
      onProgress?.({
        stage: 'completed',
        progress: 100,
        message: 'Upload complete - processing in background',
      });

      // Stage 2: Trigger indexing in background (fire-and-forget)
      // This creates document record + gemini_operation
      // DB trigger will handle validation automatically
      // We don't wait for this to complete
      this.triggerIndexingBackground(
        file.name,
        storagePath,
        rtoCode,
        unitCode,
        documentType,
        validationDetailId
      ).catch(error => {
        console.error('[Upload] Background indexing failed:', error);
        // Error will be visible in Dashboard, no need to notify user here
      });

      return {
        documentId: 0, // Will be assigned by edge function
        storagePath,
      };

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

    const { data, error } = await supabase.storage
      .from('documents')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('[Upload] Storage error:', error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }

    if (!data) {
      throw new Error('Upload succeeded but no data returned');
    }

    return data.path;
  }

  /**
   * Trigger indexing in background (fire-and-forget)
   * This creates document record + gemini_operation
   * DB trigger will automatically validate when indexing completes
   */
  private async triggerIndexingBackground(
    fileName: string,
    storagePath: string,
    rtoCode: string,
    unitCode: string,
    documentType: string,
    validationDetailId?: number
  ): Promise<number> {
    const { data, error } = await supabase.functions.invoke('upload-document', {
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
      console.error('[Upload] Edge function error:', error);
      throw new Error(`Failed to trigger indexing: ${error.message}`);
    }

    console.log('[Upload] Background indexing triggered successfully');
    // Don't return anything - this is fire-and-forget
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
