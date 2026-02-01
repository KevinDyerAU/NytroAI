import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { handleCors, createErrorResponse, createSuccessResponse } from '../_shared/cors.ts';
import { createAIClient } from '../_shared/ai-provider.ts';
import { getValidationPrompt } from '../_shared/validation-prompts.ts';
import { getValidationPromptV2 } from '../_shared/validation-prompts-v2.ts';
import { getValidationPromptV2 as getPromptFromNewTable, formatPrompt, shouldRunGeneration } from '../_shared/prompts-v2.ts';
import { formatLearnerGuideValidationPrompt } from '../_shared/learner-guide-validation-prompt.ts';
import { storeValidationResults as storeValidationResultsNew, storeSingleValidationResult } from '../_shared/store-validation-results.ts';
import { fetchRequirements, fetchAllRequirements, formatRequirementsAsJSON, type Requirement } from '../_shared/requirements-fetcher.ts';
import { storeValidationResultsV2, type ValidationResponseV2 } from '../_shared/store-validation-results-v2.ts';
import { parseValidationResponseV2WithFallback, mergeCitationsIntoValidations } from '../_shared/parse-validation-response-v2.ts';
import { validateRequirement, getDocumentContent, extractDocuments, type ValidationContext, type RequirementInput } from '../_shared/validate-requirement.ts';

/**
 * Fetch prompt from database based on validation type
 *
 * ⚠️ IMPORTANT: Only fetches prompts where current = true
 *
 * Falls back to hardcoded prompts if:
 * - No prompt exists for this validation_type_id
 * - Prompt exists but current = false (inactive)
 * - Database query fails
 */
async function getPromptFromDatabase(
  supabase: any,
  validationTypeId: number
): Promise<string | null> {
  // ⚠️ CRITICAL: Only fetch active prompts (current = true)
  const { data, error } = await supabase
    .from('prompt')
    .select('prompt')
    .eq('validation_type_id', validationTypeId)
    .eq('current', true)  // ⚠️ Only active prompts are used
    .single();

  if (error || !data) {
    console.log(`⚠️ No active prompt (current=true) found for validation_type_id ${validationTypeId}, using hardcoded fallback`);
    return null;
  }

  console.log(`✅ Using database prompt for validation_type_id ${validationTypeId} (current=true)`);
  return data.prompt;
}

interface ValidateAssessmentRequest {
  documentId: number;
  unitCode: string;
  validationType:
  | 'assessment'
  | 'knowledge_evidence'
  | 'performance_evidence'
  | 'foundation_skills'
  | 'elements_criteria'
  | 'assessment_conditions'
  | 'assessment_instructions'
  | 'full_validation'
  | 'learner_guide_validation';
  validationDetailId?: number;
  customPrompt?: string;
  promptId?: number; // ID of prompt to fetch from database
  namespace?: string; // Unique namespace to filter to specific validation session
}

interface Citation {
  documentName: string;
  pageNumbers: number[];
  chunkText?: string;
  metadata?: Record<string, any>;
}

interface ValidationResult {
  validationType: string;
  status: 'pass' | 'fail' | 'partial';
  score: number;
  summary: string;
  details: string;
  gaps: string[];
  recommendations: string[];
  citations: Citation[];
}

interface RequirementValidation {
  requirementId: number;
  status: string;
  mapped_questions?: string;
  unmappedContent?: string;
  unmappedRecommendations?: string;
  docReferences: string;
}

interface ValidationRecord {
  valDetail_id: number;
  requirementId: bigint | null;
  status: string;
  mapped_questions?: string;
  unmappedContent?: string;
  unmappedRecommendation?: string;
  docReferences: string;
}

