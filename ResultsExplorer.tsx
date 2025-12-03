import React, { useState, useEffect } from 'react';
import { Card } from './ui/card';
import { ValidationCard } from './ValidationCard';
import { AIChat } from './AIChat';
import { GlowButton } from './GlowButton';
import { Input } from './ui/input';
import { StatusBadge } from './StatusBadge';
import { ValidationStatusIndicator } from './ValidationStatusIndicator';
import { Progress } from './ui/progress';
import { ValidationReport } from './reports';
import { ReportDownloadPopup } from './ReportDownloadPopup';
import {
  Search, 
  Download,
  X,
  Target,
  AlertCircle,
  Calendar,
  FileText,
  FileCheck,
  FileSpreadsheet
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { mockValidations, getValidationTypeLabel, formatValidationDate, Validation } from '../types/validation';
import { toast } from 'sonner';
import { getRTOById, getAICredits, consumeAICredit, getActiveValidationsByRTO, getValidationResults, type ValidationRecord, type ValidationEvidenceRecord } from '../types/rto';

interface ResultsExplorerProps {
  selectedValidationId?: string | null;
  aiCreditsAvailable?: boolean;
  selectedRTOId: string;
}

export function ResultsExplorer({ selectedValidationId, aiCreditsAvailable = true, selectedRTOId }: ResultsExplorerProps) {
  const [selectedValidation, setSelectedValidation] = useState<Validation | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedResult, setSelectedResult] = useState<any>(null);
  const [showChat, setShowChat] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showDetailedReport, setShowDetailedReport] = useState(false);
  const [selectedValidationDetailId, setSelectedValidationDetailId] = useState<number | null>(null);
  const [showReportDownloadPopup, setShowReportDownloadPopup] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [aiCredits, setAICredits] = useState({ current: 0, total: 0 });
  const [isConsumingCredit, setIsConsumingCredit] = useState(false);
  const [validationRecords, setValidationRecords] = useState<ValidationRecord[]>([]);
  const [isLoadingValidations, setIsLoadingValidations] = useState(true);
  const [validationLoadError, setValidationLoadError] = useState<string | null>(null);
  const [validationEvidenceData, setValidationEvidenceData] = useState<ValidationEvidenceRecord[]>([]);

  useEffect(() => {
    const loadAICredits = async () => {
      const currentRTO = getRTOById(selectedRTOId);
      if (!currentRTO?.code) return;

      const credits = await getAICredits(currentRTO.code);
      setAICredits(credits);
    };

    const loadValidations = async () => {
      try {
        setIsLoadingValidations(true);
        setValidationLoadError(null);
        
        const currentRTO = getRTOById(selectedRTOId);
        if (!currentRTO?.code) {
          console.warn('[ResultsExplorer] No RTO code available');
          setValidationRecords([]);
          setIsLoadingValidations(false);
          return;
        }

        console.log('[ResultsExplorer] Loading validations for RTO:', currentRTO.code);
        const records = await getActiveValidationsByRTO(currentRTO.code);
        console.log('[ResultsExplorer] Loaded validation records:', records.length);
        
        setValidationRecords(records);
        
        if (records.length === 0) {
          console.warn('[ResultsExplorer] No validation records found');
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('[ResultsExplorer] Error loading validations:', errorMsg);
        setValidationLoadError(errorMsg);
        toast.error(`Failed to load validations: ${errorMsg}`);
      } finally {
        setIsLoadingValidations(false);
      }
    };

    loadAICredits();
    loadValidations();
  }, [selectedRTOId]);

  // Handle report signing (redo validation)
  const handleGenerateReport = async () => {
    if (!selectedValidation) {
      toast.error('No validation selected');
      return;
    }

    // Check AI credits
    if (aiCredits.current <= 0) {
      toast.error('Insufficient AI credits to redo validation');
      return;
    }

    const currentRTO = getRTOById(selectedRTOId);
    if (!currentRTO?.code) {
      toast.error('RTO not selected');
      return;
    }

    setIsConsumingCredit(true);

    try {
      // Consume AI credit
      const result = await consumeAICredit(currentRTO.code);

      if (result.success) {
        // Update local AI credits
        setAICredits(prev => ({
          ...prev,
          current: Math.max(0, (result.newBalance as number) || 0)
        }));

        // Mark the validation as signed
        const updatedValidation = { ...selectedValidation, reportSigned: true };
        setSelectedValidation(updatedValidation);

        // Update in mockValidations array
        const index = mockValidations.findIndex(v => v.id === selectedValidation.id);
        if (index !== -1) {
          mockValidations[index] = updatedValidation;
        }

        toast.success('Validation reprocessed. 1 AI credit consumed.');
      } else {
        toast.error(result.message || 'Failed to redo validation');
      }
    } catch (error) {
      console.error('Error redoing validation:', error instanceof Error ? error.message : JSON.stringify(error));
      toast.error('An error occurred while redoing validation');
    } finally {
      setIsConsumingCredit(false);
      setConfirmText('');
      setShowReportDialog(false);
    }
  };

  const handleDownloadReport = () => {
    // Handle download logic here
    setConfirmText('');
    setShowReportDialog(false);
  };

  // Auto-select validation if selectedValidationId is provided
  useEffect(() => {
    if (selectedValidationId && !isLoadingValidations) {
      console.log('[ResultsExplorer] Looking for validation ID:', selectedValidationId);
      console.log('[ResultsExplorer] Available validation records:', validationRecords.length);
      console.log('[ResultsExplorer] Loading status:', isLoadingValidations);
      
      // First try to find in mock validations (for backward compatibility)
      let validation = mockValidations.find(v => v.id === selectedValidationId);

      // If not found, look in validation records (from DB)
      if (!validation) {
        const record = validationRecords.find(r => r.id.toString() === selectedValidationId);
        
        if (record) {
          console.log('[ResultsExplorer] Found validation record:', record);
          validation = {
            id: record.id.toString(),
            unitCode: record.unit_code || 'N/A',
            unitTitle: record.qualification_code || 'Unit',
            validationType: (record.validation_type?.toLowerCase() as 'learner-guide' | 'assessment' | 'unit') || 'unit',
            rtoId: selectedRTOId,
            validationDate: record.created_at,
            status: record.req_extracted ? 'docExtracted' : 'pending',
            progress: record.req_total ? Math.round((record.completed_count || 0) / record.req_total * 100) : 0,
            sector: 'General',
            documentsValidated: record.doc_extracted ? 1 : 0,
            requirementsChecked: record.completed_count || 0,
            totalRequirements: record.req_total || 0,
            reportSigned: false
          };
        } else if (validationRecords.length > 0) {
          // Records loaded but validation not found
          console.error('[ResultsExplorer] Validation record not found for ID:', selectedValidationId);
          console.error('[ResultsExplorer] Available IDs:', validationRecords.map(r => r.id));
          toast.error(
            'Validation record not found. The validation may have failed during creation or the record was deleted.',
            { duration: 7000 }
          );
        } else {
          // No records at all
          console.warn('[ResultsExplorer] No validation records available');
          toast.error(
            'No validation records found. Please try creating a validation again.',
            { duration: 5000 }
          );
        }
      }

      if (validation) {
        setSelectedValidation(validation);
      }
    }
  }, [selectedValidationId, validationRecords, selectedRTOId, isLoadingValidations]);

  // Fetch validation evidence data when validation is selected
  useEffect(() => {
    const loadValidationEvidence = async () => {
      if (!selectedValidation) {
        setValidationEvidenceData([]);
        return;
      }

      // The validation record's id IS the valDetail_id
      const currentRecord = validationRecords.find(r => r.id.toString() === selectedValidation.id);
      const valDetailId = currentRecord?.id;

      const evidence = await getValidationResults(selectedValidation.id, valDetailId);
      setValidationEvidenceData(evidence);
    };

    loadValidationEvidence();
  }, [selectedValidation, validationRecords]);

  const filteredValidations = validationRecords
    .map(record => ({
      id: record.id.toString(),
      unitCode: record.unit_code || 'N/A',
      unitTitle: record.qualification_code || 'Unit',
      validationType: (record.validation_type?.toLowerCase() as 'learner-guide' | 'assessment' | 'unit') || 'unit',
      rtoId: selectedRTOId,
      validationDate: record.created_at,
      status: record.req_extracted ? 'docExtracted' : 'pending',
      progress: record.req_total ? Math.round((record.completed_count || 0) / record.req_total * 100) : 0,
      requirementsChecked: record.completed_count || 0,
      totalRequirements: record.req_total || 0
    })) as Validation[];

  const handleValidationSelect = (validation: Validation) => {
    setSelectedValidation(validation);
    setShowChat(false);
    setSearchTerm('');
    setStatusFilter('all');
  };

  // Normalize status values from RPC
  const normalizeStatus = (status: string | null | undefined): 'met' | 'not-met' | 'partial' => {
    if (!status) return 'partial';
    const normalized = status.toLowerCase().trim().replace(/\s+/g, '-');
    if (['met', 'not-met', 'partial'].includes(normalized)) {
      return normalized as 'met' | 'not-met' | 'partial';
    }
    return 'partial';
  };

  // Convert evidence data to ValidationResult format for display
  const currentResults = selectedValidation && validationEvidenceData.length > 0
    ? validationEvidenceData.map(evidence => ({
        id: evidence.id,
        requirementNumber: evidence.requirement_number,
        type: evidence.type,
        requirementText: evidence.requirement_text,
        status: normalizeStatus(evidence.status),
        reasoning: evidence.reasoning,
        evidence: {
          mappedQuestions: evidence.mapped_questions ? evidence.mapped_questions.split('\n').filter(q => q.trim()) : [],
          unmappedReasoning: evidence.unmapped_reasoning,
          documentReferences: (() => {
            try {
              // Citations stored as JSON: [{"documentName": "...", "pageNumbers": [1,2,3]}]
              if (evidence.document_references) {
                const citations = JSON.parse(evidence.document_references);
                if (Array.isArray(citations)) {
                  // Extract all page numbers from all citations
                  const allPages = citations.flatMap((c: any) => c.pageNumbers || []);
                  // Remove duplicates and sort
                  return [...new Set(allPages)].sort((a, b) => a - b);
                }
              }
            } catch (e) {
              // Fallback: try parsing as comma-separated (legacy format)
              if (evidence.document_references) {
                const pages = evidence.document_references.split(',').map(p => parseInt(p.trim())).filter(n => !isNaN(n));
                if (pages.length > 0) return pages;
              }
            }
            return [];
          })(),
        },
        aiEnhancement: {
          smartQuestion: evidence.smart_question,
          benchmarkAnswer: evidence.benchmark_answer,
          recommendations: evidence.recommendations ? evidence.recommendations.split('\n').filter(r => r.trim()) : [],
        },
      }))
    : [];

  const filteredResults = currentResults.filter(result => {
    const matchesSearch = result.requirementText.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         result.requirementNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || result.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = selectedValidation ? {
    total: currentResults.length,
    met: currentResults.filter(r => r.status === 'met').length,
    notMet: currentResults.filter(r => r.status === 'not-met').length,
    partial: currentResults.filter(r => r.status === 'partial').length,
  } : { total: 0, met: 0, notMet: 0, partial: 0 };

  const complianceScore = statusCounts.total > 0 
    ? Math.round((statusCounts.met / statusCounts.total) * 100) 
    : 0;

  const handleChatClick = (result: any) => {
    setSelectedResult(result);
    setShowChat(true);
  };

  return (
    <div className="min-h-screen bg-[#f8f9fb] p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-poppins text-[#1e293b] text-3xl font-bold mb-2">
              Results Explorer
            </h1>
            <p className="text-[#64748b]">View and analyze validation results</p>
          </div>
        </div>
      </div>

      {/* Validation Selection */}
      <Card className="border border-[#dbeafe] bg-white p-6 shadow-soft mb-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-[#3b82f6] text-white flex items-center justify-center">
              <Target className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-poppins text-[#1e293b]">
                {selectedValidation ? 'Selected Validation' : 'Select Validation'}
              </h2>
              <p className="text-sm text-[#64748b]">
                {selectedValidation ? 'Viewing detailed validation results and analysis' : 'Search and select a validation to view results'}
              </p>
            </div>
          </div>
        </div>

        {/* Validation Selection */}
        {selectedValidation ? (
          <div className="p-4 bg-[#dcfce7] border border-[#22c55e] rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="font-poppins text-[#166534]">{selectedValidation.unitCode}</div>
                  <span className="text-sm text-[#64748b]">•</span>
                  <span className="text-sm text-[#166534]">
                    {getValidationTypeLabel(selectedValidation.validationType)}
                  </span>
                  <ValidationStatusIndicator 
                    status={selectedValidation.status} 
                    progress={selectedValidation.progress}
                    size="sm"
                    compact={true}
                  />
                </div>
                <p className="text-sm text-[#64748b] mb-2">{selectedValidation.unitTitle}</p>
                <div className="flex gap-4 text-xs text-[#94a3b8]">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatValidationDate(selectedValidation.validationDate)}
                  </span>
                  <span>•</span>
                  <span>{selectedValidation.sector}</span>
                  <span>•</span>
                  <span>Progress: {selectedValidation.progress}%</span>
                </div>
              </div>
              <div className="flex gap-3">
                <GlowButton 
                  variant="default" 
                  onClick={() => setShowReportDownloadPopup(true)}
                  disabled={validationEvidenceData.length === 0}
                  className="flex items-center gap-2"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Generate Report
                </GlowButton>
                {selectedValidation.reportSigned ? (
                  <GlowButton variant="primary" onClick={handleDownloadReport}>
                    <Download className="w-5 h-5 mr-2" />
                    Download Report
                  </GlowButton>
                ) : (
                  <GlowButton
                    variant="primary"
                    onClick={() => {
                      const matchingRecord = validationRecords.find(
                        r => r.unit_code === selectedValidation.unitCode &&
                        r.rto_code === selectedValidation.rtoId
                      );
                      if (matchingRecord) {
                        setSelectedValidationDetailId(matchingRecord.id);
                        setShowDetailedReport(true);
                      } else {
                        toast.error('Could not find validation details');
                      }
                    }}
                  >
                    <FileCheck className="w-5 h-5 mr-2" />
                    View Report
                  </GlowButton>
                )}
                <GlowButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelectedValidation(null)}
                >
                  Change Validation
                </GlowButton>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <Select
              value={selectedValidation?.id || ''}
              onValueChange={(value) => {
                const validation = filteredValidations.find(v => v.id === value);
                if (validation) {
                  handleValidationSelect(validation);
                }
              }}
            >
              <SelectTrigger className="w-full h-12 bg-white border-2 border-[#dbeafe] focus:border-[#3b82f6]">
                <SelectValue placeholder="Select a validation to view results..." />
              </SelectTrigger>
              <SelectContent className="bg-white border-[#dbeafe]">
                {isLoadingValidations ? (
                  <SelectItem value="loading" disabled>Loading validations...</SelectItem>
                ) : filteredValidations.length === 0 ? (
                  <SelectItem value="none" disabled>No validations found</SelectItem>
                ) : (
                  filteredValidations.map((validation) => (
                    <SelectItem key={validation.id} value={validation.id}>
                      <div className="flex items-center gap-2 py-1">
                        <span className="font-poppins text-[#1e293b]">{validation.unitCode}</span>
                        <span className="text-xs text-[#94a3b8]">•</span>
                        <span className="text-xs text-[#3b82f6]">
                          {getValidationTypeLabel(validation.validationType)}
                        </span>
                        <span className="text-xs text-[#94a3b8]">•</span>
                        <span className="text-xs text-[#64748b]">
                          {formatValidationDate(validation.validationDate)}
                        </span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>

            <div className="mt-4 p-4 bg-[#dbeafe] border border-[#3b82f6] rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-[#3b82f6] flex-shrink-0 mt-0.5" />
              <div className="text-sm text-[#1e40af]">
                <p className="font-medium mb-1">Select a validation to view results</p>
                <p className="text-xs">Choose a validation from the dropdown above to review its detailed results and compliance analysis.</p>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Results Content - Only shown when validation is selected */}
      {selectedValidation ? (
        <>
          {/* Overall Status Summary Tiles */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            <Card className="border border-[#3b82f6] bg-white p-6 text-center shadow-soft">
              <div className="w-24 h-24 mx-auto mb-3 relative">
                <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="#e2e8f0"
                    strokeWidth="10"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="10"
                    strokeDasharray="282.7"
                    strokeDashoffset={282.7 * (1 - complianceScore / 100)}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                  <div className="font-poppins text-[#1e293b]">{complianceScore}%</div>
                  <div className="text-xs text-[#64748b]">Compliance</div>
                </div>
              </div>
            </Card>

            <Card className="border-l-4 border-[#22c55e] bg-white p-6 text-center shadow-soft">
              <div className="font-poppins text-[#166534] mb-1">{statusCounts.met}</div>
              <div className="text-sm text-[#64748b] uppercase">Met</div>
              <div className="mt-2 text-xs text-[#94a3b8]">
                {statusCounts.total > 0 ? Math.round((statusCounts.met / statusCounts.total) * 100) : 0}%
              </div>
            </Card>

            <Card className="border-l-4 border-[#ef4444] bg-white p-6 text-center shadow-soft">
              <div className="font-poppins text-[#991b1b] mb-1">{statusCounts.notMet}</div>
              <div className="text-sm text-[#64748b] uppercase">Not Met</div>
              <div className="mt-2 text-xs text-[#94a3b8]">
                {statusCounts.total > 0 ? Math.round((statusCounts.notMet / statusCounts.total) * 100) : 0}%
              </div>
            </Card>

            <Card className="border-l-4 border-[#f59e0b] bg-white p-6 text-center shadow-soft">
              <div className="font-poppins text-[#92400e] mb-1">{statusCounts.partial}</div>
              <div className="text-sm text-[#64748b] uppercase">Partial</div>
              <div className="mt-2 text-xs text-[#94a3b8]">
                {statusCounts.total > 0 ? Math.round((statusCounts.partial / statusCounts.total) * 100) : 0}%
              </div>
            </Card>

            <Card className="border-l-4 border-[#64748b] bg-white p-6 text-center shadow-soft">
              <div className="font-poppins text-[#1e293b] mb-1">{statusCounts.total}</div>
              <div className="text-sm text-[#64748b] uppercase">Total Items</div>
              <div className="mt-2 text-xs text-[#94a3b8]">Requirements</div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Detailed Results Panel */}
            <div className={showChat ? 'lg:col-span-2' : 'lg:col-span-3'}>
              <Card className="border border-[#dbeafe] bg-white p-6 shadow-soft">
                <h3 className="mb-6 uppercase tracking-wide font-poppins text-[#64748b]">
                  Detailed Validation Results
                </h3>

                {/* Filters */}
                <div className="flex gap-4 mb-6">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748b]" />
                    <Input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search requirements..."
                      className="pl-10 bg-white border-[#dbeafe]"
                    />
                  </div>
                  
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-48 bg-white border-[#dbeafe]">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-[#dbeafe]">
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="met">Met</SelectItem>
                      <SelectItem value="not-met">Not Met</SelectItem>
                      <SelectItem value="partial">Partial</SelectItem>
                    </SelectContent>
                  </Select>

                  {showChat && (
                    <GlowButton 
                      variant="secondary" 
                      size="icon"
                      onClick={() => setShowChat(false)}
                    >
                      <X className="w-4 h-4" />
                    </GlowButton>
                  )}
                </div>

                {/* Results Count */}
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-[#dbeafe]">
                  <p className="text-sm text-[#64748b]">
                    Showing <span className="text-[#3b82f6] font-poppins">{filteredResults.length}</span> of {statusCounts.total} requirements
                  </p>
                </div>

                {/* Results List */}
                <div className="space-y-4">
                  {filteredResults.length > 0 ? (
                    filteredResults.map((result) => (
                      <ValidationCard
                        key={result.id}
                        result={result}
                        onChatClick={handleChatClick}
                        isReportSigned={selectedValidation?.reportSigned}
                        aiCreditsAvailable={aiCreditsAvailable}
                        validationContext={{
                          rtoId: selectedRTOId,
                          unitCode: selectedValidation?.unitCode,
                          unitTitle: selectedValidation?.unitTitle,
                          validationType: selectedValidation?.validationType,
                          validationId: selectedValidation?.id,
                        }}
                      />
                    ))
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-[#64748b]">No results match your search criteria</p>
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* AI Chat Panel */}
            {showChat && (
              <div className="lg:col-span-1">
                <AIChat
                  context={selectedResult?.requirementNumber}
                  onClose={() => setShowChat(false)}
                  selectedRTOId={selectedRTOId}
                  onCreditConsumed={(newBalance) => setAICredits(prev => ({ ...prev, current: newBalance }))}
                />
              </div>
            )}
          </div>
        </>
      ) : (
        <Card className="border border-[#dbeafe] bg-white p-12 text-center shadow-soft">
          <Target className="w-16 h-16 mx-auto mb-4 text-[#cbd5e1]" />
          <h3 className="font-poppins text-[#64748b] mb-2">No Validation Selected</h3>
          <p className="text-sm text-[#94a3b8] max-w-md mx-auto">
            Please search and select a validation from above to view its detailed results and compliance analysis.
          </p>
        </Card>
      )}

      {/* Detailed Validation Report */}
      {showDetailedReport && selectedValidationDetailId ? (
        <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto">
          <div className="min-h-screen p-4">
            <div className="max-w-7xl mx-auto">
              {/* Back Button */}
              <div className="mb-4">
                <GlowButton
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setShowDetailedReport(false);
                    setSelectedValidationDetailId(null);
                  }}
                  className="gap-2"
                >
                  ← Back to Results
                </GlowButton>
              </div>
              {/* Report Component */}
              <div className="bg-white rounded-lg">
                <ValidationReport validationId={selectedValidationDetailId} />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Report Dialog */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent className="bg-white border border-[#dbeafe] sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-poppins text-[#1e293b] flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-[#3b82f6]" />
              Validation Report
            </DialogTitle>
            <DialogDescription className="text-[#64748b]">
              Generate or download the validation report for {selectedValidation?.unitCode}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Warning Note */}
            <div className="bg-[#fef3c7] border border-[#f59e0b] rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-[#f59e0b] flex-shrink-0 mt-0.5" />
              <div className="text-sm text-[#92400e]">
                <p className="font-medium mb-1">Important Notice</p>
                <p className="text-xs">
                  {selectedValidation?.reportSigned
                    ? 'This validation has been signed off. Download the report to view the final validation results.'
                    : 'Generating this report will sign off your validation. Once signed, no further updates will be allowed.'}
                </p>
              </div>
            </div>

            {/* Report Options */}
            <div className="space-y-3">
              {selectedValidation?.reportSigned ? (
                <GlowButton
                  variant="primary"
                  className="w-full justify-center"
                  onClick={handleDownloadReport}
                >
                  <Download className="w-5 h-5 mr-2" />
                  Download Report
                </GlowButton>
              ) : (
                <>
                  <div className="space-y-2">
                    <label htmlFor="confirm-text" className="text-sm text-[#64748b]">
                      Type <span className="font-medium text-[#0f172a]">report</span> to confirm:
                    </label>
                    <Input
                      id="confirm-text"
                      type="text"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder="Type report here"
                      className="w-full"
                    />
                  </div>
                  <GlowButton
                    variant="primary"
                    className="w-full justify-center"
                    onClick={handleGenerateReport}
                    disabled={confirmText.toLowerCase() !== 'report' || aiCredits.current <= 0 || isConsumingCredit}
                  >
                    <FileCheck className="w-5 h-5 mr-2" />
                    {isConsumingCredit ? 'Processing...' : aiCredits.current <= 0 ? 'Insufficient AI Credits' : 'Generate & Sign Report'}
                  </GlowButton>
                </>
              )}
            </div>
          </div>

          <DialogFooter>
            <GlowButton
              variant="secondary"
              size="sm"
              onClick={() => setShowReportDialog(false)}
            >
              Cancel
            </GlowButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedValidation && (
        <ReportDownloadPopup
          isOpen={showReportDownloadPopup}
          onOpenChange={setShowReportDownloadPopup}
          validationDetailId={selectedValidationDetailId || 0}
          unitCode={selectedValidation.unitCode}
          unitTitle={selectedValidation.unitTitle}
          rtoName={getRTOById(selectedRTOId)?.name || 'Unknown RTO'}
          rtoCode={getRTOById(selectedRTOId)?.code || 'UNKNOWN'}
          validationType={selectedValidation.validationType as 'learner-guide' | 'assessment' | 'unit'}
          validationResults={validationEvidenceData}
        />
      )}
    </div>
  );
}
