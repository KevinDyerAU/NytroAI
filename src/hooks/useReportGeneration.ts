/**
 * useReportGeneration Hook
 * 
 * Hook for generating assessment and learner guide reports
 * from validation results data
 */

import { useState } from 'react';
import { toast } from 'sonner';
import {
  generateAssessmentReport,
  generateLearnerGuideReport,
  downloadExcelFile,
  type AssessmentReportParams,
} from '../lib/assessmentReportGenerator';
import { ValidationEvidenceRecord } from '../types/rto';
import { supabase } from '../lib/supabase';

export interface UseReportGenerationReturn {
  generateReport: (params: Omit<AssessmentReportParams, 'validationResults'>, validationResults: ValidationEvidenceRecord[]) => Promise<void>;
  isGenerating: boolean;
  error: string | null;
}

export function useReportGeneration(): UseReportGenerationReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateReport = async (
    params: Omit<AssessmentReportParams, 'validationResults'>,
    validationResults: ValidationEvidenceRecord[]
  ) => {
    setIsGenerating(true);
    setError(null);

    try {
      console.log('[useReportGeneration] Generating report:', {
        validationType: params.validationType,
        unitCode: params.unitCode,
        resultsCount: validationResults.length,
      });

      toast.loading('Generating validation report...', { id: 'generate-report' });

      const fullParams: AssessmentReportParams = {
        ...params,
        validationResults,
      };

      // Generate appropriate report type
      const blob =
        params.validationType === 'learner-guide'
          ? await generateLearnerGuideReport(fullParams)
          : await generateAssessmentReport(fullParams);

      // Generate filename
      const timestamp = new Date().toISOString().split('T')[0];
      const reportTypeStr = params.validationType === 'learner-guide' ? 'Learner-Guide' : 'Assessment';
      const filename = `${params.unitCode}_${reportTypeStr}_Report_${timestamp}.xlsx`;

      // Download file
      downloadExcelFile(blob, filename);

      // Update validation_detail status to 'Finalised'
      console.log('[useReportGeneration] Updating validation status to Finalised for ID:', params.validationDetailId);
      const { error: updateError } = await supabase
        .from('validation_detail')
        .update({ validation_status: 'Finalised' })
        .eq('id', params.validationDetailId);

      if (updateError) {
        console.error('[useReportGeneration] Failed to update validation status:', updateError);
        // Don't fail the whole operation - report was still generated
      } else {
        console.log('[useReportGeneration] Validation status updated to Finalised');
      }

      toast.success('Report generated and downloaded!', {
        id: 'generate-report',
        description: `${reportTypeStr} report for ${params.unitCode}`,
      });

      console.log('[useReportGeneration] Report generated successfully:', filename);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to generate report';
      setError(errorMsg);
      console.error('[useReportGeneration] Report generation error:', errorMsg);

      toast.error('Failed to generate report', {
        id: 'generate-report',
        description: errorMsg,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    generateReport,
    isGenerating,
    error,
  };
}
