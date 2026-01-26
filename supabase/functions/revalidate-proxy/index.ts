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

  // 3. Smart Element Retrieval - Use simple sequential searches instead of complex .or()
  const reqNum = (validationResult.requirement_number || '').trim();
  const reqText = (validationResult.requirement_text || '').trim();

  console.log(`[Revalidate Proxy] Searching for: "${reqNum}"`);

  const docUrls = documents.map((doc: any) => `s3://smartrtobucket/${doc.storage_path}`);

  // Try simple exact requirement number search first
  let { data: matchedElements } = await supabase
    .from('elements')
    .select('id, text, url, page_number')
    .in('url', docUrls)
    .ilike('text', `%${reqNum}%`)
    .limit(50);

  // If no matches, try keywords from requirement text
  if (!matchedElements || matchedElements.length === 0) {
    const keywords = reqText.split(' ').filter(w => w.length > 6).slice(0, 2);
    if (keywords.length > 0) {
      console.log(`[Revalidate Proxy] No exact match, trying keywords: ${keywords.join(', ')}`);
      const { data: keywordMatches } = await supabase
        .from('elements')
        .select('id, text, url, page_number')
        .in('url', docUrls)
        .ilike('text', `%${keywords[0]}%`)
        .limit(50);
      matchedElements = keywordMatches;
    }
  }

  let finalContent = '';
  if (matchedElements && matchedElements.length > 0) {
    // 2. Fetch all elements from the pages where we found matches to give the AI context
    const pageNumbers = [...new Set(matchedElements.map((e: any) => e.page_number))];
    console.log(`[Revalidate Proxy] Found matches on pages: ${pageNumbers.join(', ')}. Fetching context...`);

    const { data: contextualElements } = await supabase
      .from('elements')
      .select('text, url, page_number')
      .in('url', docUrls)
      .in('page_number', pageNumbers.slice(0, 6)) // Limit to first 6 matching pages
      .order('id', { ascending: true })
      .limit(120);

    const docGroups: Record<string, string[]> = {};
    (contextualElements || matchedElements).forEach((e: any) => {
      if (!docGroups[e.url]) docGroups[e.url] = [];
      docGroups[e.url].push(e.text);
    });

    for (const [url, texts] of Object.entries(docGroups)) {
      const fileName = documents.find(d => `s3://smartrtobucket/${d.storage_path}` === url)?.file_name || 'Document';
      finalContent += `\n=== RELEVANT EXCERPTS FROM: ${fileName} ===\n${texts.join('\n')}\n`;
    }
  } else {
    // 3. Fallback: If no keyword match, take the document overviews (first 60 elements)
    console.log(`[Revalidate Proxy] No keyword match for ${reqNum}. Falling back to document overviews.`);
    const { data: overviews } = await supabase
      .from('elements')
      .select('text, url')
      .in('url', docUrls)
      .limit(80);

    const docGroups: Record<string, string[]> = {};
    (overviews || []).forEach((e: any) => {
      if (!docGroups[e.url]) docGroups[e.url] = [];
      docGroups[e.url].push(e.text);
    });

    for (const [url, texts] of Object.entries(docGroups)) {
      const fileName = documents.find(d => `s3://smartrtobucket/${d.storage_path}` === url)?.file_name || 'Document';
      finalContent += `\n=== DOCUMENT OVERVIEW: ${fileName} ===\n${texts.join('\n')}\n`;
    }
  }

  if (!finalContent.trim()) {
    throw new Error('Could not find any relevant document content for this requirement.');
  }

  // 4. Fetch Prompt Template
  // Determine document type - essential for learner guide prompts
  const documentType = detail.document_type ||
    (requirementType === 'knowledge_evidence' && validationResult.requirement_text?.toLowerCase().includes('learner') ? 'learner_guide' : 'unit');

  console.log(`[Revalidate Proxy] Searching for prompt: type=${requirementType}, doc=${documentType}`);

  // 1. Try finding specific validation prompt for this type + document
  let { data: promptTemplate } = await supabase
    .from('prompts')
    .select('*')
    .eq('prompt_type', 'validation')
    .eq('requirement_type', requirementType)
    .eq('document_type', documentType)
    .eq('is_active', true)
    .eq('is_default', true)
    .limit(1)
    .maybeSingle();

  // 2. Fallback to general revalidation prompt if no specific one found
  if (!promptTemplate) {
    const { data: generalRevalPrompt } = await supabase
      .from('prompts')
      .select('*')
      .eq('prompt_type', 'requirement_revalidation')
      .eq('requirement_type', 'general')
      .eq('is_active', true)
      .eq('is_default', true)
      .limit(1)
      .maybeSingle();

    promptTemplate = generalRevalPrompt;
  }

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
    'You are an expert RTO validator. You MUST return a JSON response with ALL of the following fields: status, reasoning, mapped_content, citations (array), recommendations, smart_task, and benchmark_answer. Never omit any required fields.';

  // For Azure, only add explicit format instruction when using fallback (no database prompt)
  // Database prompts should have their own proper instructions
  if (!promptTemplate) {
    const outputFormatInstruction = `

IMPORTANT: You MUST return a JSON object with this exact structure:
{
  "status": "Met" | "Partially Met" | "Not Met",
  "reasoning": "detailed explanation here",
  "mapped_content": "specific evidence from documents",
  "citations": ["document reference 1", "document reference 2"],
  "smart_task": "A practical task or observation that assesses this requirement",
  "benchmark_answer": "Expected observable behavior for competent performance",
  "recommendations": "improvement suggestions if not fully met"
}

ALL fields are required. If a field doesn't apply, use an empty string "" or empty array [].`;

    promptText += outputFormatInstruction;
  }

  // 6. Call AI
  console.log(`[Revalidate Proxy] Calling Azure for ${validationResult.requirement_number} using ${promptTemplate?.name || 'fallback prompt'}`);
  const aiResponse = await aiClient.generateValidation({
    prompt: promptText,
    documentContent: finalContent,
    systemInstruction,
    outputSchema: promptTemplate?.output_schema,
    generationConfig: promptTemplate?.generation_config
  });

  // 7. Parse & Store Result - ROBUST MAPPING
  console.log('[Revalidate Proxy] AI Response Sample:', aiResponse.text.substring(0, 300));
  let parsedResult: any;
  try {
    parsedResult = JSON.parse(aiResponse.text);
  } catch (e) {
    console.error('[Revalidate Proxy] JSON Parse Failed:', aiResponse.text);
    throw new Error('AI returned invalid JSON');
  }

  // Normalize keys to lowercase AND replace spaces with underscores
  const normalizedResult: any = {};
  for (const key in parsedResult) {
    const normalizedKey = key.toLowerCase().replace(/\s+/g, '_');
    normalizedResult[normalizedKey] = parsedResult[key];
  }

  console.log('[Revalidate Proxy] Normalized keys:', Object.keys(normalizedResult).join(', '));
  console.log('[Revalidate Proxy] Full normalized result:', JSON.stringify(normalizedResult).substring(0, 500));

  // Handle special case: AI sometimes puts citations array in mapped_content
  let citations = normalizedResult.citations || normalizedResult.doc_references || normalizedResult.evidence_citations || [];
  let mappedContent = normalizedResult.mapped_content || normalizedResult.evidence_found || '';

  // If mapped_content is an array, it's probably citations
  if (Array.isArray(mappedContent) && (!citations || (Array.isArray(citations) && citations.length === 0))) {
    citations = mappedContent;
    mappedContent = ''; // Clear mapped_content since we moved it to citations
  }

  // Extract smart_task and benchmark_answer - handle both flat and nested formats
  let smartQuestions = '';
  let benchmarkAnswer = '';

  const smartTaskField = normalizedResult.smart_task || normalizedResult.smart_question || normalizedResult.assessment_question;
  if (smartTaskField) {
    if (typeof smartTaskField === 'object' && !Array.isArray(smartTaskField)) {
      // AI returned nested object like { "Task Text": "...", "Benchmark Answer": "..." }
      smartQuestions = smartTaskField.task_text || smartTaskField['task text'] || smartTaskField.text || '';
      benchmarkAnswer = smartTaskField.benchmark_answer || smartTaskField['benchmark answer'] || smartTaskField.answer || '';
    } else {
      smartQuestions = String(smartTaskField);
    }
  }

  // If benchmark_answer is separate, use it
  const benchmarkField = normalizedResult.benchmark_answer || normalizedResult.model_answer || normalizedResult.expected_behavior;
  if (benchmarkField && !benchmarkAnswer) {
    if (typeof benchmarkField === 'object' && !Array.isArray(benchmarkField)) {
      benchmarkAnswer = benchmarkField.text || benchmarkField.answer || JSON.stringify(benchmarkField);
    } else {
      benchmarkAnswer = String(benchmarkField);
    }
  }

  // Handle mapped_content - extract text if it's an object
  if (typeof mappedContent === 'object' && !Array.isArray(mappedContent)) {
    const textValue = mappedContent.observation_task_number ||
      mappedContent['observation/task_number'] ||
      mappedContent.text ||
      mappedContent.content;
    mappedContent = textValue ? String(textValue) : '';
  }

  // Handle recommendations - extract text if it's an object
  let recommendations = normalizedResult.recommendations || normalizedResult.improvement_suggestions || normalizedResult.unmapped_content || '';
  if (typeof recommendations === 'object' && !Array.isArray(recommendations)) {
    recommendations = recommendations.text || recommendations.content || '';
  }

  // Reconcile all fields
  const status = normalizedResult.status || 'Unknown';
  const reasoning = normalizedResult.reasoning || normalizedResult.explanation || normalizedResult.rationale || '';

  const updateData = {
    status,
    reasoning: typeof reasoning === 'string' ? reasoning : '',
    mapped_content: typeof mappedContent === 'string' ? mappedContent : '',
    citations: Array.isArray(citations) ? JSON.stringify(citations) : String(citations || '[]'),
    recommendations: typeof recommendations === 'string' ? recommendations : '',
    smart_questions: smartQuestions,
    benchmark_answer: benchmarkAnswer,
    updated_at: new Date().toISOString()
  };

  console.log('[Revalidate Proxy] Update data:', {
    status,
    reasoningLength: reasoning.length,
    citationsLength: updateData.citations.length,
    smartQuestionsLength: smartQuestions.length,
    benchmarkLength: benchmarkAnswer.length
  });

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
