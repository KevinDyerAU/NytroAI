/**
 * useReportGenerationWithStorage Hook
 * 
 * Enhanced hook for generating and storing assessment and learner guide reports
 * Reports are uploaded to Supabase storage and button is disabled after generation
 */

import { useState } from 'react';
import { toast } from 'sonner';
import {
  generateAndStoreAssessmentReport,
  generateAndStoreLearnerGuideReport,
  type AssessmentReportParams,
  type GenerateAndStoreReportResult,
} from '../lib/assessmentReportGeneratorWithStorage';
import { ValidationEvidenceRecord } from '../types/rto';

export interface UseReportGenerationWithStorageReturn {
  generateReport: (params: Omit<AssessmentReportParams, 'validationResults'>, validationResults: ValidationEvidenceRecord[]) => Promise<GenerateAndStoreReportResult>;
  isGenerating: boolean;
  error: string | null;
  generatedReports: Map<string, boolean>; // Track which report types have been generated
}

export function useReportGenerationWithStorage(): UseReportGenerationWithStorageReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedReports, setGeneratedReports] = useState<Map<string, boolean>>(new Map());

  const generateReport = async (
    params: Omit<AssessmentReportParams, 'validationResults'>,
    validationResults: ValidationEvidenceRecord[]
  ): Promise<GenerateAndStoreReportResult> => {
    setIsGenerating(true);
    setError(null);

    try {
      console.log('[useReportGenerationWithStorage] Generating report:', {
        validationType: params.validationType,
        unitCode: params.unitCode,
        resultsCount: validationResults.length,
      });

      const toastId = `generate-report-${params.validationType}`;
      toast.loading('Generating and storing validation report...', { id: toastId });

      const fullParams: AssessmentReportParams = {
        ...params,
        validationResults,
      };

      // Generate and store appropriate report type
      let result: GenerateAndStoreReportResult;
      if (params.validationType === 'learner-guide') {
        result = await generateAndStoreLearnerGuideReport(fullParams);
      } else {
        result = await generateAndStoreAssessmentReport(fullParams);
      }

      if (result.success && result.report) {
        // Mark this report type as generated
        const newGeneratedReports = new Map(generatedReports);
        newGeneratedReports.set(params.validationType, true);
        setGeneratedReports(newGeneratedReports);

        toast.success('Report generated and stored!', {
          id: toastId,
          description: `${params.validationType === 'learner-guide' ? 'Learner Guide' : 'Assessment'} report for ${params.unitCode} has been saved.`,
        });

        console.log('[useReportGenerationWithStorage] Report generated successfully:', result.report.filename);
        return result;
      } else {
        throw new Error(result.error || 'Failed to generate report');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to generate report';
      setError(errorMsg);
      console.error('[useReportGenerationWithStorage] Report generation error:', errorMsg);

      toast.error('Failed to generate report', {
        id: `generate-report-${params.validationType}`,
        description: errorMsg,
      });

      return {
        success: false,
        error: errorMsg,
      };
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    generateReport,
    isGenerating,
    error,
    generatedReports,
  };
}
