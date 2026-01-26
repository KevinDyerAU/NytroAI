/**
 * Trigger Validation Unified - Multi-Provider Support
 * 
 * This edge function triggers document validation using either:
 * - Google Gemini (via n8n or direct)
 * - Azure OpenAI (direct only, no n8n needed)
 * 
 * ⭐ UPDATED: Now replicates the n8n "AI Validation Flow - Enhanced" logic:
 * - Fetches prompts from DB per requirement_type + document_type
 * - Loops over each requirement individually
 * - Builds session context header
 * - Uses DB output_schema for structured JSON
 * - Saves to validation_results table
 * 
 * Environment Variables:
 * - AI_PROVIDER: 'azure' | 'google' (default: 'google')
 * - ORCHESTRATION_MODE: 'direct' | 'n8n' (default: 'direct')
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { handleCors, createErrorResponse, createSuccessResponse } from '../_shared/cors.ts';
import { fetchRequirements, type Requirement } from '../_shared/requirements-fetcher.ts';
import {
  getAIProviderConfig,
  shouldUseN8n,
  createAIClient,
  getN8nWebhookUrl,
  logProviderConfig
} from '../_shared/ai-provider.ts';
import { createDefaultAzureDocIntelClient } from '../_shared/azure-document-intelligence.ts';
import { createDefaultAzureOpenAIClient } from '../_shared/azure-openai.ts';

interface TriggerValidationRequest {
  validationDetailId: number;
}

interface PromptTemplate {
  id: number;
  prompt_type: string;
  requirement_type: string;
  document_type: string;
  name: string;
  prompt_text: string;
  system_instruction: string;
  output_schema: any;
  generation_config: any;
}

interface ValidationResultRecord {
  validation_detail_id: number;
  status: string;
  reasoning: string;
  mapped_content: string;
  citations: string;
  smart_questions: string;
  benchmark_answer: string;
  requirement_type: string;
  requirement_number: string;
  requirement_text: string;
  document_type: string;
  recommendations: string;
}

serve(async (req) => {
  const startTime = Date.now();

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCors(req);
  }

  try {
    const { validationDetailId } = await req.json() as TriggerValidationRequest;

    if (!validationDetailId) {
      return createErrorResponse('Missing validationDetailId', 400);
    }

    // Log provider configuration
    logProviderConfig();

    const config = getAIProviderConfig();

    console.log('╔════════════════════════════════════════════════════════════════════');
    console.log('║ TRIGGER VALIDATION UNIFIED (ENHANCED)');
    console.log('╠════════════════════════════════════════════════════════════════════');
    console.log('║ Validation Detail ID:', validationDetailId);
    console.log('║ Provider:', config.provider.toUpperCase());
    console.log('║ Orchestration:', config.orchestrationMode.toUpperCase());
    console.log('║ Mode: Per-requirement validation with DB prompts');
    console.log('╚════════════════════════════════════════════════════════════════════');

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
        created_at,
        document_type,
        validation_type:validation_type!validation_detail_validationType_id_fkey (code),
        validation_summary!inner (
          unitCode,
          unitLink,
          rtoCode
        )
      `)
      .eq('id', validationDetailId)
      .single();

    if (detailError || !validationDetail) {
      console.error('[Trigger Validation] Failed to fetch validation detail:', detailError);
      return createErrorResponse(`Validation detail ${validationDetailId} not found or error fetching context: ${JSON.stringify(detailError)}`, 404);
    }

    // Fetch documents
    const { data: documents, error: docsError } = await supabase
      .from('documents')
      .select('id, file_name, storage_path, gemini_file_uri')
      .eq('validation_detail_id', validationDetailId)
      .order('created_at', { ascending: true });

    if (docsError || !documents || documents.length === 0) {
      console.error('[Trigger Validation] Failed to fetch documents:', docsError);
      return createErrorResponse(`No documents found for validation ${validationDetailId}: ${JSON.stringify(docsError)}`, 404);
    }

    console.log(`[Trigger Validation] Found ${documents.length} documents`);

    // Get unit requirements
    const unitCode = validationDetail.validation_summary.unitCode;
    const unitLink = validationDetail.validation_summary.unitLink;
    const rtoCode = validationDetail.validation_summary.rtoCode;
    const validationType = validationDetail.validation_type?.code || 'unit';

    // Map database validation type codes to what fetchRequirements expects
    let fetchType: any = validationType;
    const lowerType = String(validationType).toLowerCase();

    if (lowerType === 'unit' || lowerType === 'assessment' || lowerType === 'full_validation') {
      fetchType = 'full_validation';
    } else if (lowerType === 'knowledgeevidence') {
      fetchType = 'knowledge_evidence';
    } else if (lowerType === 'performanceevidence') {
      fetchType = 'performance_evidence';
    } else if (lowerType === 'foundationskills') {
      fetchType = 'foundation_skills';
    } else if (lowerType === 'assessmentconditions') {
      fetchType = 'assessment_conditions';
    } else if (lowerType === 'assessmentinstructions') {
      fetchType = 'assessment_instructions';
    } else if (lowerType === 'elementsandperformancecriteria') {
      fetchType = 'elements_criteria';
    } else if (lowerType === 'learner_guide_validation' || lowerType === 'learner_guide') {
      fetchType = 'learner_guide_validation';
    }

    // Use document_type from DB if available, otherwise derive from validation type
    const documentType = validationDetail.document_type ||
      (lowerType.includes('learner_guide') ? 'learner_guide' : 'unit');

    console.log(`[Trigger Validation] Fetching requirements for ${unitCode} using type: ${fetchType} (original: ${validationType})`);
    const requirements: Requirement[] = await fetchRequirements(supabase, unitCode, fetchType, unitLink);

    if (!requirements || requirements.length === 0) {
      return createErrorResponse(`No requirements found for unit ${unitCode} with type ${fetchType} (${validationType})`, 400);
    }

    console.log(`[Trigger Validation] Retrieved ${requirements.length} requirements`);

    // Route based on provider and orchestration mode
    if (config.provider === 'google' && config.orchestrationMode === 'n8n') {
      // Use n8n for Google Gemini orchestration (existing behavior)
      return await triggerN8nValidation(
        supabase,
        validationDetail,
        documents,
        requirements
      );
    } else if (config.provider === 'azure') {
      // Use Azure for direct validation with enhanced per-requirement logic
      return await triggerAzureValidationEnhanced(
        supabase,
        validationDetail,
        documents,
        requirements,
        documentType,
        startTime
      );
    } else {
      // Direct Google Gemini validation with enhanced per-requirement logic
      return await triggerDirectGeminiValidationEnhanced(
        supabase,
        validationDetail,
        documents,
        requirements,
        documentType,
        startTime
      );
    }

  } catch (error) {
    console.error('[Trigger Validation] Error:', error);
    return createErrorResponse(error instanceof Error ? error.message : 'Unknown error', 500);
  }
});

/**
 * Trigger validation via n8n webhook (existing behavior - let n8n handle the flow)
 */
