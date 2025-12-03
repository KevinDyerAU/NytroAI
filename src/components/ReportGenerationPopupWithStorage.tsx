/**
 * Report Generation Popup with Storage Integration
 * 
 * Displays available report types and allows user to generate
 * assessment or learner guide reports from validation results.
 * Reports are stored in Supabase and button is disabled after generation.
 */

import React, { useState, useEffect } from 'react';
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
import { FileSpreadsheet, Loader2, CheckCircle2, Download } from 'lucide-react';
import { useReportGenerationWithStorage } from '../hooks/useReportGenerationWithStorage';
import { getReportsForValidation, downloadReportFromStorage } from '../lib/reportStorageService';
import { ValidationEvidenceRecord } from '../types/rto';
import { StoredReport } from '../lib/reportStorageService';

interface ReportGenerationPopupWithStorageProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  validationDetailId: number;
  unitCode: string;
  unitTitle: string;
  rtoName: string;
  rtoCode: string;
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

export function ReportGenerationPopupWithStorage({
  isOpen,
  onOpenChange,
  validationDetailId,
  unitCode,
  unitTitle,
  rtoName,
  rtoCode,
  validationType,
  validationResults,
}: ReportGenerationPopupWithStorageProps) {
  const [selectedReportType, setSelectedReportType] = useState<'assessment' | 'learner-guide'>('assessment');
  const [storedReports, setStoredReports] = useState<StoredReport[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const { generateReport, isGenerating, generatedReports } = useReportGenerationWithStorage();

  // Load existing reports when dialog opens
  useEffect(() => {
    if (isOpen) {
      loadStoredReports();
    }
  }, [isOpen]);

  const loadStoredReports = async () => {
    setIsLoadingReports(true);
    try {
      const reports = await getReportsForValidation(rtoCode, validationDetailId);
      setStoredReports(reports);
    } catch (error) {
      console.error('Error loading stored reports:', error);
    } finally {
      setIsLoadingReports(false);
    }
  };

  const handleGenerateReport = async () => {
    const result = await generateReport(
      {
        validationDetailId,
        unitCode,
        unitTitle,
        rtoName,
        rtoCode,
        validationType: selectedReportType,
        createdDate: new Date().toISOString().split('T')[0],
      },
      validationResults
    );

    if (result.success) {
      // Reload reports to show the newly generated one
      await loadStoredReports();
    }
  };

  const selectedOption = REPORT_OPTIONS.find(opt => opt.id === selectedReportType);
  const isReportGenerated = generatedReports.has(selectedReportType);
  const existingReport = storedReports.find(r => r.type === selectedReportType);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-white max-h-[90vh] overflow-y-auto">
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

          {/* Stored Reports Section */}
          {storedReports.length > 0 && (
            <div className="space-y-3">
              <label className="text-sm font-semibold text-gray-700">Available Reports</label>
              <div className="bg-green-50 rounded-lg p-4 border border-green-200 space-y-2">
                {storedReports.map((report) => (
                  <div key={report.id} className="flex items-center justify-between p-3 bg-white rounded border border-green-100">
                    <div className="flex items-center gap-3 flex-1">
                      <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{report.filename}</p>
                        <p className="text-xs text-gray-500">
                          {report.type === 'learner-guide' ? 'Learner Guide Report' : 'Assessment Report'} • Generated {new Date(report.uploadedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadReportFromStorage(report.url, report.filename)}
                      className="flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Report Type Selection */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-gray-700">
              {storedReports.length > 0 ? 'Generate Additional Report' : 'Select Report Type'}
            </label>
            <div className="grid grid-cols-1 gap-3">
              {REPORT_OPTIONS.map((option) => {
                const isGenerated = generatedReports.has(option.id) || storedReports.some(r => r.type === option.id);
                
                return (
                  <Card
                    key={option.id}
                    className={`cursor-pointer transition-all ${
                      selectedReportType === option.id
                        ? 'border-2 border-blue-500 bg-blue-50'
                        : 'border border-gray-200 hover:border-gray-300'
                    } ${isGenerated ? 'opacity-75' : ''}`}
                    onClick={() => !isGenerated && setSelectedReportType(option.id)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-base">{option.title}</CardTitle>
                            {isGenerated && (
                              <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                            )}
                          </div>
                          <CardDescription className="text-sm">{option.description}</CardDescription>
                        </div>
                        {!isGenerated && (
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
                        )}
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
                );
              })}
            </div>
          </div>

          {/* Report Details */}
          {selectedOption && !generatedReports.has(selectedReportType) && (
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h4 className="font-semibold text-gray-900 mb-2">{selectedOption.title}</h4>
              <p className="text-sm text-gray-600 mb-3">{selectedOption.description}</p>
              <div className="text-xs text-gray-500 space-y-1">
                <p>• Format: Excel (.xlsx)</p>
                <p>• File will be stored in Supabase storage</p>
                <p>• Contains formatted data with color-coded status indicators</p>
                <p>• Generate button will be disabled after successful generation</p>
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
            Close
          </Button>
          {!generatedReports.has(selectedReportType) && (
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
                  Generate & Store
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
