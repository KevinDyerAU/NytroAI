/**
 * Trigger Validation (n8n Integration)
 * 
 * Simplified edge function that calls n8n workflow instead of orchestrating validation
 * This replaces the complex trigger-validation function
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { fetchRequirements, formatRequirementsAsJSON, type Requirement } from '../_shared/requirements-fetcher.ts';

const N8N_WEBHOOK_URL = 'https://n8n-gtoa.onrender.com/webhook/validate-document';

interface TriggerValidationRequest {
  validationDetailId: number;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const { validationDetailId } = await req.json();

    if (!validationDetailId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing validationDetailId' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Trigger Validation N8n] Starting for validationDetailId:', validationDetailId);

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch validation context
    const { data: validationDetail, error: detailError } = await supabase
      .from('validation_detail')
      .select(`
        id,
        summary_id,
        namespace_code,
        file_search_store_id,
        file_search_store_name,
        validation_type (code),
        validation_summary!inner (
          unitCode,
          unitLink,
          rtoCode
        )
      `)
      .eq('id', validationDetailId)
      .single();

    if (detailError || !validationDetail) {
      console.error('[Trigger Validation N8n] Failed to fetch validation detail:', detailError);
      return new Response(
        JSON.stringify({ success: false, error: 'Validation detail not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch documents with Gemini operation info
    const { data: documents, error: docsError } = await supabase
      .from('documents')
      .select('id, file_name, storage_path, file_search_store_id')
      .eq('validation_detail_id', validationDetailId)
      .order('created_at', { ascending: true });

    if (docsError || !documents || documents.length === 0) {
      console.error('[Trigger Validation N8n] Failed to fetch documents:', docsError);
      console.error('[Trigger Validation N8n] Error details:', JSON.stringify(docsError));
      return new Response(
        JSON.stringify({ success: false, error: 'No documents found', details: docsError?.message }),
        { status: 404, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // Fetch ALL Gemini operations for ALL documents in this validation
    const { data: geminiOps, error: opError } = await supabase
      .from('gemini_operations')
      .select('id, operation_name, status, document_id')
      .eq('validation_detail_id', validationDetailId)
      .order('created_at', { ascending: false });

    if (opError || !geminiOps || geminiOps.length === 0) {
      console.error('[Trigger Validation N8n] No Gemini operations found for validation');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No Gemini upload operations found. Call upload-document first.' 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    console.log(`[Trigger Validation N8n] Found ${geminiOps.length} Gemini operations for validation ${validationDetailId}`);
    
    // Get file search store from validation_detail (all docs share same store now)
    const fileSearchStoreId = validationDetail.file_search_store_id;
    
    if (!fileSearchStoreId) {
      console.error('[Trigger Validation N8n] Validation missing file_search_store_id');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Documents not uploaded to Gemini. Call upload-document first.' 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // Get unit requirements using the same logic as validate-assessment
    const unitCode = validationDetail.validation_summary.unitCode;
    const unitLink = validationDetail.validation_summary.unitLink;
    const validationType = validationDetail.validation_type.code;
    
    console.log('[Trigger Validation N8n] Fetching requirements for unit:', unitCode, 'type:', validationType);
    
    // For 'assessment' type, fetch ALL requirements (like full_validation)
    // Otherwise fetch specific type
    const fetchType = validationType === 'assessment' ? 'full_validation' : validationType;
    console.log('[Trigger Validation N8n] Using fetch type:', fetchType);
    
    const requirements: Requirement[] = await fetchRequirements(supabase, unitCode, fetchType, unitLink);
    console.log(`[Trigger Validation N8n] Retrieved ${requirements.length} requirements`);

    // Check if we have requirements - if not, we cannot validate
    if (!requirements || requirements.length === 0) {
      console.error(`[Trigger Validation N8n] No requirements found for ${unitCode} - cannot validate`);
      return new Response(
        JSON.stringify({ success: false, error: `No requirements found for unit ${unitCode}` }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // Prepare n8n request with ALL operations to poll
    const n8nRequest = {
      validationDetailId: validationDetail.id,
      operations: geminiOps.map(op => ({
        id: op.id,
        operationName: op.operation_name,
        status: op.status,
        documentId: op.document_id
      })),
      fileSearchStoreId: fileSearchStoreId,
      fileSearchStoreName: validationDetail.file_search_store_name,
      validationType: validationDetail.validation_type.code,
      unitCode: unitCode,
      unitLink: unitLink,
      rtoCode: validationDetail.validation_summary.rtoCode,
      namespaceCode: validationDetail.namespace_code,
      requirements: requirements,
      requirementsCount: requirements.length,
    };

    console.log('[Trigger Validation N8n] Calling n8n webhook:', {
      validationDetailId,
      operationCount: geminiOps.length,
      validationType: validationDetail.validation_type.code
    });

    // Call n8n webhook
    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(n8nRequest),
    });

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text();
      console.error('[Trigger Validation N8n] N8n webhook failed:', errorText);
      return new Response(
        JSON.stringify({ success: false, error: `N8n webhook failed: ${errorText}` }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // N8n workflow will handle polling and validation asynchronously
    // Don't wait for response - just confirm it was triggered
    console.log('[Trigger Validation N8n] ✅ N8n workflow triggered successfully');
    console.log('[Trigger Validation N8n] Workflow will poll operation status and call validate-assessment-v2');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Validation triggered via n8n',
        validationDetailId: validationDetailId
      }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    );

  } catch (error) {
    console.error('[Trigger Validation N8n] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    );
  }
});