serve(async (req) => {
  const startTime = Date.now();
  console.log('='.repeat(80));
  console.log('[validate-assessment] START', new Date().toISOString());
  console.log('[validate-assessment] Method:', req.method);

  const corsResponse = handleCors(req);
  if (corsResponse) {
    console.log('[validate-assessment] CORS preflight handled');
    return corsResponse;
  }

  try {
    const requestData: ValidateAssessmentRequest = await req.json();
    let { documentId, unitCode, validationType, validationDetailId, customPrompt, promptId, namespace } = requestData;

    // Normalize unit code to lowercase for database queries (database stores lowercase)
    const unitCodeLower = unitCode.toLowerCase();

    console.log('[validate-assessment] Request data:', {
      documentId,
      unitCode: unitCodeLower,
      validationType,
      validationDetailId,
      hasCustomPrompt: !!customPrompt,
      promptId,
      namespace
    });

    if (!documentId || !unitCode || !validationType) {
      return createErrorResponse(
        'Missing required fields: documentId, unitCode, validationType'
      );
    }

    const supabase = createSupabaseClient(req);

    // If validationDetailId is provided, fetch namespace and unitLink from validation records
    let unitLink: string | null = null;
    if (validationDetailId && !namespace) {
      const { data: validationDetail } = await supabase
        .from('validation_detail')
        .select('namespace_code, validation_summary(unitLink)')
        .eq('id', validationDetailId)
        .single();

      if (validationDetail?.namespace_code) {
        namespace = validationDetail.namespace_code;
        console.log(`[Validate Assessment] Fetched namespace from validation_detail: ${namespace}`);
      }

      if (validationDetail?.validation_summary?.unitLink) {
        unitLink = validationDetail.validation_summary.unitLink;
        console.log(`[Validate Assessment] Fetched unitLink from validation_summary: ${unitLink}`);
      }
    }

    // Get document
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      return createErrorResponse(`Document not found: ${documentId}`);
    }

    // Get unit requirements (use lowercase for database query)
    const { data: unit, error: unitError } = await supabase
      .from('UnitOfCompetency')
      .select('*')
      .eq('unitCode', unitCodeLower)
      .single();

    if (unitError || !unit) {
      return createErrorResponse(`Unit not found: ${unitCode}`);
    }

    // Use Link from UnitOfCompetency if unitLink not already set
    if (!unitLink && unit.Link) {
      unitLink = unit.Link;
      console.log(`[Validate Assessment] Using Link from UnitOfCompetency: ${unitLink}`);
    }

    // Map "assessment" to "full_validation" for requirements fetching
    const requirementValidationType = validationType === 'assessment' ? 'full_validation' : validationType;

    // Get requirements for this unit using the new requirements fetcher (use lowercase)
    console.log(`[Validate Assessment] Fetching requirements for ${unitCodeLower}, type: ${validationType} (mapped to ${requirementValidationType}), unitLink: ${unitLink}`);
    // Passing validationDetailId to fetchRequirements will automatically update validation_total in the DB
    const requirements: Requirement[] = await fetchRequirements(supabase, unitCodeLower, requirementValidationType, unitLink, validationDetailId);
    console.log(`[Validate Assessment] Retrieved ${requirements.length} requirements`);

    // Check if we have requirements - if not, we cannot validate
    if (!requirements || requirements.length === 0) {
      console.error(`[Validate Assessment] No requirements found for ${unitCode} - cannot validate`);
      return createErrorResponse(
        `No requirements found for unit ${unitCode}. Please ensure requirements have been extracted from training.gov.au first.`,
        400
      );
    }

    // Ensure we have requirements datas JSON for prompt injection
    const requirementsJSON = formatRequirementsAsJSON(requirements);

    // Map validationType to validation_type_id for database lookup
    const validationTypeMap: Record<string, number> = {
      'knowledge_evidence': 1,
      'performance_evidence': 3,
      'foundation_skills': 5,
      'elements_criteria': 2,
      'assessment_conditions': 4,
      'assessment_instructions': 7,
      'assessment': 10, // Maps to full_validation
      'full_validation': 10, // UnitOfCompetency
      'learner_guide_validation': 11, // LearnerGuide - single-prompt validation
    };

    // Try to get prompt from database first, then fall back to hardcoded prompts
    let prompt = customPrompt;
    if (!prompt) {
      // If promptId is provided, fetch that specific prompt from old table
      if (promptId) {
        console.log(`[validate-assessment] Fetching prompt by ID: ${promptId}`);
        const { data: promptData, error: promptError } = await supabase
          .from('prompt')
          .select('prompt')
          .eq('id', promptId)
          .single();

        if (!promptError && promptData) {
          prompt = promptData.prompt
            .replace(/{unitCode}/g, unitCode)
            .replace(/{unitTitle}/g, unit.Title || unit.title || 'Unit Title Not Available')
            .replace(/{requirements}/g, requirementsJSON);
          console.log(`[validate-assessment] Using prompt ID ${promptId}`);
        } else {
          console.error(`[validate-assessment] Failed to fetch prompt ${promptId}:`, promptError);
        }
      }

      // PRIORITY 1: Try the NEW prompts table (v2.0 split prompts)
      // These prompts support the split validation architecture and include {{requirement_text}} placeholders
      if (!prompt) {
        console.log(`[validate-assessment] Trying new prompts table for ${validationType}`);
        const newPrompt = await getPromptFromNewTable(supabase, validationType, 'unit');
        if (newPrompt) {
          console.log(`[validate-assessment] ✅ Using NEW prompts table: ${newPrompt.name} (v${newPrompt.version})`);
          // Replace placeholders with actual data
          prompt = formatPrompt(newPrompt.prompt_text, {
            unitCode: unitCode,
            unitTitle: unit.Title || unit.title || 'Unit Title Not Available',
            requirements: requirementsJSON,
          });
        }
      }

      // PRIORITY 2: Try the OLD prompt table (legacy prompts)
      if (!prompt) {
        const validationTypeId = validationTypeMap[validationType];
        if (validationTypeId) {
          const dbPrompt = await getPromptFromDatabase(supabase, validationTypeId);
          if (dbPrompt) {
            console.log(`[validate-assessment] Using OLD prompt table for validation_type_id ${validationTypeId}`);
            // Replace placeholders with actual data
            prompt = dbPrompt
              .replace(/{unitCode}/g, unitCode)
              .replace(/{unitTitle}/g, unit.Title || unit.title || 'Unit Title Not Available');

            // Replace {requirements} placeholder with JSON array of requirements
            prompt = prompt.replace(/{requirements}/g, requirementsJSON);
          }
        }
      }

      // PRIORITY 3: Fallback to hardcoded prompts
      if (!prompt) {
        console.log(`[validate-assessment] Using hardcoded fallback prompt for ${validationType}`);
        if (validationType === 'learner_guide_validation') {
          // Use the learner guide validation prompt template
          const allRequirementsData = await formatAllRequirementsForLearnerGuide(supabase, unitCode);
          prompt = formatLearnerGuideValidationPrompt(
            unitCode,
            unit.Title || unit.title || 'Unit Title Not Available',
            allRequirementsData.knowledgeEvidence,
            allRequirementsData.performanceEvidence,
            allRequirementsData.foundationSkills,
            allRequirementsData.elementsPerformanceCriteria,
            allRequirementsData.assessmentConditions
          );
        } else {
          // Use V2 prompt with JSON requirements
          prompt = getValidationPromptV2(validationType, unit, requirementsJSON);
        }
      }
    }

    console.log(`[Validate Assessment] Running ${validationType} validation for ${unitCode} using Azure`);
    console.log(`[Validate Assessment] Document info:`, {
      id: document.id,
      file_name: document.file_name,
      storage_path: document.storage_path
    });

    // ===== AZURE-BASED VALIDATION =====
    // 1. Fetch all documents for this validation session
    const { data: sessionDocuments, error: docsError } = await supabase
      .from('documents')
      .select('id, file_name, storage_path')
      .eq('validation_detail_id', validationDetailId);

    if (docsError || !sessionDocuments || sessionDocuments.length === 0) {
      console.error(`[Validate Assessment] No documents found for validation_detail_id: ${validationDetailId}`);
      return createErrorResponse('No documents found for this validation session', 404);
    }

    console.log(`[Validate Assessment] Found ${sessionDocuments.length} documents for validation session`);

    // 2. Extract document content using Azure Document Intelligence
    const docUrls = sessionDocuments.map((doc: any) => `s3://smartrtobucket/${doc.storage_path}`);

    // Check if elements exist for these documents
    const { data: existingElements } = await supabase
      .from('elements')
      .select('id')
      .in('url', docUrls)
      .limit(1);

    if (!existingElements || existingElements.length === 0) {
      console.log(`[Validate Assessment] No elements found - extracting documents now...`);
      await extractDocuments(supabase, sessionDocuments, validationDetailId);
    }

    // Determine document type
    const documentType = validationType === 'learner_guide_validation'
      ? 'training_package'
      : 'assessment';

    // 3. Build validation context
    const validationContext: ValidationContext = {
      supabase,
      validationDetailId,
      unitCode,
      unitTitle: unit.Title || unit.title || 'Unit Title Not Available',
      documentType,
      documents: sessionDocuments,
      rtoCode: unit.rtoCode
    };

    // 4. Get document content once for efficient reuse
    const documentContent = await getDocumentContent(
      supabase,
      sessionDocuments,
      validationDetailId
    );

    console.log(`[Validate Assessment] Document content retrieved: ${documentContent.length} characters`);

    // 5. Validate each requirement using Azure OpenAI
    const validationResults: any[] = [];
    let successCount = 0;
    let failCount = 0;

    console.log(`[Validate Assessment] Validating ${requirements.length} requirements...`);

    for (const requirement of requirements) {
      const req: any = requirement; // Cast to any since different requirement types have different property names
      const requirementInput: RequirementInput = {
        id: req.id,
        requirement_number: req.requirement_number || req.ke_point || req.pe_point || req.fs_number || req.element_number || `REQ-${req.id}`,
        requirement_text: req.requirement_text || req.ke_text || req.pe_text || req.description || '',
        requirement_type: req.requirement_type || validationType,
        element_text: req.element_text
      };

      console.log(`[Validate Assessment] Validating: ${requirementInput.requirement_number}`);

      // Get requirement-specific content from documents
      const reqContent = await getDocumentContent(
        supabase,
        sessionDocuments,
        validationDetailId,
        requirementInput.requirement_number,
        requirementInput.requirement_text
      );

      const result = await validateRequirement(validationContext, requirementInput, reqContent);

      if (result.success) {
        successCount++;
      } else {
        failCount++;
        console.warn(`[Validate Assessment] Failed to validate ${requirementInput.requirement_number}: ${result.error}`);
      }

      // Store result in validation_results table
      const { error: insertError } = await supabase
        .from('validation_results')
        .insert({
          validation_detail_id: validationDetailId,
          requirement_id: req.id,
          requirement_type: requirementInput.requirement_type,
          requirement_number: requirementInput.requirement_number,
          requirement_text: requirementInput.requirement_text,
          status: result.status,
          reasoning: result.reasoning,
          mapped_content: result.mappedContent,
          citations: result.citations,
          smart_questions: result.smartQuestions,
          benchmark_answer: result.benchmarkAnswer,
          recommendations: result.recommendations,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (insertError) {
        console.error(`[Validate Assessment] Failed to store result for ${requirementInput.requirement_number}:`, insertError.message);
      }

      validationResults.push({
        requirementId: req.id,
        requirementNumber: requirementInput.requirement_number,
        ...result
      });
    }

    console.log(`[Validate Assessment] Validation complete: ${successCount} succeeded, ${failCount} failed`);

    // 6. Update validation_detail with completion status
    const overallStatus = failCount === 0 ? 'completed' : (successCount > 0 ? 'partial' : 'failed');

    await supabase
      .from('validation_detail')
      .update({
        status: overallStatus,
        completed_at: new Date().toISOString(),
        last_updated_at: new Date().toISOString()
      })
      .eq('id', validationDetailId);

    // Calculate summary stats
    const metCount = validationResults.filter(r => r.status?.toLowerCase() === 'met').length;
    const partialCount = validationResults.filter(r => r.status?.toLowerCase().includes('partial')).length;
    const notMetCount = validationResults.filter(r => r.status?.toLowerCase().includes('not')).length;

    console.log(`[Validate Assessment] Summary: ${metCount} Met, ${partialCount} Partial, ${notMetCount} Not Met`);

    const duration = Date.now() - startTime;
    console.log('[validate-assessment] Validation completed successfully');
    console.log('[validate-assessment] SUCCESS - Duration:', duration, 'ms');
    console.log('[validate-assessment] END', new Date().toISOString());
    console.log('='.repeat(80));

    return createSuccessResponse({
      success: true,
      validation: {
        overallStatus: overallStatus,
        requirementCount: validationResults.length,
        metCount,
        partialCount,
        notMetCount,
        results: validationResults
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[validate-assessment] ERROR:', error);
    console.error('[validate-assessment] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      duration: duration + 'ms'
    });
    console.log('[validate-assessment] END (with error)', new Date().toISOString());
    console.log('='.repeat(80));

    return createErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    );
  }
});

async function createSyntheticTestRequirements(
  supabase: any,
  unitCode: string,
  requirementTables: Array<{ type: string; table: string }>
): Promise<Array<{ type: string; requirements: any[] }>> {
  console.log(`[Create Synthetic Requirements] Creating test requirements for ${unitCode}`);

  const syntheticRequirements: Array<{ type: string; requirements: any[] }> = [];

  for (const { type, table } of requirementTables) {
    let requirements: any[] = [];

    switch (type) {
      case 'knowledge_evidence':
        const { data: keData, error: keError } = await supabase
          .from(table)
          .insert([
            {
              unitCode,
              ke_number: '1',
              ke_requirement: 'Test requirement for knowledge evidence',
            }
          ])
          .select();

        if (!keError && keData) {
          requirements = keData;
          console.log(`[Create Synthetic Requirements] Created ${keData.length} KE requirements`);
        }
        break;

      case 'performance_evidence':
        const { data: peData, error: peError } = await supabase
          .from(table)
          .insert([
            {
              unitCode,
              pe_number: '1',
              pe_requirement: 'Test requirement for performance evidence',
            }
          ])
          .select();

        if (!peError && peData) {
          requirements = peData;
          console.log(`[Create Synthetic Requirements] Created ${peData.length} PE requirements`);
        }
        break;

      case 'foundation_skills':
        const { data: fsData, error: fsError } = await supabase
          .from(table)
          .insert([
            {
              unitCode,
              fs_number: '1',
              fs_requirement: 'Test requirement for foundation skills',
            }
          ])
          .select();

        if (!fsError && fsData) {
          requirements = fsData;
          console.log(`[Create Synthetic Requirements] Created ${fsData.length} FS requirements`);
        }
        break;

      case 'elements_criteria':
        const { data: epcData, error: epcError } = await supabase
          .from(table)
          .insert([
            {
              unitCode,
              element_number: '1',
              pc_number: '1.1',
              performance_criteria: 'Test requirement for elements and performance criteria',
            }
          ])
          .select();

        if (!epcError && epcData) {
          requirements = epcData;
          console.log(`[Create Synthetic Requirements] Created ${epcData.length} EPC requirements`);
        }
        break;

      case 'assessment_conditions':
        const { data: acData, error: acError } = await supabase
          .from(table)
          .insert([
            {
              unitCode,
              condition_point: 'Test requirement for assessment conditions',
            }
          ])
          .select();

        if (!acError && acData) {
          requirements = acData;
          console.log(`[Create Synthetic Requirements] Created ${acData.length} AC requirements`);
        }
        break;
    }

    syntheticRequirements.push({ type, requirements });
  }

  return syntheticRequirements;
}

function parseValidationResponse(
  responseText: string,
  validationType: string,
  groundingMetadata: any
): ValidationResult {
  const scoreMatch = responseText.match(/(?:COVERAGE SCORE|OVERALL SCORE):\s*(\d+)/i);
  const score = scoreMatch ? parseInt(scoreMatch[1], 10) : 0;

  const statusMatch = responseText.match(/STATUS:\s*(PASS|FAIL|PARTIAL)/i);
  const status = statusMatch
    ? (statusMatch[1].toLowerCase() as 'pass' | 'fail' | 'partial')
    : score >= 80
      ? 'pass'
      : score >= 50
        ? 'partial'
        : 'fail';

  const summaryMatch = responseText.match(/(?:SUMMARY|EXECUTIVE SUMMARY):\s*([^\n]+(?:\n[^\n*-]+)*)/i);
  const summary = summaryMatch ? summaryMatch[1].trim() : 'Validation completed';

  const gapsSection = responseText.match(/GAPS?:\s*((?:[-*]\s*[^\n]+\n?)+)/i);
  const gaps = gapsSection
    ? gapsSection[1]
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => line.replace(/^[-*]\s*/, '').trim())
    : [];

  const recsSection = responseText.match(/RECOMMENDATIONS?:\s*((?:[-*]\s*[^\n]+\n?)+)/i);
  const recommendations = recsSection
    ? recsSection[1]
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => line.replace(/^[-*]\s*/, '').trim())
    : [];

  // Extract citations with page numbers and document names
  const citations: Citation[] = [];
  const groundingChunks = groundingMetadata?.groundingChunks || [];

  for (const chunk of groundingChunks) {
    if (chunk.fileSearchChunk) {
      const citation: Citation = {
        documentName: chunk.fileSearchChunk.documentName || 'Unknown Document',
        pageNumbers: chunk.fileSearchChunk.pageNumbers || [],
        chunkText: chunk.fileSearchChunk.chunkText,
        metadata: {},
      };

      // Extract custom metadata if available
      if (chunk.fileSearchChunk.customMetadata) {
        for (const meta of chunk.fileSearchChunk.customMetadata) {
          citation.metadata![meta.key] = meta.stringValue || meta.numericValue;
        }
      }

      citations.push(citation);
    }
  }

  console.log(`[Parse Response] Extracted ${citations.length} citations`);

  return {
    validationType,
    status,
    score,
    summary,
    details: responseText,
    gaps,
    recommendations,
    citations,
  };
}

