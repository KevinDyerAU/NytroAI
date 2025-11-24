import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { handleCors, createErrorResponse, createSuccessResponse } from '../_shared/cors.ts';

/**
 * Get Validation Detail Status Edge Function
 * 
 * Retrieves the status of all documents and operations for a specific validation_detail_id.
 * This shows the processing pipeline status for that validation.
 */
serve(async (req) => {
  console.log('[get-validation-detail-status] Request received');
  
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { validationDetailId } = await req.json();
    
    if (!validationDetailId) {
      return createErrorResponse('Missing validationDetailId', 400);
    }

    console.log('[get-validation-detail-status] Fetching status for validation_detail:', validationDetailId);

    const supabase = createSupabaseClient(req);

    // Get documents for this validation
    const { data: documents, error: docsError } = await supabase
      .from('documents')
      .select('*')
      .eq('validation_detail_id', validationDetailId)
      .order('uploaded_at', { ascending: false });

    if (docsError) {
      console.error('[get-validation-detail-status] Error fetching documents:', docsError);
      return createErrorResponse('Failed to fetch documents', 500);
    }

    // Get Gemini operations for these documents
    const documentIds = documents?.map(d => d.id) || [];
    const { data: operations, error: opsError } = documentIds.length > 0
      ? await supabase
          .from('gemini_operations')
          .select('*')
          .in('document_id', documentIds)
          .order('created_at', { ascending: false })
      : { data: [], error: null };

    if (opsError) {
      console.error('[get-validation-detail-status] Error fetching operations:', opsError);
    }

    // Build status array
    const status = (documents || []).map(doc => {
      const docOps = (operations || []).filter(op => op.document_id === doc.id);
      const latestOp = docOps[0];

      return {
        file_name: doc.file_name,
        embedding_status: doc.embedding_status,
        gemini_status: latestOp?.status || null,
        gemini_progress: latestOp?.progress_percentage || 0,
        error_message: latestOp?.error_message || doc.error_message || null,
        uploaded_at: doc.uploaded_at,
        file_search_document_id: doc.file_search_document_id,
        operation_count: docOps.length,
      };
    });

    console.log('[get-validation-detail-status] Found', status.length, 'documents');

    return createSuccessResponse({
      validationDetailId,
      documentCount: status.length,
      status,
    });

  } catch (error) {
    console.error('[get-validation-detail-status] Error:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    );
  }
});
