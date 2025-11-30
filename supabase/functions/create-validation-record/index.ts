import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { handleCors, createErrorResponse, createSuccessResponse } from '../_shared/cors.ts';

interface CreateValidationRecordRequest {
  rtoCode: string;
  unitCode: string;
  unitLink?: string;
  qualificationCode?: string | null;
  validationType: string;
  documentType?: string;
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
      documentType, 
      pineconeNamespace 
    } = requestData;

    // Validate request
    if (!rtoCode || !unitCode || !validationType || !pineconeNamespace) {
      return createErrorResponse(
        'Missing required fields: rtoCode, unitCode, validationType, pineconeNamespace'
      );
    }

    if (!unitLink) {
      return createErrorResponse(
        'Missing required field: unitLink (required for finding/creating validation_summary)'
      );
    }

    // Initialize Supabase client
    const supabase = createSupabaseClient(req);

    // Step 1: Find existing validation_summary using unitLink (MUST exist - contains requirements)
    console.log('[create-validation-record] 1. Looking for existing validation_summary with unitLink:', unitLink);
    
    const { data: existingSummary, error: findError } = await supabase
      .from('validation_summary')
      .select('id, reqExtracted')
      .eq('unitLink', unitLink)
      .single();

    if (findError) {
      if (findError.code === 'PGRST116') { // Not found
        console.error('[create-validation-record] No validation_summary found for unitLink:', unitLink);
        return createErrorResponse(
          `No requirements found for unit: ${unitCode}. Please extract requirements first using Unit Acquisition.`,
          404
        );
      }
      console.error('[create-validation-record] Error finding validation_summary:', findError);
      throw new Error(`Failed to find validation_summary: ${findError.message}`);
    }

    if (!existingSummary.reqExtracted) {
      console.error('[create-validation-record] Requirements not extracted for unitLink:', unitLink);
      return createErrorResponse(
        `Requirements not yet extracted for unit: ${unitCode}. Please wait for extraction to complete.`,
        400
      );
    }

    console.log('[create-validation-record] Found existing validation_summary with requirements:', existingSummary.id);
    const summaryId = existingSummary.id;

    // Update validation_summary with rtoCode (may be missing from initial creation)
    console.log('[create-validation-record] 1.5. Updating validation_summary with rtoCode:', rtoCode);
    const { error: updateError } = await supabase
      .from('validation_summary')
      .update({ rtoCode: rtoCode })
      .eq('id', summaryId);

    if (updateError) {
      console.error('[create-validation-record] Error updating validation_summary with rtoCode:', updateError);
      // Don't fail - rtoCode is optional, just log the error
    } else {
      console.log('[create-validation-record] Successfully updated validation_summary with rtoCode');
    }

    // Step 2: Get validation_type based on documentType (unit or learner_guide)
    // Map documentType to validation_type name for lookup
    const validationTypeName = documentType === 'learner_guide' ? 'learner_guide' : 'unit';
    console.log('[create-validation-record] 2. Looking up validation_type:', validationTypeName, '(from documentType:', documentType, ')');
    let validationTypeId: number;

    const { data: existingType, error: typeError } = await supabase
      .from('validation_type')
      .select('id, name')
      .eq('name', validationTypeName)
      .single();

    if (typeError && typeError.code !== 'PGRST116') {
      console.error('[create-validation-record] Error looking up validation_type:', typeError);
      throw new Error(`Failed to look up validation_type: ${typeError.message}`);
    }

    if (existingType) {
      console.log('[create-validation-record] Using existing validation_type:', existingType.id, '(', existingType.name, ')');
      validationTypeId = existingType.id;
    } else {
      console.log('[create-validation-record] Creating new validation_type:', validationTypeName);
      const { data: newType, error: createTypeError } = await supabase
        .from('validation_type')
        .insert({ name: validationTypeName })
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
    
    // Build insert object conditionally based on whether document_type is provided
    const insertData: any = {
      summary_id: summaryId,
      validationType_id: validationTypeId,
      namespace_code: pineconeNamespace,
      docExtracted: false,
      extractStatus: 'Uploading',
      numOfReq: 0,
    };
    
    // Only add document_type if provided (supports backward compatibility)
    if (documentType) {
      insertData.document_type = documentType;
    }
    
    const { data: validationDetail, error: detailError } = await supabase
      .from('validation_detail')
      .insert(insertData)
      .select('id')
      .single();

    if (detailError) {
      console.error('[create-validation-record] Error creating validation_detail:', detailError);
      
      // If error is about document_type column not existing, retry without it
      if (detailError.message?.includes('document_type') || detailError.code === '42703') {
        console.log('[create-validation-record] Retrying without document_type (column may not exist yet)...');
        delete insertData.document_type;
        
        const { data: retryValidationDetail, error: retryError } = await supabase
          .from('validation_detail')
          .insert(insertData)
          .select('id')
          .single();
        
        if (retryError) {
          console.error('[create-validation-record] Retry also failed:', retryError);
          throw new Error(`Failed to create validation_detail: ${retryError.message}`);
        }
        
        console.log('[create-validation-record] Created validation_detail (without document_type):', retryValidationDetail.id);
        
        const responseData = {
          success: true,
          summaryId: summaryId,
          detailId: retryValidationDetail.id,
          validationTypeId: validationTypeId,
          namespace: pineconeNamespace,
        };
        
        return createSuccessResponse(responseData);
      }
      
      throw new Error(`Failed to create validation_detail: ${detailError.message}`);
    }

    console.log('[create-validation-record] Created validation_detail:', validationDetail.id);

    const responseData = {
      success: true,
      summaryId: summaryId,
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
