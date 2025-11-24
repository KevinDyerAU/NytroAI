import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { handleCors, createErrorResponse, createSuccessResponse } from '../_shared/cors.ts';

/**
 * Reindex Document Edge Function
 * 
 * Marks a document for re-indexing by:
 * 1. Setting embedding_status back to 'pending'
 * 2. Clearing the old file_search_document_id
 * 3. Creating a new gemini_operations record
 * 
 * This triggers the document to be re-uploaded to Gemini File Search
 * with updated metadata.
 */
serve(async (req) => {
  console.log('[reindex-document] Request received');
  
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { documentId } = await req.json();
    
    if (!documentId) {
      return createErrorResponse('Missing documentId', 400);
    }

    const supabase = createSupabaseClient(req);

    // Get document details
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      return createErrorResponse(`Document not found: ${documentId}`, 404);
    }

    console.log('[reindex-document] Document:', document.file_name);
    console.log('[reindex-document] Current metadata:', document.metadata);

    // Update document to pending status
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        embedding_status: 'pending',
        file_search_document_id: null, // Clear old Gemini document ID
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    if (updateError) {
      console.error('[reindex-document] Failed to update document:', updateError);
      return createErrorResponse('Failed to update document', 500);
    }

    // Create new gemini_operations record to trigger re-indexing
    const operationName = `operations/${Date.now()}-reindex-${documentId}`;
    
    const { error: opError } = await supabase
      .from('gemini_operations')
      .insert({
        operation_name: operationName,
        document_id: documentId,
        operation_type: 'document_embedding',
        status: 'pending',
        progress_percentage: 0,
        max_wait_time_ms: 60000,
        metadata: {
          file_name: document.file_name,
          storage_path: document.storage_path,
          file_search_store_id: document.file_search_store_id,
          reindex: true,
        },
      });

    if (opError) {
      console.error('[reindex-document] Failed to create operation:', opError);
      // Don't fail - document will still be picked up by process-pending-indexing
    }

    console.log('[reindex-document] Document marked for re-indexing');

    return createSuccessResponse({
      success: true,
      message: 'Document marked for re-indexing',
      documentId,
    });

  } catch (error) {
    console.error('[reindex-document] Error:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    );
  }
});
