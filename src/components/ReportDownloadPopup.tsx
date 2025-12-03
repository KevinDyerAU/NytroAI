/**
 * Report Download Popup Component
 * 
 * Displays a popup with report generation and download options
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, Download, Loader2, AlertCircle } from 'lucide-react';
import { generateReportFromTemplate, downloadReport } from '@/lib/templateReportGenerator';
import { useToast } from '@/hooks/use-toast';

export interface ReportDownloadPopupProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  validationDetailId: number;
  unitCode: string;
  unitTitle: string;
  rtoName: string;
  rtoCode: string;
  validationType: 'learner-guide' | 'assessment' | 'unit';
  validationResults: any[];
}

export function ReportDownloadPopup({
  isOpen,
  onOpenChange,
  validationDetailId,
  unitCode,
  unitTitle,
  rtoName,
  rtoCode,
  validationType,
  validationResults,
}: ReportDownloadPopupProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<{
    filename: string;
    data: ArrayBuffer;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleGenerateReport = async () => {
    try {
      setIsGenerating(true);
      setError(null);

      console.log('[ReportDownloadPopup] Generating report for:', {
        validationDetailId,
        unitCode,
        validationType,
      });

      const result = await generateReportFromTemplate({
        validationDetailId,
        unitCode,
        unitTitle,
        rtoName,
        rtoCode,
        validationType,
        validationResults,
        createdDate: new Date().toISOString().split('T')[0],
      });

      if (result.success && result.data) {
        setGeneratedReport({
          filename: result.filename,
          data: result.data,
        });

        toast({
          title: 'Report Generated',
          description: `${result.filename} is ready to download`,
          duration: 3000,
        });
      } else {
        const errorMsg = result.error || 'Failed to generate report';
        setError(errorMsg);
        toast({
          title: 'Error',
          description: errorMsg,
          variant: 'destructive',
          duration: 3000,
        });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMsg);
      console.error('[ReportDownloadPopup] Error:', err);
      toast({
        title: 'Error',
        description: errorMsg,
        variant: 'destructive',
        duration: 3000,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (generatedReport) {
      try {
        downloadReport(generatedReport.data, generatedReport.filename);
        toast({
          title: 'Downloaded',
          description: `${generatedReport.filename} downloaded successfully`,
          duration: 2000,
        });
        // Close popup after download
        setTimeout(() => onOpenChange(false), 500);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Download failed';
        toast({
          title: 'Error',
          description: errorMsg,
          variant: 'destructive',
          duration: 3000,
        });
      }
    }
  };

  const getValidationTypeLabel = () => {
    switch (validationType) {
      case 'learner-guide':
        return 'Learner Guide Report';
      case 'assessment':
        return 'Assessment Report';
      case 'unit':
        return 'Unit Validation Report';
      default:
        return 'Report';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            {getValidationTypeLabel()}
          </DialogTitle>
          <DialogDescription>
            Generate and download the {validationType} report for {unitCode}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Unit Information */}
          <div className="space-y-2 rounded-lg bg-slate-50 p-3">
            <div className="text-sm">
              <span className="font-medium text-slate-700">Unit Code:</span>
              <span className="ml-2 text-slate-600">{unitCode}</span>
            </div>
            <div className="text-sm">
              <span className="font-medium text-slate-700">Unit Title:</span>
              <span className="ml-2 text-slate-600">{unitTitle}</span>
            </div>
            <div className="text-sm">
              <span className="font-medium text-slate-700">RTO:</span>
              <span className="ml-2 text-slate-600">{rtoName} ({rtoCode})</span>
            </div>
            <div className="text-sm">
              <span className="font-medium text-slate-700">Requirements:</span>
              <span className="ml-2 text-slate-600">{validationResults.length} total</span>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex gap-3 rounded-lg bg-red-50 p-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600 mt-0.5" />
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          {/* Generated Report Info */}
          {generatedReport && (
            <div className="flex gap-3 rounded-lg bg-green-50 p-3">
              <FileSpreadsheet className="w-5 h-5 flex-shrink-0 text-green-600 mt-0.5" />
              <div className="text-sm text-green-700">
                <div className="font-medium">Report Ready</div>
                <div className="text-xs mt-1">{generatedReport.filename}</div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2">
            {!generatedReport ? (
              <Button
                onClick={handleGenerateReport}
                disabled={isGenerating || validationResults.length === 0}
                className="w-full"
                size="lg"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating Report...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Generate Report
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleDownload}
                className="w-full bg-green-600 hover:bg-green-700"
                size="lg"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Report
              </Button>
            )}
          </div>

          {validationResults.length === 0 && !generatedReport && (
            <div className="text-center text-sm text-slate-500 py-2">
              No validation results available to generate report
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
