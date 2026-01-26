/**
 * Revalidate Proxy Edge Function
 * 
 * Proxies revalidate requirement requests to either:
 * 1. n8n workflow (for Google/Legacy)
 * 2. Azure OpenAI Directly (for modern Azure orchestration)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { handleCors, createErrorResponse, corsHeaders } from '../_shared/cors.ts';
import { createAIClient, getAIProviderConfig } from '../_shared/ai-provider.ts';

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
    const supabase = createSupabaseClient(req);
    const config = getAIProviderConfig();
    const body = await req.json() as RevalidateRequest;

    const validationResult = body.validation_result;
    const validationResultId = validationResult?.id || body.validation_result_id;

    if (!validationResultId) {
      return createErrorResponse('Missing validation_result_id', 400);
    }

    console.log(`[Revalidate Proxy] Start processing. Provider: ${config.provider}, ID: ${validationResultId}`);

    // If Azure provider is active, handle directly
    if (config.provider === 'azure') {
      return await handleAzureRevalidation(supabase, validationResult, validationResultId);
    }

    // Default: Proxy to n8n (Legacy/Google behavior)
    return await proxyToN8n(body, validationResultId);

  } catch (error: any) {
    console.error('[Revalidate Proxy] Error:', error);
    return createErrorResponse(error.message || 'Internal server error', 500);
  }
});

/**
 * Handle revalidation directly using Azure OpenAI
 */
async function handleAzureRevalidation(supabase: any, validationResult: any, validationResultId: number) {
  console.log('[Revalidate Proxy] Executing Azure Direct Revalidation...');

  const aiClient = createAIClient();
  const validationDetailId = validationResult.validation_detail_id;

  if (!validationDetailId) {
    // Try to fetch it from the database if not provided in payload
    const { data: resultData } = await supabase
      .from('validation_results')
      .select('validation_detail_id')
      .eq('id', validationResultId)
      .single();

    if (!resultData?.validation_detail_id) {
      throw new Error(`Could not find validation_detail_id for result ${validationResultId}`);
    }
    validationResult.validation_detail_id = resultData.validation_detail_id;
  }

  // 1. Fetch Validation Context
  const { data: detail, error: detailError } = await supabase
    .from('validation_detail')
    .select(`
      id,
      document_type,
      validation_summary!inner (
        unitCode,
        unitLink,
        rtoCode
      )
    `)
    .eq('id', validationResult.validation_detail_id)
    .single();

  if (detailError || !detail) {
    throw new Error(`Validation detail not found: ${detailError?.message}`);
  }

  // 2. Fetch Documents to get content
  const { data: documents, error: docsError } = await supabase
    .from('documents')
    .select('id, file_name, storage_path')
    .eq('validation_detail_id', validationResult.validation_detail_id);

  if (docsError || !documents || documents.length === 0) {
    throw new Error(`No documents found for this validation session`);
  }

  // 3. Extract/Fetch document content from elements table (Azure cache)
  let combinedContent = '';
  for (const doc of documents) {
    const docUrl = `s3://smartrtobucket/${doc.storage_path}`;
    const { data: elements } = await supabase
      .from('elements')
      .select('text')
      .eq('url', docUrl)
      .order('id', { ascending: true });

    if (elements && elements.length > 0) {
      const docText = elements.map((e: any) => e.text).join('\n');
      combinedContent += `\n=== DOCUMENT: ${doc.file_name} ===\n${docText}\n`;
    }
  }

  if (!combinedContent.trim()) {
    throw new Error('No document content found in cache. Please process documents first.');
  }

  // 4. Fetch Prompt Template
  // Map requirement_type shorthands to database prompt types
  let requirementType = validationResult.requirement_type;
  const typeMap: Record<string, string> = {
    'ke': 'knowledge_evidence',
    'pe': 'performance_evidence',
    'fs': 'foundation_skills',
    'epc': 'elements_performance_criteria',
    'ac': 'assessment_conditions',
    'ai': 'assessment_instructions',
    'learner': 'knowledge_evidence' // Fallback for learner guide parts
  };

  if (typeMap[requirementType]) {
    requirementType = typeMap[requirementType];
  }

  const documentType = detail.document_type || 'unit';

  const { data: promptTemplate } = await supabase
    .from('prompts')
    .select('*')
    .eq('prompt_type', 'validation')
    .eq('requirement_type', requirementType)
    .eq('document_type', documentType)
    .eq('is_active', true)
    .eq('is_default', true)
    .limit(1)
    .single();

  // 5. Build Prompt
  const unitCode = detail.validation_summary.unitCode;
  const unitTitle = detail.validation_summary.unitTitle || '';

  let promptText = promptTemplate?.prompt_text ||
    `Validate the following requirement against the provided documents.
    Requirement: {{requirement_number}} - {{requirement_text}}`;

  promptText = promptText
    .replace(/{{requirement_number}}/g, validationResult.requirement_number || '')
    .replace(/{{requirement_text}}/g, validationResult.requirement_text || '')
    .replace(/{{requirement_type}}/g, requirementType)
    .replace(/{{unit_code}}/g, unitCode)
    .replace(/{{unit_title}}/g, unitTitle)
    .replace(/{{document_type}}/g, documentType);

  const systemInstruction = promptTemplate?.system_instruction ||
    'You are an expert RTO validator. Return a JSON response with status, reasoning, mapped_content, citations, recommendations, smart_question, and benchmark_answer.';

  // 6. Call AI
  console.log(`[Revalidate Proxy] Calling Azure for ${validationResult.requirement_number}`);
  const aiResponse = await aiClient.generateValidation({
    prompt: promptText,
    documentContent: combinedContent,
    systemInstruction,
    outputSchema: promptTemplate?.output_schema
  });

  // 7. Parse & Store Result
  let parsedResult: any;
  try {
    parsedResult = JSON.parse(aiResponse.text);
  } catch (e) {
    console.error('[Revalidate Proxy] Failed to parse AI JSON:', aiResponse.text);
    throw new Error('AI returned invalid JSON');
  }

  const updateData = {
    status: parsedResult.status || 'Unknown',
    reasoning: parsedResult.reasoning || '',
    mapped_content: parsedResult.mapped_content || '',
    citations: Array.isArray(parsedResult.citations) ? JSON.stringify(parsedResult.citations) : (parsedResult.citations || ''),
    recommendations: parsedResult.recommendations || '',
    smart_questions: parsedResult.smart_question || '',
    benchmark_answer: parsedResult.benchmark_answer || '',
    updated_at: new Date().toISOString()
  };

  const { data: updatedResult, error: updateError } = await supabase
    .from('validation_results')
    .update(updateData)
    .eq('id', validationResultId)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Failed to update validation_results: ${updateError.message}`);
  }

  return new Response(
    JSON.stringify({
      success: true,
      data: updatedResult,
      provider: 'azure',
      status: updateData.status,
      validation_result_id: validationResultId
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * Legacy behavior: Forward to n8n
 */
async function proxyToN8n(body: any, validationResultId: number) {
  const n8nUrl = Deno.env.get('N8N_REVALIDATE_URL') || 'https://n8n-gtoa.onrender.com/webhook/revalidate-requirement';

  console.log('[Revalidate Proxy] Proxying to n8n:', n8nUrl);

  const n8nPayload = {
    validation_result_id: validationResultId,
    validation_result: body.validation_result,
  };

  const response = await fetch(n8nUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(n8nPayload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`n8n request failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
