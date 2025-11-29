/**
 * useValidationProgress Hook - Updated for Phase 3
 * Uses consolidated validation_results table
 */

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

/**
 * Map requirement_type to human-readable type name
 */
function getTypeName(requirementType: string): string {
  const typeMap: Record<string, string> = {
    ke: 'Knowledge Evidence',
    pe: 'Performance Evidence',
    fs: 'Foundation Skills',
    epc: 'Elements & Performance Criteria',
    ac: 'Assessment Conditions',
    ai: 'Assessment Instructions',
    learner: 'Learner Guide',
  };
  return typeMap[requirementType] || requirementType.toUpperCase();
}

/**
 * Parse smart_questions JSONB array
 */
function parseSmartQuestions(smartQuestions: any): { question: string; answer: string } {
  if (!smartQuestions || !Array.isArray(smartQuestions) || smartQuestions.length === 0) {
    return { question: '', answer: '' };
  }
  const first = smartQuestions[0];
  return {
    question: first.question || '',
    answer: first.benchmark_answer || '',
  };
}

/**
 * Parse doc_references JSON
 */
function parseDocReferences(docReferences: string | null): string[] {
  if (!docReferences) return [];
  try {
    const parsed = JSON.parse(docReferences);
    if (Array.isArray(parsed)) {
      return parsed.map((ref: any) => {
        if (typeof ref === 'string') return ref;
        if (ref.documentName && ref.pageNumbers) {
          return `${ref.documentName} (Pages: ${ref.pageNumbers.join(', ')})`;
        }
        return JSON.stringify(ref);
      });
    }
    return [docReferences];
  } catch {
    return [docReferences];
  }
}

export function useValidationProgress(validationId: number): UseValidationProgressReturn {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { 
    validationProgress, 
    validationResults, 
    setValidationProgress, 
    setValidationResults, 
    setIsLoading: setStoreLoading, 
    setError: setStoreError 
  } = useValidationStore();

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
          .select('*, document_type')
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
            documentType: data.document_type || 'unit',
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

    // Fetch validation results from consolidated table
    const fetchValidationResults = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('validation_results')
          .select('*')
          .eq('validation_detail_id', validationId)
          .order('requirement_number', { ascending: true });

        if (fetchError) {
          throw new Error(`Error fetching validation results: ${fetchError.message}`);
        }

        if (!data) {
          setValidationResults([]);
          return;
        }

        // Transform data to match ValidationResult interface
        const evidenceData: ValidationResult[] = data.map((result: any) => {
          const smartQ = parseSmartQuestions(result.smart_questions);
          const docRefs = parseDocReferences(result.doc_references);

          return {
            id: result.id,
            requirementNumber: result.requirement_number || '',
            type: getTypeName(result.requirement_type),
            requirementText: result.requirement_text || '',
            status: normalizeStatus(result.status),
            reasoning: result.reasoning || result.unmapped_content || '',
            evidence: {
              mappedQuestions: result.mapped_content 
                ? result.mapped_content.split('\n').filter((q: string) => q.trim())
                : [],
              unmappedReasoning: result.unmapped_content || '',
              documentReferences: docRefs,
            },
            aiEnhancement: {
              smartQuestion: smartQ.question,
              benchmarkAnswer: smartQ.answer,
              recommendations: result.recommendations 
                ? result.recommendations.split('\n').filter((r: string) => r.trim())
                : [],
            },
          };
        });

        setValidationResults(evidenceData);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to fetch validation results';
        console.error('Error fetching validation results:', errorMsg);
        setError(errorMsg);
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
            documentType: updatedData.document_type || 'unit',
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

    // Subscribe to validation_results changes (replaces multiple table subscriptions)
    const resultsSubscription = supabase
      .channel(`validation-results-${validationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'validation_results',
          filter: `validation_detail_id=eq.${validationId}`,
        },
        () => {
          fetchValidationResults();
        }
      )
      .subscribe();

    setIsLoading(false);

    // Cleanup subscriptions
    return () => {
      validationSubscription.unsubscribe();
      resultsSubscription.unsubscribe();
    };
  }, [validationId, setValidationProgress, setValidationResults, setStoreLoading, setStoreError]);

  return {
    validationProgress,
    validationResults,
    isLoading,
    error,
  };
}
