/**
 * Upload Files to Storage Edge Function
 * 
 * This function handles file uploads for Azure-based validation:
 * 1. Receives base64-encoded files from frontend
 * 2. Uploads to Supabase Storage 'documents' bucket
 * 3. Creates document records in 'documents' table
 * 4. Returns uploaded file info for validation trigger
 * 
 * Used with AI_PROVIDER=azure for Azure Document Intelligence + OpenAI flow.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { handleCors, createErrorResponse, createSuccessResponse } from '../_shared/cors.ts';

interface FileToUpload {
  name: string;
  base64Content: string;
}

interface UploadFilesRequest {
  rtoCode: string;
  unitCode: string;
  validationType: string;
  files: FileToUpload[];
  validationDetailId?: number;
}

serve(async (req) => {
  const startTime = Date.now();
  console.log('[upload-files-to-storage] START', new Date().toISOString());

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCors(req);
  }

  try {
    const requestData: UploadFilesRequest = await req.json();
    const { rtoCode, unitCode, validationType, files, validationDetailId } = requestData;

    console.log('[upload-files-to-storage] Request:', {
      rtoCode,
      unitCode,
      validationType,
      fileCount: files?.length,
      validationDetailId
    });

    // Validate request
    if (!rtoCode || !unitCode || !files || files.length === 0) {
      return createErrorResponse('Missing required fields: rtoCode, unitCode, files', 400);
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get or find validation_detail_id
    let detailId = validationDetailId;
    
    if (!detailId) {
      // Try to find the most recent validation_detail for this rto/unit
      const { data: recentDetail } = await supabase
        .from('validation_detail')
        .select('id, validation_summary!inner(rtoCode, unitCode)')
        .eq('validation_summary.rtoCode', rtoCode)
        .eq('validation_summary.unitCode', unitCode)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (recentDetail) {
        detailId = recentDetail.id;
        console.log('[upload-files-to-storage] Found recent validation_detail:', detailId);
      }
    }

    if (!detailId) {
      return createErrorResponse('No validation_detail_id provided and none found for this unit', 400);
    }

    const uploadedFiles: any[] = [];
    const folderPath = `${rtoCode}/${unitCode}/${detailId}`;

    for (const file of files) {
      try {
        console.log(`[upload-files-to-storage] Processing: ${file.name}`);

        // Decode base64 content
        const binaryString = atob(file.base64Content);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const storagePath = `${folderPath}/${file.name}`;

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('documents')
          .upload(storagePath, bytes, {
            contentType: 'application/pdf',
            upsert: true
          });

        if (uploadError) {
          console.error(`[upload-files-to-storage] Upload failed for ${file.name}:`, uploadError);
          throw uploadError;
        }

        console.log(`[upload-files-to-storage] Uploaded to storage: ${storagePath}`);

        // Create document record in database
        const { data: docRecord, error: docError } = await supabase
          .from('documents')
          .insert({
            file_name: file.name,
            storage_path: storagePath,
            validation_detail_id: detailId,
            embedding_status: 'pending',
            uploaded_at: new Date().toISOString()
          })
          .select()
          .single();

        if (docError) {
          console.error(`[upload-files-to-storage] Failed to create document record:`, docError);
          throw docError;
        }

        console.log(`[upload-files-to-storage] Created document record: ${docRecord.id}`);

        uploadedFiles.push({
          id: docRecord.id,
          name: file.name,
          path: storagePath,
          size: bytes.length
        });

      } catch (fileError: any) {
        console.error(`[upload-files-to-storage] Error processing ${file.name}:`, fileError);
        // Continue with other files
      }
    }

    if (uploadedFiles.length === 0) {
      return createErrorResponse('Failed to upload any files', 500);
    }

    const elapsedMs = Date.now() - startTime;
    console.log(`[upload-files-to-storage] Complete. Uploaded ${uploadedFiles.length} files in ${elapsedMs}ms`);

    return createSuccessResponse({
      success: true,
      uploadedFiles,
      validationDetailId: detailId,
      elapsedMs
    });

  } catch (error: any) {
    console.error('[upload-files-to-storage] Error:', error);
    return createErrorResponse(error.message || 'Internal server error', 500);
  }
});
