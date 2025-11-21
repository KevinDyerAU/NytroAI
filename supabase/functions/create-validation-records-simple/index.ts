import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface RequestBody {
  rtoCode: string;
  unitCode: string;
  qualificationCode: string | null;
  validationType: string;
  pineconeNamespace: string;
}

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();
    console.log('[create-validation-records-simple] Request:', body);

    // Create Supabase client with service role (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Look up unit Link from UnitOfCompetency table
    const { data: unitData, error: unitError } = await supabase
      .from('UnitOfCompetency')
      .select('Link')
      .eq('unitCode', body.unitCode)
      .single();

    if (unitError) {
      console.error('[create-validation-records-simple] Unit lookup error:', unitError);
      // Don't throw - continue without unitLink if unit not found
    }

    const unitLink = unitData?.Link || null;
    console.log('[create-validation-records-simple] Unit Link:', unitLink);

    // 1. Create validation_summary
    const { data: summaryData, error: summaryError } = await supabase
      .from('validation_summary')
      .insert({
        rtoCode: body.rtoCode,
        unitCode: body.unitCode,
        unitLink: unitLink, // Populate unitLink field
        qualificationCode: body.qualificationCode,
        reqExtracted: false,
      })
      .select('id')
      .single();

    if (summaryError) {
      console.error('[create-validation-records-simple] Summary error:', summaryError);
      throw summaryError;
    }

    // 2. Get or create validation_type
    let { data: validationType, error: typeError } = await supabase
      .from('validation_type')
      .select('id')
      .eq('code', body.validationType)
      .single();

    if (typeError && typeError.code === 'PGRST116') {
      // Type doesn't exist, create it
      const typeDescription = body.validationType === 'UnitOfCompetency' 
        ? 'Unit Validation' 
        : body.validationType === 'full_validation'
        ? 'Full Validation'
        : 'Learner Guide Validation';
      
      const { data: newType, error: createTypeError } = await supabase
        .from('validation_type')
        .insert({
          code: body.validationType,
          description: typeDescription,
        })
        .select('id')
        .single();

      if (createTypeError) {
        console.error('[create-validation-records-simple] Type creation error:', createTypeError);
        throw createTypeError;
      }
      validationType = newType;
    } else if (typeError) {
      console.error('[create-validation-records-simple] Type lookup error:', typeError);
      throw typeError;
    }

    // 3. Create validation_detail
    const { data: detailData, error: detailError } = await supabase
      .from('validation_detail')
      .insert({
        summary_id: summaryData.id,
        validationType_id: validationType.id,
        namespace_code: body.pineconeNamespace,
        docExtracted: false,
        extractStatus: 'Uploading',
        numOfReq: 0,
      })
      .select('id')
      .single();

    if (detailError) {
      console.error('[create-validation-records-simple] Detail error:', detailError);
      throw detailError;
    }

    console.log('[create-validation-records-simple] Success:', {
      summaryId: summaryData.id,
      typeId: validationType.id,
      detailId: detailData.id,
    });

    return new Response(
      JSON.stringify({
        success: true,
        summaryId: summaryData.id,
        typeId: validationType.id,
        detailId: detailData.id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[create-validation-records-simple] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
