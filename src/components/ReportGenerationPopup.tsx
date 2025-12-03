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
    description: 'Comprehensive validation report with all evidence types',
    includes: [
      'Summary with overall status and scores',
      'Knowledge Evidence analysis',
      'Performance Evidence validation',
      'Detailed mapping and recommendations',
    ],
  },
  {
    id: 'learner-guide',
    title: 'Learner Guide Report',
    description: 'Learner-focused validation report with practical guidance',
    includes: [
      'Summary with focus on learner outcomes',
      'Performance Evidence with practical examples',
      'Knowledge Evidence with learning objectives',
      'Actionable recommendations for improvement',
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
  const [selectedReportType, setSelectedReportType] = useState<'assessment' | 'learner-guide'>('assessment');
  const { generateReport, isGenerating } = useReportGeneration();

  const handleGenerateReport = async () => {
    await generateReport(
      {
        validationDetailId,
        unitCode,
        unitTitle,
        rtoName,
        validationType: selectedReportType,
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

  const selectedOption = REPORT_OPTIONS.find(opt => opt.id === selectedReportType);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Generate Validation Report
          </DialogTitle>
          <DialogDescription>
            Select a report type to generate for {unitCode}
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

          {/* Report Type Selection */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-gray-700">Select Report Type</label>
            <div className="grid grid-cols-1 gap-3">
              {REPORT_OPTIONS.map((option) => (
                <Card
                  key={option.id}
                  className={`cursor-pointer transition-all ${
                    selectedReportType === option.id
                      ? 'border-2 border-blue-500 bg-blue-50'
                      : 'border border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedReportType(option.id)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{option.title}</CardTitle>
                        <CardDescription className="text-sm">{option.description}</CardDescription>
                      </div>
                      <div className="flex-shrink-0">
                        <input
                          type="radio"
                          name="report-type"
                          value={option.id}
                          checked={selectedReportType === option.id}
                          onChange={() => setSelectedReportType(option.id)}
                          className="h-4 w-4 text-blue-600"
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1">
                      {option.includes.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Report Details */}
          {selectedOption && (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h4 className="font-semibold text-gray-900 mb-2">{selectedOption.title}</h4>
              <p className="text-sm text-gray-600 mb-3">{selectedOption.description}</p>
              <div className="text-xs text-gray-500">
                <p>• Format: Excel (.xlsx)</p>
                <p>• File will be automatically downloaded to your computer</p>
                <p>• Contains formatted data with color-coded status indicators</p>
              </div>
            </div>
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
