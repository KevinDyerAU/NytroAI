/**
 * Regenerate Questions Proxy Edge Function
 * 
 * Proxies regenerate questions requests to either:
 * 1. n8n workflow (for Google/Legacy)
 * 2. Azure OpenAI Directly (for modern Azure orchestration)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { handleCors, createErrorResponse, corsHeaders } from '../_shared/cors.ts';
import { createAIClient, getAIProviderConfig } from '../_shared/ai-provider.ts';

interface RegenerateRequest {
  validation_detail_id: number;
  validation_result_id: number;
  user_guidance: string;
  requirement_text?: string;
  existing_smart_question?: string;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return handleCors(req);
  }

  try {
    const supabase = createSupabaseClient(req);
    const config = getAIProviderConfig();
    const body = await req.json() as RegenerateRequest;

    const { validation_detail_id, validation_result_id, user_guidance } = body;

    if (!validation_result_id) {
      return createErrorResponse('Missing validation_result_id', 400);
    }

    console.log(`[Regenerate Proxy] Start processing. Provider: ${config.provider}, ID: ${validation_result_id}`);

    // If Azure provider is active, handle directly
    if (config.provider === 'azure') {
      return await handleAzureRegeneration(supabase, body);
    }

    // Default: Proxy to n8n (Legacy/Google behavior)
    return await proxyToN8n(body);

  } catch (error: any) {
    console.error('[Regenerate Proxy] Error:', error);
    return createErrorResponse(error.message || 'Internal server error', 500);
  }
});

/**
 * Handle regeneration directly using Azure OpenAI
 */
