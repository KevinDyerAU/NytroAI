import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { handleCors, createErrorResponse, createSuccessResponse } from '../_shared/cors.ts';

interface TriggerValidationRequest {
  validationDetailId: number;
}

serve(async (req) => {
  const startTime = Date.now();
  console.log('='.repeat(80));
  console.log('[trigger-validation] START', new Date().toISOString());
  console.log('[trigger-validation] Method:', req.method);
  
  const corsResponse = handleCors(req);
  if (corsResponse) {
    console.log('[trigger-validation] CORS preflight handled');
    return corsResponse;
  }

  try {
    const requestData: TriggerValidationRequest = await req.json();
    const { validationDetailId } = requestData;
    console.log('[trigger-validation] Request data:', { validationDetailId });

    if (!validationDetailId) {
      return createErrorResponse('Missing required field: validationDetailId');
    }

    const supabase = createSupabaseClient(req);

    // Get validation detail
    console.log(`[Trigger Validation] Looking for validation_detail: ${validationDetailId}`);
    
    const { data: validationDetail, error: valDetailError } = await supabase
      .from('validation_detail')
      .select(`
        *,
        validation_summary!inner(
          rtoCode,
          unitCode
        ),
        validation_type!inner(
          code,
          description
        )
      `)
      .eq('id', validationDetailId)
      .single();

    console.log(`[Trigger Validation] Query result:`, { validationDetail, valDetailError });

    if (valDetailError || !validationDetail) {
      console.error(`[Trigger Validation] Error details:`, valDetailError);
      
      // Try a simpler query to see if the record exists at all
      const { data: simpleCheck, error: simpleError } = await supabase
        .from('validation_detail')
        .select('*')
        .eq('id', validationDetailId)
        .single();
      
      console.log(`[Trigger Validation] Simple check:`, { simpleCheck, simpleError });
      
      return createErrorResponse(`Validation detail not found: ${validationDetailId}. Error: ${valDetailError?.message || 'Unknown'}`);
    }

    // Check if documents are uploaded and indexed
    if (!validationDetail.docExtracted || !validationDetail.file_search_store_id) {
      return createErrorResponse('Documents not yet indexed. Please wait for upload to complete.');
    }

    // Get all documents for this validation
    const { data: documents, error: docsError } = await supabase
      .from('documents')
      .select('*')
      .eq('validation_detail_id', validationDetailId);

    if (docsError || !documents || documents.length === 0) {
      return createErrorResponse('No documents found for this validation');
    }

    const rtoCode = validationDetail.validation_summary.rtoCode;
    const unitCode = validationDetail.validation_summary.unitCode;
    const validationType = validationDetail.validation_type.code;
    const namespace = validationDetail.namespace_code; // Unique namespace for this validation session

    console.log(`[Trigger Validation] Starting validation for:`, {
      validationDetailId,
      rtoCode,
      unitCode,
      validationType,
      namespace,
      documentCount: documents.length,
    });

    // validationType is now the code field, so use it directly
    // If it's already in the right format, use it; otherwise default to full_validation
    const mappedValidationType = validationType || 'full_validation';

    // Call validate-assessment Edge Function for each document
    // In practice, you might want to validate all documents together or just the first one
    const firstDocument = documents[0];

    console.log(`[Trigger Validation] Calling validate-assessment for document ${firstDocument.id}...`);

    // Update status to ProcessingInBackground when validation starts
    await supabase
      .from('validation_detail')
      .update({
        extractStatus: 'ProcessingInBackground',
      })
      .eq('id', validationDetailId);

    const { data: validationResult, error: validationError } = await supabase.functions.invoke(
      'validate-assessment',
      {
        body: {
          documentId: firstDocument.id,
          unitCode: unitCode,
          validationType: mappedValidationType,
          validationDetailId: validationDetailId,
          // Don't pass namespace - let validate-assessment fetch it from validation_detail to ensure consistency
        },
      }
    );

    if (validationError) {
      console.error(`[Trigger Validation] Error validating:`, validationError);
      
      // Update validation status to failed
      await supabase
        .from('validation_detail')
        .update({
          extractStatus: 'ValidationFailed',
        })
        .eq('id', validationDetailId);

      return createErrorResponse(`Validation failed: ${validationError.message}`);
    }

    const duration = Date.now() - startTime;
    console.log(`[trigger-validation] Validation completed successfully`);
    console.log('[trigger-validation] SUCCESS - Duration:', duration, 'ms');

    // Update validation status to completed
    await supabase
      .from('validation_detail')
      .update({
        extractStatus: 'Completed',
      })
      .eq('id', validationDetailId);

    console.log('[trigger-validation] END', new Date().toISOString());
    console.log('='.repeat(80));

    return createSuccessResponse({
      success: true,
      message: 'Validation triggered successfully',
      validationDetailId,
      result: validationResult,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[trigger-validation] ERROR:', error);
    console.error('[trigger-validation] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      duration: duration + 'ms'
    });
    console.log('[trigger-validation] END (with error)', new Date().toISOString());
    console.log('='.repeat(80));
    
    return createErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    );
  }
});
