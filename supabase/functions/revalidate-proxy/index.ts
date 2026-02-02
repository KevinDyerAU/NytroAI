/**
 * Revalidate Proxy Edge Function
 * 
 * Proxies revalidate requirement requests to either:
 * 1. n8n workflow (for Google/Legacy)
 * 2. Azure OpenAI Directly (for modern Azure orchestration)
 * 
 * UPDATED: Now handles document processing on-demand if elements don't exist
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { handleCors, createErrorResponse, corsHeaders } from '../_shared/cors.ts';
import { createAIClient, getAIProviderConfig } from '../_shared/ai-provider.ts';
import { createDefaultAzureDocIntelClient } from '../_shared/azure-document-intelligence.ts';

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
 * Process documents with Azure Document Intelligence and store elements
 * Returns the extracted elements for immediate use
 */
async function processDocumentsForAzure(
  supabase: any,
  documents: any[],
  validationDetailId: number
): Promise<any[]> {
  console.log(`[Revalidate Proxy] Processing ${documents.length} documents with Azure Document Intelligence...`);

  const docIntelClient = createDefaultAzureDocIntelClient();
  const allElements: any[] = [];

  for (const doc of documents) {
    const docUrl = `s3://smartrtobucket/${doc.storage_path}`;

    console.log(`[Revalidate Proxy] Processing document: ${doc.file_name}`);

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(doc.storage_path);

    if (downloadError || !fileData) {
      console.error(`[Revalidate Proxy] Failed to download ${doc.file_name}:`, downloadError);
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
        console.error(`[Revalidate Proxy] Failed to store elements for ${doc.file_name}:`, insertError.message);
      } else {
        console.log(`[Revalidate Proxy] Stored ${chunks.length} elements for ${doc.file_name}`);
      }

    } catch (extractError) {
      console.error(`[Revalidate Proxy] Extraction failed for ${doc.file_name}:`, extractError);
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
 * Handle revalidation directly using Azure OpenAI
 */
async function handleAzureRevalidation(supabase: any, validationResult: any, validationResultId: number) {
  console.log('[Revalidate Proxy] Executing Azure Direct Revalidation...');

  const aiClient = createAIClient();
  let validationDetailId = validationResult.validation_detail_id;

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
    validationDetailId = resultData.validation_detail_id;
    validationResult.validation_detail_id = validationDetailId;
  }

  // 1. Fetch Validation Context
  const { data: detail, error: detailError } = await supabase
    .from('validation_detail')
    .select(`
      id,
      document_type,
      docExtracted,
      extractStatus,
      validation_summary!inner (
        unitCode,
        unitLink,
        rtoCode
      )
    `)
    .eq('id', validationDetailId)
    .single();

  if (detailError || !detail) {
    throw new Error(`Validation detail not found: ${detailError?.message}`);
  }

  // 2. Fetch Documents to get content
  const { data: documents, error: docsError } = await supabase
    .from('documents')
    .select('id, file_name, storage_path')
    .eq('validation_detail_id', validationDetailId);

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

  // 3. Build document URLs and check for existing elements
  const docUrls = documents.map((doc: any) => `s3://smartrtobucket/${doc.storage_path}`);

  // Check if elements exist for these documents
  const { data: existingElements, error: elementsError } = await supabase
    .from('elements')
    .select('id, text, url, page_number')
    .in('url', docUrls)
    .limit(1);

  let sessionElements: any[] = [];

  if (!existingElements || existingElements.length === 0) {
    // No elements found - need to process documents first
    console.log('[Revalidate Proxy] No elements found for documents. Processing now...');

    sessionElements = await processDocumentsForAzure(supabase, documents, validationDetailId);

    if (sessionElements.length === 0) {
      throw new Error('Failed to extract content from documents. Please try again or re-upload the documents.');
    }

    console.log(`[Revalidate Proxy] Document processing complete. ${sessionElements.length} elements extracted.`);
  }

  // 4. Smart Element Retrieval - Use simple sequential searches instead of complex .or()
  const reqNum = (validationResult.requirement_number || '').trim();
  const reqText = (validationResult.requirement_text || '').trim();

  console.log(`[Revalidate Proxy] Searching for: "${reqNum}"`);

  // Try simple exact requirement number search first
  let { data: matchedElements } = await supabase
    .from('elements')
    .select('id, text, url, page_number')
    .in('url', docUrls)
    .ilike('text', `%${reqNum}%`)
    .limit(50);

  // If no matches, try keywords from requirement text
  if (!matchedElements || matchedElements.length === 0) {
    const keywords = reqText.split(' ').filter((w: string) => w.length > 6).slice(0, 2);
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
      const fileName = documents.find((d: any) => `s3://smartrtobucket/${d.storage_path}` === url)?.file_name || 'Document';
      finalContent += `\n=== RELEVANT EXCERPTS FROM: ${fileName} ===\n${texts.join('\n')}\n`;
    }
  } else {
    // 3. Fallback: If no keyword match, take the document overviews (first 80 elements)
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
      const fileName = documents.find((d: any) => `s3://smartrtobucket/${d.storage_path}` === url)?.file_name || 'Document';
      finalContent += `\n=== DOCUMENT OVERVIEW: ${fileName} ===\n${texts.join('\n')}\n`;
    }
  }

  if (!finalContent.trim()) {
    throw new Error('Could not find any relevant document content for this requirement.');
  }

  // 5. Fetch Prompt Template
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

  // 6. Build Prompt
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

  // For Azure, ALWAYS add explicit JSON format instruction
  // Azure/GPT doesn't respect output_schema like Gemini does, so we need explicit instructions
  const isKE = requirementType === 'knowledge_evidence';
  const isPE = requirementType === 'performance_evidence' || requirementType === 'elements_performance_criteria';

  // Build the JSON format instruction based on requirement type
  let outputFormatInstruction = '';

  if (isPE) {
    outputFormatInstruction = `

IMPORTANT: You MUST return a JSON object with this EXACT structure:
{
  "status": "Met" | "Partially Met" | "Not Met",
  "reasoning": "Detailed explanation (max 300 words)",
  "mapped_content": "Specific tasks/observations with page numbers",
  "citations": ["Document name, Section, Page X"],
  "smart_task": "If 'Met', use 'N/A'. Otherwise, ONE practical task",
  "benchmark_answer": "If 'Met', use 'N/A'. Otherwise, expected behavior",
  "unmapped_content": "What is missing. Use 'N/A' if fully met"
}

ALL fields are required. Return ONLY the JSON object.`;
  } else if (isKE) {
    outputFormatInstruction = `

IMPORTANT: You MUST return a JSON object with this EXACT structure:
{
  "status": "Met" | "Partially Met" | "Not Met",
  "reasoning": "Detailed explanation (max 300 words)",
  "mapped_content": "Specific questions/content with page numbers",
  "citations": ["Document name, Section, Page X"],
  "smart_question": "If 'Met', use 'N/A'. Otherwise, ONE question",
  "benchmark_answer": "If 'Met', use 'N/A'. Otherwise, expected answer",
  "unmapped_content": "What is missing. Use 'N/A' if fully met"
}

ALL fields are required. Return ONLY the JSON object.`;
  } else {
    outputFormatInstruction = `

IMPORTANT: You MUST return a JSON object with this EXACT structure:
{
  "status": "Met" | "Partially Met" | "Not Met",
  "reasoning": "Detailed explanation",
  "mapped_content": "Specific content with page numbers",
  "citations": ["Document name, Section, Page X"],
  "smart_task": "If 'Met', use 'N/A'. Otherwise, ONE task/question",
  "benchmark_answer": "If 'Met', use 'N/A'. Otherwise, expected answer",
  "unmapped_content": "What is missing. Use 'N/A' if fully met"
}

ALL fields are required. Return ONLY the JSON object.`;
  }

  promptText += outputFormatInstruction;

  // 7. Call AI
  console.log(`[Revalidate Proxy] Calling Azure for ${validationResult.requirement_number} using ${promptTemplate?.name || 'fallback prompt'}`);
  const aiResponse = await aiClient.generateValidation({
    prompt: promptText,
    documentContent: finalContent,
    systemInstruction,
    outputSchema: promptTemplate?.output_schema,
    generationConfig: promptTemplate?.generation_config
  });

  // 8. Parse & Store Result - ROBUST MAPPING
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

  // Extract smart_task/practical_task and benchmark_answer - handle both flat and nested formats
  // For Performance Evidence/Elements: AI returns practical_workplace_task
  // For Knowledge Evidence: AI returns smart_task or smart_question
  // Both map to the same database field: smart_questions
  let smartQuestions = '';
  let benchmarkAnswer = '';

  const smartTaskField = normalizedResult.practical_workplace_task ||
    normalizedResult.practical_task ||
    normalizedResult.smart_task ||
    normalizedResult.smart_question ||
    normalizedResult.suggested_question ||
    normalizedResult.assessment_question ||
    normalizedResult.tasks;  // Handle Azure returning 'tasks' instead of smart_questions

  if (smartTaskField) {
    if (typeof smartTaskField === 'object' && !Array.isArray(smartTaskField)) {
      // AI returned nested object like { "Task Text": "...", "Benchmark Answer": "..." }
      smartQuestions = smartTaskField.task_text || smartTaskField['task text'] || smartTaskField.text || smartTaskField.question || '';
      benchmarkAnswer = smartTaskField.benchmark_answer || smartTaskField['benchmark answer'] || smartTaskField.answer || '';
    } else if (Array.isArray(smartTaskField)) {
      // AI returned array of tasks - join them
      smartQuestions = smartTaskField.map((t: any) => typeof t === 'string' ? t : (t.task_text || t.text || t.question || JSON.stringify(t))).join('\n');
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
  // For KE, it might be in 'mapped_questions'
  if (!mappedContent || mappedContent === 'N/A') {
    mappedContent = normalizedResult.mapped_questions || '';
  }

  if (typeof mappedContent === 'object' && !Array.isArray(mappedContent)) {
    const textValue = mappedContent.observation_task_number ||
      mappedContent['observation/task_number'] ||
      mappedContent.text ||
      mappedContent.content ||
      mappedContent.question;
    mappedContent = textValue ? String(textValue) : '';
  }

  // Handle recommendations - extract text if it's an object
  // For PE/EPC: unmapped_content maps to recommendations
  // For KE: recommendations or improvement_suggestions
  let recommendations = normalizedResult.unmapped_content ||
    normalizedResult.recommendations ||
    normalizedResult.improvement_suggestions || '';
  if (typeof recommendations === 'object' && !Array.isArray(recommendations)) {
    recommendations = recommendations.text || recommendations.content || '';
  }

  // Reconcile all fields
  const status = normalizedResult.status || 'Unknown';
  const reasoning = normalizedResult.reasoning || normalizedResult.explanation || normalizedResult.rationale || '';

  // IMPORTANT: Only include smart questions if status is NOT 'Met'
  // This is part of the split validation architecture:
  // - Phase 1 (validation) always runs
  // - Phase 2 (generation/smart questions) only runs when status != 'Met'
  const normalizedStatus = status.toLowerCase().replace(/[\s_-]/g, '');
  const shouldRunPhase2 = normalizedStatus !== 'met';

  // Phase 2: Generate smart questions if status is not Met
  // Also run if smartQuestions is a placeholder like 'N/A', 'None', etc.
  const isPlaceholder = smartQuestions && ['n/a', 'na', 'none', 'null', 'undefined', ''].includes(smartQuestions.trim().toLowerCase());
  if (shouldRunPhase2 && (!smartQuestions || smartQuestions.trim() === '' || isPlaceholder)) {
    console.log(`[Revalidate Proxy] Running Phase 2 generation for requirement (status: ${status})`);

    // Fetch Phase 2 generation prompt
    const { data: generationPrompt } = await supabase
      .from('prompts')
      .select('*')
      .eq('prompt_type', 'generation')
      .eq('requirement_type', requirementType)
      .eq('document_type', documentType)
      .eq('is_active', true)
      .eq('is_default', true)
      .limit(1)
      .maybeSingle();

    if (generationPrompt) {
      console.log(`[Revalidate Proxy] Using generation prompt: ${generationPrompt.name}`);

      // Build Phase 2 prompt
      let phase2Prompt = generationPrompt.prompt_text
        .replace(/{{requirement_number}}/g, validationResult.requirement_number)
        .replace(/{{requirement_text}}/g, validationResult.requirement_text)
        .replace(/{{element_text}}/g, '')
        .replace(/{{unit_code}}/g, unitCode)
        .replace(/{{unit_title}}/g, unitTitle)
        .replace(/{{status}}/g, status)
        .replace(/{{reasoning}}/g, reasoning)
        .replace(/{{unmapped_content}}/g, recommendations || 'N/A');

      // Call AI for Phase 2 generation
      console.log(`[Revalidate Proxy] Calling AI for Phase 2 generation...`);
      try {
        const phase2Response = await aiClient.generateValidation({
          prompt: phase2Prompt,
          documentContent: finalContent,
          systemInstruction,
          outputSchema: generationPrompt.output_schema,
          generationConfig: generationPrompt.generation_config
        });

        console.log(`[Revalidate Proxy] Phase 2 raw response length: ${phase2Response?.text?.length || 0}`);

        if (!phase2Response?.text || phase2Response.text.trim() === '') {
          console.error(`[Revalidate Proxy] Phase 2 returned empty response`);
        } else {
          const phase2Result = JSON.parse(phase2Response.text);
          const normalizedPhase2: any = {};
          for (const key in phase2Result) {
            const normalizedKey = key.toLowerCase().replace(/\s+/g, '_');
            normalizedPhase2[normalizedKey] = phase2Result[key];
          }

          console.log(`[Revalidate Proxy] Phase 2 parsed keys: ${Object.keys(normalizedPhase2).join(', ')}`);

          // Extract smart questions and benchmark answer from Phase 2
          const phase2SmartTask = normalizedPhase2.smart_task || normalizedPhase2.smart_question || normalizedPhase2.practical_workplace_task || normalizedPhase2.practical_task || '';
          if (phase2SmartTask) {
            smartQuestions = typeof phase2SmartTask === 'string' ? phase2SmartTask : JSON.stringify(phase2SmartTask);
          } else {
            console.warn(`[Revalidate Proxy] Phase 2 response missing smart_task/smart_question field`);
          }

          const phase2Benchmark = normalizedPhase2.benchmark_answer || normalizedPhase2.model_answer || '';
          if (phase2Benchmark) {
            benchmarkAnswer = typeof phase2Benchmark === 'string' ? phase2Benchmark : JSON.stringify(phase2Benchmark);
          }

          console.log(`[Revalidate Proxy] Phase 2 completed - smart_questions length: ${smartQuestions.length}`);
        }
      } catch (e) {
        console.error(`[Revalidate Proxy] Phase 2 failed:`, e);
      }
    } else {
      console.log(`[Revalidate Proxy] No Phase 2 generation prompt found for ${requirementType}/${documentType}`);
    }
  } else if (!shouldRunPhase2 && smartQuestions) {
    console.log(`[Revalidate Proxy] Skipping smart questions for requirement (status: ${status})`);
    smartQuestions = '';
    benchmarkAnswer = '';
  }

  const updateData = {
    status,
    reasoning: typeof reasoning === 'string' ? reasoning : '',
    mapped_content: typeof mappedContent === 'string' ? mappedContent : '',
    citations: Array.isArray(citations) ? JSON.stringify(citations) : String(citations || '[]'),
    recommendations: typeof recommendations === 'string' ? recommendations : '',
    smart_questions: smartQuestions || '',
    benchmark_answer: benchmarkAnswer || '',
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