// DEPRECATED: This function has been replaced by storeValidationResultsNew in _shared/store-validation-results.ts
// Keeping for reference during migration
/*
async function storeValidationResults(
  supabase: any,
  validationType: string,
  validationDetailId: number,
  requirements: any[],
  validationResult: ValidationResult
): Promise<void> {
  console.log(`[Store Results] Storing ${validationType} validation results for ${requirements.length} requirements`);

  const statusMap: Record<string, string> = {
    'pass': 'met',
    'fail': 'not-met',
    'partial': 'partial',
  };
  const mappedStatus = statusMap[validationResult.status] || validationResult.status;

  const citationsJson = JSON.stringify(validationResult.citations);

  // Determine the validation table and prepare records
  let tableName = '';
  const records: any[] = [];

  switch (validationType) {
    case 'knowledge_evidence':
      tableName = 'knowledge_evidence_validations';
      for (const req of requirements) {
        records.push({
          valDetail_id: validationDetailId,
          requirementId: req.id,
          ke_number: req.ke_number,
          ke_requirement: req.ke_requirement,
          status: mappedStatus,
          unmappedContent: validationResult.gaps.join('\n'),
          unmappedRecommendation: validationResult.recommendations.join('\n'),
          docReferences: citationsJson,
        });
      }
      break;

    case 'performance_evidence':
      tableName = 'performance_evidence_validations';
      for (const req of requirements) {
        records.push({
          valDetail_id: validationDetailId,
          requirementId: req.id,
          pe_number: req.pe_number,
          pe_requirement: req.pe_requirement,
          status: mappedStatus,
          unmappedContent: validationResult.gaps.join('\n'),
          unmappedRecommendation: validationResult.recommendations.join('\n'),
          docReferences: citationsJson,
        });
      }
      break;

    case 'foundation_skills':
      tableName = 'foundation_skills_validations';
      for (const req of requirements) {
        records.push({
          valDetail_id: validationDetailId,
          requirementId: req.id,
          fs_number: req.fs_number,
          fs_requirement: req.fs_requirement,
          status: mappedStatus,
          unmappedContent: validationResult.gaps.join('\n'),
          unmappedRecommendation: validationResult.recommendations.join('\n'),
          docReferences: citationsJson,
        });
      }
      break;

    case 'elements_criteria':
      tableName = 'elements_performance_criteria_validations';
      for (const req of requirements) {
        records.push({
          valDetail_id: validationDetailId,
          requirementId: req.id,
          epc_number: req.element_number && req.pc_number 
            ? `${req.element_number}.${req.pc_number}` 
            : req.pc_number || req.element_number || '',
          performance_criteria: req.performance_criteria,
          status: mappedStatus,
          unmappedContent: validationResult.gaps.join('\n'),
          unmappedRecommendation: validationResult.recommendations.join('\n'),
          docReferences: citationsJson,
        });
      }
      break;

    case 'assessment_conditions':
      tableName = 'assessment_conditions_validations';
      for (const req of requirements) {
        records.push({
          valDetail_id: validationDetailId,
          ac_point: req.condition_point,
          status: mappedStatus,
          reasoning: validationResult.summary,
          recommendation: validationResult.recommendations.join('\n'),
        });
      }
      break;
  }

  if (tableName && records.length > 0) {
    const { error } = await supabase.from(tableName).insert(records);

    if (error) {
      console.error(`[Store Results] Error inserting into ${tableName}:`, error);
      throw new Error(`Failed to store validation results: ${error.message}`);
    }

    console.log(`[Store Results] Successfully stored ${records.length} records in ${tableName}`);
  }
}
*/

