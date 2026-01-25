/**
 * Trigger Validation Unified - Multi-Provider Support
 * 
 * This edge function triggers document validation using either:
 * - Google Gemini (via n8n or direct)
 * - Azure OpenAI (direct only, no n8n needed)
 * 
 * Environment Variables:
 * - AI_PROVIDER: 'azure' | 'google' (default: 'google')
 * - ORCHESTRATION_MODE: 'direct' | 'n8n' (default: 'direct')
 * 
 * When AI_PROVIDER='google' and ORCHESTRATION_MODE='n8n':
 *   - Calls n8n webhook to handle validation (existing behavior)
 * 
 * When AI_PROVIDER='google' and ORCHESTRATION_MODE='direct':
 *   - Calls validate-assessment-v2 directly
 * 
 * When AI_PROVIDER='azure':
 *   - Extracts document with Azure Document Intelligence
 *   - Validates with Azure OpenAI
 *   - No n8n required
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { handleCors, createErrorResponse, createSuccessResponse } from '../_shared/cors.ts';
import { fetchRequirements, formatRequirementsAsJSON, type Requirement } from '../_shared/requirements-fetcher.ts';
import { getValidationPromptV2 } from '../_shared/validation-prompts-v2.ts';
import { storeValidationResultsV2 } from '../_shared/store-validation-results-v2.ts';
import { parseValidationResponseV2WithFallback } from '../_shared/parse-validation-response-v2.ts';
import { 
  getAIProviderConfig, 
  shouldUseN8n, 
  createAIClient, 
  getN8nWebhookUrl,
  logProviderConfig 
} from '../_shared/ai-provider.ts';
import { createDefaultAzureDocIntelClient } from '../_shared/azure-document-intelligence.ts';

interface TriggerValidationRequest {
  validationDetailId: number;
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
    console.log('║ TRIGGER VALIDATION UNIFIED');
    console.log('╠════════════════════════════════════════════════════════════════════');
    console.log('║ Validation Detail ID:', validationDetailId);
    console.log('║ Provider:', config.provider.toUpperCase());
    console.log('║ Orchestration:', config.orchestrationMode.toUpperCase());
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
      console.error('[Trigger Validation] Failed to fetch validation detail:', detailError);
      return createErrorResponse('Validation detail not found', 404);
    }

    // Fetch documents
    const { data: documents, error: docsError } = await supabase
      .from('documents')
      .select('id, file_name, storage_path, file_search_store_id, extracted_content')
      .eq('validation_detail_id', validationDetailId)
      .order('created_at', { ascending: true });

    if (docsError || !documents || documents.length === 0) {
      console.error('[Trigger Validation] Failed to fetch documents:', docsError);
      return createErrorResponse('No documents found', 404);
    }

    console.log(`[Trigger Validation] Found ${documents.length} documents`);

    // Get unit requirements
    const unitCode = validationDetail.validation_summary.unitCode;
    const unitLink = validationDetail.validation_summary.unitLink;
    const validationType = validationDetail.validation_type.code;
    
    const fetchType = validationType === 'assessment' ? 'full_validation' : validationType;
    const requirements: Requirement[] = await fetchRequirements(supabase, unitCode, fetchType, unitLink);
    
    if (!requirements || requirements.length === 0) {
      return createErrorResponse(`No requirements found for unit ${unitCode}`, 400);
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
      // Use Azure for direct validation
      return await triggerAzureValidation(
        supabase,
        validationDetail,
        documents,
        requirements,
        startTime
      );
    } else {
      // Direct Google Gemini validation (no n8n)
      return await triggerDirectGeminiValidation(
        supabase,
        validationDetail,
        documents,
        requirements,
        startTime
      );
    }

  } catch (error) {
    console.error('[Trigger Validation] Error:', error);
    return createErrorResponse(error instanceof Error ? error.message : 'Unknown error', 500);
  }
});

/**
 * Trigger validation via n8n webhook (existing behavior)
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
 * Trigger validation using Azure OpenAI (direct, no n8n)
 */
