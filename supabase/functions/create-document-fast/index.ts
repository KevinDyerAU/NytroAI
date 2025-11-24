import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { handleCors, createErrorResponse, createSuccessResponse } from '../_shared/cors.ts';

interface CreateDocumentRequest {
  rtoCode: string;
  unitCode: string;
  documentType: 'assessment' | 'unit_requirement' | 'training_package' | 'other';
  fileName: string;
  storagePath: string;
  validationDetailId?: number;
}

/**
 * Create Document Fast Edge Function
 * 
 * This function:
 * 1. Creates validation_detail record immediately
 * 2. Creates document record in 'pending' status
 * 3. Creates gemini_operations record for indexing
 * 4. Returns immediately (no waiting for Gemini)
 * 
 * Background process will:
 * - Poll gemini_operations for indexing completion
 * - Trigger validation when indexing is done
 * - Update statuses in DB
 */
serve(async (req) => {
  console.log('[create-document-fast] Request received');
  console.log('[create-document-fast] Method:', req.method);
  console.log('[create-document-fast] URL:', req.url);
  
  const corsResponse = handleCors(req);
  if (corsResponse) {
    console.log('[create-document-fast] Returning CORS response');
    return corsResponse;
  }

  try {
    console.log('[create-document-fast] Parsing request body...');
    const requestData: CreateDocumentRequest = await req.json();
    console.log('[create-document-fast] Request data:', JSON.stringify(requestData, null, 2));
    
    const { rtoCode, unitCode, documentType, fileName, storagePath, validationDetailId } = requestData;

    // Validate request
    if (!rtoCode || !unitCode || !documentType || !fileName || !storagePath) {
      console.error('[create-document-fast] Missing required fields');
      return createErrorResponse('Missing required fields: rtoCode, unitCode, documentType, fileName, storagePath', 400);
    }
    
    console.log('[create-document-fast] Validation passed, creating Supabase client...');

    const supabase = createSupabaseClient(req);
    console.log('[create-document-fast] Supabase client created');

    // Get RTO
    console.log('[create-document-fast] Querying RTO table for code:', rtoCode);
    const { data: rto, error: rtoError } = await supabase
      .from('RTO')
      .select('id, code, legalname')
      .eq('code', rtoCode)
      .single();

    if (rtoError) {
      console.error('[create-document-fast] RTO query error:', rtoError);
      return createErrorResponse(`RTO query failed: ${rtoError.message}`, 500);
    }

    if (!rto) {
      console.error('[create-document-fast] RTO not found:', rtoCode);
      return createErrorResponse(`RTO not found: ${rtoCode}`, 404);
    }

    console.log('[create-document-fast] RTO found:', rto.code);

    // Generate File Search store name
    const storeName = `rto-${rtoCode.toLowerCase()}-assessments`;

    // Create or use existing validation_detail record
    let validationDetail;
    if (validationDetailId) {
      // Use existing validation_detail
      const { data: existing } = await supabase
        .from('validation_detail')
        .select('*')
        .eq('id', validationDetailId)
        .single();
      
      validationDetail = existing;
    }

    if (!validationDetail) {
      // Create new validation_detail
      const { data: newDetail, error: detailError } = await supabase
        .from('validation_detail')
        .insert({
          rto_id: rto.id,
          unit_code: unitCode,
          validation_type: 'assessment',
          validation_status: 'pending',
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (detailError) {
        console.error('[create-document-fast] Failed to create validation_detail:', detailError);
        return createErrorResponse('Failed to create validation record', 500);
      }

      validationDetail = newDetail;
      console.log('[create-document-fast] Created validation_detail:', validationDetail.id);
    }

    // Create document record in 'pending' status
    const { data: document, error: docError } = await supabase
      .from('documents')
      .insert({
        rto_id: rto.id,
        unit_code: unitCode,
        document_type: documentType,
        file_name: fileName,
        display_name: fileName,
        storage_path: storagePath,
        file_search_store_id: storeName,
        embedding_status: 'pending',
        validation_detail_id: validationDetail.id,
        metadata: {
          unit_code: unitCode,
          rto_code: rtoCode,
          document_type: documentType,
        },
        uploaded_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (docError) {
      console.error('[create-document-fast] Failed to create document:', docError);
      return createErrorResponse('Failed to create document record', 500);
    }

    console.log('[create-document-fast] Document created:', document.id);

    // Create gemini_operations record to trigger background indexing
    const { data: operation, error: opError } = await supabase
      .from('gemini_operations')
      .insert({
        document_id: document.id,
        operation_type: 'document_embedding',
        status: 'pending',
        progress_percentage: 0,
        max_wait_time_ms: 60000,
        metadata: {
          file_name: fileName,
          rto_code: rtoCode,
          unit_code: unitCode,
          storage_path: storagePath,
          file_search_store_id: storeName,
        },
      })
      .select()
      .single();

    if (opError) {
      console.error('[create-document-fast] Failed to create operation:', opError);
      // Don't fail the request - document is created, indexing can be retried
    }

    console.log('[create-document-fast] Operation created:', operation?.id);

    // Return success immediately - background worker will handle indexing
    return createSuccessResponse({
      success: true,
      document: {
        id: document.id,
        fileName: document.file_name,
        storagePath: document.storage_path,
        embeddingStatus: document.embedding_status,
        validationDetailId: validationDetail.id,
      },
      operation: {
        id: operation?.id,
        status: 'pending',
      },
      message: 'Document record created. Indexing will start in background.',
    });

  } catch (error) {
    console.error('[create-document-fast] FATAL ERROR:', error);
    console.error('[create-document-fast] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('[create-document-fast] Error type:', typeof error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    );
  }
});