async function triggerN8nValidation(
  supabase: any,
  validationDetail: any,
  documents: any[],
  requirements: Requirement[]
) {
  console.log('[Trigger Validation] Using n8n orchestration...');

  // Fetch Gemini operations
  const { data: geminiOps, error: opError } = await supabase
    .from('gemini_operations')
    .select('id, operation_name, status, document_id')
    .eq('validation_detail_id', validationDetail.id)
    .order('created_at', { ascending: false });

  if (opError || !geminiOps || geminiOps.length === 0) {
    return createErrorResponse('No Gemini upload operations found. Call upload-document first.', 400);
  }

  const fileSearchStoreId = validationDetail.file_search_store_id;
  if (!fileSearchStoreId) {
    return createErrorResponse('Documents not uploaded to Gemini. Call upload-document first.', 400);
  }

  // Prepare n8n request
  const n8nRequest = {
    validationDetailId: validationDetail.id,
    operations: geminiOps.map((op: any) => ({
      id: op.id,
      operationName: op.operation_name,
      status: op.status,
      documentId: op.document_id
    })),
    fileSearchStoreId: fileSearchStoreId,
    fileSearchStoreName: validationDetail.file_search_store_name,
    validationType: validationDetail.validation_type.code,
    unitCode: validationDetail.validation_summary.unitCode,
    unitLink: validationDetail.validation_summary.unitLink,
    rtoCode: validationDetail.validation_summary.rtoCode,
    namespaceCode: validationDetail.namespace_code,
    requirements: requirements,
    requirementsCount: requirements.length,
  };

  // Call n8n webhook
  const n8nResponse = await fetch(getN8nWebhookUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(n8nRequest),
  });

  if (!n8nResponse.ok) {
    const errorText = await n8nResponse.text();
    return createErrorResponse(`N8n webhook failed: ${errorText}`, 500);
  }

  console.log('[Trigger Validation] ✅ N8n workflow triggered successfully');

  return createSuccessResponse({
    success: true,
    message: 'Validation triggered via n8n',
    provider: 'google',
    orchestration: 'n8n',
    validationDetailId: validationDetail.id
  });
}

