/**
 * Results Explorer with Report Generation
 * 
 * Enhanced Results Explorer component that includes:
 * - Report generation button
 * - Report type selection popup
 * - Direct integration with validation results
 */

import React, { useState, useEffect } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { ReportGenerationPopup } from './ReportGenerationPopup';
import { ValidationEvidenceRecord } from '../types/rto';

interface ResultsExplorerReportActionsProps {
  selectedValidation: any; // Validation object
  validationDetailId: number;
  validationEvidenceData: ValidationEvidenceRecord[];
  rtoName: string;
  isLoadingResults?: boolean;
}

/**
 * Report button component for Results Explorer
 * Can be integrated into the existing Results Explorer component
 */
export function ResultsExplorerReportButton({
  selectedValidation,
  validationDetailId,
  validationEvidenceData,
  rtoName,
  isLoadingResults = false,
}: ResultsExplorerReportActionsProps) {
  const [showReportPopup, setShowReportPopup] = useState(false);

  if (!selectedValidation || validationEvidenceData.length === 0) {
    return null;
  }

  return (
    <>
      <Button
        onClick={() => setShowReportPopup(true)}
        disabled={isLoadingResults}
        className="flex items-center gap-2"
        variant="default"
      >
        {isLoadingResults ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading...
          </>
        ) : (
          <>
            <FileDown className="w-4 h-4" />
            Generate Report
          </>
        )}
      </Button>

      <ReportGenerationPopup
        isOpen={showReportPopup}
        onOpenChange={setShowReportPopup}
        validationDetailId={validationDetailId}
        unitCode={selectedValidation.unitCode}
        unitTitle={selectedValidation.unitTitle}
        rtoName={rtoName}
        validationType={selectedValidation.validationType || 'assessment'}
        validationResults={validationEvidenceData}
      />
    </>
  );
}

/**
 * Hook to integrate report generation into existing components
 * Usage in ResultsExplorer:
 * 
 * const reportButton = (
 *   <ResultsExplorerReportButton
 *     selectedValidation={selectedValidation}
 *     validationDetailId={selectedValidationDetailId || 0}
 *     validationEvidenceData={validationEvidenceData}
 *     rtoName={getRTOById(selectedRTOId)?.name || 'Unknown RTO'}
 *     isLoadingResults={isLoadingValidations}
 *   />
 * );
 */