async function triggerAzureValidation(
  supabase: any,
  validationDetail: any,
  documents: any[],
  requirements: Requirement[],
  startTime: number
) {
  console.log('[Trigger Validation] Using Azure AI (direct)...');
  
  const aiClient = createAIClient();
  const docIntelClient = createDefaultAzureDocIntelClient();
  
  // Update status to processing
  await supabase
    .from('validation_detail')
    .update({ status: 'processing', updated_at: new Date().toISOString() })
    .eq('id', validationDetail.id);

  // Extract document content
  let combinedContent = '';
  
  for (const doc of documents) {
    console.log(`[Trigger Validation] Processing document: ${doc.file_name}`);
    
    // Check if we already have extracted content
    if (doc.extracted_content) {
      console.log(`[Trigger Validation] Using cached extracted content for ${doc.file_name}`);
      combinedContent += `\n\n--- Document: ${doc.file_name} ---\n\n${doc.extracted_content}`;
    } else {
      // Download and extract document
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('documents')
        .download(doc.storage_path);
      
      if (downloadError || !fileData) {
        console.error(`[Trigger Validation] Failed to download ${doc.file_name}:`, downloadError);
        continue;
      }
      
      // Extract with Azure Document Intelligence
      const fileBytes = new Uint8Array(await fileData.arrayBuffer());
      const extracted = await docIntelClient.extractDocument(fileBytes);
      
      // Cache the extracted content
      await supabase
        .from('documents')
        .update({ extracted_content: extracted.content })
        .eq('id', doc.id);
      
      combinedContent += `\n\n--- Document: ${doc.file_name} ---\n\n${extracted.content}`;
      
      console.log(`[Trigger Validation] Extracted ${extracted.content.length} chars from ${doc.file_name}`);
    }
  }

  if (!combinedContent.trim()) {
    await supabase
      .from('validation_detail')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', validationDetail.id);
    
    return createErrorResponse('Failed to extract content from documents', 500);
  }

  // Fetch unit of competency for prompt
  const { data: unit } = await supabase
    .from('UnitOfCompetency')
    .select('*')
    .eq('Link', validationDetail.validation_summary.unitLink)
    .single();

  // Build validation prompt
  const requirementsJSON = formatRequirementsAsJSON(requirements);
  const prompt = getValidationPromptV2(
    validationDetail.validation_type.code,
    unit,
    requirementsJSON
  );

  console.log('[Trigger Validation] Calling Azure OpenAI for validation...');

  // Generate validation
  const response = await aiClient.generateValidation({
    prompt,
    documentContent: combinedContent
  });

  console.log('[Trigger Validation] Azure OpenAI response received');

  // Parse and store results
  const validationResponse = parseValidationResponseV2WithFallback(
    response.text,
    validationDetail.validation_type.code,
    validationDetail.validation_summary.unitCode,
    requirements
  );

  const storeResult = await storeValidationResultsV2(
    supabase,
    validationDetail.id,
    validationResponse,
    undefined
  );

  if (!storeResult.success) {
    console.error('[Trigger Validation] Failed to store results:', storeResult.error);
    await supabase
      .from('validation_detail')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', validationDetail.id);
    
    return createErrorResponse(`Failed to store validation results: ${storeResult.error}`, 500);
  }

  // Update status to validated
  await supabase
    .from('validation_detail')
    .update({ status: 'validated', updated_at: new Date().toISOString() })
    .eq('id', validationDetail.id);

  const elapsedMs = Date.now() - startTime;

  console.log('╔════════════════════════════════════════════════════════════════════');
  console.log('║ AZURE VALIDATION COMPLETE');
  console.log('╠════════════════════════════════════════════════════════════════════');
  console.log('║ Elapsed Time:', elapsedMs, 'ms');
  console.log('║ Requirements Validated:', validationResponse.requirementValidations.length);
  console.log('║ Overall Status:', validationResponse.overallStatus);
  console.log('╚════════════════════════════════════════════════════════════════════');

  return createSuccessResponse({
    success: true,
    provider: 'azure',
    orchestration: 'direct',
    validationDetailId: validationDetail.id,
    overallStatus: validationResponse.overallStatus,
    requirementCount: validationResponse.requirementValidations.length,
    elapsedMs
  });
}

