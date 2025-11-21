import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useValidationStore, type ValidationProgress, type ValidationResult } from '../store/validation.store';

interface UseValidationProgressReturn {
  validationProgress: ValidationProgress | null;
  validationResults: ValidationResult[];
  isLoading: boolean;
  error: string | null;
}

function normalizeStatus(status: string | null | undefined): 'met' | 'not-met' | 'partial' {
  if (!status) return 'partial';
  const normalized = status.toLowerCase().trim().replace(/\s+/g, '-');
  if (['met', 'not-met', 'partial'].includes(normalized)) {
    return normalized as 'met' | 'not-met' | 'partial';
  }
  return 'partial';
}

export function useValidationProgress(validationId: number): UseValidationProgressReturn {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { validationProgress, validationResults, setValidationProgress, setValidationResults, setIsLoading: setStoreLoading, setError: setStoreError } = useValidationStore();

  useEffect(() => {
    if (!validationId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setStoreError(null);

    // Fetch initial validation progress
    const fetchValidationProgress = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('validation_detail')
          .select('*')
          .eq('id', validationId)
          .single();

        if (fetchError) {
          throw new Error(`Error fetching validation: ${fetchError.message}`);
        }

        if (data) {
          const progress: ValidationProgress = {
            id: data.id,
            unitCode: data.unit_code,
            qualificationCode: data.qualification_code,
            validationType: data.validation_type,
            status: data.req_extracted ? (data.doc_extracted ? 'docExtracted' : 'reqExtracted') : 'pending',
            progress: data.req_total ? Math.round((data.completed_count || 0) / data.req_total * 100) : 0,
            docExtracted: data.doc_extracted || false,
            reqExtracted: data.req_extracted || false,
            reqTotal: data.req_total || 0,
            completedCount: data.completed_count || 0,
            createdAt: data.created_at,
          };

          setValidationProgress(progress);
          setStoreLoading(false);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to fetch validation progress';
        setError(errorMsg);
        setStoreError(errorMsg);
        setStoreLoading(false);
      }
    };

    // Fetch validation results/evidence
    const fetchValidationResults = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('validation_detail')
          .select('id')
          .eq('id', validationId)
          .single();

        if (fetchError) {
          throw new Error(`Error fetching validation: ${fetchError.message}`);
        }

        if (!data) return;

        // Try to fetch evidence from various sources
        const evidenceData: ValidationResult[] = [];

        // Fetch knowledge evidence validations
        const { data: knowledgeData } = await supabase
          .from('knowledge_evidence_validations')
          .select('*')
          .eq('valDetail_id', validationId);

        if (knowledgeData) {
          evidenceData.push(...knowledgeData.map((ev: any, index: number) => ({
            id: ev.id || index,
            requirementNumber: ev.ke_number || `KE-${index + 1}`,
            type: 'Knowledge Evidence',
            requirementText: ev.ke_requirement || 'Knowledge Requirement',
            status: normalizeStatus(ev.status),
            reasoning: ev.unmappedContent || '',
            evidence: {
              mappedQuestions: (ev.mapped_questions || '').split('\n').filter((q: string) => q.trim()),
              unmappedReasoning: ev.unmappedRecommendations || '',
              documentReferences: ev.docReferences ? [ev.docReferences] : [],
            },
            aiEnhancement: {
              smartQuestion: ev.smart_question || '',
              benchmarkAnswer: ev.benchmarkAnswer || '',
              recommendations: (ev.unmappedRecommendations || '').split('\n').filter((r: string) => r.trim()),
            },
          })));
        }

        // Fetch performance evidence validations
        const { data: performanceData } = await supabase
          .from('performance_evidence_validations')
          .select('*')
          .eq('valDetail_id', validationId);

        if (performanceData) {
          evidenceData.push(...performanceData.map((ev: any, index: number) => ({
            id: ev.id || (1000 + index),
            requirementNumber: ev.pe_number || `PE-${index + 1}`,
            type: 'Performance Evidence',
            requirementText: ev.pe_requirement || 'Performance Requirement',
            status: normalizeStatus(ev.status),
            reasoning: ev.unmappedContent || '',
            evidence: {
              mappedQuestions: (ev.mapped_questions || '').split('\n').filter((q: string) => q.trim()),
              unmappedReasoning: ev.unmappedRecommendations || '',
              documentReferences: ev.docReferences ? [ev.docReferences] : [],
            },
            aiEnhancement: {
              smartQuestion: '',
              benchmarkAnswer: '',
              recommendations: (ev.unmappedRecommendations || '').split('\n').filter((r: string) => r.trim()),
            },
          })));
        }

        // Fetch foundation skills validations
        const { data: foundationData } = await supabase
          .from('foundation_skills_validations')
          .select('*')
          .eq('valDetail_id', validationId);

        if (foundationData) {
          evidenceData.push(...foundationData.map((ev: any, index: number) => ({
            id: ev.id || (2000 + index),
            requirementNumber: ev.fs_number || `FS-${index + 1}`,
            type: 'Foundation Skills',
            requirementText: ev.fs_requirement || 'Foundation Skills Requirement',
            status: normalizeStatus(ev.status),
            reasoning: ev.unmappedContent || '',
            evidence: {
              mappedQuestions: [],
              unmappedReasoning: ev.unmappedRecommendations || '',
              documentReferences: ev.docReferences ? [ev.docReferences] : [],
            },
            aiEnhancement: {
              smartQuestion: '',
              benchmarkAnswer: '',
              recommendations: (ev.unmappedRecommendations || '').split('\n').filter((r: string) => r.trim()),
            },
          })));
        }

        // Fetch elements & performance criteria validations
        const { data: elementsData } = await supabase
          .from('elements_performance_criteria_validations')
          .select('*')
          .eq('valDetail_id', validationId);

        if (elementsData) {
          evidenceData.push(...elementsData.map((ev: any, index: number) => ({
            id: ev.id || (3000 + index),
            requirementNumber: `${ev.element_number}.${ev.pc_number}` || `EPC-${index + 1}`,
            type: 'Elements & Performance Criteria',
            requirementText: ev.performance_criteria || 'Performance Criteria',
            status: normalizeStatus(ev.status),
            reasoning: ev.unmappedContent || '',
            evidence: {
              mappedQuestions: [],
              unmappedReasoning: ev.unmappedRecommendations || '',
              documentReferences: ev.docReferences ? [ev.docReferences] : [],
            },
            aiEnhancement: {
              smartQuestion: '',
              benchmarkAnswer: '',
              recommendations: (ev.unmappedRecommendations || '').split('\n').filter((r: string) => r.trim()),
            },
          })));
        }

        // Fetch assessment conditions validations
        const { data: assessmentConditionsData } = await supabase
          .from('assessment_conditions_validations')
          .select('*')
          .eq('valDetail_id', validationId);

        if (assessmentConditionsData) {
          evidenceData.push(...assessmentConditionsData.map((ev: any, index: number) => ({
            id: ev.id || (4000 + index),
            requirementNumber: `AC-${index + 1}`,
            type: 'Assessment Conditions',
            requirementText: ev.ac_point || 'Assessment Condition',
            status: normalizeStatus(ev.status),
            reasoning: ev.reasoning || '',
            evidence: {
              mappedQuestions: [],
              unmappedReasoning: '',
              documentReferences: [],
            },
            aiEnhancement: {
              smartQuestion: '',
              benchmarkAnswer: '',
              recommendations: (ev.recommendation || '').split('\n').filter((r: string) => r.trim()),
            },
          })));
        }

        setValidationResults(evidenceData);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to fetch validation results';
        console.error('Error fetching validation results:', errorMsg);
      }
    };

    fetchValidationProgress();
    fetchValidationResults();

    // Subscribe to validation_detail changes
    const validationSubscription = supabase
      .channel(`validation-${validationId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'validation_detail',
          filter: `id=eq.${validationId}`,
        },
        (payload) => {
          const updatedData = payload.new;
          const progress: ValidationProgress = {
            id: updatedData.id,
            unitCode: updatedData.unit_code,
            qualificationCode: updatedData.qualification_code,
            validationType: updatedData.validation_type,
            status: updatedData.req_extracted ? (updatedData.doc_extracted ? 'docExtracted' : 'reqExtracted') : 'pending',
            progress: updatedData.req_total ? Math.round((updatedData.completed_count || 0) / updatedData.req_total * 100) : 0,
            docExtracted: updatedData.doc_extracted || false,
            reqExtracted: updatedData.req_extracted || false,
            reqTotal: updatedData.req_total || 0,
            completedCount: updatedData.completed_count || 0,
            createdAt: updatedData.created_at,
          };

          setValidationProgress(progress);
        }
      )
      .subscribe();

    // Subscribe to knowledge evidence changes
    const knowledgeSubscription = supabase
      .channel(`knowledge-${validationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'knowledge_evidence_validations',
          filter: `valDetail_id=eq.${validationId}`,
        },
        () => {
          fetchValidationResults();
        }
      )
      .subscribe();

    // Subscribe to performance evidence changes
    const performanceSubscription = supabase
      .channel(`performance-${validationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'performance_evidence_validations',
          filter: `valDetail_id=eq.${validationId}`,
        },
        () => {
          fetchValidationResults();
        }
      )
      .subscribe();

    // Subscribe to foundation skills changes
    const foundationSubscription = supabase
      .channel(`foundation-${validationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'foundation_skills_validations',
          filter: `valDetail_id=eq.${validationId}`,
        },
        () => {
          fetchValidationResults();
        }
      )
      .subscribe();

    // Subscribe to elements & performance criteria changes
    const elementsSubscription = supabase
      .channel(`elements-${validationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'elements_performance_criteria_validations',
          filter: `valDetail_id=eq.${validationId}`,
        },
        () => {
          fetchValidationResults();
        }
      )
      .subscribe();

    // Subscribe to assessment conditions changes
    const assessmentConditionsSubscription = supabase
      .channel(`assessment-conditions-${validationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'assessment_conditions_validations',
          filter: `valDetail_id=eq.${validationId}`,
        },
        () => {
          fetchValidationResults();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(validationSubscription);
      supabase.removeChannel(knowledgeSubscription);
      supabase.removeChannel(performanceSubscription);
      supabase.removeChannel(foundationSubscription);
      supabase.removeChannel(elementsSubscription);
      supabase.removeChannel(assessmentConditionsSubscription);
    };
  }, [validationId, setValidationProgress, setValidationResults, setStoreLoading, setStoreError]);

  return {
    validationProgress,
    validationResults,
    isLoading,
    error,
  };
}
