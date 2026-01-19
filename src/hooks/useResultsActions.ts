/**
 * useResultsActions Hook
 * 
 * Hook for Results Explorer actions:
 * - Generate Excel report (direct database query)
 * - Revalidate requirement (via n8n webhook)
 * - Regenerate smart questions (via n8n webhook)
 */

import { useState } from 'react';
import { toast } from 'sonner';
import {
  generateReport,
  revalidateRequirement,
  regenerateQuestions,
} from '../lib/n8nApi';

interface UseResultsActionsReturn {
  generateAndDownloadReport: (validationDetailId: number) => Promise<void>;
  revalidate: (validationResult: any) => Promise<void>;
  regenerateSmartQuestions: (validationDetailId: number, validationResultId: number, userGuidance: string) => Promise<any>;
  isGeneratingReport: boolean;
  isRevalidating: boolean;
  isRegeneratingQuestions: boolean;
  error: string | null;
}


export function useResultsActions(onRefresh?: () => void): UseResultsActionsReturn {
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [isRegeneratingQuestions, setIsRegeneratingQuestions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateAndDownloadReport = async (validationDetailId: number) => {
    setIsGeneratingReport(true);
    setError(null);

    try {
      console.log('[useResultsActions] Generating Excel report:', validationDetailId);

      toast.loading('Generating Excel validation report...', { id: 'generate-report' });

      const result = await generateReport(validationDetailId);

      if (result.success) {
        // Excel file is downloaded directly by the generateReport function
        toast.success('Excel report generated and downloaded!', {
          id: 'generate-report',
          description: 'Check your downloads folder for the .xlsx file.',
        });
      } else {
        throw new Error(result.error || 'Failed to generate report');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to generate report';
      setError(errorMsg);
      console.error('[useResultsActions] Report generation error:', errorMsg);

      toast.error('Failed to generate report', {
        id: 'generate-report',
        description: errorMsg,
      });
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const revalidate = async (validationResult: any) => {
    setIsRevalidating(true);
    setError(null);

    try {
      console.log('[useResultsActions] Revalidating requirement:', {
        id: validationResult.id,
        validationDetailId: validationResult.validation_detail_id,
      });

      toast.loading('Revalidating requirement...', { id: 'revalidate' });

      const result = await revalidateRequirement(validationResult);

      if (result.success) {
        toast.success('Requirement revalidated!', {
          id: 'revalidate',
          description: 'Results updated.',
        });

        // Trigger refresh if callback provided
        if (onRefresh) {
          onRefresh();
        }
      } else {
        throw new Error(result.error || 'Failed to revalidate requirement');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to revalidate';
      setError(errorMsg);
      console.error('[useResultsActions] Revalidation error:', errorMsg);

      toast.error('Failed to revalidate', {
        id: 'revalidate',
        description: errorMsg,
      });
    } finally {
      setIsRevalidating(false);
    }
  };

  const regenerateSmartQuestions = async (
    validationDetailId: number,
    validationResultId: number,
    userGuidance: string
  ) => {
    setIsRegeneratingQuestions(true);
    setError(null);

    try {
      console.log('[useResultsActions] Regenerating questions:', {
        validationDetailId,
        validationResultId,
        guidanceLength: userGuidance.length,
      });

      toast.loading('Regenerating smart questions...', { id: 'regenerate-questions' });

      const result = await regenerateQuestions(validationDetailId, validationResultId, userGuidance);

      // Check if questions were returned (the API returns { validation_detail_id, questions, summary?, response_timestamp })
      if (result.questions && result.questions.length > 0) {
        toast.success('Questions regenerated!', {
          id: 'regenerate-questions',
          description: `Generated ${result.questions.length} new questions.`,
        });

        // Trigger refresh if callback provided
        if (onRefresh) {
          onRefresh();
        }

        return result.questions;
      } else {
        throw new Error('No questions generated');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to regenerate questions';
      setError(errorMsg);
      console.error('[useResultsActions] Question regeneration error:', errorMsg);

      toast.error('Failed to regenerate questions', {
        id: 'regenerate-questions',
        description: errorMsg,
      });

      return null;
    } finally {
      setIsRegeneratingQuestions(false);
    }
  };

  return {
    generateAndDownloadReport,
    revalidate,
    regenerateSmartQuestions,
    isGeneratingReport,
    isRevalidating,
    isRegeneratingQuestions,
    error,
  };
}
