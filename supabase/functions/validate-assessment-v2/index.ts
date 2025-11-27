// Deno imports
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { handleCors, createErrorResponse, createSuccessResponse } from '../_shared/cors.ts';
import { createDefaultGeminiClient } from '../_shared/gemini.ts';
import { getValidationPromptV2 } from '../_shared/validation-prompts-v2.ts';
import { fetchRequirements, formatRequirementsAsJSON, type Requirement } from '../_shared/requirements-fetcher.ts';
import { storeValidationResultsV2, type ValidationResponseV2 } from '../_shared/store-validation-results-v2.ts';
import { parseValidationResponseV2WithFallback, mergeCitationsIntoValidations } from '../_shared/parse-validation-response-v2.ts';

/**
 * Validate Assessment V2 - Optimized for Per-Validation File Search Stores
 * 
 * Key Changes from V1:
 * - Expects dedicated File Search store per validation (no shared stores)
 * - No metadata filtering needed (all documents in store are relevant)
 * - Simplified retry logic (no fallback strategies)
 * - Better error messages for debugging
 * 
 * Usage:
 * POST /validate-assessment-v2
 * {
 *   "documentId": 123,
 *   "unitCode": "TLIF0025",
 *   "validationType": "knowledge_evidence",
 *   "validationDetailId": 456,
 *   "fileSearchStoreName": "fileSearchStores/abc123"  // Required!
 * }
 */

interface ValidateAssessmentRequest {
  documentId: number;
  unitCode: string;
  unitLink?: string;  // Optional: URL to training.gov.au unit
  validationType:
    | 'knowledge_evidence'
    | 'performance_evidence'
    | 'foundation_skills'
    | 'elements_criteria'
    | 'assessment_conditions'
    | 'assessment_instructions';
  validationDetailId: number;
  fileSearchStoreName: string;  // Required: Resource name of dedicated File Search store
  customPrompt?: string;
}

