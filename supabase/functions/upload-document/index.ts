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

    // Get or create File Search store for this RTO
    const storeName = `rto-${rtoCode.toLowerCase()}-assessments`;
    let fileSearchStore;

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
    console.log(`Operation name: ${operation.name}`);
    console.log(`Now waiting for Gemini to process and index the document...`);

    // Create operation tracking record
    const { data: operationRecord, error: opRecordError } = await supabase
      .from('gemini_operations')
      .insert({
        operation_name: operation.name,
        operation_type: 'document_embedding',
        status: 'pending',
        progress_percentage: 0,
        max_wait_time_ms: 60000, // 60 seconds for small files
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

    console.log(`Starting waitForOperation for: ${operation.name}`);
    console.log(`Max wait time: 60 seconds (small files should complete in 5-10 seconds)`);

    // Wait for operation to complete (small files should be 5-10 seconds)
    // Pass 60000ms (60 seconds) as max wait time and operation ID for tracking
    const completedOperation = await gemini.waitForOperation(
      operation.name,
      60000, // 60 seconds instead of 5 minutes
      operationRecord?.id
    );

    console.log(`waitForOperation completed successfully for: ${operation.name}`);

    console.log(`Document successfully processed and indexed by Gemini`);

    // Store document metadata in Supabase
    const { data: document, error: docError } = await supabase
      .from('documents')
      .insert({
        rto_id: rto.id,
        unit_code: unitCode,
        document_type: documentType,
        file_name: fileName,
        display_name: displayName || fileName,
        file_search_store_id: fileSearchStore.name,
        file_search_document_id: completedOperation.name,
        metadata: documentMetadata,
        embedding_status: 'completed',
        uploaded_at: new Date().toISOString(),
      })
      .select()
      .single();

    // Link operation record to document
    if (operationRecord && document) {
      await supabase
        .from('gemini_operations')
        .update({ document_id: document.id })
        .eq('id', operationRecord.id);
    }

    if (docError) {
      console.error('Error storing document metadata:', docError);
      // Document is uploaded to Gemini but failed to store in DB
      // You might want to clean up the Gemini document here
      return createErrorResponse('Failed to store document metadata', 500);
    }

    const duration = Date.now() - startTime;
    console.log(`[upload-document] Document uploaded successfully: ${document.id}`);
    console.log('[upload-document] SUCCESS - Duration:', duration, 'ms');
    console.log('[upload-document] END', new Date().toISOString());
    console.log('='.repeat(80));

    return createSuccessResponse({
      success: true,
      document: {
        id: document.id,
        fileName: document.file_name,
        displayName: document.display_name,
        documentType: document.document_type,
        fileSearchStoreId: document.file_search_store_id,
        fileSearchDocumentId: document.file_search_document_id,
        uploadedAt: document.uploaded_at,
      },
      message: 'Document uploaded and indexed successfully',
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
