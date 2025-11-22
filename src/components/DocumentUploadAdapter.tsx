/**
 * DocumentUploadAdapter - Backward Compatible Wrapper
 * 
 * This adapter component wraps DocumentUploadRefactored to maintain
 * backward compatibility with the legacy DocumentUpload interface.
 * 
 * It handles:
 * - RTO selection to unit code mapping
 * - Legacy callback conversions
 * - Validation workflow integration
 * - Credit consumption (delegated to parent)
 */

import { useState, useEffect, useCallback } from 'react';
import { Card } from './ui/card';
import { AlertCircle, XCircle, Search, FileText, CheckCircle, Loader2 } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { DocumentUploadRefactored } from './upload/DocumentUploadRefactored';
import { getRTOById, getValidationCredits } from '../types/rto';
import { toast } from 'sonner';
import { validationWorkflowService, IndexingStatus } from '../services/ValidationWorkflowService';

interface Unit {
  id: number;
  code: string;
  title: string;
  link?: string;
}

interface DocumentUploadAdapterProps {
  selectedRTOId: string;
  /** @deprecated Validation workflow is now separate from document uploads */
  onValidationSubmit?: (validationData?: { validationId: number; documentName: string; unitCode: string }) => void;
  onCreditsConsumed?: () => void;
}

/**
 * Adapter component that provides legacy DocumentUpload interface
 * while using the new DocumentUploadRefactored component internally
 */
