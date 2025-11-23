/**
 * Store Validation Results V2
 * 
 * Updated storage utility for V2 validation system that uses JSON requirements arrays.
 * Stores individual requirement validation results in the validation_results table.
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface RequirementValidation {
  requirementId: number;
  requirementType: string;
  requirementNumber: string;
  requirementText: string;
  status: 'met' | 'partial' | 'not_met';
  reasoning: string;
  evidenceFound: Array<{
    location: string;
    description?: string;
    questionNumber?: string;
    questionText?: string;
    taskNumber?: string;
    taskDescription?: string;
    relevance: string;
  }>;
  gaps: string[];
  smartQuestions: Array<{
    question: string;
    rationale: string;
    benchmarkAnswer?: string;
    assessmentType?: string;
    skillApplication?: string;
    implementationNote?: string;
  }>;
  citations: Array<{
    documentName: string;
    pageNumbers: number[];
    chunkText?: string;
  }>;
}

export interface ValidationResponseV2 {
  validationType: string;
  unitCode: string;
  overallStatus: 'met' | 'partial' | 'not_met';
  summary: string;
  requirementValidations: RequirementValidation[];
  summaryByType?: Record<string, {
    total: number;
    met: number;
    partial: number;
    not_met: number;
  }>;
}

/**
 * Map validation type to requirement type code for database
 */
function mapRequirementType(validationType: string): string {
  const typeMap: Record<string, string> = {
    'knowledge_evidence': 'knowledge_evidence',
    'performance_evidence': 'performance_evidence',
    'foundation_skills': 'foundation_skills',
    'elements_criteria': 'elements_performance_criteria',
    'elements_performance_criteria': 'elements_performance_criteria',
    'assessment_conditions': 'assessment_conditions',
  };
  return typeMap[validationType] || validationType;
}

/**
 * Map status from V2 format to database format
 */
function mapStatus(status: 'met' | 'partial' | 'not_met'): 'met' | 'partial' | 'not_met' {
  // Already in correct format, but normalize just in case
  if (status === 'not_met') return 'not_met';
  return status;
}

/**
 * Store V2 validation results in validation_results table
 * 
 * This function takes the structured V2 response and stores each requirement
 * validation as a separate row in the validation_results table.
 */
export async function storeValidationResultsV2(
  supabase: SupabaseClient,
  validationDetailId: number,
  validationResponse: ValidationResponseV2,
  namespace?: string
): Promise<{ success: boolean; insertedCount: number; error?: any }> {
  try {
    console.log(`[Store V2] Storing ${validationResponse.requirementValidations.length} requirement validations`);

    if (!validationResponse.requirementValidations || validationResponse.requirementValidations.length === 0) {
      console.log('[Store V2] No requirement validations to store');
      return { success: true, insertedCount: 0 };
    }

    // Prepare records for insertion
    const records = validationResponse.requirementValidations.map(reqVal => {
      // Format smart questions for storage
      const smartQuestions = reqVal.smartQuestions.map(sq => ({
        question: sq.question,
        rationale: sq.rationale,
        benchmark_answer: sq.benchmarkAnswer || '',
        type: 'smart' as const,
        assessment_type: sq.assessmentType || 'written',
        metadata: {
          skill_application: sq.skillApplication,
          implementation_note: sq.implementationNote,
        },
      }));

      // Format evidence found
      const evidenceText = reqVal.evidenceFound
        .map(ev => `${ev.location}: ${ev.description || ev.questionText || ev.taskDescription || ''} (${ev.relevance})`)
        .join('\n');

      // Format citations
      const citations = reqVal.citations.map(cit => ({
        document_name: cit.documentName,
        page_numbers: cit.pageNumbers,
        chunk_text: cit.chunkText || '',
      }));

      return {
        validation_detail_id: validationDetailId,
        requirement_type: mapRequirementType(reqVal.requirementType),
        requirement_number: reqVal.requirementNumber,
        requirement_text: reqVal.requirementText,
        status: mapStatus(reqVal.status),
        reasoning: reqVal.reasoning,
        citations: citations,
        smart_questions: smartQuestions,
        document_namespace: namespace || null,
        metadata: {
          requirement_id: reqVal.requirementId,
          evidence_found: reqVal.evidenceFound,
          gaps: reqVal.gaps,
          validation_type: validationResponse.validationType,
          unit_code: validationResponse.unitCode,
          overall_status: validationResponse.overallStatus,
          evidence_text: evidenceText,
        },
      };
    });

    // Insert all records
    const { data, error } = await supabase
      .from('validation_results')
      .insert(records)
      .select();

    if (error) {
      console.error('[Store V2] Error inserting validation results:', error);
      return { success: false, insertedCount: 0, error };
    }

    console.log(`[Store V2] Successfully stored ${data?.length || 0} validation results`);

    return {
      success: true,
      insertedCount: data?.length || 0,
    };

  } catch (error) {
    console.error('[Store V2] Exception storing validation results:', error);
    return {
      success: false,
      insertedCount: 0,
      error,
    };
  }
}

