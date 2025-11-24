import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { handleCors, createErrorResponse, createSuccessResponse } from '../_shared/cors.ts';

/**
 * Retrigger Validation Edge Function
 * 
 * Creates a new validation_detail record that reuses the same documents and embeddings
 * from a previous validation, then runs only the validation step.
 * 
 * This allows testing different prompts without re-uploading/re-indexing documents.
 */
serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { sourceValidationDetailId, promptId } = await req.json();

    if (!sourceValidationDetailId) {
      return createErrorResponse('Missing required field: sourceValidationDetailId', 400);
    }

    console.log('[retrigger-validation] Retriggering validation from detail:', sourceValidationDetailId);
    console.log('[retrigger-validation] Using prompt ID:', promptId || 'default');

    const supabase = createSupabaseClient(req);

    // 1. Fetch the source validation_detail record
    const { data: sourceDetail, error: sourceError } = await supabase
      .from('validation_detail')
      .select('*')
      .eq('id', sourceValidationDetailId)
      .single();

    if (sourceError || !sourceDetail) {
      console.error('[retrigger-validation] Source detail not found:', sourceError);
      return createErrorResponse(`Validation detail ${sourceValidationDetailId} not found`, 404);
    }

    console.log('[retrigger-validation] Source detail found:', {
      summary_id: sourceDetail.summary_id,
      namespace: sourceDetail.namespace_code,
      status: sourceDetail.extractStatus
    });

    // 2. Create a new validation_detail record (clone)
    const newDetail = {
      summary_id: sourceDetail.summary_id,
      namespace_code: sourceDetail.namespace_code,
      rto_id: sourceDetail.rto_id,
      extractStatus: 'Pending', // Will be updated by validation
      numOfReq: sourceDetail.numOfReq,
      validationType_id: sourceDetail.validationType_id,
      // Note: Don't copy created_at, updated_at - let them be auto-generated
    };

    const { data: clonedDetail, error: cloneError } = await supabase
      .from('validation_detail')
      .insert([newDetail])
      .select()
      .single();

    if (cloneError || !clonedDetail) {
      console.error('[retrigger-validation] Failed to clone validation_detail:', cloneError);
      return createErrorResponse('Failed to create new validation record', 500);
    }

    console.log('[retrigger-validation] Created new validation_detail:', clonedDetail.id);

    // 3. Link existing documents to the new validation_detail
    const { data: existingDocs, error: docsError } = await supabase
      .from('documents')
      .select('*')
      .eq('validation_detail_id', sourceValidationDetailId);

    if (docsError) {
      console.error('[retrigger-validation] Failed to fetch documents:', docsError);
      return createErrorResponse('Failed to fetch existing documents', 500);
    }

    console.log('[retrigger-validation] Found', existingDocs?.length || 0, 'documents to link');

    if (existingDocs && existingDocs.length > 0) {
      // Update each document to point to the new validation_detail_id
      const updatePromises = existingDocs.map(doc =>
        supabase
          .from('documents')
          .insert([{
            file_name: doc.file_name,
            file_path: doc.file_path,
            file_size: doc.file_size,
            file_type: doc.file_type,
            uploaded_at: doc.uploaded_at,
            rto_id: doc.rto_id,
            validation_detail_id: clonedDetail.id,
            file_search_store_id: doc.file_search_store_id,
            gemini_file_id: doc.gemini_file_id,
            embedding_status: doc.embedding_status,
            // Reuse the same Gemini file and embeddings
          }])
      );

      const results = await Promise.all(updatePromises);
      const errors = results.filter(r => r.error);
      
      if (errors.length > 0) {
        console.error('[retrigger-validation] Some document links failed:', errors);
      } else {
        console.log('[retrigger-validation] Successfully linked all documents');
      }
    }

    // 4. Trigger validation on the new validation_detail
    console.log('[retrigger-validation] Triggering validation on new detail:', clonedDetail.id);

    // Get the first document for validation
    const { data: firstDoc } = await supabase
      .from('documents')
      .select('id, file_name')
      .eq('validation_detail_id', clonedDetail.id)
      .limit(1)
      .single();

    if (!firstDoc) {
      return createErrorResponse('No documents found for validation', 500);
    }

    // Get unit code from validation_summary
    const { data: summary } = await supabase
      .from('validation_summary')
      .select('unitCode')
      .eq('id', clonedDetail.summary_id)
      .single();

    const unitCode = summary?.unitCode || 'unknown';

    // Call validate-assessment edge function
    const validatePayload: any = {
      documentId: firstDoc.id,
      unitCode: unitCode,
      validationType: 'full_validation',
      validationDetailId: clonedDetail.id,
      namespace: clonedDetail.namespace_code,
    };
    
    // Add promptId if provided
    if (promptId) {
      validatePayload.promptId = promptId;
    }

    console.log('[retrigger-validation] Calling validate-assessment with:', validatePayload);

    const { data: validateData, error: validateError } = await supabase.functions.invoke(
      'validate-assessment',
      { body: validatePayload }
    );

    if (validateError) {
      console.error('[retrigger-validation] Validation failed:', validateError);
      return createErrorResponse(`Validation failed: ${validateError.message}`, 500);
    }

    console.log('[retrigger-validation] Validation triggered successfully');

    return createSuccessResponse({
      message: 'Validation retriggered successfully',
      newValidationDetailId: clonedDetail.id,
      sourceValidationDetailId: sourceValidationDetailId,
      documentsLinked: existingDocs?.length || 0,
      validationStarted: true,
    });

  } catch (error) {
    console.error('[retrigger-validation] Exception:', error);
    return createErrorResponse('Internal server error', 500);
  }
});
