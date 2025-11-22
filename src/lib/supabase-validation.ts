import { supabase } from './supabase';

interface ValidationPayload {
  validationId: number;
  rtoCode: string;
  unitCode: string;
  validationType: string;
  files: Array<{
    name: string;
    path: string;
    url: string;
  }>;
}

/**
 * Upload files to Supabase Storage
 */
export async function uploadFilesToSupabase(
  files: Array<{ name: string; file: File }>,
  rtoCode: string,
  unitCode: string,
  validationType: string
): Promise<Array<{ name: string; path: string; url: string }>> {
  const uploadedFiles: Array<{ name: string; path: string; url: string }> = [];
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const folderPath = `${rtoCode}/${unitCode}/${validationType}/${timestamp}`;

  for (const { name, file } of files) {
    const filePath = `${folderPath}/${name}`;
    
    console.log(`[Supabase Upload] Uploading ${name} to ${filePath}...`);

    const { data, error } = await supabase.storage
      .from('documents')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error(`[Supabase Upload] Error uploading ${name}:`, error);
      throw new Error(`Failed to upload ${name}: ${error.message}`);
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('documents')
      .getPublicUrl(filePath);

    console.log(`[Supabase Upload] ${name} uploaded successfully to ${publicUrl}`);

    uploadedFiles.push({
      name,
      path: filePath,
      url: publicUrl,
    });
  }

  return uploadedFiles;
}

/**
 * Call Supabase Edge Function to upload documents to Gemini File Search
 */
export async function startValidationWithGemini(
  validationId: number,
  rtoCode: string,
  unitCode: string,
  validationType: string,
  uploadedFiles: Array<{ name: string; path: string; url: string }>
): Promise<void> {
  console.log('[Supabase Validation] Starting validation with Gemini...');
  console.log('[Supabase Validation] Validation ID:', validationId);
  console.log('[Supabase Validation] Unit Code:', unitCode);
  console.log('[Supabase Validation] Files:', uploadedFiles.length);

  try {
    // Process documents to Gemini File Search via Edge Function (async)
    const documentType = validationType === 'LearnerGuide' ? 'training_package' : 'assessment';

    let firstFileSearchStoreId: string | null = null;

    for (let i = 0; i < uploadedFiles.length; i++) {
      const uploadedFile = uploadedFiles[i];
      const fileNumber = i + 1;
      const totalFiles = uploadedFiles.length;

      console.log(`[Supabase Validation] Processing File ${fileNumber}/${totalFiles}: ${uploadedFile.name}`);
      console.log(`[Supabase Validation] Uploading to Gemini File Search API (synchronous)...`);

      const invokePayload = {
        rtoCode,
        unitCode,
        documentType,
        fileName: uploadedFile.name,
        storagePath: uploadedFile.path,
        displayName: uploadedFile.name,
        metadata: {
          validation_detail_id: validationId.toString(),
          validation_type: validationType,
          uploaded_at: new Date().toISOString(),
          storage_path: uploadedFile.path,
          file_number: fileNumber,
          total_files: totalFiles,
        },
      };

      console.log(`[Supabase Validation] Calling upload-document Edge Function...`);
      const startTime = Date.now();

      // Call Edge Function synchronously and wait for response
      const { data: uploadResponse, error: uploadError } = await supabase.functions.invoke(
        'upload-document',
        { body: invokePayload }
      );

      const duration = Date.now() - startTime;
      console.log(`[Supabase Validation] Edge Function returned after ${duration}ms`);

      if (uploadError) {
        console.error(`[Supabase Validation] ❌ Upload error for ${uploadedFile.name}:`, uploadError);
        throw new Error(`Failed to upload ${uploadedFile.name}: ${uploadError.message}`);
      }

      if (!uploadResponse?.document) {
        console.error(`[Supabase Validation] ❌ Invalid response (no document):`, uploadResponse);
        throw new Error(`Invalid response from upload-document for ${uploadedFile.name}`);
      }

      console.log(`[Supabase Validation] ✓ File ${fileNumber}/${totalFiles} uploaded successfully`);
      console.log(`[Supabase Validation] Document ID: ${uploadResponse.document.id}`);
      console.log(`[Supabase Validation] File Search Store: ${uploadResponse.document.file_search_store_id}`);

      // Store the first file search store ID
      if (!firstFileSearchStoreId && uploadResponse.document.file_search_store_id) {
        firstFileSearchStoreId = uploadResponse.document.file_search_store_id;
      }
    }

    // Update validation_detail with file search store ID
    if (firstFileSearchStoreId) {
      console.log(`[Supabase Validation] Updating validation with File Search Store ID...`);
      const { error: updateError } = await supabase
        .from('validation_detail')
        .update({
          file_search_store_id: firstFileSearchStoreId,
          docExtracted: true,
          extractStatus: 'DocumentsUploaded',
        })
        .eq('id', validationId);

      if (updateError) {
        console.error('[Supabase Validation] Error updating validation_detail:', updateError);
        throw new Error(`Failed to update validation: ${updateError.message}`);
      }
    } else {
      throw new Error('No file search store ID returned from Gemini');
    }

    console.log('[Supabase Validation] ✓ All documents processed and uploaded to Gemini successfully');
    console.log('[Supabase Validation] ✓ Validation ready for processing');
  } catch (error) {
    console.error('[Supabase Validation] Error during Gemini processing:', error);

    // Update validation status to failed
    const { error: failError } = await supabase
      .from('validation_detail')
      .update({
        extractStatus: 'Failed',
      })
      .eq('id', validationId);

    if (failError) {
      console.error('[Supabase Validation] Error updating failure status:', failError);
    }

    throw error;
  }
}

/**
 * Trigger validation after documents are uploaded and indexed
 */
export async function triggerValidation(validationDetailId: number): Promise<void> {
  console.log('[Trigger Validation] Starting validation for validation detail:', validationDetailId);

  try {
    const { data, error } = await supabase.functions.invoke('trigger-validation', {
      body: {
        validationDetailId,
      },
    });

    if (error) {
      console.error('[Trigger Validation] Error:', error);
      throw new Error(`Failed to trigger validation: ${error.message}`);
    }

    console.log('[Trigger Validation] Validation triggered successfully:', data);
  } catch (error) {
    console.error('[Trigger Validation] Error triggering validation:', error);
    throw error;
  }
}

export function createFolderName(rtoCode: string, unitCode: string, validationType: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  return `${rtoCode}/${unitCode}/${validationType}/${timestamp}`;
}

export function createPineconeNamespace(folderName: string): string {
  return folderName.replace(/\//g, '_');
}