/**
 * Fetch prompt template from database for a specific requirement type and document type
 */
async function fetchPromptTemplate(
  supabase: any,
  requirementType: string,
  documentType: string
): Promise<PromptTemplate | null> {
  const { data, error } = await supabase
    .from('prompts')
    .select('*')
    .eq('prompt_type', 'validation')
    .eq('requirement_type', requirementType)
    .eq('document_type', documentType)
    .eq('is_active', true)
    .eq('is_default', true)
    .limit(1)
    .single();

  if (error || !data) {
    console.warn(`[Fetch Prompt] No prompt found for ${requirementType}/${documentType}:`, error?.message);
    return null;
  }

  return data as PromptTemplate;
}

/**
 * Build session context header (replicates n8n "Prepare Request with Session Context")
 */
function buildSessionContext(
  validationDetail: any,
  requirement: Requirement,
  documents: any[],
  currentIndex: number,
  totalRequirements: number
): string {
  const unitCode = validationDetail.validation_summary.unitCode;
  const rtoCode = validationDetail.validation_summary.rtoCode;

  return `
**VALIDATION SESSION CONTEXT**
────────────────────────────────────────────────────────────────────
Session ID: ${validationDetail.id}
Session Created: ${new Date(validationDetail.created_at).toLocaleString()}
Unit Code: ${unitCode}
RTO Code: ${rtoCode}
Requirement Type: ${requirement.type}
Requirement ${currentIndex} of ${totalRequirements}
────────────────────────────────────────────────────────────────────

**DOCUMENTS FOR THIS SESSION** (${documents.length} files):
${documents.map((d, i) => `${i + 1}. ${d.file_name}
   - Storage: ${d.storage_path}`).join('\n')}

**IMPORTANT INSTRUCTIONS**:
1. This is an ISOLATED validation session
2. Only consider documents uploaded for THIS session
3. All citations must reference documents from THIS session only
4. Include document names and page numbers in all evidence citations
5. This is requirement ${currentIndex} of ${totalRequirements}

────────────────────────────────────────────────────────────────────
`;
}

/**
 * Replace template variables in prompt text
 */
function replacePromptVariables(
  promptText: string,
  requirement: Requirement,
  unitCode: string,
  documentType: string
): string {
  return promptText
    .replace(/{{requirement_number}}/g, requirement.number || '')
    .replace(/{{requirement_text}}/g, requirement.text || '')
    .replace(/{{requirement_type}}/g, requirement.type || '')
    .replace(/{{unit_code}}/g, unitCode || '')
    .replace(/{{document_type}}/g, documentType || 'unit');
}

