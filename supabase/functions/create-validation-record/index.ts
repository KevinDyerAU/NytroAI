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
  userId?: string;
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
      pineconeNamespace,
      userId 
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

    // Step 1: Find or create validation_summary using unitLink
    console.log('[create-validation-record] 1. Looking for existing validation_summary with unitLink:', unitLink);
    
    const { data: existingSummary, error: findError } = await supabase
      .from('validation_summary')
      .select('id, reqExtracted')
      .eq('unitLink', unitLink)
      .single();

    let summaryId: number;

    if (findError) {
      if (findError.code === 'PGRST116') { // Not found - create it
        console.log('[create-validation-record] No validation_summary found, creating from unit_of_competency...');
        
        // Get unit details from UnitOfCompetency table
        const { data: unitData, error: unitError } = await supabase
          .from('UnitOfCompetency')
          .select('unitCode, Title, Link')
          .eq('Link', unitLink)
          .single();

        if (unitError || !unitData) {
          console.error('[create-validation-record] Unit not found in UnitOfCompetency:', unitError);
          return createErrorResponse(
            `Unit not found: ${unitCode}. Please ensure the unit exists in the database.`,
            404
          );
        }

        console.log('[create-validation-record] Found unit in UnitOfCompetency:', unitData.unitCode);

        // Create new validation_summary
        const summaryInsertData: any = {
          unitCode: unitData.unitCode,
          unitLink: unitData.Link,
          rtoCode: rtoCode, // Use rtoCode from request (UnitOfCompetency doesn't have rto_code)
          reqExtracted: false, // Requirements not yet extracted
        };
        
        // Add user_id if provided
        if (userId) {
          summaryInsertData.user_id = userId;
        }
        
        const { data: newSummary, error: createSummaryError } = await supabase
          .from('validation_summary')
          .insert(summaryInsertData)
          .select('id')
          .single();

        if (createSummaryError) {
          console.error('[create-validation-record] Error creating validation_summary:', createSummaryError);
          throw new Error(`Failed to create validation_summary: ${createSummaryError.message}`);
        }

        console.log('[create-validation-record] Created new validation_summary:', newSummary.id);
        summaryId = newSummary.id;
      } else {
        console.error('[create-validation-record] Error finding validation_summary:', findError);
        throw new Error(`Failed to find validation_summary: ${findError.message}`);
      }
    } else {
      // Found existing summary
      console.log('[create-validation-record] Found existing validation_summary:', existingSummary.id);
      summaryId = existingSummary.id;

      // Warn if requirements not extracted (but don't block - allow validation to proceed)
      if (!existingSummary.reqExtracted) {
        console.warn('[create-validation-record] ⚠️ Requirements not yet extracted for this unit. Validation will proceed but may have limited functionality.');
      }
    }

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
    // Map documentType to validation_type code for lookup
    const validationTypeCode = documentType === 'learner_guide' ? 'learner_guide' : 'unit';
    console.log('[create-validation-record] 2. Looking up validation_type:', validationTypeCode, '(from documentType:', documentType, ')');
    let validationTypeId: number;

    const { data: existingType, error: typeError } = await supabase
      .from('validation_type')
      .select('id, code')
      .eq('code', validationTypeCode)
      .single();

    if (typeError && typeError.code !== 'PGRST116') {
      console.error('[create-validation-record] Error looking up validation_type:', typeError);
      throw new Error(`Failed to look up validation_type: ${typeError.message}`);
    }

    if (existingType) {
      console.log('[create-validation-record] Using existing validation_type:', existingType.id, '(', existingType.code, ')');
      validationTypeId = existingType.id;
    } else {
      console.log('[create-validation-record] Creating new validation_type:', validationTypeCode);
      const { data: newType, error: createTypeError } = await supabase
        .from('validation_type')
        .insert({ code: validationTypeCode })
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
    
    // Add user_id if provided
    if (userId) {
      insertData.user_id = userId;
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
