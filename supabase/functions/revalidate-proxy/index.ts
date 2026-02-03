/**
 * Revalidate Proxy Edge Function
 * 
 * Proxies revalidate requirement requests to n8n workflow for 2-phase revalidation
 * Uses the same pattern as trigger-validation-n8n
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { handleCors, createErrorResponse, corsHeaders } from '../_shared/cors.ts';

const N8N_REVALIDATE_WEBHOOK_URL = 'https://n8n-gtoa.onrender.com/webhook/revalidate-2phase';

interface RevalidateRequest {
  validation_result: {
    id: number;
    validation_detail_id: number;
    requirement_number: string;
    requirement_text: string;
    requirement_type: string;
    status: string;
    reasoning: string;
    mapped_content: string;
    citations: string;
    doc_references: string;
    smart_questions: string;
    benchmark_answer: string;
  };
  validation_result_id?: number;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return handleCors(req);
  }

  try {
    const body = await req.json() as RevalidateRequest;

    const validationResult = body.validation_result;
    const validationResultId = validationResult?.id || body.validation_result_id;

    if (!validationResultId) {
      return createErrorResponse('Missing validation_result_id', 400);
    }

    console.log(`[Revalidate Proxy] Start processing. ID: ${validationResultId}`);

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Always proxy to n8n for 2-phase revalidation
    return await proxyToN8n(supabase, body, validationResultId);

  } catch (error: any) {
    console.error('[Revalidate Proxy] Error:', error);
    return createErrorResponse(error.message || 'Internal server error', 500);
  }
});

/**
 * Proxy to n8n for 2-phase revalidation
 * Follows the same pattern as trigger-validation-n8n
 */
async function proxyToN8n(supabase: any, body: any, validationResultId: number) {
  console.log('[Revalidate Proxy] Proxying to n8n:', N8N_REVALIDATE_WEBHOOK_URL);

  const validationResult = body.validation_result;
  let validationDetailId = validationResult?.validation_detail_id;

  // Fetch validation_detail_id if not provided
  if (!validationDetailId) {
    const { data: resultData } = await supabase
      .from('validation_results')
      .select('validation_detail_id')
      .eq('id', validationResultId)
      .single();

    if (!resultData?.validation_detail_id) {
      throw new Error(`Could not find validation_detail_id for result ${validationResultId}`);
    }
    validationDetailId = resultData.validation_detail_id;
  }

  // Fetch validation context (same pattern as trigger-validation-n8n)
  const { data: validationDetail, error: detailError } = await supabase
    .from('validation_detail')
    .select(`
      id,
      document_type,
      file_search_store_id,
      file_search_store_name,
      namespace_code,
      validation_summary!inner (
        unitCode,
        unitLink,
        rtoCode
      )
    `)
    .eq('id', validationDetailId)
    .single();

  if (detailError || !validationDetail) {
    throw new Error(`Validation detail not found: ${detailError?.message}`);
  }

  // Fetch documents with Gemini operation info
  const { data: documents, error: docsError } = await supabase
    .from('documents')
    .select('id, file_name, storage_path')
    .eq('validation_detail_id', validationDetailId)
    .order('created_at', { ascending: true });

  if (docsError || !documents || documents.length === 0) {
    console.error('[Revalidate Proxy] No documents found:', docsError);
  }

  // Fetch Gemini operations for this validation
  const { data: geminiOps } = await supabase
    .from('gemini_operations')
    .select('id, operation_name, status, document_id')
    .eq('validation_detail_id', validationDetailId)
    .order('created_at', { ascending: false });

  // Build n8n payload (similar to trigger-validation-n8n)
  const n8nPayload = {
    validation_result_id: validationResultId,
    validation_result: {
      ...validationResult,
      validation_detail_id: validationDetailId
    },
    validationDetailId: validationDetailId,
    fileSearchStoreId: validationDetail.file_search_store_id,
    fileSearchStoreName: validationDetail.file_search_store_name,
    unitCode: validationDetail.validation_summary.unitCode,
    unitLink: validationDetail.validation_summary.unitLink,
    rtoCode: validationDetail.validation_summary.rtoCode,
    namespaceCode: validationDetail.namespace_code,
    documentType: validationDetail.document_type,
    documents: documents?.map((doc: any) => ({
      id: doc.id,
      fileName: doc.file_name,
      storagePath: doc.storage_path
    })) || [],
    operations: geminiOps?.map((op: any) => ({
      id: op.id,
      operationName: op.operation_name,
      status: op.status,
      documentId: op.document_id
    })) || []
  };

  console.log('[Revalidate Proxy] Calling n8n webhook:', {
    validationResultId,
    validationDetailId,
    requirementNumber: validationResult?.requirement_number,
    requirementType: validationResult?.requirement_type
  });

  const response = await fetch(N8N_REVALIDATE_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(n8nPayload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`n8n request failed: ${response.status} - ${errorText}`);
  }

  // N8n workflow will handle revalidation asynchronously
  console.log('[Revalidate Proxy] ✅ N8n 2-phase revalidation triggered successfully');

  return new Response(
    JSON.stringify({
      success: true,
      message: 'Revalidation triggered via n8n',
      validation_result_id: validationResultId,
      validationDetailId: validationDetailId
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  );
}