/**
 * Store smart questions generated by V2 system
 * 
 * This function stores smart questions in the SmartQuestion table and links them
 * to the appropriate validation_results records.
 */
export async function storeSmartQuestionsV2(
  supabase: SupabaseClient,
  validationDetailId: number,
  unitCode: string,
  documentId: number,
  smartQuestions: Array<{
    requirementId: number;
    requirementType: string;
    requirementText: string;
    question: string;
    benchmarkAnswer: string;
    questionType: string;
    difficultyLevel: string;
    assessmentCategory: string;
    rationale: string;
    docReferences?: Array<{
      documentName: string;
      pageNumbers: number[];
      relevance: string;
    }>;
  }>
): Promise<{ success: boolean; insertedCount: number; error?: any }> {
  try {
    console.log(`[Store Smart Questions V2] Storing ${smartQuestions.length} smart questions`);

    if (!smartQuestions || smartQuestions.length === 0) {
      console.log('[Store Smart Questions V2] No smart questions to store');
      return { success: true, insertedCount: 0 };
    }

    // Prepare records for SmartQuestion table
    const records = smartQuestions.map(sq => ({
      question: sq.question,
      benchmark_answer: sq.benchmarkAnswer,
      question_type: sq.questionType,
      difficulty_level: sq.difficultyLevel,
      assessment_category: sq.assessmentCategory,
      validation_detail_id: validationDetailId,
      requirement_id: sq.requirementId,
      unit_code: unitCode,
      document_id: documentId,
      metadata: {
        requirement_type: sq.requirementType,
        requirement_text: sq.requirementText,
        rationale: sq.rationale,
        doc_references: sq.docReferences || [],
      },
    }));

    // Insert all records
    const { data, error } = await supabase
      .from('SmartQuestion')
      .insert(records)
      .select();

    if (error) {
      console.error('[Store Smart Questions V2] Error inserting smart questions:', error);
      return { success: false, insertedCount: 0, error };
    }

    console.log(`[Store Smart Questions V2] Successfully stored ${data?.length || 0} smart questions`);

    // Also update the validation_results table to include these smart questions
    // Group questions by requirement
    const questionsByRequirement = new Map<number, typeof smartQuestions>();
    for (const sq of smartQuestions) {
      if (!questionsByRequirement.has(sq.requirementId)) {
        questionsByRequirement.set(sq.requirementId, []);
      }
      questionsByRequirement.get(sq.requirementId)!.push(sq);
    }

    // Update each validation_results record with its smart questions
    for (const [requirementId, questions] of questionsByRequirement) {
      const smartQuestionsJson = questions.map(q => ({
        question: q.question,
        benchmark_answer: q.benchmarkAnswer,
        type: 'smart' as const,
        rationale: q.rationale,
      }));

      await supabase
        .from('validation_results')
        .update({ smart_questions: smartQuestionsJson })
        .eq('validation_detail_id', validationDetailId)
        .eq('metadata->requirement_id', requirementId);
    }

    return {
      success: true,
      insertedCount: data?.length || 0,
    };

  } catch (error) {
    console.error('[Store Smart Questions V2] Exception storing smart questions:', error);
    return {
      success: false,
      insertedCount: 0,
      error,
    };
  }
}

/**
 * Update validation results with additional smart questions
 * 
 * This function adds smart questions to existing validation_results records.
 */
export async function addSmartQuestionsToValidationResults(
  supabase: SupabaseClient,
  validationDetailId: number,
  requirementId: number,
  smartQuestions: Array<{
    question: string;
    benchmarkAnswer?: string;
    rationale: string;
    type?: string;
  }>
): Promise<{ success: boolean; error?: any }> {
  try {
    // Get existing validation result
    const { data: existing, error: fetchError } = await supabase
      .from('validation_results')
      .select('smart_questions')
      .eq('validation_detail_id', validationDetailId)
      .eq('metadata->requirement_id', requirementId)
      .single();

    if (fetchError) {
      console.error('[Add Smart Questions] Error fetching existing record:', fetchError);
      return { success: false, error: fetchError };
    }

    // Merge with existing smart questions
    const existingQuestions = (existing?.smart_questions as any[]) || [];
    const newQuestions = smartQuestions.map(sq => ({
      question: sq.question,
      benchmark_answer: sq.benchmarkAnswer || '',
      type: (sq.type as 'smart' | 'mapped' | 'unmapped') || 'smart',
      rationale: sq.rationale,
    }));

    const mergedQuestions = [...existingQuestions, ...newQuestions];

    // Update the record
    const { error: updateError } = await supabase
      .from('validation_results')
      .update({ smart_questions: mergedQuestions })
      .eq('validation_detail_id', validationDetailId)
      .eq('metadata->requirement_id', requirementId);

    if (updateError) {
      console.error('[Add Smart Questions] Error updating record:', updateError);
      return { success: false, error: updateError };
    }

    console.log(`[Add Smart Questions] Added ${newQuestions.length} questions to requirement ${requirementId}`);

    return { success: true };

  } catch (error) {
    console.error('[Add Smart Questions] Exception:', error);
    return { success: false, error };
  }
}
