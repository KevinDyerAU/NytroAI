import { supabase } from '../lib/supabase';

export interface UploadProgress {
  stage: 'pending' | 'uploading' | 'completed' | 'failed';
  progress: number; // 0-100
  message: string;
  documentId?: number;
  error?: string;
}

export interface UploadResult {
  fileName: string;
  storagePath: string;
}

/**
 * Simplified Document Upload Service
 * 
 * Correct Flow:
 * 1. Upload file to Supabase Storage ONLY
 * 2. After ALL files uploaded, parent triggers n8n with validation_detail_id + storage_paths
 * 3. n8n workflow:
 *    - Creates document records in DB
 *    - Uploads files to Gemini
 *    - Updates document status to 'processing'/'completed'
 *    - Triggers validation when all done
 * 
 * The Dashboard polls for status updates.
 */
export class DocumentUploadServiceSimplified {
  
  /**
   * Upload a file to storage - returns storage path
   * Document record creation and Gemini upload happens in n8n
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
      console.log('[Upload] Starting storage upload for:', file.name, 'Size:', file.size, 'bytes');
      
      // Upload to Supabase Storage
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
        console.log('[Upload] ✅ File uploaded to storage:', storagePath);

        // Done! File in storage, n8n will create document record
        onProgress?.({
          stage: 'completed',
          progress: 100,
          message: 'Upload complete',
        });

        return {
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
