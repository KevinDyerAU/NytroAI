import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const startTime = Date.now();
  console.log('[create-validation-record] Request received, method:', req.method);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: corsHeaders,
      status: 200 
    });
  }

  try {
    console.log('[create-validation-record] Processing POST request...');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    console.log('[create-validation-record] Parsing request body...');
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.error('[create-validation-record] Failed to parse request body:', parseError);
      throw new Error(`Invalid JSON: ${parseError.message}`);
    }

    const { rtoCode, unitCode, qualificationCode, userId, validationType, pineconeNamespace } = requestBody;

    console.log('[create-validation-record] Starting validation record creation:', {
      rtoCode,
      unitCode,
      validationType,
      userId,
      pineconeNamespace
    });

    // Step 1: Create validation_summary
    console.log('[create-validation-record] 1. Creating validation_summary...');
    const insertData: any = {
      rtoCode: rtoCode,
      unitCode: unitCode,
      qualificationCode: qualificationCode || null,
      reqExtracted: false,
    };

    // Add user_id if provided (for RLS policies)
    if (userId) {
      insertData.user_id = userId;
    }

    const { data: summaryData, error: summaryError } = await supabase
      .from('validation_summary')
      .insert({
        rtoCode: rtoCode,
        unitCode: unitCode,
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
      validationSummaryId: summaryData.id,
      validationTypeId: validationTypeId,
      validationDetailId: validationDetail.id,
    };

    const endTime = Date.now();
    const duration = endTime - startTime;
    console.log(`[create-validation-record] ✓ All records created successfully in ${duration}ms, returning:`, responseData);

    // Return all IDs
    return new Response(
      JSON.stringify(responseData),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    console.error(`[create-validation-record] Error after ${duration}ms:`, error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorName = error instanceof Error ? error.name : 'Error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('[create-validation-record] Error details:', {
      name: errorName,
      message: errorMessage,
      stack: errorStack,
    });
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        errorType: errorName,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
