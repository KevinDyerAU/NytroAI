import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { handleCors, createErrorResponse, createSuccessResponse } from '../_shared/cors.ts';
import { createGeminiClient } from '../_shared/gemini.ts';

interface UploadDocumentRequest {
  rtoCode: string;
  unitCode?: string;
  documentType: 'assessment' | 'unit_requirement' | 'training_package' | 'other';
  fileName: string;
  storagePath: string; // Path in Supabase Storage (required)
  displayName?: string;
  metadata?: Record<string, string | number>;
  validationDetailId?: number; // Optional link to validation
  namespace?: string; // Optional namespace for filtering documents in validation
}

/**
 * Async Document Upload Edge Function
 * 
 * This function:
 * 1. Downloads file from Supabase Storage
 * 2. Initiates Gemini File Search upload (async)
 * 3. Creates document record immediately
 * 4. Creates operation tracking record
 * 5. Returns operation ID for client polling
 * 
 * The actual Gemini indexing happens asynchronously.
 * Clients should poll the gemini_operations table for status updates.
 */
serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    console.log('[Upload Document] Request received');
    const requestData: UploadDocumentRequest = await req.json();
    console.log('[Upload Document] Request data:', JSON.stringify(requestData, null, 2));
    const { 
      rtoCode, 
      unitCode, 
      documentType, 
      fileName, 
      storagePath, 
      displayName, 
      metadata,
      validationDetailId,
      namespace 
    } = requestData;

    // Validate required fields
    if (!rtoCode || !documentType || !fileName || !storagePath) {
      return createErrorResponse(
        'Missing required fields: rtoCode, documentType, fileName, storagePath'
      );
    }

    const supabase = createSupabaseClient(req);

    // Get RTO
    console.log('[Upload Document] Looking up RTO:', rtoCode);
    const { data: rto, error: rtoError } = await supabase
      .from('RTO')
      .select('id, code, legalname')
      .eq('code', rtoCode)
      .single();

    if (rtoError || !rto) {
      console.error('[Upload Document] RTO lookup failed:', rtoError);
      return createErrorResponse(`RTO not found: ${rtoCode}. Error: ${rtoError?.message || 'No RTO data'}`);
    }
    
    console.log('[Upload Document] RTO found:', rto.id, rto.code);

    // Download file from Supabase Storage
    console.log(`[Upload Document] Downloading file from storage: ${storagePath}`);
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(storagePath);

    if (downloadError) {
      console.error('[Upload Document] Error downloading file:', downloadError);
      return createErrorResponse(`Failed to download file: ${downloadError.message}`, 500);
    }

    const fileBytes = new Uint8Array(await fileData.arrayBuffer());
    console.log(`[Upload Document] Downloaded ${fileBytes.length} bytes`);

    // Check Gemini API key
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      console.error('[Upload Document] GEMINI_API_KEY not set in environment');
      return createErrorResponse('Gemini API key not configured. Please set GEMINI_API_KEY in edge function environment variables.', 500);
    }
    console.log('[Upload Document] Gemini API key found, length:', geminiApiKey.length);

    // Initialize Gemini client
    console.log('[Upload Document] Initializing Gemini client...');
    const gemini = createGeminiClient({
      apiKey: geminiApiKey,
      model: Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash',
      supabaseClient: supabase,
    });
    console.log('[Upload Document] Gemini client initialized');

    // Get or create File Search store
    const storeName = `rto-${rtoCode.toLowerCase()}-assessments`;
    let fileSearchStore;

    try {
      console.log('[Upload Document] Listing File Search stores...');
      const stores = await gemini.listFileSearchStores();
      console.log(`[Upload Document] Found ${stores.length} File Search stores`);
      
      fileSearchStore = stores.find((s) => s.displayName === storeName);

      if (!fileSearchStore) {
        console.log(`[Upload Document] Creating new File Search store: ${storeName}`);
        fileSearchStore = await gemini.createFileSearchStore(storeName);
        console.log('[Upload Document] File Search store created:', fileSearchStore.name);
      } else {
        console.log('[Upload Document] Using existing File Search store:', fileSearchStore.name);
      }
    } catch (error) {
      console.error('[Upload Document] Error managing File Search store:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Upload Document] File Search store error details:', errorMessage);
      return createErrorResponse(`Failed to manage File Search store: ${errorMessage}`, 500);
    }

    // Use provided namespace or fetch from validation_detail if validationDetailId provided
    let resolvedNamespace: string | null = namespace || null;
    if (!resolvedNamespace && validationDetailId) {
      const { data: validationDetail, error: validationError } = await supabase
        .from('validation_detail')
        .select('namespace_code')
        .eq('id', validationDetailId)
        .single();
      
      if (!validationError && validationDetail) {
        resolvedNamespace = validationDetail.namespace_code;
        console.log('[Upload Document] Using namespace from validation_detail:', resolvedNamespace);
      }
    } else if (resolvedNamespace) {
      console.log('[Upload Document] Using provided namespace:', resolvedNamespace);
    }

    // Prepare metadata - include namespace for File Search filtering
    const documentMetadata: Record<string, string | number> = {
      rto_code: rtoCode,
      rto_id: rto.id,
      document_type: documentType,
      upload_date: new Date().toISOString().split('T')[0],
      storage_path: storagePath,
      ...metadata,
    };

    if (unitCode) {
      documentMetadata.unit_code = unitCode;
    }

    if (validationDetailId) {
      documentMetadata.validation_detail_id = validationDetailId;
    }

    if (resolvedNamespace) {
      documentMetadata.namespace = resolvedNamespace; // CRITICAL: Namespace for File Search filtering
      console.log('[Upload Document] Added namespace to metadata:', resolvedNamespace);
    }

    // Create document record FIRST (before Gemini upload completes)
    console.log('[Upload Document] Creating document record...');
    console.log('[Upload Document] Document data:', {
      rto_id: rto.id,
      unit_code: unitCode,
      document_type: documentType,
      file_name: fileName,
    });
    
    const { data: document, error: docError } = await supabase
      .from('documents')
      .insert({
        rto_id: rto.id,
        unit_code: unitCode,
        document_type: documentType,
        file_name: fileName,
        display_name: displayName || fileName,
        file_search_store_id: fileSearchStore.name,
        storage_path: storagePath,
        validation_detail_id: validationDetailId,
        metadata: documentMetadata,
        embedding_status: 'processing',
        uploaded_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (docError) {
      console.error('[Upload Document] Error creating document record:', docError);
      console.error('[Upload Document] Document error details:', JSON.stringify(docError));
      return createErrorResponse(`Failed to create document record: ${docError.message}`, 500);
    }

    console.log(`[Upload Document] Document record created: ${document.id}`);

    // Start Gemini upload (async - don't wait)
    console.log('[Upload Document] Starting Gemini File Search upload...');
    console.log('[Upload Document] Upload params:', {
      fileSize: fileBytes.length,
      fileName: fileName,
      storeName: fileSearchStore.name,
    });
    
    let operation;
    try {
      operation = await gemini.uploadToFileSearchStore(
        fileBytes,
        fileName,
        fileSearchStore.name,
        displayName || fileName,
        documentMetadata
      );

      console.log(`[Upload Document] Gemini upload initiated: ${operation.name}`);
    } catch (uploadError) {
      console.error('[Upload Document] Gemini upload error:', uploadError);
      const errorMessage = uploadError instanceof Error ? uploadError.message : String(uploadError);
      console.error('[Upload Document] Gemini upload error details:', errorMessage);
      return createErrorResponse(`Failed to upload to Gemini: ${errorMessage}`, 500);
    }

    // Create operation tracking record
    const { data: operationRecord, error: opError } = await supabase
      .from('gemini_operations')
      .insert({
        operation_name: operation.name,
        operation_type: 'document_embedding',
        document_id: document.id,
        validation_detail_id: validationDetailId,
        status: 'processing',
        progress_percentage: 10,
        max_wait_time_ms: 300000, // 5 minutes max
        metadata: {
          file_name: fileName,
          file_size: fileBytes.length,
          rto_code: rtoCode,
          storage_path: storagePath,
        },
      })
      .select()
      .single();

    if (opError) {
      console.error('[Upload Document] Error creating operation record:', opError);
      // Continue anyway - operation is running
    }

    // Update validation_detail status to show document processing (Stage 2)
    if (validationDetailId) {
      await supabase
        .from('validation_detail')
        .update({ extractStatus: 'DocumentProcessing' })
        .eq('id', validationDetailId);
    }

    // Start background processing (don't wait for it)
    // This will be handled by a separate polling mechanism or webhook
    console.log('[Upload Document] Document upload initiated successfully');
    console.log('[Upload Document] Client should poll gemini_operations table for status');

    return createSuccessResponse({
      success: true,
      document: {
        id: document.id,
        fileName: document.file_name,
        displayName: document.display_name,
        documentType: document.document_type,
        fileSearchStoreId: document.file_search_store_id,
        embeddingStatus: document.embedding_status,
        uploadedAt: document.uploaded_at,
      },
      operation: {
        id: operationRecord?.id,
        name: operation.name,
        status: 'processing',
        message: 'Document upload initiated. Poll operation status for completion.',
      },
      message: 'Document upload initiated. Check operation status for completion.',
    });
  } catch (error) {
    console.error('[Upload Document] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    const errorStack = error instanceof Error ? error.stack : '';
    console.error('[Upload Document] Error stack:', errorStack);
    
    return createErrorResponse(
      `Upload failed: ${errorMessage}. Check edge function logs for details.`,
      500
    );
  }
});
