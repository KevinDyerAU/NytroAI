import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { useToast } from './ui/use-toast';
import {
  generateUnitValidationReport,
  generateLearnerGuideReport,
  downloadExcelFile,
  type ValidationReportData,
} from '../lib/excelReportGenerator';

interface ReportGenerationProps {
  validationId: number;
  reportType: 'unit' | 'learner_guide';
  unitCode: string;
}

export function ReportGeneration({ validationId, reportType, unitCode }: ReportGenerationProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const handleGenerateReport = async () => {
    setIsGenerating(true);

    try {
      // Fetch validation data from API
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-validation-report`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            validationId,
            reportType,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch validation data');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to generate report');
      }

      // Transform API data to report format
      const reportData: ValidationReportData = transformApiDataToReportData(result.data);

      // Generate Excel file
      const blob =
        reportType === 'learner_guide'
          ? await generateLearnerGuideReport(reportData)
          : await generateUnitValidationReport(reportData);

      // Download file
      const filename = `${unitCode}_${reportType === 'learner_guide' ? 'Learner_Guide' : 'Unit'}_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
      downloadExcelFile(blob, filename);

      toast({
        title: 'Report Generated',
        description: `Your ${reportType === 'learner_guide' ? 'Learner Guide' : 'Unit'} validation report has been downloaded.`,
      });
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate report',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Generate Validation Report
        </CardTitle>
        <CardDescription>
          Download a formatted Excel report with all validation results
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <div className="text-sm text-muted-foreground">
            <p>
              This will generate a comprehensive{' '}
              {reportType === 'learner_guide' ? 'Learner Guide' : 'Unit'} validation report
              including:
            </p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Summary with overall status and scores</li>
              <li>Elements & Performance Criteria analysis</li>
              {reportType === 'unit' && <li>Foundation Skills assessment</li>}
              <li>Performance Evidence validation</li>
              <li>Knowledge Evidence validation</li>
              {reportType === 'unit' && (
                <>
                  <li>Assessment Conditions review</li>
                  <li>Assessment Instructions evaluation</li>
                </>
              )}
            </ul>
          </div>

          <Button onClick={handleGenerateReport} disabled={isGenerating} className="w-full">
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating Report...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Download Excel Report
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Transform API data to report data format
 */
function transformApiDataToReportData(apiData: any): ValidationReportData {
  return {
    unit_code: apiData.summary?.unit_code || 'N/A',
    unit_title: apiData.summary?.unit_title || 'N/A',
    rto_name: apiData.summary?.rto_name || 'N/A',
    overall_status: apiData.summary?.overall_status || 'Unknown',
    overall_score: apiData.summary?.overall_score || 0,
    epc_status: apiData.summary?.categories?.find((c: any) => c.name.includes('Elements'))?.status,
    epc_score: apiData.summary?.categories?.find((c: any) => c.name.includes('Elements'))?.score,
    fs_status: apiData.summary?.categories?.find((c: any) => c.name.includes('Foundation'))?.status,
    fs_score: apiData.summary?.categories?.find((c: any) => c.name.includes('Foundation'))?.score,
    pe_status: apiData.summary?.categories?.find((c: any) => c.name.includes('Performance'))?.status,
    pe_score: apiData.summary?.categories?.find((c: any) => c.name.includes('Performance'))?.score,
    ke_status: apiData.summary?.categories?.find((c: any) => c.name.includes('Knowledge'))?.status,
    ke_score: apiData.summary?.categories?.find((c: any) => c.name.includes('Knowledge'))?.score,
    ac_status: apiData.summary?.categories?.find((c: any) => c.name.includes('Conditions'))?.status,
    ac_score: apiData.summary?.categories?.find((c: any) => c.name.includes('Conditions'))?.score,
    ai_status: apiData.summary?.categories?.find((c: any) => c.name.includes('Instructions'))?.status,
    ai_score: apiData.summary?.categories?.find((c: any) => c.name.includes('Instructions'))?.score,
    elements_criteria: apiData.elements_criteria || [],
    foundation_skills: apiData.foundation_skills || [],
    performance_evidence: apiData.performance_evidence || [],
    knowledge_evidence: apiData.knowledge_evidence || [],
    assessment_conditions: apiData.assessment_conditions || [],
    assessment_instructions: apiData.assessment_instructions || {},
  };
}