function formatCitationsForStorage(citations: Citation[]): string {
  // Return empty JSON array if no citations
  if (citations.length === 0) {
    return JSON.stringify([]);
  }

  // Format citations as JSON array of objects for easier parsing
  const formattedCitations = citations.map((citation) => ({
    documentName: citation.documentName,
    pageNumbers: citation.pageNumbers
  }));

  return JSON.stringify(formattedCitations);
}

/**
 * Format all requirement types for full_validation prompt
 * Supports two modes:
 * 1. Single-prompt: Reads from UnitOfCompetency.UOCpage JSON (preferred)
 * 2. Legacy: Reads from separate requirement tables (fallback)
 */
async function formatAllRequirements(supabase: any, unitCode: string): Promise<string> {
  const sections: string[] = [];

  // First, try to fetch from UnitOfCompetency.UOCpage (single-prompt mode)
  const { data: uocData, error: uocError } = await supabase
    .from('UnitOfCompetency')
    .select('UOCpage, ke, pe, fs, epc, ac')
    .eq('unitCode', unitCode)
    .single();

  if (!uocError && uocData && uocData.UOCpage) {
    console.log('[Validate Assessment] Using UOCpage for requirements (single-prompt mode)');

    try {
      const uocPage = typeof uocData.UOCpage === 'string'
        ? JSON.parse(uocData.UOCpage)
        : uocData.UOCpage;

      // Extract requirements from UOCpage JSON
      if (uocPage.KnowledgeEvidence) {
        sections.push('**Knowledge Evidence Requirements:**\n' + uocPage.KnowledgeEvidence);
      } else if (uocData.ke) {
        sections.push('**Knowledge Evidence Requirements:**\n' + uocData.ke);
      }

      if (uocPage.PerformanceEvidence) {
        sections.push('\n**Performance Evidence Requirements:**\n' + uocPage.PerformanceEvidence);
      } else if (uocData.pe) {
        sections.push('\n**Performance Evidence Requirements:**\n' + uocData.pe);
      }

      if (uocPage.ElementsAndPerformanceCriteria) {
        sections.push('\n**Elements and Performance Criteria:**\n' + uocPage.ElementsAndPerformanceCriteria);
      } else if (uocData.epc) {
        sections.push('\n**Elements and Performance Criteria:**\n' + uocData.epc);
      }

      if (uocPage.FoundationSkills) {
        sections.push('\n**Foundation Skills Requirements:**\n' + uocPage.FoundationSkills);
      } else if (uocData.fs) {
        sections.push('\n**Foundation Skills Requirements:**\n' + uocData.fs);
      }

      if (uocPage.AssessmentConditions) {
        sections.push('\n**Assessment Conditions Requirements:**\n' + uocPage.AssessmentConditions);
      } else if (uocData.ac) {
        sections.push('\n**Assessment Conditions Requirements:**\n' + uocData.ac);
      }

      if (sections.length > 0) {
        return sections.join('\n');
      }
    } catch (err) {
      console.log('[Validate Assessment] Error parsing UOCpage JSON, falling back to requirement tables:', err);
    }
  }

  // Fallback: Fetch from separate requirement tables (legacy mode)
  console.log('[Validate Assessment] Using requirement tables (legacy mode)');

  // Fetch Knowledge Evidence requirements
  const { data: keData } = await supabase
    .from('knowledge_evidence_requirements')
    .select('*')
    .eq('unitCode', unitCode);

  if (keData && keData.length > 0) {
    sections.push('**Knowledge Evidence Requirements:**');
    keData.forEach((r: any, i: number) => {
      sections.push(`${i + 1}. ${r.knowled_point || r.description || 'No description'}`);
    });
  }

  // Fetch Performance Evidence requirements
  const { data: peData } = await supabase
    .from('performance_evidence_requirements')
    .select('*')
    .eq('unitCode', unitCode);

  if (peData && peData.length > 0) {
    sections.push('\n**Performance Evidence Requirements:**');
    peData.forEach((r: any, i: number) => {
      sections.push(`${i + 1}. ${r.performance_evidence || r.description || 'No description'}`);
    });
  }

  // Fetch Elements & Performance Criteria
  const { data: epcData } = await supabase
    .from('elements_performance_criteria_requirements')
    .select('*')
    .eq('unitCode', unitCode);

  if (epcData && epcData.length > 0) {
    sections.push('\n**Elements and Performance Criteria:**');
    epcData.forEach((r: any) => {
      sections.push(`${r.element || 'Element'}: ${r.performance_criteria || 'No description'}`);
    });
  }

  // Fetch Foundation Skills requirements
  const { data: fsData } = await supabase
    .from('foundation_skills_requirements')
    .select('*')
    .eq('unitCode', unitCode);

  if (fsData && fsData.length > 0) {
    sections.push('\n**Foundation Skills Requirements:**');
    fsData.forEach((r: any, i: number) => {
      sections.push(`${i + 1}. ${r.skill_point || r.description || 'No description'}`);
    });
  }

  // Fetch Assessment Conditions requirements
  const { data: acData } = await supabase
    .from('assessment_conditions_requirements')
    .select('*')
    .eq('unitCode', unitCode);

  if (acData && acData.length > 0) {
    sections.push('\n**Assessment Conditions Requirements:**');
    acData.forEach((r: any, i: number) => {
      sections.push(`${i + 1}. ${r.condition_point || r.description || 'No description'}`);
    });
  }

  return sections.length > 0
    ? sections.join('\n')
    : 'No requirements found in database for this unit.';
}

