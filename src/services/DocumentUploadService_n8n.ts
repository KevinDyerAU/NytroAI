import { supabase } from '../lib/supabase';

export interface UploadProgress {
  stage: 'pending' | 'uploading' | 'processing' | 'completed' | 'failed';
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
 * Simplified Document Upload Service for n8n Integration
 * 
 * New Flow (Simplified):
 * 1. Upload file to Supabase Storage
 * 2. Create document record in DB
 * 3. Call n8n webhook to trigger document processing
 * 4. n8n uploads to Gemini File API and updates document record
 * 
 * No more:
 * - Edge function complexity
 * - Gemini File Search Stores
 * - Database triggers
 * - Operation polling
 */
export class DocumentUploadServiceN8n {
  private n8nWebhookUrl: string;

  constructor() {
    // Get n8n webhook URL from environment
    this.n8nWebhookUrl = import.meta.env.VITE_N8N_DOCUMENT_PROCESSING_URL || '';
    
    if (!this.n8nWebhookUrl) {
      console.warn('[Upload] N8N_DOCUMENT_PROCESSING_URL not configured');
    }
  }

  /**
   * Upload a file - simple and fast
   */
  async uploadDocument(
    file: File,
    rtoCode: string,
    unitCode: string,
    documentType: 'assessment' | 'unit_requirement' | 'training_package' | 'other',
    validationDetailId?: number,
    onProgress?: (progress: UploadProgress) => void,
    abortSignal?: AbortSignal
  ): Promise<UploadResult> {
    try {
      console.log('[Upload] Starting upload for:', file.name, 'Size:', file.size, 'bytes');
      
      // Stage 1: Upload to Supabase Storage (0-70%)
      onProgress?.({
        stage: 'uploading',
        progress: 10,
        message: 'Uploading to storage...',
      });

      const storagePath = await this.uploadToStorage(
        file, 
        rtoCode, 
        unitCode, 
        onProgress,
        abortSignal
      );
      
      console.log('[Upload] File uploaded to storage:', storagePath);

      // Stage 2: Create document record (70-80%)
      onProgress?.({
        stage: 'uploading',
        progress: 75,
        message: 'Creating document record...',
      });

      const documentId = await this.createDocumentRecord(
        file.name,
        storagePath,
        rtoCode,
        unitCode,
        documentType,
        validationDetailId
      );

      console.log('[Upload] Document record created:', documentId);

      // Stage 3: Trigger n8n processing (80-100%)
      onProgress?.({
        stage: 'processing',
        progress: 85,
        message: 'Starting AI processing...',
      });

      await this.triggerN8nProcessing(validationDetailId!, [storagePath]);

      console.log('[Upload] n8n processing triggered');

      // Done!
      onProgress?.({
        stage: 'completed',
        progress: 100,
        message: 'Upload complete - AI processing started',
        documentId,
      });

      return {
        documentId,
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
   * Upload multiple files
   */
  async uploadDocuments(
    files: File[],
    rtoCode: string,
    unitCode: string,
    documentType: 'assessment' | 'unit_requirement' | 'training_package' | 'other',
    validationDetailId?: number,
    onProgress?: (fileIndex: number, progress: UploadProgress) => void,
    abortSignal?: AbortSignal
  ): Promise<UploadResult[]> {
    const results: UploadResult[] = [];
    const storagePaths: string[] = [];

    try {
      // Upload all files to storage and create records
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        onProgress?.(i, {
          stage: 'uploading',
          progress: 0,
          message: `Uploading file ${i + 1} of ${files.length}...`,
        });

        // Upload to storage
        const storagePath = await this.uploadToStorage(
          file,
          rtoCode,
          unitCode,
          (progress) => {
            onProgress?.(i, {
              ...progress,
              message: `Uploading file ${i + 1} of ${files.length}... ${progress.message}`,
            });
          },
          abortSignal
        );

        storagePaths.push(storagePath);

        // Create document record
        const documentId = await this.createDocumentRecord(
          file.name,
          storagePath,
          rtoCode,
          unitCode,
          documentType,
          validationDetailId
        );

        results.push({ documentId, storagePath });

        onProgress?.(i, {
          stage: 'completed',
          progress: 100,
          message: `File ${i + 1} of ${files.length} uploaded`,
          documentId,
        });
      }

      // Trigger n8n processing for all files at once
      if (validationDetailId && storagePaths.length > 0) {
        await this.triggerN8nProcessing(validationDetailId, storagePaths);
      }

      return results;

    } catch (error) {
      console.error('[Upload] Batch upload error:', error);
      throw error;
    }
  }

  /**
   * Upload file to Supabase Storage
   */
  private async uploadToStorage(
    file: File,
    rtoCode: string,
    unitCode: string,
    onProgress?: (progress: UploadProgress) => void,
    abortSignal?: AbortSignal
  ): Promise<string> {
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${rtoCode}/${unitCode}/${timestamp}_${sanitizedFileName}`;

    console.log('[Upload] Starting storage upload:', storagePath);
    console.log('[Upload] File size:', file.size, 'bytes', `(${(file.size / 1024 / 1024).toFixed(2)} MB)`);

    // Simulate progress during upload
    const progressInterval = setInterval(() => {
      onProgress?.({
        stage: 'uploading',
        progress: Math.min(65, Math.random() * 20 + 30),
        message: 'Uploading to storage...',
      });
    }, 500);

    try {
      const startTime = Date.now();

      const { data, error } = await supabase.storage
        .from('documents')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      clearInterval(progressInterval);

      const duration = Date.now() - startTime;
      console.log(`[Upload] Storage upload took ${duration}ms`);

      if (error) {
        console.error('[Upload] Storage error:', error);
        throw new Error(`Failed to upload file: ${error.message}`);
      }

      if (!data) {
        throw new Error('Upload succeeded but no data returned');
      }

      console.log('[Upload] Storage upload successful:', data.path);
      
      onProgress?.({
        stage: 'uploading',
        progress: 70,
        message: 'Upload complete',
      });

      return data.path;

    } catch (error) {
      clearInterval(progressInterval);
      throw error;
    }
  }

  /**
   * Create document record in database
   */
  private async createDocumentRecord(
    fileName: string,
    storagePath: string,
    rtoCode: string,
    unitCode: string,
    documentType: string,
    validationDetailId?: number
  ): Promise<number> {
    console.log('[Upload] Creating document record...');

    const documentData: any = {
      file_name: fileName,
      storage_path: storagePath,
      document_type: documentType,
      rto_code: rtoCode,
      unit_code: unitCode,
    };

    if (validationDetailId) {
      documentData.validation_detail_id = validationDetailId;
    }

    const { data, error } = await supabase
      .from('documents')
      .insert(documentData)
      .select('id')
      .single();

    if (error) {
      console.error('[Upload] Database error:', error);
      throw new Error(`Failed to create document record: ${error.message}`);
    }

    if (!data) {
      throw new Error('Document record created but no ID returned');
    }

    console.log('[Upload] Document record created with ID:', data.id);
    return data.id;
  }

  /**
   * Trigger n8n document processing workflow
   */
  private async triggerN8nProcessing(
    validationDetailId: number,
    storagePaths: string[]
  ): Promise<void> {
    if (!this.n8nWebhookUrl) {
      console.warn('[Upload] n8n webhook URL not configured, skipping processing trigger');
      return;
    }

    console.log('[Upload] Triggering n8n processing for validation:', validationDetailId);
    console.log('[Upload] Storage paths:', storagePaths);

    try {
      const response = await fetch(this.n8nWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          validation_detail_id: validationDetailId,
          storage_paths: storagePaths,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Upload] n8n webhook error:', response.status, errorText);
        throw new Error(`n8n webhook failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      console.log('[Upload] n8n processing triggered successfully:', result);

    } catch (error) {
      console.error('[Upload] Failed to trigger n8n processing:', error);
      // Don't throw - files are uploaded, processing can be retried later
      console.warn('[Upload] Files uploaded successfully, but processing trigger failed. User can retry from dashboard.');
    }
  }

  /**
   * Retry processing for failed documents
   */
  async retryProcessing(validationDetailId: number): Promise<void> {
    if (!this.n8nWebhookUrl) {
      throw new Error('n8n webhook URL not configured');
    }

    console.log('[Upload] Retrying processing for validation:', validationDetailId);

    // Get all storage paths for this validation
    const { data: documents, error } = await supabase
      .from('documents')
      .select('storage_path')
      .eq('validation_detail_id', validationDetailId);

    if (error) {
      throw new Error(`Failed to fetch documents: ${error.message}`);
    }

    if (!documents || documents.length === 0) {
      throw new Error('No documents found for this validation');
    }

    const storagePaths = documents.map(doc => doc.storage_path);

    // Trigger n8n processing
    await this.triggerN8nProcessing(validationDetailId, storagePaths);
  }
}

// Export singleton instance
export const documentUploadServiceN8n = new DocumentUploadServiceN8n();
