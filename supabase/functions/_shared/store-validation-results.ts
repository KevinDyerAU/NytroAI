/**
 * Store validation results using the consolidated validation_results table
 * Phase 3: Edge Function Updates
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { insertValidationResults, CreateValidationResultInput } from './validation-results.ts';
import { logInfo, logError } from './errors.ts';

const FUNCTION_NAME = 'store-validation-results';

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

interface Citation {
  documentName: string;
  pageNumbers: number[];
  chunkText?: string;
  metadata?: Record<string, any>;
}

/**
 * Map validation type string to validation_type_id
 */
function getValidationTypeId(validationType: string): number {
  const typeMap: Record<string, number> = {
    knowledge_evidence: 1,
    elements_criteria: 2,
    performance_evidence: 3,
    assessment_conditions: 4,
    foundation_skills: 5,
    assessment_instructions: 7,
    full_validation: 10,
    learner_guide_validation: 6,
  };
  return typeMap[validationType] || 1;
}

/**
 * Map validation type to requirement type code
 */
function getRequirementType(validationType: string): 'ke' | 'pe' | 'fs' | 'epc' | 'ac' | 'ai' | 'learner' {
  const typeMap: Record<string, 'ke' | 'pe' | 'fs' | 'epc' | 'ac' | 'ai' | 'learner'> = {
    knowledge_evidence: 'ke',
    performance_evidence: 'pe',
    foundation_skills: 'fs',
    elements_criteria: 'epc',
    assessment_conditions: 'ac',
    assessment_instructions: 'ai',
    learner_guide_validation: 'learner',
  };
  return typeMap[validationType] || 'ke';
}

/**
 * Map validation status to database enum
 */
function mapStatus(status: 'pass' | 'fail' | 'partial'): 'met' | 'not-met' | 'partial' {
  const statusMap: Record<string, 'met' | 'not-met' | 'partial'> = {
    pass: 'met',
    fail: 'not-met',
    partial: 'partial',
  };
  return statusMap[status] || 'not-met';
}

/**
 * Extract requirement number from requirement object
 */
function getRequirementNumber(req: any, validationType: string): string {
  switch (validationType) {
    case 'knowledge_evidence':
      return req.ke_number || '';
    case 'performance_evidence':
      return req.pe_number || '';
    case 'foundation_skills':
      return req.fs_number || '';
    case 'elements_criteria':
      return req.element_number && req.pc_number 
        ? `${req.element_number}.${req.pc_number}` 
        : req.pc_number || req.element_number || req.epc_number || '';
    case 'assessment_conditions':
      return req.ac_number || `AC-${req.id}`;
    default:
      return '';
  }
}

/**
 * Extract requirement text from requirement object
 */
function getRequirementText(req: any, validationType: string): string {
  switch (validationType) {
    case 'knowledge_evidence':
      return req.ke_requirement || req.knowled_point || '';
    case 'performance_evidence':
      return req.pe_requirement || req.performance_evidence || '';
    case 'foundation_skills':
      return req.fs_requirement || req.skill_point || '';
    case 'elements_criteria':
      return req.performance_criteria || '';
    case 'assessment_conditions':
      return req.ac_point || req.condition_point || '';
    default:
      return '';
  }
}

/**
 * Store validation results in the consolidated validation_results table
 * 
 * This replaces the old storeValidationResults function that inserted into
 * separate tables (knowledge_evidence_validations, performance_evidence_validations, etc.)
 */
export async function storeValidationResults(
  supabase: SupabaseClient,
  validationType: string,
  validationDetailId: number,
  requirements: any[],
  validationResult: ValidationResult,
  namespace?: string
): Promise<{ success: boolean; error?: any }> {
  try {
    logInfo(FUNCTION_NAME, `Storing ${validationType} validation results for ${requirements.length} requirements`);

    const mappedStatus = mapStatus(validationResult.status);
    const requirementType = getRequirementType(validationType);
    const validationTypeId = getValidationTypeId(validationType);
    const citationsJson = JSON.stringify(validationResult.citations);

    // Prepare records for insertion
    const records: CreateValidationResultInput[] = requirements.map(req => ({
      validation_detail_id: validationDetailId,
      validation_type_id: validationTypeId,
      requirement_id: req.id || null,
      requirement_type: requirementType,
      requirement_number: getRequirementNumber(req, validationType),
      requirement_text: getRequirementText(req, validationType),
      status: mappedStatus,
      reasoning: validationResult.summary,
      mapped_content: validationResult.details,
      unmapped_content: validationResult.gaps.join('\n'),
      recommendations: validationResult.recommendations.join('\n'),
      doc_references: citationsJson,
      smart_questions: [],
      validation_method: 'single_prompt',
      metadata: {
        namespace,
        score: validationResult.score,
        validation_type: validationType,
      },
    }));

    // Insert all records using shared utility
    const { data, error } = await insertValidationResults(supabase, records);

    if (error) {
      logError(FUNCTION_NAME, error, { validationType, validationDetailId, recordCount: records.length });
      return { success: false, error };
    }

    logInfo(FUNCTION_NAME, `Successfully stored ${records.length} validation results`, {
      validationType,
      validationDetailId,
      status: mappedStatus,
    });

    return { success: true };

  } catch (error) {
    logError(FUNCTION_NAME, error, { validationType, validationDetailId });
    return { success: false, error };
  }
}

/**
 * Store a single validation result (for full_validation or learner_guide_validation without requirements)
 */
export async function storeSingleValidationResult(
  supabase: SupabaseClient,
  validationType: string,
  validationDetailId: number,
  validationResult: ValidationResult,
  namespace?: string
): Promise<{ success: boolean; error?: any }> {
  try {
    logInfo(FUNCTION_NAME, `Storing single ${validationType} validation result`);

    const mappedStatus = mapStatus(validationResult.status);
    const requirementType = getRequirementType(validationType);
    const validationTypeId = getValidationTypeId(validationType);
    const citationsJson = JSON.stringify(validationResult.citations);

    const record: CreateValidationResultInput = {
      validation_detail_id: validationDetailId,
      validation_type_id: validationTypeId,
      requirement_id: null,
      requirement_type: requirementType,
      requirement_number: '1',
      requirement_text: `${validationType} validation`,
      status: mappedStatus,
      reasoning: validationResult.summary,
      mapped_content: validationResult.details,
      unmapped_content: validationResult.gaps.join('\n'),
      recommendations: validationResult.recommendations.join('\n'),
      doc_references: citationsJson,
      smart_questions: [],
      validation_method: 'single_prompt',
      metadata: {
        namespace,
        score: validationResult.score,
        validation_type: validationType,
        is_single_result: true,
      },
    };

    const { data, error } = await insertValidationResults(supabase, [record]);

    if (error) {
      logError(FUNCTION_NAME, error, { validationType, validationDetailId });
      return { success: false, error };
    }

    logInfo(FUNCTION_NAME, `Successfully stored single validation result`, {
      validationType,
      validationDetailId,
      status: mappedStatus,
    });

    return { success: true };

  } catch (error) {
    logError(FUNCTION_NAME, error, { validationType, validationDetailId });
    return { success: false, error };
  }
}