/**
 * Format all requirements for learner guide validation prompt
 * Returns requirements as separate fields for each section
 */
async function formatAllRequirementsForLearnerGuide(supabase: any, unitCode: string): Promise<{
  knowledgeEvidence: string;
  performanceEvidence: string;
  foundationSkills: string;
  elementsPerformanceCriteria: string;
  assessmentConditions: string;
}> {
  // Try to fetch from UnitOfCompetency.UOCpage first
  const { data: uocData, error: uocError } = await supabase
    .from('UnitOfCompetency')
    .select('UOCpage, ke, pe, fs, epc, ac')
    .eq('unitCode', unitCode)
    .single();

  if (!uocError && uocData && uocData.UOCpage) {
    try {
      const uocPage = typeof uocData.UOCpage === 'string'
        ? JSON.parse(uocData.UOCpage)
        : uocData.UOCpage;

      return {
        knowledgeEvidence: uocPage.KnowledgeEvidence || uocData.ke || 'No knowledge evidence requirements found',
        performanceEvidence: uocPage.PerformanceEvidence || uocData.pe || 'No performance evidence requirements found',
        foundationSkills: uocPage.FoundationSkills || uocData.fs || 'No foundation skills requirements found',
        elementsPerformanceCriteria: uocPage.ElementsAndPerformanceCriteria || uocPage.Elements || uocData.epc || 'No elements/criteria requirements found',
        assessmentConditions: uocPage.AssessmentConditions || uocData.ac || 'No assessment conditions requirements found',
      };
    } catch (error) {
      console.error('[Validate Assessment] Error parsing UOCpage:', error);
    }
  }

  // Fallback: format from individual requirement tables
  return {
    knowledgeEvidence: 'Knowledge evidence requirements - see database tables',
    performanceEvidence: 'Performance evidence requirements - see database tables',
    foundationSkills: 'Foundation skills requirements - see database tables',
    elementsPerformanceCriteria: 'Elements and performance criteria - see database tables',
    assessmentConditions: 'Assessment conditions - see database tables',
  };
}
