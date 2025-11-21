/**
 * Validate Assessment Function - Refactored for Phase 2
 * Uses consolidated validation_results table
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient, getDocumentById, updateValidationDetailStatus } from '../_shared/database.ts';
import { handleCors } from '../_shared/cors.ts';
import { createErrorResponse, createSuccessResponse, ErrorCode, logError, logInfo } from '../_shared/errors.ts';
import { insertValidationResults, CreateValidationResultInput } from '../_shared/validation-results.ts';

const FUNCTION_NAME = 'validate-assessment-v2';

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
  validationDetailId: number;
  customPrompt?: string;
  namespace?: string;
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    logInfo(FUNCTION_NAME, 'Starting validation request');

    const requestData: ValidateAssessmentRequest = await req.json();
    const { documentId, unitCode, validationType, validationDetailId, customPrompt, namespace } = requestData;

    // Validate required fields
    if (!documentId || !unitCode || !validationType || !validationDetailId) {
      return createErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Missing required fields: documentId, unitCode, validationType, validationDetailId',
        { received: requestData }
      );
    }

    const supabase = createSupabaseClient(req);

    // Get document
    const { data: document, error: docError } = await getDocumentById(supabase, documentId);
    if (docError || !document) {
      return createErrorResponse(
        ErrorCode.NOT_FOUND,
        `Document not found: ${documentId}`,
        { documentId, error: docError }
      );
    }

    // Update validation detail status to 'in_progress'
    await updateValidationDetailStatus(supabase, validationDetailId, 'in_progress');

    // Get requirements based on validation type
    const requirements = await getRequirements(supabase, unitCode, validationType);
    if (!requirements || requirements.length === 0) {
      return createErrorResponse(
        ErrorCode.NOT_FOUND,
        `No requirements found for unit ${unitCode} and type ${validationType}`,
        { unitCode, validationType }
      );
    }

    logInfo(FUNCTION_NAME, `Found ${requirements.length} requirements to validate`);

    // Perform validation using Gemini AI
    // This is a placeholder - you would integrate with Gemini API here
    const validationResults = await performValidation(
      document,
      requirements,
      validationType,
      customPrompt,
      namespace
    );

    // Map validation results to consolidated table format
    const resultsToInsert: CreateValidationResultInput[] = validationResults.map(result => ({
      validation_detail_id: validationDetailId,
      validation_type_id: getValidationTypeId(validationType),
      requirement_id: result.requirementId,
      requirement_type: getRequirementType(validationType),
      requirement_number: result.requirementNumber,
      requirement_text: result.requirementText,
      status: mapStatus(result.status),
      reasoning: result.reasoning,
      mapped_content: result.mappedContent,
      unmapped_content: result.unmappedContent,
      recommendations: result.recommendations,
      doc_references: result.docReferences,
      smart_questions: [],
      validation_method: 'single_prompt',
      metadata: {
        namespace,
        customPrompt: !!customPrompt,
      },
    }));

    // Insert all validation results
    const { data: insertedResults, error: insertError } = await insertValidationResults(
      supabase,
      resultsToInsert
    );

    if (insertError) {
      logError(FUNCTION_NAME, insertError, { validationDetailId });
      await updateValidationDetailStatus(supabase, validationDetailId, 'failed', {
        error_message: insertError.message,
      });
      return createErrorResponse(
        ErrorCode.DATABASE_ERROR,
        'Failed to store validation results',
        { error: insertError }
      );
    }

    // Update validation detail status to 'completed'
    await updateValidationDetailStatus(supabase, validationDetailId, 'completed', {
      completed_at: new Date().toISOString(),
    });

    logInfo(FUNCTION_NAME, 'Validation completed successfully', {
      validationDetailId,
      resultsCount: insertedResults?.length || 0,
    });

    return createSuccessResponse({
      validationDetailId,
      resultsCount: insertedResults?.length || 0,
      results: insertedResults,
    });

  } catch (error) {
    logError(FUNCTION_NAME, error);
    return createErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'An unexpected error occurred during validation',
      { error: error instanceof Error ? error.message : String(error) },
      500
    );
  }
});

/**
 * Get requirements from database based on validation type
 */
async function getRequirements(
  supabase: any,
  unitCode: string,
  validationType: string
): Promise<any[]> {
  const tableMap: Record<string, string> = {
    knowledge_evidence: 'knowledge_evidence',
    performance_evidence: 'performance_evidence',
    foundation_skills: 'foundation_skills',
    elements_criteria: 'elements_performance_criteria',
    assessment_conditions: 'assessment_conditions',
  };

  const tableName = tableMap[validationType];
  if (!tableName) {
    return [];
  }

  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .eq('unit_code', unitCode);

  if (error) {
    console.error(`Error fetching requirements from ${tableName}:`, error);
    return [];
  }

  return data || [];
}

/**
 * Perform validation using AI
 * This is a placeholder - integrate with actual Gemini API
 */
async function performValidation(
  document: any,
  requirements: any[],
  validationType: string,
  customPrompt?: string,
  namespace?: string
): Promise<any[]> {
  // Placeholder implementation
  // In real implementation, this would:
  // 1. Build prompt with requirements
  // 2. Call Gemini API with document context
  // 3. Parse AI response
  // 4. Return structured validation results

  return requirements.map(req => ({
    requirementId: req.id,
    requirementNumber: req.ke_number || req.pe_number || req.fs_number || req.epc_number || `AC-${req.id}`,
    requirementText: req.ke_requirement || req.pe_requirement || req.fs_requirement || req.performance_criteria || req.ac_point,
    status: 'met',
    reasoning: 'Placeholder reasoning',
    mappedContent: 'Placeholder mapped content',
    unmappedContent: '',
    recommendations: '',
    docReferences: 'Page 1',
  }));
}

/**
 * Get validation type ID from validation type string
 */
function getValidationTypeId(validationType: string): number {
  const typeMap: Record<string, number> = {
    knowledge_evidence: 1,
    elements_criteria: 2,
    performance_evidence: 3,
    assessment_conditions: 4,
    foundation_skills: 5,
    learner_guide_validation: 6,
  };
  return typeMap[validationType] || 1;
}

/**
 * Get requirement type code from validation type
 */
function getRequirementType(validationType: string): 'ke' | 'pe' | 'fs' | 'epc' | 'ac' | 'ai' | 'learner' {
  const typeMap: Record<string, 'ke' | 'pe' | 'fs' | 'epc' | 'ac' | 'learner'> = {
    knowledge_evidence: 'ke',
    performance_evidence: 'pe',
    foundation_skills: 'fs',
    elements_criteria: 'epc',
    assessment_conditions: 'ac',
    learner_guide_validation: 'learner',
  };
  return typeMap[validationType] || 'ke';
}

/**
 * Map status from AI response to database enum
 */
function mapStatus(status: string): 'met' | 'not-met' | 'partial' | 'pending' {
  const statusLower = status.toLowerCase();
  if (statusLower.includes('met') && !statusLower.includes('not')) return 'met';
  if (statusLower.includes('not') || statusLower.includes('fail')) return 'not-met';
  if (statusLower.includes('partial')) return 'partial';
  return 'pending';
}