/**
 * Trigger validation using Google Gemini directly (no n8n)
 */
async function triggerDirectGeminiValidation(
  supabase: any,
  validationDetail: any,
  documents: any[],
  requirements: Requirement[],
  startTime: number
) {
  console.log('[Trigger Validation] Using Google Gemini (direct)...');
  
  // Check for file search store
  const fileSearchStoreName = validationDetail.file_search_store_name;
  if (!fileSearchStoreName) {
    return createErrorResponse('Documents not uploaded to Gemini. Call upload-document first.', 400);
  }

  const aiClient = createAIClient();

  // Update status to processing
  await supabase
    .from('validation_detail')
    .update({ status: 'processing', updated_at: new Date().toISOString() })
    .eq('id', validationDetail.id);

  // Fetch unit of competency for prompt
  const { data: unit } = await supabase
    .from('UnitOfCompetency')
    .select('*')
    .eq('Link', validationDetail.validation_summary.unitLink)
    .single();

  // Build validation prompt
  const requirementsJSON = formatRequirementsAsJSON(requirements);
  const prompt = getValidationPromptV2(
    validationDetail.validation_type.code,
    unit,
    requirementsJSON
  );

  console.log('[Trigger Validation] Calling Gemini with File Search...');

  // Generate validation
  const response = await aiClient.generateValidation({
    prompt,
    fileSearchStoreName
  });

  console.log('[Trigger Validation] Gemini response received');

  // Check grounding chunks
  if (!response.groundingChunks || response.groundingChunks.length === 0) {
    console.warn('[Trigger Validation] No grounding chunks returned');
  }

  // Parse and store results
  const validationResponse = parseValidationResponseV2WithFallback(
    response.text,
    validationDetail.validation_type.code,
    validationDetail.validation_summary.unitCode,
    requirements
  );

  const storeResult = await storeValidationResultsV2(
    supabase,
    validationDetail.id,
    validationResponse,
    undefined
  );

  if (!storeResult.success) {
    console.error('[Trigger Validation] Failed to store results:', storeResult.error);
    await supabase
      .from('validation_detail')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', validationDetail.id);
    
    return createErrorResponse(`Failed to store validation results: ${storeResult.error}`, 500);
  }

  // Update status to validated
  await supabase
    .from('validation_detail')
    .update({ status: 'validated', updated_at: new Date().toISOString() })
    .eq('id', validationDetail.id);

  const elapsedMs = Date.now() - startTime;

  console.log('╔════════════════════════════════════════════════════════════════════');
  console.log('║ GEMINI VALIDATION COMPLETE');
  console.log('╠════════════════════════════════════════════════════════════════════');
  console.log('║ Elapsed Time:', elapsedMs, 'ms');
  console.log('║ Requirements Validated:', validationResponse.requirementValidations.length);
  console.log('║ Grounding Chunks:', response.groundingChunks?.length || 0);
  console.log('║ Overall Status:', validationResponse.overallStatus);
  console.log('╚════════════════════════════════════════════════════════════════════');

  return createSuccessResponse({
    success: true,
    provider: 'google',
    orchestration: 'direct',
    validationDetailId: validationDetail.id,
    overallStatus: validationResponse.overallStatus,
    requirementCount: validationResponse.requirementValidations.length,
    groundingChunkCount: response.groundingChunks?.length || 0,
    elapsedMs
  });
}