async function handleAzureRegeneration(supabase: any, body: RegenerateRequest) {
  console.log('[Regenerate Proxy] Executing Azure Direct Regeneration...');

  const aiClient = createAIClient();
  const { validation_detail_id, validation_result_id, user_guidance, requirement_text } = body;

  // 1. Fetch Validation Context & Result
  let finalRequirementText = requirement_text;
  let requirementType = 'general';

  const { data: resultData } = await supabase
    .from('validation_results')
    .select('requirement_text, requirement_type')
    .eq('id', validation_result_id)
    .single();

  if (resultData) {
    if (!finalRequirementText) finalRequirementText = resultData.requirement_text;
    requirementType = resultData.requirement_type || 'general';
  }

  // 2. Fetch Detail for Document Type
  const { data: detail } = await supabase
    .from('validation_detail')
    .select('document_type')
    .eq('id', validation_detail_id)
    .single();

  const documentType = detail?.document_type ||
    (finalRequirementText?.toLowerCase().includes('learner') ? 'learner_guide' : 'unit');

  // 3. Smart Element Retrieval - Target the specific requirement
  console.log(`[Regenerate Proxy] Performing targeted search for: "${finalRequirementText}"`);

  const { data: documents } = await supabase
    .from('documents')
    .select('id, file_name, storage_path')
    .eq('validation_detail_id', validation_detail_id);

  const docUrls = (documents || []).map((doc: any) => `s3://smartrtobucket/${doc.storage_path}`);
  // Extract core keywords
  const keywords = (finalRequirementText || '').split(' ')
    .filter(w => w.length > 5)
    .slice(0, 3)
    .join(' ');

  // 1. Find elements that explicitly mention the requirement keywords
  const { data: matchedElements } = await supabase
    .from('elements')
    .select('id, text, url, page_number')
    .in('url', docUrls)
    .or(`text.ilike.%${keywords}%`)
    .limit(32);

  let finalContent = '';
  if (matchedElements && matchedElements.length > 0) {
    // 2. Fetch context from those pages
    const pageNumbers = [...new Set(matchedElements.map((e: any) => e.page_number))];
    const { data: contextualElements } = await supabase
      .from('elements')
      .select('text, url, page_number')
      .in('url', docUrls)
      .in('page_number', pageNumbers.slice(0, 5))
      .order('id', { ascending: true })
      .limit(100);

    const docGroups: Record<string, string[]> = {};
    (contextualElements || matchedElements).forEach((e: any) => {
      if (!docGroups[e.url]) docGroups[e.url] = [];
      docGroups[e.url].push(e.text);
    });

    for (const [url, texts] of Object.entries(docGroups)) {
      const fileName = documents?.find(d => `s3://smartrtobucket/${d.storage_path}` === url)?.file_name || 'Document';
      finalContent += `\n=== RELEVANT CONTEXT FROM: ${fileName} ===\n${texts.join('\n')}\n`;
    }
  } else {
    // 3. Fallback: Overview
    const { data: overviews } = await supabase
      .from('elements')
      .select('text, url')
      .in('url', docUrls)
      .limit(60);

    const docGroups: Record<string, string[]> = {};
    (overviews || []).forEach((e: any) => {
      if (!docGroups[e.url]) docGroups[e.url] = [];
      docGroups[e.url].push(e.text);
    });

    for (const [url, texts] of Object.entries(docGroups)) {
      const fileName = documents?.find(d => `s3://smartrtobucket/${d.storage_path}` === url)?.file_name || 'Document';
      finalContent += `\n=== DOCUMENT OVERVIEW: ${fileName} ===\n${texts.join('\n')}\n`;
    }
  }

  // 4. Fetch Prompt Template
  // Try specific smart question prompt for this requirement type/doc type first
  let { data: promptTemplate } = await supabase
    .from('prompts')
    .select('*')
    .eq('prompt_type', 'smart_question')
    .eq('requirement_type', requirementType)
    .eq('document_type', documentType)
    .eq('is_active', true)
    .eq('is_default', true)
    .limit(1)
    .maybeSingle();

  // Fallback to general smart question prompt
  if (!promptTemplate) {
    const { data: generalPrompt } = await supabase
      .from('prompts')
      .select('*')
      .eq('prompt_type', 'smart_question')
      .eq('requirement_type', 'general')
      .eq('is_active', true)
      .eq('is_default', true)
      .limit(1)
      .maybeSingle();

    promptTemplate = generalPrompt;
  }

  // 4. Build Prompt
  let promptText = promptTemplate?.prompt_text ||
    `Generate a SMART assessment question for the following requirement.
    Requirement: {{requirement_text}}
    User Guidance: {{user_guidance}}`;

  promptText = promptText
    .replace(/{{requirement_text}}/g, finalRequirementText || '')
    .replace(/{{user_guidance}}/g, user_guidance || 'None provided');

  const systemInstruction = promptTemplate?.system_instruction ||
    'You are an expert RTO assessment designer. Return a JSON response with a question and rationale (which serves as the benchmark answer).';

  // 5. Call AI
  const aiResponse = await aiClient.generateValidation({
    prompt: promptText,
    documentContent: finalContent || 'No document content available.',
    systemInstruction,
    outputSchema: {
      type: "object",
      required: ["question", "rationale"],
      properties: {
        question: { type: "string" },
        rationale: { type: "string", description: "The benchmark answer/model response" }
      }
    }
  });

  // 6. Parse
  let parsedResult: any;
  try {
    parsedResult = JSON.parse(aiResponse.text);
  } catch (e) {
    console.error('[Regenerate Proxy] Failed to parse AI JSON:', aiResponse.text);
    throw new Error('AI returned invalid JSON');
  }

  // format response to match what frontend expects
  const responseData = {
    validation_detail_id,
    questions: [
      {
        question: parsedResult.question,
        rationale: parsedResult.rationale || parsedResult.benchmark_answer || 'No rationale provided',
        question_type: 'smart',
        difficulty_level: 'intermediate',
        focus_area: 'requirement_understanding'
      }
    ],
    response_timestamp: new Date().toISOString()
  };

  return new Response(
    JSON.stringify(responseData),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/**
 * Legacy behavior: Forward to n8n
 */
async function proxyToN8n(body: any) {
  const n8nUrl = Deno.env.get('N8N_REGENERATE_QUESTIONS_URL') || 'https://n8n-gtoa.onrender.com/webhook/smart-questions';

  console.log('[Regenerate Proxy] Proxying to n8n:', n8nUrl);

  const response = await fetch(n8nUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
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
