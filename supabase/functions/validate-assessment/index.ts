import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { handleCors, createErrorResponse, createSuccessResponse } from '../_shared/cors.ts';
import { parseUOCPage, formatRequirementsForPrompt } from '../_shared/uoc-parser.ts';
import { createDefaultGeminiClient } from '../_shared/gemini.ts';
import { getValidationPrompt } from '../_shared/validation-prompts.ts';
import { formatLearnerGuideValidationPrompt } from '../_shared/learner-guide-validation-prompt.ts';
import { storeValidationResults as storeValidationResultsNew, storeSingleValidationResult } from '../_shared/store-validation-results.ts';

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
    | 'knowledge_evidence'
    | 'performance_evidence'
    | 'foundation_skills'
    | 'elements_criteria'
    | 'assessment_conditions'
    | 'full_validation'
    | 'learner_guide_validation';
  validationDetailId?: number;
  customPrompt?: string;
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
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const requestData: ValidateAssessmentRequest = await req.json();
    let { documentId, unitCode, validationType, validationDetailId, customPrompt, namespace } = requestData;

    if (!documentId || !unitCode || !validationType) {
      return createErrorResponse(
        'Missing required fields: documentId, unitCode, validationType'
      );
    }

    const supabase = createSupabaseClient(req);

    // If validationDetailId is provided but no namespace, fetch it from validation_detail
    if (validationDetailId && !namespace) {
      const { data: validationDetail } = await supabase
        .from('validation_detail')
        .select('namespace_code')
        .eq('id', validationDetailId)
        .single();
      
      if (validationDetail?.namespace_code) {
        namespace = validationDetail.namespace_code;
        console.log(`[Validate Assessment] Fetched namespace from validation_detail: ${namespace}`);
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

    // Get unit requirements
    const { data: unit, error: unitError } = await supabase
      .from('UnitOfCompetency')
      .select('*')
      .eq('unitCode', unitCode)
      .single();

    if (unitError || !unit) {
      return createErrorResponse(`Unit not found: ${unitCode}`);
    }

    // Get requirements for this unit based on validation type
    let requirements: any[] = [];
    let requirementTable = '';

    switch (validationType) {
      case 'knowledge_evidence':
        requirementTable = 'knowledge_evidence_requirements';
        break;
      case 'performance_evidence':
        requirementTable = 'performance_evidence_requirements';
        break;
      case 'foundation_skills':
        requirementTable = 'foundation_skills_requirements';
        break;
      case 'elements_criteria':
        requirementTable = 'elements_performance_criteria_requirements';
        break;
      case 'assessment_conditions':
        requirementTable = 'assessment_conditions_requirements';
        break;
    }

    if (requirementTable) {
      const { data: reqData, error: reqError } = await supabase
        .from(requirementTable)
        .select('*')
        .eq('unitCode', unitCode);

      if (!reqError && reqData) {
        requirements = reqData;
      }
    }

    const gemini = createDefaultGeminiClient();

    // Map validationType to validation_type_id for database lookup
    const validationTypeMap: Record<string, number> = {
      'knowledge_evidence': 1,
      'performance_evidence': 3,
      'foundation_skills': 5,
      'elements_criteria': 2,
      'assessment_conditions': 4,
      'assessment_instructions': 7,
      'full_validation': 10, // UnitOfCompetency
      'learner_guide_validation': 11, // LearnerGuide - single-prompt validation
    };

    // Try to get prompt from database first, then fall back to hardcoded prompts
    let prompt = customPrompt;
    if (!prompt) {
      const validationTypeId = validationTypeMap[validationType];
      if (validationTypeId) {
        const dbPrompt = await getPromptFromDatabase(supabase, validationTypeId);
        if (dbPrompt) {
          // Replace placeholders with actual data
          prompt = dbPrompt
            .replace(/{unitCode}/g, unitCode)
            .replace(/{unitTitle}/g, unit.Title || unit.title || 'Unit Title Not Available');
          
          // For full_validation, format all requirement types
          if (validationType === 'full_validation') {
            const allRequirementsText = await formatAllRequirements(supabase, unitCode);
            prompt = prompt.replace(/{requirements}/g, allRequirementsText);
          } else if (validationType === 'learner_guide_validation') {
            // For learner_guide_validation, format all requirement types (same as full_validation)
            const allRequirementsText = await formatAllRequirements(supabase, unitCode);
            prompt = prompt.replace(/{requirements}/g, allRequirementsText);
          } else {
            // For specific validation types, format that type's requirements
            const requirementsText = requirements
              .map((r, i) => `${i + 1}. ${r.description || r.text || r.knowled_point || r.performance_evidence || JSON.stringify(r)}`)
              .join('\n');
            prompt = prompt.replace(/{requirements}/g, requirementsText);
          }
        }
      }

      // Fallback to hardcoded prompts
      if (!prompt) {
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
          prompt = getValidationPrompt(validationType, unit, requirements);
        }
      }
    }

    console.log(`[Validate Assessment] Running ${validationType} validation for ${unitCode}`);
    console.log(`[Validate Assessment] Document info:`, {
      id: document.id,
      file_name: document.file_name,
      file_search_store_id: document.file_search_store_id,
      embedding_status: document.embedding_status
    });

    // Build metadata filter - use namespace if provided to search ALL documents in this validation session
    // Note: Gemini API requires string values to be quoted in metadata filters
    
    // Determine document type based on validation type
    const documentType = validationType === 'learner_guide_validation' 
      ? 'training_package'  // Learner guides
      : 'assessment';        // Assessment documents
    
    let metadataFilter: string | undefined;
    if (namespace) {
      // Filter by namespace to get ALL documents from THIS specific validation session
      metadataFilter = `namespace="${namespace}" AND document-type="${documentType}"`;
      console.log(`[Validate Assessment] Using namespace filter: ${namespace}, document-type: ${documentType}`);
    } else if (unitCode) {
      // Fallback to unit-code filter (legacy behavior)
      metadataFilter = `unit-code="${unitCode}" AND document-type="${documentType}"`;
      console.log(`[Validate Assessment] Using unit-code filter: ${unitCode}, document-type: ${documentType}`);
    }

    // Query with File Search - Gemini will search ALL documents matching the filter
    const response = await gemini.generateContentWithFileSearch(
      prompt,
      [document.file_search_store_id],
      metadataFilter
    );
    
    // Log grounding information
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    console.log(`[Validate Assessment] Grounding chunks found: ${groundingChunks.length}`);
    if (groundingChunks.length > 0) {
      console.log(`[Validate Assessment] Sample chunks:`, groundingChunks.slice(0, 3).map((c: any) => ({
        doc: c.fileSearchChunk?.documentName,
        pages: c.fileSearchChunk?.pageNumbers
      })));
    } else {
      console.log(`[Validate Assessment] WARNING: No grounding chunks found - Gemini did not access any documents`);
    }

    // Parse validation result with citations
    const validationResult = parseValidationResponse(
      response.text,
      validationType,
      response.candidates[0]?.groundingMetadata
    );

    console.log(`[Validate Assessment] Validation completed. Score: ${validationResult.score}`);
    console.log(`[Validate Assessment] Citations found: ${validationResult.citations.length}`);

    // Store validation results in the appropriate table
    if (validationDetailId) {
      if (validationType === 'full_validation' || validationType === 'learner_guide_validation') {
        const validationLabel = validationType === 'learner_guide_validation' 
          ? 'Learner guide validation' 
          : 'Full validation';
        console.log(`[Validate Assessment] ${validationLabel} - storing results across all validation tables`);
        
        const requirementTables = [
          { type: 'knowledge_evidence', table: 'knowledge_evidence_requirements' },
          { type: 'performance_evidence', table: 'performance_evidence_requirements' },
          { type: 'foundation_skills', table: 'foundation_skills_requirements' },
          { type: 'elements_criteria', table: 'elements_performance_criteria_requirements' },
          { type: 'assessment_conditions', table: 'assessment_conditions_requirements' },
        ];

        let totalInserted = 0;
        let allTablesEmpty = true;
        
        for (const { type, table } of requirementTables) {
          const { data: reqData, error: reqError } = await supabase
            .from(table)
            .select('*')
            .eq('unitCode', unitCode);

          if (!reqError && reqData && reqData.length > 0) {
            allTablesEmpty = false;
            console.log(`[Validate Assessment] Storing ${reqData.length} ${type} validations`);
            await storeValidationResultsNew(
              supabase,
              type,
              validationDetailId,
              reqData,
              validationResult,
              namespace
            );
            totalInserted += reqData.length;
          }
        }
        
        if (allTablesEmpty) {
          console.log(`[Validate Assessment] No requirements found for ${unitCode} - using single-prompt mode (no requirement linking)`);
          
          // For single-prompt validation, store results without linking to specific requirements
          // Create one validation record per requirement type
          const validationTypes = [
            { type: 'knowledge_evidence', tableName: 'knowledge_evidence_validations' },
            { type: 'performance_evidence', tableName: 'performance_evidence_validations' },
            { type: 'foundation_skills', tableName: 'foundation_skills_validations' },
            { type: 'elements_criteria', tableName: 'elements_performance_criteria_validations' },
            { type: 'assessment_conditions', tableName: 'assessment_conditions_validations' },
          ];
          
          for (const { type, tableName } of validationTypes) {
            // Map validation status to database format
            const dbStatus = validationResult.status === 'pass' ? 'met' 
              : validationResult.status === 'fail' ? 'not-met' 
              : 'partial';
            
            const record = {
              valDetail_id: validationDetailId,
              requirementId: null, // No specific requirement for single-prompt
              status: dbStatus,
              mapped_questions: validationResult.summary,
              unmappedContent: validationResult.details,
              unmappedRecommendation: validationResult.recommendations.join('\n'),
              docReferences: formatCitationsForStorage(validationResult.citations),
            };
            
            const { data: insertData, error: insertError } = await supabase
              .from(tableName)
              .insert([record])
              .select();
            
            if (insertError) {
              console.error(`[Validate Assessment] ERROR inserting ${type} validation:`, insertError);
              console.error(`[Validate Assessment] Record attempted:`, JSON.stringify(record, null, 2));
            } else {
              console.log(`[Validate Assessment] ✓ Stored single-prompt ${type} validation (id: ${insertData?.[0]?.id})`);
              totalInserted++;
            }
          }
        }

        await supabase
          .from('validation_detail')
          .update({
            completed_count: totalInserted,
            extractStatus: 'Completed',
          })
          .eq('id', validationDetailId);

        console.log(`[Validate Assessment] ${validationLabel} complete - ${totalInserted} total validations stored`);
      } else if (requirements.length > 0) {
        // Single validation type
        await storeValidationResultsNew(
          supabase,
          validationType,
          validationDetailId,
          requirements,
          validationResult,
          namespace
        );
      }
    }

    return createSuccessResponse({
      success: true,
      validation: validationResult,
    });
  } catch (error) {
    console.error('[Validate Assessment] Error:', error);
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
      // Use safe UOC parser instead of JSON.parse
      const parsedUOC = parseUOCPage(uocData.UOCpage);
      
      if (!parsedUOC) {
        console.log('[Validate Assessment] Failed to parse UOCpage, falling back to requirement tables');
      } else {
        const uocPage = parsedUOC;

        // Use formatted requirements from parser
        const formattedRequirements = formatRequirementsForPrompt(uocPage);
        if (formattedRequirements) {
          return formattedRequirements;
        }
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
      // Use safe UOC parser instead of JSON.parse
      const parsedUOC = parseUOCPage(uocData.UOCpage);
      
      if (parsedUOC) {
        return {
          knowledgeEvidence: parsedUOC.knowledgeEvidence || uocData.ke || 'No knowledge evidence requirements found',
          performanceEvidence: parsedUOC.performanceEvidence || uocData.pe || 'No performance evidence requirements found',
          foundationSkills: parsedUOC.foundationSkills || uocData.fs || 'No foundation skills requirements found',
          elementsPerformanceCriteria: parsedUOC.elementsAndPerformanceCriteria || uocData.epc || 'No elements/criteria requirements found',
          assessmentConditions: parsedUOC.assessmentConditions || uocData.ac || 'No assessment conditions requirements found',
        };
      }
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
