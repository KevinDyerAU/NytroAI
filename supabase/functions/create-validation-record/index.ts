import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { handleCors, createErrorResponse, createSuccessResponse } from '../_shared/cors.ts';

interface CreateValidationRecordRequest {
  rtoCode: string;
  unitCode: string;
  unitLink?: string;
  qualificationCode?: string | null;
  validationType: string;
  pineconeNamespace: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const requestData: CreateValidationRecordRequest = await req.json();
    const { 
      rtoCode, 
      unitCode, 
      unitLink,
      qualificationCode, 
      validationType, 
      pineconeNamespace 
    } = requestData;

    // Validate request
    if (!rtoCode || !unitCode || !validationType || !pineconeNamespace) {
      return createErrorResponse(
        'Missing required fields: rtoCode, unitCode, validationType, pineconeNamespace'
      );
    }

    // Initialize Supabase client
    const supabase = createSupabaseClient(req);

    // Step 1: Create validation_summary
    console.log('[create-validation-record] 1. Creating validation_summary...');
    const { data: summaryData, error: summaryError } = await supabase
      .from('validation_summary')
      .insert({
        rtoCode: rtoCode,
        unitCode: unitCode,
        unitLink: unitLink || null,
        qualificationCode: qualificationCode || null,
        reqExtracted: false,
      })
      .select('id')
      .single();

    if (summaryError) {
      console.error('[create-validation-record] Error creating validation_summary:', summaryError);
      throw new Error(`Failed to create validation_summary: ${summaryError.message}`);
    }

    console.log('[create-validation-record] Created validation_summary:', summaryData.id);

    // Step 2: Get or create validation_type
    console.log('[create-validation-record] 2. Looking up validation_type:', validationType);
    let validationTypeId: number;

    const { data: existingType, error: typeError } = await supabase
      .from('validation_type')
      .select('id')
      .eq('code', validationType)
      .single();

    if (typeError && typeError.code !== 'PGRST116') { // PGRST116 = not found
      console.error('[create-validation-record] Error looking up validation_type:', typeError);
      throw new Error(`Failed to lookup validation_type: ${typeError.message}`);
    }

    if (existingType) {
      console.log('[create-validation-record] Using existing validation_type:', existingType.id);
      validationTypeId = existingType.id;
    } else {
      console.log('[create-validation-record] Creating new validation_type...');
      const { data: newType, error: createTypeError } = await supabase
        .from('validation_type')
        .insert({
          code: validationType,
          description: validationType === 'UnitOfCompetency' ? 'Unit Validation' : 'Learner Guide Validation',
        })
        .select('id')
        .single();

      if (createTypeError) {
        console.error('[create-validation-record] Error creating validation_type:', createTypeError);
        throw new Error(`Failed to create validation_type: ${createTypeError.message}`);
      }

      console.log('[create-validation-record] Created validation_type:', newType.id);
      validationTypeId = newType.id;
    }

    // Step 3: Create validation_detail
    console.log('[create-validation-record] 3. Creating validation_detail...');
    const { data: validationDetail, error: detailError } = await supabase
      .from('validation_detail')
      .insert({
        summary_id: summaryData.id,
        validationType_id: validationTypeId,
        namespace_code: pineconeNamespace,
        docExtracted: false,
        extractStatus: 'Uploading',
        numOfReq: 0,
      })
      .select('id')
      .single();

    if (detailError) {
      console.error('[create-validation-record] Error creating validation_detail:', detailError);
      throw new Error(`Failed to create validation_detail: ${detailError.message}`);
    }

    console.log('[create-validation-record] Created validation_detail:', validationDetail.id);

    const responseData = {
      success: true,
      summaryId: summaryData.id,
      detailId: validationDetail.id,
      validationTypeId: validationTypeId,
      namespace: pineconeNamespace,
    };

    console.log('[create-validation-record] Returning response:', responseData);

    return createSuccessResponse(responseData);
  } catch (error) {
    console.error('[create-validation-record] Error:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    );
  }
});