export function DocumentUploadAdapter({ 
  selectedRTOId,
  onValidationSubmit,
  onCreditsConsumed 
}: DocumentUploadAdapterProps) {
  const [validationType, setValidationType] = useState<'unit' | 'learner_guide'>('unit');
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [availableUnits, setAvailableUnits] = useState<Unit[]>([]);
  const [isLoadingUnits, setIsLoadingUnits] = useState(false);
  const [validationCredits, setValidationCredits] = useState({ current: 10, total: 10 });
  
  // Validation workflow state
  const [validationDetailId, setValidationDetailId] = useState<number | null>(null);
  const [indexingStatus, setIndexingStatus] = useState<IndexingStatus | null>(null);
  const [isPollingStarted, setIsPollingStarted] = useState(false);
  const [isTriggeringValidation, setIsTriggeringValidation] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [shouldTriggerUpload, setShouldTriggerUpload] = useState(false);

  const selectedRTO = getRTOById(selectedRTOId);
  const hasValidationCredits = validationCredits.current > 0;

  // Load validation credits
  useEffect(() => {
    const loadCredits = async () => {
      if (!selectedRTO?.code) return;

      const credits = await getValidationCredits(selectedRTO.code);
      setValidationCredits(credits);
    };

    loadCredits();
  }, [selectedRTOId, selectedRTO?.code]);

  // Fetch units of competency
  useEffect(() => {
    const fetchUnits = async () => {
      setIsLoadingUnits(true);
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        const response = await fetch(`${supabaseUrl}/functions/v1/fetch-units-of-competency`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({}),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result?.error || 'Failed to fetch units');
        }

        const data = result.data || [];
        const formattedUnits = data.map((unit: any) => ({
          id: unit.id,
          code: unit.unitCode || 'NO_CODE',
          title: unit.Title || unit.unitCode || 'Untitled',
          link: unit.Link,
        })).filter(Boolean) as Unit[];

        setAvailableUnits(formattedUnits);
      } catch (error) {
        console.error('[DocumentUploadAdapter] Failed to fetch units:', error);
        toast.error('Failed to load units. Please refresh the page.');
        setAvailableUnits([]);
      } finally {
        setIsLoadingUnits(false);
      }
    };

    fetchUnits();
  }, []);

  const filteredUnits = availableUnits.filter(unit =>
    unit.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    unit.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUnitSelect = async (unit: Unit) => {
    setSelectedUnit(unit);
    setSearchTerm('');
    setOpen(false);
    
    // Reset validation workflow state for new validation
    setValidationDetailId(null);
    setIsPollingStarted(false);
    setIndexingStatus(null);
    setConfirmText('');
    // Note: We intentionally DON'T clear selectedFiles here
    // This allows users to keep their uploaded files if they change the unit selection
    setShouldTriggerUpload(false);
    
    // Don't create validation record yet - wait for user to upload docs and click proceed
  };

  // Validation record creation happens in handleStartValidation

  const handleUploadComplete = async (documentId: number, currentFile: number = 1, totalFiles: number = 1) => {
    console.log(`[DocumentUploadAdapter] Upload complete, document ID: ${documentId} (${currentFile}/${totalFiles})`);
    
    onCreditsConsumed?.();

    if (!validationDetailId) {
      toast.success('Document uploaded successfully!');
      return;
    }

    // Only start polling after ALL files are uploaded
    const isLastFile = currentFile === totalFiles;
    
    if (!isLastFile) {
      console.log(`[DocumentUploadAdapter] Still uploading files (${currentFile}/${totalFiles}), waiting...`);
      return;
    }

    // This is the last file - clear upload state and navigate to dashboard
    console.log('[DocumentUploadAdapter] All files uploaded! Clearing upload state...');
    setSelectedFiles([]);
    setShouldTriggerUpload(false);
    setConfirmText('');
    
    // Update status to DocumentProcessing before navigating
    await validationWorkflowService.updateValidationStatus(validationDetailId, 'DocumentProcessing');
    
    // Navigate to dashboard - it will track progress via ValidationProgressTracker
    if (onValidationSubmit && selectedUnit) {
      toast.success('Upload complete! Navigating to dashboard...');
      onValidationSubmit({
        validationId: validationDetailId,
        documentName: selectedUnit.code,
        unitCode: selectedUnit.code,
      });
    }
  };

  // Manual validation trigger (user confirms)
  const handleStartValidation = async () => {
    if (!selectedUnit || selectedFiles.length === 0) return;
    
    setIsTriggeringValidation(true);
    
    // Show loading toast
    const loadingToast = toast.loading('Creating validation record...');
    
    try {
      // Step 1: Create validation record
      console.log('[DocumentUploadAdapter] Creating validation record...');
      console.log('[DocumentUploadAdapter] RTO:', selectedRTO?.code, 'Unit:', selectedUnit.code);
      
      // Reset namespace for new validation session
      validationWorkflowService.resetNamespace();
      
      const record = await validationWorkflowService.createValidationRecord({
        rtoCode: selectedRTO!.code,
        unitCode: selectedUnit.code,
        validationType: validationType === 'learner_guide' ? 'learner_guide_validation' : 'full_validation',
      });
      
      const detailId = record.detailId;
      setValidationDetailId(detailId);
      console.log('[DocumentUploadAdapter] Validation record created successfully:', detailId);
      
      // Dismiss loading toast
      toast.dismiss(loadingToast);
      
      // Update status to Uploading
      await validationWorkflowService.updateValidationStatus(detailId, 'Uploading');
      
      // Step 2: Trigger file upload (user stays on page to see progress)
      setShouldTriggerUpload(true);
      toast.success('Validation record created! Starting upload...');
      
      // Note: User will see upload progress and be navigated to dashboard after upload completes
      // The handleUploadComplete callback will call onValidationSubmit after all files are uploaded
    } catch (error) {
      console.error('[DocumentUploadAdapter] Error starting validation:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      // Dismiss loading toast
      toast.dismiss(loadingToast);
      
      // Show detailed error with action buttons using Sonner's action API
      toast.error(`Failed to Start Validation: ${errorMessage}`, {
        duration: 15000,
        action: {
          label: 'Retry',
          onClick: () => {
            console.log('[DocumentUploadAdapter] User clicked Retry');
            handleStartValidation();
          },
        },
        description: 'Check if edge functions are deployed in Supabase Dashboard',
        cancel: {
          label: 'Check Functions',
          onClick: () => {
            window.open('https://supabase.com/dashboard/project/dfqxmjmggokneiuljkta/functions', '_blank');
          },
        },
      });
      
      // If we have a validationDetailId (record was created), mark it as failed
      if (validationDetailId) {
        try {
          await validationWorkflowService.markValidationError(validationDetailId, errorMessage);
        } catch (markError) {
          console.error('[DocumentUploadAdapter] Failed to mark validation as failed:', markError);
        }
      }
    } finally {
      setIsTriggeringValidation(false);
    }
  };

  // Cancel validation workflow
  const handleCancelValidation = () => {
    setConfirmText('');
    setSelectedFiles([]);
    toast.info('Validation cancelled. You can start a new validation anytime.');
  };

  // Memoized callback to prevent infinite re-renders
  const handleFilesSelected = useCallback((files: File[]) => {
    console.log('[DocumentUploadAdapter] Files selected:', files.length);
    setSelectedFiles(files);
  }, []);

  // Show error if RTO is not loaded
  if (!selectedRTO && selectedRTOId) {
    return (
      <div className="min-h-screen bg-[#f8f9fb] p-8">
        <div className="mb-8">
          <h1 className="font-poppins text-[#1e293b] mb-2">Validate</h1>
          <p className="text-[#64748b]">Upload and validate your documents</p>
        </div>
        <div className="max-w-4xl mx-auto">
          <Card className="border-2 border-[#ef4444] bg-[#fef2f2] p-6 shadow-soft">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-[#ef4444] text-white flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div className="flex-1">
                <h3 className="font-poppins text-[#991b1b] mb-2">
                  RTO Data Not Found
                </h3>
                <p className="text-[#7f1d1d] mb-4">
                  Unable to load RTO information. Please refresh the page or contact support if the problem persists.
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-[#ef4444] hover:bg-[#dc2626] text-white font-semibold rounded transition-colors"
                >
                  Refresh Page
                </button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fb] p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-poppins text-[#1e293b] mb-2">Validate</h1>
        <p className="text-[#64748b]">Upload and validate your documents</p>
      </div>

      {/* No Validation Credits Warning */}
      {!hasValidationCredits && (
        <div className="max-w-4xl mx-auto mb-6">
          <Card className="border-2 border-[#ef4444] bg-[#fef2f2] p-6 shadow-soft">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-lg bg-[#ef4444] text-white flex items-center justify-center flex-shrink-0">
                <XCircle className="w-7 h-7" />
              </div>
              <div className="flex-1">
                <h3 className="font-poppins text-[#991b1b] mb-2">
                  No Validation Credits Available
                </h3>
                <p className="text-sm text-[#7f1d1d] mb-3">
                  Your organization has run out of validation credits. Upload and validation features are currently disabled.
                </p>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-[#991b1b] font-medium">Current credits:</span>
                  <span className="font-poppins text-[#ef4444]">
                    {validationCredits.current} / {validationCredits.total}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Step 1: Validation Type Selection */}
        <Card className={`border ${!hasValidationCredits ? 'border-[#fca5a5] opacity-60' : 'border-[#dbeafe]'} bg-white p-8 shadow-soft`}>
          <div className="flex items-start gap-4 mb-6">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#3b82f6] to-[#2563eb] text-white flex items-center justify-center flex-shrink-0 font-bold">
              1
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-poppins text-[#1e293b] mb-2">Select Validation Type</h2>
              <p className="text-sm text-[#64748b] mb-4">
                Choose whether you're validating an assessment or learner guide
              </p>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => {
                    setValidationType('unit');
                    setSelectedUnit(null);
                    setValidationDetailId(null);
                  }}
                  disabled={!hasValidationCredits}
                  className={`p-6 border-2 rounded-lg transition-all ${
                    validationType === 'unit'
                      ? 'border-[#3b82f6] bg-[#eff6ff]'
                      : 'border-[#dbeafe] hover:border-[#93c5fd]'
                  } ${!hasValidationCredits ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-5 h-5 rounded-full border-2 ${
                      validationType === 'unit'
                        ? 'border-[#3b82f6] bg-[#3b82f6]'
                        : 'border-[#cbd5e1]'
                    } flex items-center justify-center`}>
                      {validationType === 'unit' && (
                        <div className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </div>
                    <h3 className="font-semibold text-[#1e293b]">Unit Assessment</h3>
                  </div>
                  <p className="text-sm text-[#64748b] text-left">
                    Validate assessment documents against unit requirements
                  </p>
                </button>

                <button
                  onClick={() => {
                    setValidationType('learner_guide');
                    setSelectedUnit(null);
                    setValidationDetailId(null);
                  }}
                  disabled={!hasValidationCredits}
                  className={`p-6 border-2 rounded-lg transition-all ${
                    validationType === 'learner_guide'
                      ? 'border-[#3b82f6] bg-[#eff6ff]'
                      : 'border-[#dbeafe] hover:border-[#93c5fd]'
                  } ${!hasValidationCredits ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-5 h-5 rounded-full border-2 ${
                      validationType === 'learner_guide'
                        ? 'border-[#3b82f6] bg-[#3b82f6]'
                        : 'border-[#cbd5e1]'
                    } flex items-center justify-center`}>
                      {validationType === 'learner_guide' && (
                        <div className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </div>
                    <h3 className="font-semibold text-[#1e293b]">Learner Guide</h3>
                  </div>
                  <p className="text-sm text-[#64748b] text-left">
                    Validate learner guide content against unit requirements
                  </p>
                </button>
              </div>
            </div>
          </div>
        </Card>

        {/* Step 2: Unit Selection */}
        <Card className={`border ${!hasValidationCredits ? 'border-[#fca5a5] opacity-60' : 'border-[#dbeafe]'} bg-white p-8 shadow-soft`}>
          <div className="flex items-start gap-4 mb-6">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#3b82f6] to-[#2563eb] text-white flex items-center justify-center flex-shrink-0 font-bold">
              2
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-poppins text-[#1e293b] mb-2">Select Unit of Competency</h2>
              <p className="text-sm text-[#64748b] mb-4">
                Choose the unit you want to validate
              </p>

              <div className="relative z-20">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#64748b]">
                  <Search className="w-5 h-5" />
                </div>
                <Input
                  placeholder="Search units..."
                  className="pl-12 h-12 bg-white border-2 border-[#dbeafe] focus:border-[#3b82f6]"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setOpen(true);
                  }}
                  onFocus={() => setOpen(true)}
                  disabled={!hasValidationCredits || isLoadingUnits}
                />

                {/* Custom Styled Dropdown */}
                {open && (filteredUnits.length > 0 || searchTerm) && (
                  <div className="absolute top-full mt-2 left-0 right-0 border border-[#dbeafe] rounded-lg bg-white shadow-lg max-h-96 overflow-y-auto z-50">
                    {filteredUnits.length === 0 ? (
                      <div className="p-4 text-center text-[#64748b]">
                        <p className="text-sm">No units found matching "{searchTerm}"</p>
                      </div>
                    ) : (
                      <div className="p-2">
                        <p className="text-xs uppercase text-[#94a3b8] px-3 py-2">
                          Available Units ({filteredUnits.length})
                        </p>
                        {filteredUnits.map((unit) => (
                          <div
                            key={unit.id}
                            className="p-3 hover:bg-[#f8f9fb] rounded-lg cursor-pointer transition-colors"
                            onClick={() => handleUnitSelect(unit)}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded bg-[#dbeafe] border border-[#3b82f6] flex items-center justify-center flex-shrink-0">
                                <FileText className="w-5 h-5 text-[#3b82f6]" />
                              </div>
                              <div className="flex-1">
                                <div className="font-poppins text-[#1e293b] font-semibold">{unit.code}</div>
                                <p className="text-sm text-[#64748b]">{unit.title}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Backdrop overlay to close dropdown when clicking outside */}
              {open && (
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setOpen(false)}
                />
              )}

              {selectedUnit && (
                <div className="mt-4 p-4 bg-[#dbeafe] rounded-lg">
                  <p className="text-sm text-[#1e40af]">
                    <span className="font-semibold">Selected:</span> {selectedUnit.code} - {selectedUnit.title}
                  </p>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Step 3: Document Upload */}
        {selectedUnit && (
          <Card className={`border ${!hasValidationCredits ? 'border-[#fca5a5] opacity-60' : 'border-[#dbeafe]'} bg-white p-8 shadow-soft`}>
            <div className="flex items-start gap-4 mb-6">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#3b82f6] to-[#2563eb] text-white flex items-center justify-center flex-shrink-0 font-bold">
                3
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-poppins text-[#1e293b] mb-2">Upload Documents</h2>
                <p className="text-sm text-[#64748b] mb-4">
                  Upload {validationType === 'learner_guide' ? 'learner guide' : 'assessment'} documents for {selectedUnit.code}
                </p>

                {/* Use the refactored DocumentUpload component */}
                <DocumentUploadRefactored
                  unitCode={selectedUnit.code}
                  validationDetailId={validationDetailId || undefined}
                  onUploadComplete={handleUploadComplete}
                  onFilesSelected={handleFilesSelected}
                  triggerUpload={shouldTriggerUpload}
                />
              </div>
            </div>
          </Card>
        )}

        {/* Validation Confirmation Card - Shows when files are selected */}
        {(() => {
          const shouldShow = selectedFiles.length > 0 && selectedUnit;
          console.log('[DocumentUploadAdapter] VALIDATE card visibility:', {
            selectedFilesCount: selectedFiles.length,
            hasSelectedUnit: !!selectedUnit,
            shouldShow
          });
          return shouldShow;
        })() && (
          <Card className="border-2 border-[#22c55e] bg-[#f0fdf4] p-8 shadow-soft animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-[#22c55e] text-white flex items-center justify-center flex-shrink-0">
                <CheckCircle className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-[#166534] mb-2">
                  Ready to Start Validation
                </h3>
                <p className="text-[#166534] mb-4">
                  You have selected {selectedFiles.length} file{selectedFiles.length === 1 ? '' : 's'}. Type VALIDATE to proceed.
                </p>
                
                <div className="bg-white border-2 border-[#22c55e] rounded-lg p-4 mb-4">
                  <p className="text-sm text-[#166534] font-medium mb-2">
                    Type <span className="font-bold text-[#16a34a]">VALIDATE</span> to confirm and start validation:
                  </p>
                  <Input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="Type VALIDATE to confirm..."
                    className="mb-3 border-[#22c55e] focus:ring-[#22c55e]"
                    disabled={isTriggeringValidation}
                  />
                  <div className="flex gap-3">
                    <Button
                      onClick={handleStartValidation}
                      disabled={confirmText.toUpperCase() !== 'VALIDATE' || isTriggeringValidation}
                      className="bg-[#22c55e] hover:bg-[#16a34a] text-white"
                    >
                      {isTriggeringValidation ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Starting Validation...
                        </>
                      ) : (
                        'Start Validation'
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleCancelValidation}
                      disabled={isTriggeringValidation}
                      className="border-[#ef4444] text-[#ef4444] hover:bg-[#fef2f2]"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>

                <p className="text-xs text-[#166534]">
                  💡 <strong>Note:</strong> Validation consumes 1 credit. Make sure all your documents are uploaded before proceeding.
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
