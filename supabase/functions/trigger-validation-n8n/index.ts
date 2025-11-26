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

    // Fetch documents
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

    const document = documents[0];

    if (!document.file_search_store_id) {
      console.error('[Trigger Validation N8n] Document missing file_search_store_id');
      return new Response(
        JSON.stringify({ success: false, error: 'Document not indexed' }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    // Generate signed URL for document (valid for 1 hour)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('documents')
      .createSignedUrl(document.storage_path, 3600); // 1 hour expiry

    if (signedUrlError || !signedUrlData) {
      console.error('[Trigger Validation N8n] Failed to generate signed URL:', signedUrlError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to generate file access URL' }),
        { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    console.log('[Trigger Validation N8n] Generated signed URL for document');

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

    // Prepare n8n request with requirements included
    const n8nRequest = {
      validationDetailId: validationDetail.id,
      documentId: document.id,
      fileName: document.file_name,
      storagePath: document.storage_path,
      signedUrl: signedUrlData.signedUrl, // Pre-authenticated URL for n8n to download
      validationType: validationDetail.validation_type.code,
      fileSearchStore: document.file_search_store_id,
      unitCode: unitCode,
      unitLink: unitLink,
      rtoCode: validationDetail.validation_summary.rtoCode,
      namespaceCode: validationDetail.namespace_code,
      requirements: requirements, // Pass the full requirements array
      requirementsCount: requirements.length,
    };

    console.log('[Trigger Validation N8n] Calling n8n webhook:', {
      validationDetailId,
      documentId: document.id,
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

    const n8nResult = await n8nResponse.json();

    console.log('[Trigger Validation N8n] Success:', {
      validationDetailId: n8nResult.validationDetailId,
      status: n8nResult.status,
      validationsCount: n8nResult.validationsCount,
      citationCount: n8nResult.citations?.count
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Validation triggered via n8n',
        result: n8nResult
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
