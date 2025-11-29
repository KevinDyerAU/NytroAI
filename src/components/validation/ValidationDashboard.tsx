import React from 'react';
import { Card } from '../ui/card';
import { ValidationProgress } from './ValidationProgress';
import { ValidationResults } from './ValidationResults';
import { useValidationProgress } from '../../hooks/useValidationProgress';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { GlowButton } from '../GlowButton';

interface ValidationDashboardProps {
  validationId: number;
  documentName: string;
  unitCode: string;
  onClose?: () => void;
  selectedRTOId: string;
  aiCreditsAvailable?: boolean;
}

export function ValidationDashboard({
  validationId,
  documentName,
  unitCode,
  onClose,
  selectedRTOId,
  aiCreditsAvailable = true,
}: ValidationDashboardProps) {
  const { validationProgress, validationResults, isLoading, error } =
    useValidationProgress(validationId);

  if (error) {
    return (
      <div className="min-h-screen bg-[#f8f9fb] p-8">
        <div className="max-w-7xl mx-auto">
          {onClose && (
            <button
              onClick={onClose}
              className="mb-6 flex items-center gap-2 text-[#3b82f6] hover:text-[#2563eb] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          )}

          <Card className="border border-[#ef4444] bg-[#fef2f2] p-8 shadow-soft">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-8 h-8 text-[#ef4444] flex-shrink-0 mt-1" />
              <div>
                <h2 className="font-poppins text-[#991b1b] text-lg font-semibold mb-2">
                  Error Loading Validation
                </h2>
                <p className="text-[#7f1d1d] mb-4">{error}</p>
                <p className="text-sm text-[#991b1b]">
                  Please try again or contact support if the problem persists.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (isLoading || !validationProgress) {
    return (
      <div className="min-h-screen bg-[#f8f9fb] p-8">
        <div className="max-w-7xl mx-auto">
          {onClose && (
            <button
              onClick={onClose}
              className="mb-6 flex items-center gap-2 text-[#3b82f6] hover:text-[#2563eb] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          )}

          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-poppins text-[#1e293b] mb-2">
                  Real-Time Validation Progress
                </h1>
                <p className="text-[#64748b]">
                  {documentName} • {unitCode}
                </p>
              </div>
            </div>
          </div>

          <Card className="border border-[#dbeafe] bg-white p-12 text-center shadow-soft">
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto bg-gradient-to-br from-[#dbeafe] to-[#93c5fd] rounded-full animate-pulse" />
              <p className="text-[#64748b] font-poppins">Loading validation progress...</p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fb] p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        {onClose && (
          <button
            onClick={onClose}
            className="mb-6 flex items-center gap-2 text-[#3b82f6] hover:text-[#2563eb] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Results
          </button>
        )}

        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-poppins text-[#1e293b] mb-2">
                Real-Time Validation Progress
              </h1>
              <p className="text-[#64748b]">
                {documentName} • {unitCode}
                {validationProgress?.documentType && (
                  <span className="ml-2">
                    • <span className="capitalize">{validationProgress.documentType.replace('_', ' ')}</span>
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Progress Column */}
          <div className="lg:col-span-1">
            <ValidationProgress
              progress={validationProgress.progress}
              status={validationProgress.status}
              completedCount={validationProgress.completedCount}
              totalCount={validationProgress.reqTotal}
              docExtracted={validationProgress.docExtracted}
              reqExtracted={validationProgress.reqExtracted}
            />
          </div>

          {/* Right: Results Column */}
          <div className="lg:col-span-2">
            <ValidationResults
              results={validationResults}
              isLoading={isLoading}
              aiCreditsAvailable={aiCreditsAvailable}
              validationContext={{
                rtoId: selectedRTOId,
                unitCode: validationProgress.unitCode,
                unitTitle: validationProgress.qualificationCode,
                validationType: validationProgress.validationType,
                validationId: String(validationId),
              }}
            />
          </div>
        </div>

        {/* Real-Time Status Badge */}
        <div className="mt-8 flex items-center justify-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
          <span className="text-xs text-[#64748b] uppercase tracking-wide font-poppins">
            Real-Time Updates Active
          </span>
        </div>
      </div>
    </div>
  );
}
