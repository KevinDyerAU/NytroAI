import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface ValidationResult {
  id: number;
  validation_detail_id: number;
  requirement_type: string;
  requirement_number: string;
  requirement_text: string;
  status: 'met' | 'partial' | 'not_met';
  reasoning: string;
  citations: any[];
  smart_questions: any[];
  document_namespace: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
}

interface ValidationReportData {
  detail: any;
  knowledgeEvidence: ValidationResult[];
  performanceEvidence: ValidationResult[];
  assessmentConditions: ValidationResult[];
  foundationSkills: ValidationResult[];
  elementsPerformanceCriteria: ValidationResult[];
  allResults: ValidationResult[];
  isLearnerGuide: boolean;
  summaryStats: {
    total: number;
    met: number;
    partial: number;
    not_met: number;
    complianceRate: number;
  };
}

/**
 * Hook to fetch validation report data from the consolidated validation_results table
 * 
 * This is the V2 version that uses the new table structure instead of the legacy
 * separate tables (knowledge_evidence_validations, etc.)
 */
export function useValidationReport(validationDetailId: number) {
  const [report, setReport] = useState<ValidationReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReport = async () => {
      setIsLoading(true);
      setError(null);

      try {
        console.log(`[useValidationReport] Fetching report for validation ${validationDetailId}`);

        // Fetch validation detail with unit information
        const { data: detail, error: detailError } = await supabase
          .from('validation_detail')
          .select(
            `
            *,
            UnitOfCompetency!inner(id, unitCode, Title)
          `
          )
          .eq('id', validationDetailId)
          .single();

        if (detailError) {
          console.error('[useValidationReport] Error fetching detail:', detailError);
          throw detailError;
        }

        console.log(`[useValidationReport] Detail fetched:`, {
          id: detail.id,
          unitCode: detail.UnitOfCompetency?.unitCode,
          namespace: detail.namespace_code,
        });

        // Determine if this is a learner guide validation based on namespace
        const isLearnerGuide = detail?.namespace_code?.includes('learner-guide') || false;

        // Fetch all validation results from the consolidated table
        const { data: allResults, error: resultsError } = await supabase
          .from('validation_results')
          .select('*')
          .eq('validation_detail_id', validationDetailId)
          .order('requirement_type')
          .order('requirement_number');

        if (resultsError) {
          console.error('[useValidationReport] Error fetching results:', resultsError);
          throw resultsError;
        }

        console.log(`[useValidationReport] Fetched ${allResults?.length || 0} validation results`);

        // Group results by requirement type
        const knowledgeEvidence = (allResults || []).filter(
          (r) => r.requirement_type === 'knowledge_evidence'
        );
        const performanceEvidence = (allResults || []).filter(
          (r) => r.requirement_type === 'performance_evidence'
        );
        const foundationSkills = (allResults || []).filter(
          (r) => r.requirement_type === 'foundation_skills'
        );
        const elementsPerformanceCriteria = (allResults || []).filter(
          (r) => r.requirement_type === 'elements_performance_criteria'
        );
        const assessmentConditions = (allResults || []).filter(
          (r) => r.requirement_type === 'assessment_conditions'
        );

        console.log(`[useValidationReport] Results by type:`, {
          knowledge: knowledgeEvidence.length,
          performance: performanceEvidence.length,
          foundation: foundationSkills.length,
          elements: elementsPerformanceCriteria.length,
          conditions: assessmentConditions.length,
        });

        // Calculate summary statistics
        const total = allResults?.length || 0;
        const met = (allResults || []).filter((r) => r.status === 'met').length;
        const partial = (allResults || []).filter((r) => r.status === 'partial').length;
        const not_met = (allResults || []).filter((r) => r.status === 'not_met').length;
        const complianceRate = total > 0 ? Math.round((met / total) * 100) : 0;

        const summaryStats = {
          total,
          met,
          partial,
          not_met,
          complianceRate,
        };

        console.log(`[useValidationReport] Summary stats:`, summaryStats);

        setReport({
          detail,
          knowledgeEvidence,
          performanceEvidence,
          assessmentConditions,
          foundationSkills,
          elementsPerformanceCriteria,
          allResults: allResults || [],
          isLearnerGuide,
          summaryStats,
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch report';
        setError(errorMessage);
        console.error('[useValidationReport] Error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    if (validationDetailId) {
      fetchReport();
    }
  }, [validationDetailId]);

  return { report, isLoading, error };
}

/**
 * Hook to fetch validation results with smart questions
 * 
 * This variant also fetches associated smart questions from the SmartQuestion table
 */
export function useValidationReportWithQuestions(validationDetailId: number) {
  const { report, isLoading, error } = useValidationReport(validationDetailId);
  const [smartQuestions, setSmartQuestions] = useState<any[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);

  useEffect(() => {
    const fetchSmartQuestions = async () => {
      if (!validationDetailId) return;

      setQuestionsLoading(true);
      try {
        const { data, error: questionsError } = await supabase
          .from('SmartQuestion')
          .select('*')
          .eq('validation_detail_id', validationDetailId)
          .order('created_at', { ascending: false });

        if (questionsError) {
          console.error('[useValidationReportWithQuestions] Error fetching questions:', questionsError);
        } else {
          setSmartQuestions(data || []);
          console.log(`[useValidationReportWithQuestions] Fetched ${data?.length || 0} smart questions`);
        }
      } catch (err) {
        console.error('[useValidationReportWithQuestions] Exception:', err);
      } finally {
        setQuestionsLoading(false);
      }
    };

    fetchSmartQuestions();
  }, [validationDetailId]);

  return {
    report,
    smartQuestions,
    isLoading: isLoading || questionsLoading,
    error,
  };
}