serve(async (req) => {
  const startTime = Date.now();

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCors(req);
  }

  try {
    const {
      documentId,
      unitCode,
      unitLink,
      validationType,
      validationDetailId,
      fileSearchStoreName,
      customPrompt,
    } = await req.json() as ValidateAssessmentRequest;

    console.log('╔════════════════════════════════════════════════════════════════════');
    console.log('║ VALIDATE ASSESSMENT V2 - PER-VALIDATION STORE');
    console.log('╠════════════════════════════════════════════════════════════════════');
    console.log('║ Document ID:', documentId);
    console.log('║ Unit Code:', unitCode);
    console.log('║ Unit Link:', unitLink || 'Not provided');
    console.log('║ Validation Type:', validationType);
    console.log('║ Validation Detail ID:', validationDetailId);
    console.log('║ File Search Store:', fileSearchStoreName);
    console.log('╚════════════════════════════════════════════════════════════════════');

    // Validate required fields
    if (!documentId || !unitCode || !validationType || !validationDetailId || !fileSearchStoreName) {
      return createErrorResponse('Missing required fields: documentId, unitCode, validationType, validationDetailId, fileSearchStoreName', 400);
    }

    // Validate fileSearchStoreName format
    if (!fileSearchStoreName.startsWith('fileSearchStores/')) {
      return createErrorResponse(
        `Invalid fileSearchStoreName format: "${fileSearchStoreName}". Must start with "fileSearchStores/"`,
        400
      );
    }

    // Initialize clients
    const supabase = createSupabaseClient(req);
    const gemini = createDefaultGeminiClient();

    // Fetch document
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      console.error('[Validate Assessment V2] Document not found:', docError);
      return createErrorResponse(`Document not found: ${documentId}`, 404);
    }

    console.log('[Validate Assessment V2] Document:', {
      id: document.id,
      file_name: document.file_name,
      embedding_status: document.embedding_status,
      file_search_store_id: document.file_search_store_id
    });

    // Verify document is indexed
    if (document.embedding_status !== 'completed') {
      return createErrorResponse(
        `Document ${documentId} is not indexed yet (status: ${document.embedding_status}). Please wait for indexing to complete.`,
        400
      );
    }

    // Fetch unit of competency
    const { data: unit, error: unitError } = await supabase
      .from('UnitOfCompetency')
      .select('*')
      .eq('Link', unitLink)
      .single();

    if (unitError || !unit) {
      console.error('[Validate Assessment V2] Unit not found:', unitError);
      return createErrorResponse(`Unit not found: ${unitCode}`, 404);
    }

    // Fetch requirements
    console.log(`[Validate Assessment V2] Fetching ${validationType} requirements for ${unitCode}...`);
    const requirements: Requirement[] = await fetchRequirements(
      supabase,
      unitCode,
      validationType,
      unitLink
    );

    if (requirements.length === 0) {
      console.warn(`[Validate Assessment V2] No requirements found for ${unitCode} (${validationType})`);
      return createErrorResponse(
        `No ${validationType} requirements found for unit ${unitCode}. Please ensure requirements are loaded in the database.`,
        404
      );
    }

    console.log(`[Validate Assessment V2] Retrieved ${requirements.length} requirements`);

    // Format requirements as JSON for prompt
    const requirementsJSON = formatRequirementsAsJSON(requirements);

    // Build prompt
    let prompt = customPrompt;
    if (!prompt) {
      prompt = getValidationPromptV2(validationType, unit, requirementsJSON);
    }

    console.log('[Validate Assessment V2] Prompt length:', prompt.length, 'characters');

    // DEBUG: List documents in the store
    console.log('[Validate Assessment V2] 🔍 Listing documents in store...');
    try {
      const docs = await gemini.listDocuments(fileSearchStoreName);
      console.log(`[Validate Assessment V2] 📄 Documents in store: ${docs.length}`);
      
      if (docs.length === 0) {
        console.error('[Validate Assessment V2] ⚠️ WARNING: No documents in File Search store!');
        console.error('[Validate Assessment V2] This will result in 0 grounding chunks.');
        console.error('[Validate Assessment V2] Possible causes:');
        console.error('[Validate Assessment V2]   1. Documents not uploaded yet');
        console.error('[Validate Assessment V2]   2. Wrong store name provided');
        console.error('[Validate Assessment V2]   3. Documents still indexing');
        
        return createErrorResponse(
          `No documents found in File Search store "${fileSearchStoreName}". Please ensure documents are uploaded and indexed before validation.`,
          400
        );
      }

      docs.forEach((doc: any, i: number) => {
        console.log(`[Validate Assessment V2]   [${i + 1}/${docs.length}] ${doc.displayName || doc.name}`);
        if (doc.customMetadata && doc.customMetadata.length > 0) {
          const metadata = doc.customMetadata.reduce((acc: any, m: any) => {
            acc[m.key] = m.stringValue || m.numericValue;
            return acc;
          }, {});
          console.log(`[Validate Assessment V2]       Metadata:`, JSON.stringify(metadata));
        }
      });
    } catch (listError) {
      console.error('[Validate Assessment V2] ❌ Error listing documents:', listError);
    }

    // Query Gemini with File Search
    // NO metadata filter needed - all documents in this store are for this validation
    console.log('[Validate Assessment V2] 🤖 Calling Gemini API...');
    console.log('[Validate Assessment V2] Store:', fileSearchStoreName);
    console.log('[Validate Assessment V2] Metadata Filter: NONE (dedicated store)');
    
    const response = await gemini.generateContentWithFileSearch(
      prompt,
      [fileSearchStoreName],
      undefined  // No metadata filter - all docs in store are relevant
    );

    // Check grounding chunks
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    console.log(`[Validate Assessment V2] ✅ Grounding chunks found: ${groundingChunks.length}`);

    if (groundingChunks.length === 0) {
      console.error('[Validate Assessment V2] ❌ No grounding chunks returned!');
      console.error('[Validate Assessment V2] This suggests:');
      console.error('[Validate Assessment V2]   1. Documents are not fully indexed yet');
      console.error('[Validate Assessment V2]   2. Documents don\'t contain relevant content');
      console.error('[Validate Assessment V2]   3. Gemini API indexing issue');
      console.error('[Validate Assessment V2] Recommendation: Wait 30-60 seconds and retry');
      
      return createErrorResponse(
        `Validation failed: No evidence found in documents. Documents may still be indexing. Please wait 30-60 seconds and try again.`,
        500
      );
    }

    // Log sample chunks
    console.log('[Validate Assessment V2] 📚 Sample grounding chunks:');
    groundingChunks.slice(0, 3).forEach((chunk: any, i: number) => {
      if (chunk.fileSearchChunk) {
        console.log(`[Validate Assessment V2]   [${i + 1}] ${chunk.fileSearchChunk.displayName || chunk.fileSearchChunk.documentName}`);
        console.log(`[Validate Assessment V2]       Pages: ${chunk.fileSearchChunk.pageNumbers?.join(', ') || 'N/A'}`);
      }
    });

    // Parse validation response
    console.log('[Validate Assessment V2] 📝 Parsing validation response...');
    let validationResponse = parseValidationResponseV2WithFallback(
      response.text,
      validationType,
      unitCode,
      requirements
    );

    // Merge citations
    validationResponse = mergeCitationsIntoValidations(
      validationResponse,
      response.candidates[0]?.groundingMetadata
    );

    console.log('[Validate Assessment V2] ✅ Validation complete:', {
      overallStatus: validationResponse.overallStatus,
      requirementCount: validationResponse.requirementValidations.length,
      citationCount: validationResponse.requirementValidations.reduce((sum, r) => sum + (r.citations?.length || 0), 0)
    });

    // Store results
    console.log('[Validate Assessment V2] 💾 Storing validation results...');
    const storeResult = await storeValidationResultsV2(
      supabase,
      validationDetailId,
      validationResponse,
      undefined  // No namespace needed for per-validation stores
    );

    if (!storeResult.success) {
      console.error('[Validate Assessment V2] ❌ Failed to store results:', storeResult.error);
      return createErrorResponse(`Failed to store validation results: ${storeResult.error}`, 500);
    }

    console.log(`[Validate Assessment V2] ✅ Stored ${storeResult.insertedCount} requirement validations`);

    // Update validation_detail status
    await supabase
      .from('validation_detail')
      .update({ status: 'validated', updated_at: new Date().toISOString() })
      .eq('id', validationDetailId);

    const elapsedMs = Date.now() - startTime;
    console.log('╔════════════════════════════════════════════════════════════════════');
    console.log('║ VALIDATE ASSESSMENT V2 - COMPLETE');
    console.log('╠════════════════════════════════════════════════════════════════════');
    console.log('║ Elapsed Time:', elapsedMs, 'ms');
    console.log('║ Requirements Validated:', validationResponse.requirementValidations.length);
    console.log('║ Citations Found:', validationResponse.requirementValidations.reduce((sum, r) => sum + (r.citations?.length || 0), 0));
    console.log('║ Overall Status:', validationResponse.overallStatus);
    console.log('╚════════════════════════════════════════════════════════════════════');

    return createSuccessResponse({
      success: true,
      validationDetailId,
      documentId,
      unitCode,
      validationType,
      overallStatus: validationResponse.overallStatus,
      requirementCount: validationResponse.requirementValidations.length,
      citationCount: validationResponse.requirementValidations.reduce((sum, r) => sum + (r.citations?.length || 0), 0),
      elapsedMs
    });

  } catch (error) {
    console.error('[Validate Assessment V2] ❌ Error:', error);
    return createErrorResponse(error.message, 500);
  }
});