/**
 * Trigger validation using Azure OpenAI with enhanced per-requirement logic
 * Replicates n8n "AI Validation Flow - Enhanced" behavior
 */
async function triggerAzureValidationEnhanced(
  supabase: any,
  validationDetail: any,
  documents: any[],
  requirements: Requirement[],
  documentType: string,
  startTime: number
) {
  console.log('[Trigger Validation] Using Azure AI with enhanced per-requirement logic...');

  const azureClient = createDefaultAzureOpenAIClient();
  const docIntelClient = createDefaultAzureDocIntelClient();

  const unitCode = validationDetail.validation_summary.unitCode;

  // Update status to processing
  await supabase
    .from('validation_detail')
    .update({
      validation_status: 'processing',
      validation_total: requirements.length,
      validation_count: 0,
      updated_at: new Date().toISOString()
    })
    .eq('id', validationDetail.id);

  // Extract document content (using 'elements' table as cache)
  const allSessionElements: any[] = [];

  for (const doc of documents) {
    console.log(`[Trigger Validation] Matching cache for: ${doc.file_name}`);

    const docUrl = `s3://smartrtobucket/${doc.storage_path}`;

    // 1. Check if we already have this document in 'elements' table
    const { data: existingElements, error: elementError } = await supabase
      .from('elements')
      .select('text, page_number, filename, url')
      .eq('url', docUrl)
      .order('id', { ascending: true });

    if (!elementError && existingElements && existingElements.length > 0) {
      console.log(`[Trigger Validation] Found cached content for ${doc.file_name} (${existingElements.length} elements)`);
      allSessionElements.push(...existingElements);
    } else {
      // 2. Not in cache, extract with Azure Document Intelligence
      console.log(`[Trigger Validation] No cache found for ${doc.file_name}, extracting...`);

      const { data: fileData, error: downloadError } = await supabase.storage
        .from('documents')
        .download(doc.storage_path);

      if (downloadError || !fileData) {
        console.error(`[Trigger Validation] Failed to download ${doc.file_name}:`, downloadError);
        continue;
      }

      try {
        const fileBytes = new Uint8Array(await fileData.arrayBuffer());
        const extracted = await docIntelClient.extractDocument(fileBytes);

        // Save extracted content to memory and cache it to DB
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

        allSessionElements.push(...chunks);

        // Async save to elements table (fire and forget for local memory optimization)
        supabase.from('elements').insert(chunks).then(({ error }) => {
          if (error) console.error(`[Trigger Validation] DB cache error for ${doc.file_name}:`, error.message);
        });

      } catch (extractError) {
        console.error(`[Trigger Validation] Extraction failed for ${doc.file_name}:`, extractError);
        continue;
      }
    }
  }

  if (allSessionElements.length === 0) {
    await supabase
      .from('validation_detail')
      .update({ validation_status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', validationDetail.id);

    return createErrorResponse('Failed to extract content from documents.', 500);
  }

  console.log(`[Trigger Validation] Total session elements available for search: ${allSessionElements.length}`);

  // Group requirements by type
  const requirementsByType: Record<string, Requirement[]> = {};
  for (const req of requirements) {
    if (!requirementsByType[req.type]) {
      requirementsByType[req.type] = [];
    }
    requirementsByType[req.type].push(req);
  }

  // Process each requirement individually
  let validationCount = 0;
  let successCount = 0;
  let failCount = 0;
  const results: ValidationResultRecord[] = [];

  // Cache prompts by type to avoid repeated DB queries
  const promptCache: Record<string, PromptTemplate | null> = {};

  for (const [requirementType, reqs] of Object.entries(requirementsByType)) {
    // Fetch prompt template for this requirement type (cached)
    if (!(requirementType in promptCache)) {
      promptCache[requirementType] = await fetchPromptTemplate(supabase, requirementType, documentType);
    }

    const promptTemplate = promptCache[requirementType];

    if (!promptTemplate) {
      console.warn(`[Trigger Validation] No prompt template for ${requirementType}/${documentType}, using default`);
    }

    for (const requirement of reqs) {
      validationCount++;
      const currentIndex = validationCount;

      // Add a small delay between requirements to avoid hitting rate limits too hard
      if (validationCount > 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log(`[Trigger Validation] Processing requirement ${currentIndex}/${requirements.length}: ${requirement.type} - ${requirement.number}`);

      try {
        // Build session context
        const sessionContext = buildSessionContext(
          validationDetail,
          requirement,
          documents,
          currentIndex,
          requirements.length
        );

        // Build prompt
        let promptText = promptTemplate?.prompt_text ||
          `Validate the following ${requirement.type} requirement against the provided documents.
          
Requirement Number: {{requirement_number}}
Requirement Text: {{requirement_text}}

Return a JSON response with:
- status: "Met" | "Partially Met" | "Not Met"
- reasoning: explanation of your decision
- mapped_content: specific content found with page numbers
- citations: array of document references
- recommendations: if not fully met, what's missing
- smart_question: a question to assess understanding
- benchmark_answer: expected answer to the question`;

        // Replace variables
        promptText = replacePromptVariables(promptText, requirement, unitCode, documentType);

        // Combine session context with prompt
        const fullPrompt = `${sessionContext}\n\n${promptText}`;

        // Get system instruction from template or use default
        const systemInstruction = promptTemplate?.system_instruction ||
          'You are an expert RTO validator specializing in Australian vocational education and training standards. Validate requirements against provided documents with precision.';

        // Get generation config from template or use defaults
        const generationConfig = promptTemplate?.generation_config || {
          temperature: 0.1,
          maxOutputTokens: 4096
        };

        // SMART IN-MEMORY RETRIEVAL: Find relevant chunks for this specific requirement
        const reqNum = (requirement.number || '').toLowerCase();
        const reqText = (requirement.text || '').toLowerCase();
        const reqKeywords = reqText.split(' ').filter(w => w.length > 5).slice(0, 3);

        const relevantElements = allSessionElements.filter(e => {
          const content = (e.text || '').toLowerCase();
          return content.includes(reqNum) || reqKeywords.some(k => content.includes(k));
        });

        let specificContext = '';
        if (relevantElements.length > 0) {
          // Take the matched elements and their immediate contexts
          specificContext = relevantElements.slice(0, 40).map(e =>
            `\n[File: ${e.filename} | Page: ${e.page_number}]\nContent: ${e.text}\n`
          ).join('\n---\n');
        } else {
          // Fallback: Take the top 50 chunks of the whole session if no match found
          specificContext = allSessionElements.slice(0, 50).map(e =>
            `\n[File: ${e.filename} | Page: ${e.page_number}]\nContent: ${e.text}\n`
          ).join('\n---\n');
        }

        // Call Azure OpenAI
        const response = await azureClient.generateContent(
          [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: `Matched Document Context:\n\n${specificContext}\n\n---\n\n${fullPrompt}` }
          ],
          {
            temperature: generationConfig.temperature || 0.1,
            maxTokens: generationConfig.maxOutputTokens || 4096,
            responseFormat: 'json_object'
          }
        );

        // Parse the response
        let validationResult: any;
        try {
          validationResult = JSON.parse(response.text);
        } catch (parseError) {
          console.error(`[Trigger Validation] Failed to parse JSON response:`, parseError);
          validationResult = {
            status: 'Error',
            reasoning: 'Failed to parse AI response',
            mapped_content: '',
            citations: [],
            recommendations: '',
            smart_question: '',
            benchmark_answer: ''
          };
        }

        // Create result record with robust mapping
        const resultRecord: ValidationResultRecord = {
          validation_detail_id: validationDetail.id,
          status: validationResult.status || 'Unknown',
          reasoning: validationResult.reasoning || validationResult.explanation || validationResult.rationale || '',
          mapped_content: validationResult.mapped_content || validationResult.evidence_found || '',
          citations: Array.isArray(validationResult.citations || validationResult.doc_references)
            ? JSON.stringify(validationResult.citations || validationResult.doc_references)
            : (validationResult.citations || validationResult.doc_references || ''),
          smart_questions: validationResult.practical_workplace_task || validationResult.practical_task || validationResult.smart_question || validationResult.smart_task || validationResult.assessment_question || '',
          benchmark_answer: validationResult.benchmark_answer || validationResult.model_answer || '',
          requirement_type: requirement.type,
          requirement_number: requirement.number || '',
          requirement_text: requirement.text || '',
          document_type: documentType,
          recommendations: validationResult.unmapped_content || validationResult.recommendations || validationResult.improvement_suggestions || ''
        };

        // Insert into validation_results
        const { error: insertError } = await supabase
          .from('validation_results')
          .insert(resultRecord);

        if (insertError) {
          console.error(`[Trigger Validation] Failed to insert result:`, insertError);
          failCount++;
        } else {
          successCount++;
          results.push(resultRecord);
        }

        // Update progress
        await supabase
          .from('validation_detail')
          .update({
            validation_count: validationCount,
            validation_progress: Math.round((validationCount / requirements.length) * 100)
          })
          .eq('id', validationDetail.id);

      } catch (reqError: any) {
        console.error(`[Trigger Validation] Error processing requirement ${currentIndex}:`, reqError);

        // Create error result record so the failure is visible in the UI
        const errorMessage = reqError instanceof Error ? reqError.message : String(reqError);
        const errorResultRecord: ValidationResultRecord = {
          validation_detail_id: validationDetail.id,
          status: 'Error',
          reasoning: `Validation failed: ${errorMessage}`,
          mapped_content: '',
          citations: '',
          smart_questions: '',
          benchmark_answer: '',
          requirement_type: requirement.type,
          requirement_number: requirement.number || '',
          requirement_text: requirement.text || '',
          document_type: documentType,
          recommendations: 'This requirement could not be validated due to an error. Please retry or contact support.'
        };

        // Try to insert error record
        try {
          await supabase
            .from('validation_results')
            .insert(errorResultRecord);
          console.log(`[Trigger Validation] Saved error result for requirement ${currentIndex}`);
        } catch (insertErr) {
          console.error(`[Trigger Validation] Failed to save error result:`, insertErr);
        }

        failCount++;

        // Update progress even on error
        await supabase
          .from('validation_detail')
          .update({
            validation_count: validationCount,
            validation_progress: Math.round((validationCount / requirements.length) * 100)
          })
          .eq('id', validationDetail.id);
      }
    }
  }

  // Update final status
  const finalStatus = failCount === 0 ? 'completed' : (successCount > 0 ? 'partial' : 'failed');
  await supabase
    .from('validation_detail')
    .update({
      validation_status: finalStatus,
      validation_progress: 100,
      updated_at: new Date().toISOString()
    })
    .eq('id', validationDetail.id);

  const elapsedMs = Date.now() - startTime;

  // Calculate overall status
  const statusCounts = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('╔════════════════════════════════════════════════════════════════════');
  console.log('║ AZURE VALIDATION COMPLETE (ENHANCED)');
  console.log('╠════════════════════════════════════════════════════════════════════');
  console.log('║ Elapsed Time:', elapsedMs, 'ms');
  console.log('║ Total Requirements:', requirements.length);
  console.log('║ Successful:', successCount);
  console.log('║ Failed:', failCount);
  console.log('║ Status Distribution:', JSON.stringify(statusCounts));
  console.log('╚════════════════════════════════════════════════════════════════════');

  return createSuccessResponse({
    success: true,
    provider: 'azure',
    orchestration: 'direct',
    mode: 'enhanced-per-requirement',
    validationDetailId: validationDetail.id,
    totalRequirements: requirements.length,
    successfulValidations: successCount,
    failedValidations: failCount,
    statusDistribution: statusCounts,
    elapsedMs
  });
}

/**
 * Trigger validation using Google Gemini with enhanced per-requirement logic
 * Replicates n8n "AI Validation Flow - Enhanced" behavior
 */
async function triggerDirectGeminiValidationEnhanced(
  supabase: any,
  validationDetail: any,
  documents: any[],
  requirements: Requirement[],
  documentType: string,
  startTime: number
) {
  console.log('[Trigger Validation] Using Google Gemini with enhanced per-requirement logic...');

  // Check for file search store or Gemini file URIs
  const geminiFiles = documents.filter(d => d.gemini_file_uri);
  const fileSearchStoreName = validationDetail.file_search_store_name;

  if (geminiFiles.length === 0 && !fileSearchStoreName) {
    return createErrorResponse('Documents not uploaded to Gemini. Call upload-document first.', 400);
  }

  const geminiClient = createAIClient();
  const unitCode = validationDetail.validation_summary.unitCode;

  // Update status to processing
  await supabase
    .from('validation_detail')
    .update({
      validation_status: 'processing',
      validation_total: requirements.length,
      validation_count: 0,
      updated_at: new Date().toISOString()
    })
    .eq('id', validationDetail.id);

  // Group requirements by type
  const requirementsByType: Record<string, Requirement[]> = {};
  for (const req of requirements) {
    if (!requirementsByType[req.type]) {
      requirementsByType[req.type] = [];
    }
    requirementsByType[req.type].push(req);
  }

  // Process each requirement individually
  let validationCount = 0;
  let successCount = 0;
  let failCount = 0;
  const results: ValidationResultRecord[] = [];

  // Cache prompts by type
  const promptCache: Record<string, PromptTemplate | null> = {};

  for (const [requirementType, reqs] of Object.entries(requirementsByType)) {
    // Fetch prompt template for this requirement type (cached)
    if (!(requirementType in promptCache)) {
      promptCache[requirementType] = await fetchPromptTemplate(supabase, requirementType, documentType);
    }

    const promptTemplate = promptCache[requirementType];

    for (const requirement of reqs) {
      validationCount++;
      const currentIndex = validationCount;

      console.log(`[Trigger Validation] Processing requirement ${currentIndex}/${requirements.length}: ${requirement.type} - ${requirement.number}`);

      try {
        // Build session context
        const sessionContext = buildSessionContext(
          validationDetail,
          requirement,
          documents,
          currentIndex,
          requirements.length
        );

        // Build prompt
        let promptText = promptTemplate?.prompt_text ||
          `Validate the following ${requirement.type} requirement against the provided documents.`;

        // Replace variables
        promptText = replacePromptVariables(promptText, requirement, unitCode, documentType);

        // Combine session context with prompt
        const fullPrompt = `${sessionContext}\n\n${promptText}`;

        // Call Gemini with file search or file URIs
        const response = await geminiClient.generateValidation({
          prompt: fullPrompt,
          fileSearchStoreName: fileSearchStoreName || undefined,
          systemInstruction: promptTemplate?.system_instruction,
          outputSchema: promptTemplate?.output_schema,
          generationConfig: promptTemplate?.generation_config
        });

        // Parse the response
        let validationResult: any;
        try {
          validationResult = JSON.parse(response.text);
        } catch {
          // Try to extract JSON from the response
          const jsonMatch = response.text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            validationResult = JSON.parse(jsonMatch[0]);
          } else {
            validationResult = {
              status: 'Error',
              reasoning: 'Failed to parse AI response',
              mapped_content: response.text.substring(0, 500),
              citations: [],
              recommendations: '',
              smart_question: '',
              benchmark_answer: ''
            };
          }
        }

        // Create result record
        const resultRecord: ValidationResultRecord = {
          validation_detail_id: validationDetail.id,
          status: validationResult.status || 'Unknown',
          reasoning: validationResult.reasoning || '',
          mapped_content: validationResult.mapped_content || '',
          citations: Array.isArray(validationResult.citations)
            ? JSON.stringify(validationResult.citations)
            : validationResult.citations || '',
          smart_questions: validationResult.smart_question || '',
          benchmark_answer: validationResult.benchmark_answer || '',
          requirement_type: requirement.type,
          requirement_number: requirement.number || '',
          requirement_text: requirement.text || '',
          document_type: documentType,
          recommendations: validationResult.recommendations || ''
        };

        // Insert into validation_results
        const { error: insertError } = await supabase
          .from('validation_results')
          .insert(resultRecord);

        if (insertError) {
          console.error(`[Trigger Validation] Failed to insert result:`, insertError);
          failCount++;
        } else {
          successCount++;
          results.push(resultRecord);
        }

        // Update progress
        await supabase
          .from('validation_detail')
          .update({
            validation_count: validationCount,
            validation_progress: Math.round((validationCount / requirements.length) * 100)
          })
          .eq('id', validationDetail.id);

      } catch (reqError: any) {
        console.error(`[Trigger Validation] Error processing requirement ${currentIndex}:`, reqError);

        // Create error result record so the failure is visible in the UI
        const errorMessage = reqError instanceof Error ? reqError.message : String(reqError);
        const errorResultRecord: ValidationResultRecord = {
          validation_detail_id: validationDetail.id,
          status: 'Error',
          reasoning: `Validation failed: ${errorMessage}`,
          mapped_content: '',
          citations: '',
          smart_questions: '',
          benchmark_answer: '',
          requirement_type: requirement.type,
          requirement_number: requirement.number || '',
          requirement_text: requirement.text || '',
          document_type: documentType,
          recommendations: 'This requirement could not be validated due to an error. Please retry or contact support.'
        };

        // Try to insert error record
        try {
          await supabase
            .from('validation_results')
            .insert(errorResultRecord);
          console.log(`[Trigger Validation] Saved error result for requirement ${currentIndex}`);
        } catch (insertErr) {
          console.error(`[Trigger Validation] Failed to save error result:`, insertErr);
        }

        failCount++;

        // Update progress even on error
        await supabase
          .from('validation_detail')
          .update({
            validation_count: validationCount,
            validation_progress: Math.round((validationCount / requirements.length) * 100)
          })
          .eq('id', validationDetail.id);
      }
    }
  }

  // Update final status
  const finalStatus = failCount === 0 ? 'completed' : (successCount > 0 ? 'partial' : 'failed');
  await supabase
    .from('validation_detail')
    .update({
      validation_status: finalStatus,
      validation_progress: 100,
      updated_at: new Date().toISOString()
    })
    .eq('id', validationDetail.id);

  const elapsedMs = Date.now() - startTime;

  // Calculate overall status
  const statusCounts = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('╔════════════════════════════════════════════════════════════════════');
  console.log('║ GEMINI VALIDATION COMPLETE (ENHANCED)');
  console.log('╠════════════════════════════════════════════════════════════════════');
  console.log('║ Elapsed Time:', elapsedMs, 'ms');
  console.log('║ Total Requirements:', requirements.length);
  console.log('║ Successful:', successCount);
  console.log('║ Failed:', failCount);
  console.log('║ Status Distribution:', JSON.stringify(statusCounts));
  console.log('╚════════════════════════════════════════════════════════════════════');

  return createSuccessResponse({
    success: true,
    provider: 'google',
    orchestration: 'direct',
    mode: 'enhanced-per-requirement',
    validationDetailId: validationDetail.id,
    totalRequirements: requirements.length,
    successfulValidations: successCount,
    failedValidations: failCount,
    statusDistribution: statusCounts,
    elapsedMs
  });
}
