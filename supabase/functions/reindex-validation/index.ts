import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { handleCors, createErrorResponse, createSuccessResponse } from '../_shared/cors.ts';

/**
 * Reindex Validation Edge Function
 * 
 * Marks all documents for a validation_detail_id for re-indexing by:
 * 1. Setting embedding_status back to 'pending'
 * 2. Clearing the old file_search_document_id
 * 3. Creating new gemini_operations records
 * 
 * This triggers documents to be re-uploaded to Gemini File Search with updated metadata.
 */
serve(async (req) => {
  console.log('[reindex-validation] Request received');
  
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { validationDetailId } = await req.json();
    
    if (!validationDetailId) {
      return createErrorResponse('Missing validationDetailId', 400);
    }

    const supabase = createSupabaseClient(req);

    // Get all documents for this validation
    const { data: documents, error: docsError } = await supabase
      .from('documents')
      .select('*')
      .eq('validation_detail_id', validationDetailId);

    if (docsError) {
      return createErrorResponse(`Failed to fetch documents: ${docsError.message}`, 500);
    }

    if (!documents || documents.length === 0) {
      return createErrorResponse('No documents found for this validation', 404);
    }

    console.log(`[reindex-validation] Found ${documents.length} documents to reindex`);

    // Update all documents to pending status
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        embedding_status: 'pending',
        file_search_document_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('validation_detail_id', validationDetailId);

    if (updateError) {
      console.error('[reindex-validation] Failed to update documents:', updateError);
      return createErrorResponse('Failed to update documents', 500);
    }

    // Create gemini_operations for each document
    const operations = documents.map(doc => ({
      operation_name: `operations/${Date.now()}-reindex-${doc.id}`,
      document_id: doc.id,
      operation_type: 'document_embedding',
      status: 'pending',
      progress_percentage: 0,
      max_wait_time_ms: 60000,
      metadata: {
        file_name: doc.file_name,
        storage_path: doc.storage_path,
        file_search_store_id: doc.file_search_store_id,
        reindex: true,
      },
    }));

    const { error: opError } = await supabase
      .from('gemini_operations')
      .insert(operations);

    if (opError) {
      console.error('[reindex-validation] Failed to create operations:', opError);
      // Don't fail - documents will still be picked up by process-pending-indexing
    }

    console.log('[reindex-validation] All documents marked for re-indexing');

    return createSuccessResponse({
      success: true,
      message: `${documents.length} documents marked for re-indexing`,
      documentCount: documents.length,
      documentIds: documents.map(d => d.id),
    });

  } catch (error) {
    console.error('[reindex-validation] Error:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    );
  }
});
