/**
 * Report Generation Popup Component
 * 
 * Displays available report types and allows user to generate
 * assessment or learner guide reports from validation results
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { FileSpreadsheet, Loader2, CheckCircle2 } from 'lucide-react';
import { useReportGeneration } from '../hooks/useReportGeneration';
import { ValidationEvidenceRecord } from '../types/rto';

interface ReportGenerationPopupProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  validationDetailId: number;
  unitCode: string;
  unitTitle: string;
  rtoName: string;
  validationType: 'assessment' | 'learner-guide';
  validationResults: ValidationEvidenceRecord[];
}

interface ReportOption {
  id: 'assessment' | 'learner-guide';
  title: string;
  description: string;
  includes: string[];
}

const REPORT_OPTIONS: ReportOption[] = [
  {
    id: 'assessment',
    title: 'Assessment Report',
    description: 'Complete validation report with all requirement types',
    includes: [
      'Elements & Performance Criteria',
      'Knowledge Evidence',
      'Performance Evidence',
      'Foundation Skills',
      'Assessment Conditions',
      'All columns: Requirement, Status, Reasoning, Citations, Smart Questions, Benchmark Answers',
    ],
  },
  {
    id: 'learner-guide',
    title: 'Learner Guide Report',
    description: 'Learner Guide validation with focused requirement types',
    includes: [
      'Elements & Performance Criteria',
      'Knowledge Evidence',
      'Performance Evidence',
      'All columns: Requirement, Status, Reasoning, Citations, Smart Questions, Benchmark Answers',
    ],
  },
];

export function ReportGenerationPopup({
  isOpen,
  onOpenChange,
  validationDetailId,
  unitCode,
  unitTitle,
  rtoName,
  validationType,
  validationResults,
}: ReportGenerationPopupProps) {
  // Auto-select report type based on validation type (no user selection)
  const reportType = validationType;
  const { generateReport, isGenerating } = useReportGeneration();

  const handleGenerateReport = async () => {
    await generateReport(
      {
        validationDetailId,
        unitCode,
        unitTitle,
        rtoName,
        validationType: reportType,
        createdDate: new Date().toISOString().split('T')[0],
      },
      validationResults
    );

    // Close dialog after successful generation
    if (!isGenerating) {
      setTimeout(() => {
        onOpenChange(false);
      }, 1000);
    }
  };

  const selectedOption = REPORT_OPTIONS.find(opt => opt.id === reportType);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Generate Validation Report
          </DialogTitle>
          <DialogDescription>
            Generate {selectedOption?.title || 'validation report'} for {unitCode}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Validation Details */}
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-semibold text-gray-700">Unit Code:</span>
                <p className="text-gray-600">{unitCode}</p>
              </div>
              <div>
                <span className="font-semibold text-gray-700">Unit Title:</span>
                <p className="text-gray-600">{unitTitle}</p>
              </div>
              <div>
                <span className="font-semibold text-gray-700">RTO:</span>
                <p className="text-gray-600">{rtoName}</p>
              </div>
              <div>
                <span className="font-semibold text-gray-700">Results:</span>
                <p className="text-gray-600">{validationResults.length} requirements</p>
              </div>
            </div>
          </div>

          {/* Auto-Selected Report Type Display */}
          {selectedOption && (
            <Card className="border-2 border-blue-500 bg-blue-50">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <CardTitle className="text-base">{selectedOption.title}</CardTitle>
                    <CardDescription className="text-sm">{selectedOption.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 mb-3">
                  {selectedOption.includes.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                      <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="text-xs text-gray-500 bg-white rounded p-2 border border-blue-200">
                  <p>• Format: Excel (.xlsx)</p>
                  <p>• File will be automatically downloaded</p>
                  <p>• Contains formatted data with color-coded status indicators</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isGenerating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleGenerateReport}
            disabled={isGenerating}
            className="flex items-center gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating Report...
              </>
            ) : (
              <>
                <FileSpreadsheet className="h-4 w-4" />
                Generate & Download
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
