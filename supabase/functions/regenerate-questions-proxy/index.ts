/**
 * Regenerate Questions Proxy Edge Function
 * 
 * Proxies regenerate questions requests to either:
 * 1. n8n workflow (for Google/Legacy)
 * 2. Azure OpenAI Directly (for modern Azure orchestration)
 * 
 * UPDATED: Now handles document processing on-demand if elements don't exist
 * and better handles Azure response parsing for smart questions/tasks
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { handleCors, createErrorResponse, corsHeaders } from '../_shared/cors.ts';
import { createAIClient, getAIProviderConfig } from '../_shared/ai-provider.ts';
import { createDefaultAzureDocIntelClient } from '../_shared/azure-document-intelligence.ts';

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
 * Process documents with Azure Document Intelligence and store elements
 * Returns the extracted elements for immediate use
 */
async function processDocumentsForAzure(
  supabase: any,
  documents: any[],
  validationDetailId: number
): Promise<any[]> {
  console.log(`[Regenerate Proxy] Processing ${documents.length} documents with Azure Document Intelligence...`);
  
  const docIntelClient = createDefaultAzureDocIntelClient();
  const allElements: any[] = [];

  for (const doc of documents) {
    const docUrl = `s3://smartrtobucket/${doc.storage_path}`;
    
    console.log(`[Regenerate Proxy] Processing document: ${doc.file_name}`);

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(doc.storage_path);

    if (downloadError || !fileData) {
      console.error(`[Regenerate Proxy] Failed to download ${doc.file_name}:`, downloadError);
      continue;
    }

    try {
      const fileBytes = new Uint8Array(await fileData.arrayBuffer());
      const extracted = await docIntelClient.extractDocument(fileBytes);

      // Create elements from extracted content
      const chunks = extracted.paragraphs?.map((p: any) => ({
        id: crypto.randomUUID(),
        text: p.content,
        page_number: p.pageNumber || 1,
        filename: doc.file_name,
        url: docUrl,
        type: p.role || 'paragraph',
        date_processed: new Date().toISOString()
      })) || [{
        id: crypto.randomUUID(),
        text: extracted.content,
        page_number: 1,
        filename: doc.file_name,
        url: docUrl,
        type: 'document',
        date_processed: new Date().toISOString()
      }];

      allElements.push(...chunks);

      // Store elements in database (await to ensure they're saved)
      const { error: insertError } = await supabase
        .from('elements')
        .insert(chunks);

      if (insertError) {
        console.error(`[Regenerate Proxy] Failed to store elements for ${doc.file_name}:`, insertError.message);
      } else {
        console.log(`[Regenerate Proxy] Stored ${chunks.length} elements for ${doc.file_name}`);
      }

    } catch (extractError) {
      console.error(`[Regenerate Proxy] Extraction failed for ${doc.file_name}:`, extractError);
      continue;
    }
  }

  // Update validation_detail to mark documents as extracted
  if (allElements.length > 0) {
    await supabase
      .from('validation_detail')
      .update({
        docExtracted: true,
        extractStatus: 'Completed',
        last_updated_at: new Date().toISOString()
      })
      .eq('id', validationDetailId);
  }

  return allElements;
}

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

  // Check if elements exist for these documents
  const { data: existingElements } = await supabase
    .from('elements')
    .select('id')
    .in('url', docUrls)
    .limit(1);

  if (!existingElements || existingElements.length === 0) {
    // No elements found - need to process documents first
    console.log('[Regenerate Proxy] No elements found for documents. Processing now...');
    
    const processedElements = await processDocumentsForAzure(supabase, documents || [], validation_detail_id);
    
    if (processedElements.length === 0) {
      throw new Error('Failed to extract content from documents. Please try again or re-upload the documents.');
    }
    
    console.log(`[Regenerate Proxy] Document processing complete. ${processedElements.length} elements extracted.`);
  }

  // Extract core keywords
  const keywords = (finalRequirementText || '').split(' ')
    .filter((w: string) => w.length > 5)
    .slice(0, 3)
    .join(' ');

  // 1. Find elements that explicitly mention the requirement keywords
  let { data: matchedElements } = await supabase
    .from('elements')
    .select('id, text, url, page_number')
    .in('url', docUrls)
    .ilike('text', `%${keywords}%`)
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
      const fileName = documents?.find((d: any) => `s3://smartrtobucket/${d.storage_path}` === url)?.file_name || 'Document';
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
      const fileName = documents?.find((d: any) => `s3://smartrtobucket/${d.storage_path}` === url)?.file_name || 'Document';
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

  // Determine if this is a performance-type requirement (needs practical task, not question)
  const isPerformanceType = ['performance_evidence', 'pe', 'elements_performance_criteria', 'epc'].includes(requirementType.toLowerCase());

  // 4. Build Prompt with explicit format instruction for Azure
  let promptText = promptTemplate?.prompt_text ||
    `Generate a SMART assessment ${isPerformanceType ? 'task' : 'question'} for the following requirement.
    Requirement: {{requirement_text}}
    User Guidance: {{user_guidance}}`;

  promptText = promptText
    .replace(/{{requirement_text}}/g, finalRequirementText || '')
    .replace(/{{user_guidance}}/g, user_guidance || 'None provided');

  // Add explicit format instruction for Azure to ensure proper JSON structure
  const formatInstruction = isPerformanceType
    ? `

IMPORTANT: You MUST return a JSON object with this EXACT structure:
{
  "question": "A practical workplace task or observation that assesses this requirement",
  "rationale": "The expected observable behavior or benchmark answer that demonstrates competency"
}

For performance evidence, the "question" field should describe a practical task, observation, or workplace activity - NOT a written question.`
    : `

IMPORTANT: You MUST return a JSON object with this EXACT structure:
{
  "question": "A clear, specific assessment question",
  "rationale": "The model answer or expected response that demonstrates understanding"
}`;

  promptText += formatInstruction;

  const systemInstruction = promptTemplate?.system_instruction ||
    `You are an expert RTO assessment designer. Return a JSON response with exactly two fields: "question" and "rationale". ${isPerformanceType ? 'For performance requirements, the question should be a practical workplace task or observation.' : 'The question should be clear and specific.'} The rationale serves as the benchmark answer.`;

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

  // 6. Parse with robust handling for Azure's varied response formats
  console.log('[Regenerate Proxy] AI Response:', aiResponse.text.substring(0, 500));
  
  let parsedResult: any;
  try {
    parsedResult = JSON.parse(aiResponse.text);
  } catch (e) {
    console.error('[Regenerate Proxy] Failed to parse AI JSON:', aiResponse.text);
    throw new Error('AI returned invalid JSON');
  }

  // Normalize keys to lowercase and replace spaces with underscores
  const normalizedResult: any = {};
  for (const key in parsedResult) {
    const normalizedKey = key.toLowerCase().replace(/\s+/g, '_');
    normalizedResult[normalizedKey] = parsedResult[key];
  }

  // Extract question - handle various field names Azure might use
  let question = normalizedResult.question ||
    normalizedResult.smart_question ||
    normalizedResult.assessment_question ||
    normalizedResult.practical_workplace_task ||
    normalizedResult.practical_task ||
    normalizedResult.task ||
    normalizedResult.tasks;

  // If question is an array, take the first one or join them
  if (Array.isArray(question)) {
    question = question.map((q: any) => typeof q === 'string' ? q : (q.question || q.task || q.text || JSON.stringify(q))).join('\n');
  } else if (typeof question === 'object' && question !== null) {
    question = question.question || question.task || question.text || JSON.stringify(question);
  }

  // Extract rationale - handle various field names
  let rationale = normalizedResult.rationale ||
    normalizedResult.benchmark_answer ||
    normalizedResult.model_answer ||
    normalizedResult.expected_behavior ||
    normalizedResult.expected_response ||
    normalizedResult.answer;

  if (typeof rationale === 'object' && rationale !== null) {
    rationale = rationale.text || rationale.answer || JSON.stringify(rationale);
  }

  // Ensure we have values
  if (!question) {
    console.error('[Regenerate Proxy] No question found in response:', normalizedResult);
    throw new Error('AI response did not contain a question');
  }

  // Format response to match what frontend expects
  const responseData = {
    validation_detail_id,
    questions: [
      {
        question: String(question),
        rationale: String(rationale || 'No rationale provided'),
        question_type: isPerformanceType ? 'practical_task' : 'smart',
        difficulty_level: 'intermediate',
        focus_area: 'requirement_understanding'
      }
    ],
    response_timestamp: new Date().toISOString()
  };

  // Also update the validation_results table with the new smart question
  const { error: updateError } = await supabase
    .from('validation_results')
    .update({
      smart_questions: String(question),
      benchmark_answer: String(rationale || ''),
      updated_at: new Date().toISOString()
    })
    .eq('id', validation_result_id);

  if (updateError) {
    console.error('[Regenerate Proxy] Failed to update validation_results:', updateError);
  } else {
    console.log('[Regenerate Proxy] Updated validation_results with new smart question');
  }

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
