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
import { validateRequirementUnified, type ValidatorInput } from '../_shared/unified-validator.ts';

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

      // Create elements from extracted content (matches trigger-validation-unified format)
      const chunks = extracted.paragraphs?.map((p: any, idx: number) => ({
        id: crypto.randomUUID(),
        element_id: `${doc.id}-p${idx}`,
        text: p.content,
        page_number: p.pageNumber || 1,
        filename: doc.file_name,
        record_id: `doc-${doc.id}`,
        type: p.role || 'paragraph',
        filetype: 'pdf'
      })) || [{
        id: crypto.randomUUID(),
        element_id: `${doc.id}-full`,
        text: extracted.content,
        page_number: 1,
        filename: doc.file_name,
        record_id: `doc-${doc.id}`,
        type: 'document',
        filetype: 'pdf'
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

  // 3. Check for existing elements by record_id (matches trigger-validation-unified)
  let sessionElements: any[] = [];
  let allContent = '';

  for (const doc of documents) {
    // Check if we already have extracted content for this document
    const { data: existingElements } = await supabase
      .from('elements')
      .select('text, page_number')
      .eq('filename', doc.file_name)
      .eq('record_id', `doc-${doc.id}`)
      .order('page_number', { ascending: true });

    if (existingElements && existingElements.length > 0) {
      // Use cached extraction
      console.log(`[Revalidate Proxy] Using cached extraction for ${doc.file_name}: ${existingElements.length} elements`);
      sessionElements.push(...existingElements);
      const cachedContent = existingElements.map((e: any) => e.text).join('\n');
      allContent += `\n=== ${doc.file_name} ===\n${cachedContent}\n`;
    } else {
      // No elements found - need to process this document
      console.log(`[Revalidate Proxy] No elements found for ${doc.file_name}. Processing now...`);
      const newElements = await processDocumentsForAzure(supabase, [doc], validationDetailId);
      sessionElements.push(...newElements);
      const newContent = newElements.map((e: any) => e.text).join('\n');
      allContent += `\n=== ${doc.file_name} ===\n${newContent}\n`;
    }
  }

  if (sessionElements.length === 0) {
    throw new Error('Failed to extract content from documents. Please try again or re-upload the documents.');
  }

  console.log(`[Revalidate Proxy] Total elements: ${sessionElements.length}, content length: ${allContent.length}`);

  // Build document record_ids for element lookups
  const docRecordIds = documents.map((doc: any) => `doc-${doc.id}`);

  // 4. Smart Element Retrieval - Use simple sequential searches
  const reqNum = (validationResult.requirement_number || '').trim();
  const reqText = (validationResult.requirement_text || '').trim();

  console.log(`[Revalidate Proxy] Searching for: "${reqNum}"`);

  // Try simple exact requirement number search first
  let { data: matchedElements } = await supabase
    .from('elements')
    .select('id, text, page_number, record_id')
    .in('record_id', docRecordIds)
    .ilike('text', `%${reqNum}%`)
    .limit(50);

  // If no matches, try keywords from requirement text
  if (!matchedElements || matchedElements.length === 0) {
    const keywords = reqText.split(' ').filter((w: string) => w.length > 6).slice(0, 2);
    if (keywords.length > 0) {
      console.log(`[Revalidate Proxy] No exact match, trying keywords: ${keywords.join(', ')}`);
      const { data: keywordMatches } = await supabase
        .from('elements')
        .select('id, text, page_number, record_id')
        .in('record_id', docRecordIds)
        .ilike('text', `%${keywords[0]}%`)
        .limit(50);
      matchedElements = keywordMatches;
    }
  }

  let finalContent = '';
  if (matchedElements && matchedElements.length > 0) {
    // Fetch all elements from the pages where we found matches to give the AI context
    const pageNumbers = [...new Set(matchedElements.map((e: any) => e.page_number))];
    console.log(`[Revalidate Proxy] Found matches on pages: ${pageNumbers.join(', ')}. Fetching context...`);

    const { data: contextualElements } = await supabase
      .from('elements')
      .select('text, page_number, record_id')
      .in('record_id', docRecordIds)
      .in('page_number', pageNumbers.slice(0, 6)) // Limit to first 6 matching pages
      .order('id', { ascending: true })
      .limit(120);

    const docGroups: Record<string, string[]> = {};
    (contextualElements || matchedElements).forEach((e: any) => {
      const key = e.record_id || 'unknown';
      if (!docGroups[key]) docGroups[key] = [];
      docGroups[key].push(e.text);
    });

    for (const [recordId, texts] of Object.entries(docGroups)) {
      const docId = recordId.replace('doc-', '');
      const fileName = documents.find((d: any) => String(d.id) === docId)?.file_name || 'Document';
      finalContent += `\n=== RELEVANT EXCERPTS FROM: ${fileName} ===\n${texts.join('\n')}\n`;
    }
  } else {
    // Fallback: If no keyword match, take the document overviews (first 80 elements)
    console.log(`[Revalidate Proxy] No keyword match for ${reqNum}. Falling back to document overviews.`);
    const { data: overviews } = await supabase
      .from('elements')
      .select('text, record_id')
      .in('record_id', docRecordIds)
      .limit(80);

    const docGroups: Record<string, string[]> = {};
    (overviews || []).forEach((e: any) => {
      const key = e.record_id || 'unknown';
      if (!docGroups[key]) docGroups[key] = [];
      docGroups[key].push(e.text);
    });

    for (const [recordId, texts] of Object.entries(docGroups)) {
      const docId = recordId.replace('doc-', '');
      const fileName = documents.find((d: any) => String(d.id) === docId)?.file_name || 'Document';
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

  // 6. Call Unified Validator
  console.log(`[Revalidate Proxy] Calling Unified Validator for ${validationResult.requirement_number}`);
  const unitCode = detail.validation_summary.unitCode;
  const validatorInput: ValidatorInput = {
    requirement: {
      id: validationResult.requirement_id || validationResult.id,
      requirement_number: validationResult.requirement_number,
      requirement_text: validationResult.requirement_text,
      requirement_type: requirementType,
      element_text: validationResult.element_text
    },
    documentContent: finalContent,
    documentType: documentType as 'unit' | 'learner_guide',
    unitCode,
    unitTitle: detail.validation_summary.unitTitle || '',
    validationDetailId,
    supabase
  };

  const result = await validateRequirementUnified(validatorInput);

  if (!result.success) {
    throw new Error(`Validation failed: ${result.error}`);
  }

  const updateData = {
    status: result.status,
    reasoning: result.reasoning,
    mapped_content: result.mappedContent,
    citations: result.citations,
    recommendations: result.recommendations,
    smart_questions: result.smartQuestions,
    benchmark_answer: result.benchmarkAnswer,
    updated_at: new Date().toISOString()
  };

  console.log('[Revalidate Proxy] Update data:', {
    status: updateData.status,
    reasoningLength: updateData.reasoning.length,
    citationsLength: updateData.citations.length,
    smartQuestionsLength: updateData.smart_questions.length,
    benchmarkLength: updateData.benchmark_answer.length
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
