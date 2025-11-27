import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { handleCors, createErrorResponse, createSuccessResponse } from '../_shared/cors.ts';
import { createGeminiClient } from '../_shared/gemini.ts';

interface UploadDocumentRequest {
  rtoCode: string;
  unitCode?: string;
  documentType: 'assessment' | 'unit_requirement' | 'training_package' | 'other';
  fileName: string;
  fileContent?: string; // Base64 encoded (optional if storagePath provided)
  storagePath?: string; // Path in Supabase Storage (optional if fileContent provided)
  displayName?: string;
  metadata?: Record<string, string | number>;
  validationDetailId?: number; // Optional: for fetching session-specific namespace
}

serve(async (req) => {
  const startTime = Date.now();
  console.log('='.repeat(80));
  console.log('[upload-document] START', new Date().toISOString());
  console.log('[upload-document] Method:', req.method);
  
  // Handle CORS preflight requests
  const corsResponse = handleCors(req);
  if (corsResponse) {
    console.log('[upload-document] CORS preflight handled');
    return corsResponse;
  }

  try {
    // Parse request body
    const requestData: UploadDocumentRequest = await req.json();
    console.log('[upload-document] Request data:', JSON.stringify({
      rtoCode: requestData.rtoCode,
      unitCode: requestData.unitCode,
      documentType: requestData.documentType,
      fileName: requestData.fileName,
      hasFileContent: !!requestData.fileContent,
      storagePath: requestData.storagePath,
      metadataKeys: requestData.metadata ? Object.keys(requestData.metadata) : []
    }));
    const { rtoCode, unitCode, documentType, fileName, fileContent, storagePath, displayName, metadata, validationDetailId } =
      requestData;

    // Validate request
    if (!rtoCode || !documentType || !fileName) {
      return createErrorResponse(
        'Missing required fields: rtoCode, documentType, fileName'
      );
    }

    if (!fileContent && !storagePath) {
      return createErrorResponse(
        'Must provide either fileContent (base64) or storagePath'
      );
    }

    // Initialize Supabase client
    const supabase = createSupabaseClient(req);

    // Get RTO
    const { data: rto, error: rtoError } = await supabase
      .from('RTO')
      .select('id, code, legalname')
      .eq('code', rtoCode)
      .single();

    if (rtoError || !rto) {
      return createErrorResponse(`RTO not found: ${rtoCode}`);
    }

    // Fetch namespace from validation_detail if provided
    let namespace: string | null = null;
    if (validationDetailId) {
      const { data: validationDetail, error: vdError } = await supabase
        .from('validation_detail')
        .select('namespace_code')
        .eq('id', validationDetailId)
        .single();
      
      if (!vdError && validationDetail?.namespace_code) {
        namespace = validationDetail.namespace_code;
        console.log(`[upload-document] Fetched namespace from validation_detail: ${namespace}`);
      } else {
        console.warn(`[upload-document] Could not fetch namespace from validation_detail ${validationDetailId}`);
      }
    }

    // Initialize Gemini client with Supabase tracking
    const gemini = createGeminiClient({
      apiKey: Deno.env.get('GEMINI_API_KEY') || '',
      model: Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash',
      supabaseClient: supabase,
    });

    // Get or create File Search store
    // If validationDetailId provided: create dedicated per-validation store
    // Otherwise: use shared RTO store (legacy behavior)
    let storeName: string;
    let fileSearchStore;

    if (validationDetailId) {
      // NEW: Per-validation dedicated store (isolated, no filter needed)
      // Check validation_detail for existing store ID (saved from first upload)
      try {
        const { data: validationDetail } = await supabase
          .from('validation_detail')
          .select('file_search_store_id, file_search_store_name')
          .eq('id', validationDetailId)
          .single();

        if (validationDetail?.file_search_store_id) {
          // Reuse existing store from validation_detail
          // Trust the database - don't verify with Gemini (avoids race condition)
          fileSearchStore = {
            name: validationDetail.file_search_store_id,
            displayName: validationDetail.file_search_store_name,
          };
          storeName = validationDetail.file_search_store_name || 'unknown';
          console.log(`♻️ Reusing store from validation_detail: ${storeName}`);
          console.log(`   Store ID: ${fileSearchStore.name}`);
        } else {
          // First file - create new store and save ID to validation_detail
          storeName = `validation${validationDetailId}${unitCode?.toLowerCase() || 'unknown'}${Date.now()}`;
          console.log(`Creating first store for validation ${validationDetailId}: ${storeName}`);
          fileSearchStore = await gemini.createFileSearchStore(storeName);
          console.log(`✅ Created new store: ${fileSearchStore.name}`);
          console.log(`   Display name returned by Gemini: ${fileSearchStore.displayName}`);
          
          // Save store ID to validation_detail for reuse
          await supabase
            .from('validation_detail')
            .update({
              file_search_store_id: fileSearchStore.name,
              file_search_store_name: fileSearchStore.displayName,
            })
            .eq('id', validationDetailId);
          
          console.log(`✅ Saved store ID to validation_detail`);
        }
      } catch (error) {
        console.error('Error managing File Search store:', error);
        return createErrorResponse('Failed to manage File Search store', 500);
      }
    } else {
      // LEGACY: Shared RTO store (deprecated but kept for backwards compatibility)
      storeName = `rto-${rtoCode.toLowerCase()}-assessments`;
      console.warn(`⚠️ Using legacy shared store: ${storeName} (no validationDetailId provided)`);
      
      try {
        // Try to get existing store
        const stores = await gemini.listFileSearchStores();
        fileSearchStore = stores.find((s) => s.displayName === storeName);

        if (!fileSearchStore) {
          // Create new store
          console.log(`Creating new File Search store: ${storeName}`);
          fileSearchStore = await gemini.createFileSearchStore(storeName);
        }
      } catch (error) {
        console.error('Error managing File Search store:', error);
        return createErrorResponse('Failed to manage File Search store', 500);
      }
    }

    // Get file bytes from either fileContent (base64) or storagePath
    let fileBytes: Uint8Array;
    try {
      if (storagePath) {
        // Download file from Supabase Storage
        console.log(`Downloading file from storage: ${storagePath}`);
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('documents')
          .download(storagePath);

        if (downloadError) {
          console.error('Error downloading file from storage:', downloadError);
          return createErrorResponse(`Failed to download file: ${downloadError.message}`, 500);
        }

        fileBytes = new Uint8Array(await fileData.arrayBuffer());
        console.log(`Downloaded ${fileBytes.length} bytes from storage`);
      } else if (fileContent) {
        // Decode base64 file content
        const base64Data = fileContent.includes(',')
          ? fileContent.split(',')[1]
          : fileContent;
        fileBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
      } else {
        return createErrorResponse('Unable to process file: no content or path provided');
      }
    } catch (error) {
      console.error('Error processing file content:', error);
      return createErrorResponse('Invalid file content or storage path', 400);
    }

    // Prepare metadata
    const documentMetadata: Record<string, string | number> = {
      rto_code: rtoCode,
      rto_id: rto.id,
      document_type: documentType,
      upload_date: new Date().toISOString().split('T')[0],
      ...metadata,
      ...(namespace && { namespace }), // Include session-specific namespace if available
    };

    if (unitCode) {
      documentMetadata.unit_code = unitCode;
    }
    
    console.log(`[upload-document] Document metadata:`, JSON.stringify(documentMetadata));

    // Upload to File Search store
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('STARTING GEMINI UPLOAD');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`File: ${fileName}`);
    console.log(`File size: ${fileBytes.length} bytes (${(fileBytes.length / 1024).toFixed(2)} KB)`);
    console.log(`File Search store: ${fileSearchStore.name}`);
    console.log(`Document type: ${documentType}`);
    console.log('Calling gemini.uploadToFileSearchStore()...');

    const uploadStart = Date.now();
    const operation = await gemini.uploadToFileSearchStore(
      fileBytes,
      fileName,
      fileSearchStore.name,
      displayName || fileName,
      documentMetadata
    );
    const uploadDuration = Date.now() - uploadStart;

    console.log(`✓ Upload operation initiated in ${uploadDuration}ms`);
    console.log(`Operation name from Gemini: ${operation.name}`);
    
    // Gemini may return either:
    // - Short form: "operations/123" 
    // - Full form: "fileSearchStores/abc/operations/123"
    // - Upload form: "fileSearchStores/abc/upload/operations/123"
    // Use it as-is if it starts with "fileSearchStores/", otherwise prepend store name
    console.log(`[DEBUG] Raw operation.name from Gemini: "${operation.name}"`);
    console.log(`[DEBUG] fileSearchStore.name: "${fileSearchStore.name}"`);
    console.log(`[DEBUG] Starts with fileSearchStores/: ${operation.name.startsWith('fileSearchStores/')}`);
    
    const fullOperationName = operation.name.startsWith('fileSearchStores/') 
      ? operation.name 
      : `${fileSearchStore.name}/${operation.name}`;
    
    console.log(`[DEBUG] Constructed fullOperationName: "${fullOperationName}"`);
    console.log(`Full operation name: ${fullOperationName}`);
    console.log(`Now waiting for Gemini to process and index the document...`);

    // Create operation tracking record
    console.log(`[DEBUG] Inserting into gemini_operations with operation_name: "${fullOperationName}"`);
    const { data: operationRecord, error: opRecordError } = await supabase
      .from('gemini_operations')
      .insert({
        operation_name: fullOperationName,
        operation_type: 'document_embedding',
        status: 'pending',
        progress_percentage: 0,
        max_wait_time_ms: 60000, // 60 seconds for small files
        validation_detail_id: validationDetailId || null, // Link to validation for auto-trigger
        metadata: {
          file_name: fileName,
          file_size: fileBytes.length,
          rto_code: rtoCode,
        },
      })
      .select()
      .single();

    if (opRecordError) {
      console.error('Warning: Failed to create operation tracking record:', opRecordError);
    }

    // NEW FLOW: Return immediately, let n8n poll for completion
    console.log(`✓ Upload initiated! n8n will poll operation status.`);
    console.log(`Operation will be tracked in gemini_operations table (id: ${operationRecord?.id})`);

    // Create document record immediately (embedding_status = 'processing')
    const { data: document, error: docError } = await supabase
      .from('documents')
      .insert({
        rto_id: rto.id,
        unit_code: unitCode,
        document_type: documentType,
        file_name: fileName,
        display_name: displayName || fileName,
        storage_path: storagePath || null,
        file_search_store_id: fileSearchStore.name,
        metadata: documentMetadata,
        embedding_status: 'processing', // Will be updated by check-operation-status
        validation_detail_id: validationDetailId || null,
        uploaded_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (docError) {
      console.error('Error creating document record:', docError);
      return createErrorResponse('Failed to create document record', 500);
    }

    // Link operation record to document
    if (operationRecord && document) {
      await supabase
        .from('gemini_operations')
        .update({ document_id: document.id })
        .eq('id', operationRecord.id);
    }

    const duration = Date.now() - startTime;
    console.log(`[upload-document] Document record created: ${document.id}`);
    console.log('[upload-document] SUCCESS - Duration:', duration, 'ms');
    console.log('[upload-document] Indexing will happen asynchronously');
    console.log('[upload-document] END', new Date().toISOString());
    console.log('='.repeat(80));

    return createSuccessResponse({
      success: true,
      documentId: document.id,
      operationName: fullOperationName,
      fileSearchStoreName: fileSearchStore.name,
      message: 'Upload initiated. n8n will poll for completion.',
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[upload-document] ERROR:', error);
    console.error('[upload-document] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      duration: duration + 'ms'
    });
    console.log('[upload-document] END (with error)', new Date().toISOString());
    console.log('='.repeat(80));
    
    return createErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    );
  }
});
