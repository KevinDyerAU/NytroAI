import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface ValidationReportData {
  detail: any;
  knowledgeEvidence: any[];
  performanceEvidence: any[];
  assessmentConditions: any[];
  foundationSkills: any[];
  elementsPerformanceCriteria: any[];
  isLearnerGuide: boolean; // NEW: Indicates if this is learner guide validation
}

export function useValidationReport(validationDetailId: number) {
  const [report, setReport] = useState<ValidationReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReport = async () => {
      setIsLoading(true);
      setError(null);

      try {
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

        if (detailError) throw detailError;

        // Determine if this is a learner guide validation based on namespace
        const isLearnerGuide = detail?.namespace_code?.includes('learner-guide') || false;

        // Fetch all validation results in parallel
        // Use LEFT JOIN to support single-prompt validations without requirement links
        const [
          { data: ke },
          { data: pe },
          { data: ac },
          { data: fs },
          { data: epc },
        ] = await Promise.all([
          supabase
            .from('knowledge_evidence_validations')
            .select(
              `
            *,
            knowledge_evidence_requirements(id, ke_number, knowled_point)
          `
            )
            .eq('valDetail_id', validationDetailId)
            .order('id'), // Order by validation ID since requirement join may be null

          supabase
            .from('performance_evidence_validations')
            .select(
              `
            *,
            performance_evidence_requirements(id, pe_number, performance_evidence)
          `
            )
            .eq('valDetail_id', validationDetailId)
            .order('id'),

          supabase
            .from('assessment_conditions_validations')
            .select('*')
            .eq('valDetail_id', validationDetailId)
            .order('id'),

          supabase
            .from('foundation_skills_validations')
            .select(
              `
            *,
            foundation_skills_requirements(id, fs_number, skill_point)
          `
            )
            .eq('valDetail_id', validationDetailId)
            .order('id'),

          supabase
            .from('elements_performance_criteria_validations')
            .select(
              `
            *,
            elements_performance_criteria_requirements(id, epc_number, element, performance_criteria)
          `
            )
            .eq('valDetail_id', validationDetailId)
            .order('id'),
        ]);

        setReport({
          detail,
          knowledgeEvidence: ke || [],
          performanceEvidence: pe || [],
          assessmentConditions: ac || [],
          foundationSkills: fs || [],
          elementsPerformanceCriteria: epc || [],
          isLearnerGuide,
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch report';
        setError(errorMessage);
        console.error('Error fetching validation report:', err);
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
