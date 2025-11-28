/**
 * ResultsExplorer Component - Phase 3.2 Update
 * Comprehensive error handling and status management
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from './ui/card';
import { ValidationCard } from './ValidationCard';
import { AIChat } from './AIChat';
import { GlowButton } from './GlowButton';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { ValidationReport } from './reports';
import { ValidationStatusMessage, InlineErrorMessage } from './ValidationStatusMessage';
import { ResultsExplorerActions, RequirementActions } from './ResultsExplorerActions';
import { ValidationStatusBadge } from './ValidationStatusBadge';
import { 
  Search, 
  Download,
  X,
  Target,
  AlertCircle,
  RefreshCw,
  FileText,
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
import { toast } from 'sonner';
import { 
  getRTOById, 
  getAICredits, 
  consumeAICredit, 
  getActiveValidationsByRTO, 
  type ValidationRecord 
} from '../types/rto';
import { 
  getValidationResults,
  type ValidationEvidenceRecord,
  type ValidationResultsError 
} from '../lib/validationResults';
import { Validation, getValidationTypeLabel, formatValidationDate } from '../types/validation';

interface ResultsExplorerProps {
  selectedValidationId?: string | null;
  aiCreditsAvailable?: boolean;
  selectedRTOId: string;
}

export function ResultsExplorer_v2({ 
  selectedValidationId, 
  aiCreditsAvailable = true, 
  selectedRTOId 
}: ResultsExplorerProps) {
  // Load persisted state from sessionStorage
  const loadPersistedState = () => {
    try {
      const saved = sessionStorage.getItem('resultsExplorerState');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  };

  const persistedState = loadPersistedState();

  // State management with persistence
  const [selectedValidation, setSelectedValidation] = useState<Validation | null>(
    persistedState.selectedValidation || null
  );
  const [searchValidationTerm, setSearchValidationTerm] = useState(persistedState.searchValidationTerm || '');
  const [validationSearchOpen, setValidationSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(persistedState.searchTerm || '');
  const [statusFilter, setStatusFilter] = useState(persistedState.statusFilter || 'all');
  const [selectedResult, setSelectedResult] = useState<any>(null);
  const [showChat, setShowChat] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showDetailedReport, setShowDetailedReport] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  // Save state to sessionStorage when it changes
  useEffect(() => {
    const stateToSave = {
      selectedValidation,
      searchValidationTerm,
      searchTerm,
      statusFilter,
    };
    try {
      sessionStorage.setItem('resultsExplorerState', JSON.stringify(stateToSave));
    } catch (error) {
      console.warn('Failed to save Results Explorer state:', error);
    }
  }, [selectedValidation, searchValidationTerm, searchTerm, statusFilter]);
  
  // Credits state
  const [aiCredits, setAICredits] = useState({ current: 0, total: 0 });
  const [isConsumingCredit, setIsConsumingCredit] = useState(false);
  
  // Validation records state
  const [validationRecords, setValidationRecords] = useState<ValidationRecord[]>([]);
  const [isLoadingValidations, setIsLoadingValidations] = useState(true);
  const [validationLoadError, setValidationLoadError] = useState<string | null>(null);
  
  // Validation evidence state with comprehensive error handling
  const [validationEvidenceData, setValidationEvidenceData] = useState<ValidationEvidenceRecord[]>([]);
  const [isLoadingEvidence, setIsLoadingEvidence] = useState(false);
  const [evidenceError, setEvidenceError] = useState<ValidationResultsError | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastLoadedValidationId, setLastLoadedValidationId] = useState<string | null>(null);

  // Load AI credits
  useEffect(() => {
    const loadAICredits = async () => {
      const currentRTO = getRTOById(selectedRTOId);
      if (!currentRTO?.code) return;

      try {
        const credits = await getAICredits(currentRTO.code);
        setAICredits(credits);
      } catch (error) {
        console.error('[ResultsExplorer] Error loading AI credits:', error);
      }
    };

    loadAICredits();
  }, [selectedRTOId]);

  // Load validation records
  useEffect(() => {
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
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('[ResultsExplorer] Error loading validations:', errorMsg);
        setValidationLoadError(errorMsg);
        toast.error(`Failed to load validations: ${errorMsg}`);
      } finally {
        setIsLoadingValidations(false);
      }
    };

    loadValidations();
  }, [selectedRTOId]);

  // Auto-select validation if ID provided
  useEffect(() => {
    if (selectedValidationId && validationRecords.length > 0) {
      console.log('[ResultsExplorer] Looking for validation ID:', selectedValidationId);
      console.log('[ResultsExplorer] Available validation records:', validationRecords.length);
      console.log('[ResultsExplorer] Loading status:', isLoadingValidations);

      const record = validationRecords.find(r => r.id.toString() === selectedValidationId);
      
      if (record) {
        console.log('[ResultsExplorer] Found validation record:', record);
        setSelectedValidation({
          id: record.id.toString(),
          unitCode: record.unit_code || 'N/A',
          unitTitle: record.qualification_code || 'Unit',
          validationType: (record.validation_type?.toLowerCase() as any) || 'unit',
          rtoId: selectedRTOId,
          validationDate: record.created_at,
          status: record.req_extracted ? 'docExtracted' : 'pending',
          progress: record.req_total ? Math.round((record.completed_count || 0) / record.req_total * 100) : 0,
        });
      } else {
        console.warn('[ResultsExplorer] Validation ID not found:', selectedValidationId);
      }
    }
  }, [selectedValidationId, validationRecords, isLoadingValidations, selectedRTOId]);

  // Load validation evidence with comprehensive error handling
  useEffect(() => {
    let cancelled = false;

    const loadValidationEvidence = async () => {
      if (!selectedValidation) {
        setValidationEvidenceData([]);
        setEvidenceError(null);
        setIsProcessing(false);
        setLastLoadedValidationId(null);
        return;
      }

      // Only reload if validation ID actually changed
      if (selectedValidation.id === lastLoadedValidationId) {
        console.log('[ResultsExplorer] Same validation, skipping reload');
        return;
      }

      // Find the validation record
      const currentRecord = validationRecords.find(r => r.id.toString() === selectedValidation.id);
      if (!currentRecord) {
        // If records aren't loaded yet, wait for them
        if (isLoadingValidations) {
          console.log('[ResultsExplorer] Waiting for validation records to load...');
          return;
        }
        
        setEvidenceError({
          code: 'NOT_FOUND',
          message: 'Validation record not found',
          retryable: false,
        });
        return;
      }

      const valDetailId = currentRecord.id;

      setIsLoadingEvidence(true);
      setEvidenceError(null);
      setLastLoadedValidationId(selectedValidation.id);

      try {
        console.log('[ResultsExplorer] Fetching validation results for ID:', valDetailId);
        
        const response = await getValidationResults(selectedValidation.id, valDetailId);
        
        if (cancelled) return;

        if (response.error) {
          setEvidenceError(response.error);
          setIsProcessing(response.isProcessing);
          setValidationEvidenceData([]);
          
          // Show toast for errors (but not for processing state)
          if (!response.isProcessing) {
            toast.error(response.error.message);
          }
        } else {
          setValidationEvidenceData(response.data);
          setEvidenceError(null);
          setIsProcessing(false);
        }
      } catch (error) {
        if (cancelled) return;
        
        const errorMsg = error instanceof Error ? error.message : 'Failed to load validation results';
        console.error('[ResultsExplorer] Unexpected error:', error);
        
        setEvidenceError({
          code: 'UNKNOWN',
          message: errorMsg,
          retryable: true,
        });
        setValidationEvidenceData([]);
        toast.error(errorMsg);
      } finally {
        if (!cancelled) {
          setIsLoadingEvidence(false);
        }
      }
    };

    loadValidationEvidence();

    return () => {
      cancelled = true;
    };
  }, [selectedValidation, validationRecords, isLoadingValidations, lastLoadedValidationId]);

  // Retry loading evidence
  const handleRetryEvidence = useCallback(() => {
    // Reset the last loaded ID to force a reload
    setLastLoadedValidationId(null);
    setEvidenceError(null);
    setIsLoadingEvidence(true);
    
    // Force re-run of effect
    if (selectedValidation) {
      const temp = selectedValidation;
      setSelectedValidation(null);
      setTimeout(() => setSelectedValidation(temp), 0);
    }
  }, [selectedValidation]);

  // Refresh validation status
  const handleRefreshStatus = useCallback(async () => {
    const currentRTO = getRTOById(selectedRTOId);
    if (!currentRTO?.code) return;

    try {
      const records = await getActiveValidationsByRTO(currentRTO.code);
      setValidationRecords(records);
      toast.success('Status refreshed');
    } catch (error) {
      toast.error('Failed to refresh status');
    }
  }, [selectedRTOId]);

  // Filter validations
  const filteredValidations = validationRecords
    .filter(validation =>
      (validation.unit_code?.toLowerCase() || '').includes(searchValidationTerm.toLowerCase()) ||
      (validation.qualification_code?.toLowerCase() || '').includes(searchValidationTerm.toLowerCase()) ||
      (validation.validation_type?.toLowerCase() || '').includes(searchValidationTerm.toLowerCase())
    )
    .map(record => ({
      id: record.id.toString(),
      unitCode: record.unit_code || 'N/A',
      unitTitle: record.qualification_code || 'Unit',
      validationType: (record.validation_type?.toLowerCase() as any) || 'unit',
      rtoId: selectedRTOId,
      validationDate: record.created_at,
      status: record.req_extracted ? 'docExtracted' : 'pending',
      progress: record.req_total ? Math.round((record.completed_count || 0) / record.req_total * 100) : 0,
    }));

  // Filter results based on search and status
  const filteredResults = validationEvidenceData.filter(result => {
    const matchesSearch = !searchTerm || 
      result.requirement_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
      result.requirement_number.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || result.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Get current validation record (used in multiple places)
  const currentRecord = validationRecords.find(r => r.id.toString() === selectedValidation?.id);

  // Render validation evidence section
  const renderValidationEvidence = () => {
    // Get progress info from current validation record
    const progressInfo = currentRecord ? {
      completed: currentRecord.completed_count || 0,
      total: currentRecord.req_total || 0,
      status: currentRecord.validation_status || 'Unknown',
    } : undefined;

    console.log('[ResultsExplorer] Render state:', {
      selectedValidationId: selectedValidation?.id,
      currentRecord,
      progressInfo,
      totalRecords: validationRecords.length,
      isLoadingEvidence,
      validationEvidenceDataLength: validationEvidenceData.length,
      hasError: !!evidenceError,
      validationStatus: currentRecord?.validation_status,
      errorCode: evidenceError?.code
    });

    // Loading state
    if (isLoadingEvidence) {
      console.log('[ResultsExplorer] Rendering loading state');
      return <ValidationStatusMessage type="loading" validationProgress={progressInfo} />;
    }

    // Error state
    if (evidenceError) {
      return (
        <ValidationStatusMessage
          type="error"
          error={evidenceError}
          onRetry={evidenceError.retryable ? handleRetryEvidence : undefined}
          validationProgress={progressInfo}
        />
      );
    }

    // No results state
    if (validationEvidenceData.length === 0) {
      return (
        <ValidationStatusMessage 
          type="no-results"
          error={evidenceError || undefined}
          onRefresh={handleRefreshStatus}
          validationProgress={progressInfo}
        />
      );
    }

    // Success - render results
    return (
      <div className="space-y-4">
        {/* Search and filter controls */}
        <div className="flex gap-4 items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#94a3b8] w-4 h-4" />
            <Input
              placeholder="Search requirements..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="met">Met</SelectItem>
              <SelectItem value="not-met">Not Met</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleRefreshStatus} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          {/* n8n Report Generation */}
          {currentRecord && (
            <ResultsExplorerActions
              validationDetailId={currentRecord.id}
              onRefresh={handleRefreshStatus}
            />
          )}
        </div>

        {/* Results count */}
        <p className="text-sm text-gray-600">
          Showing {filteredResults.length} of {validationEvidenceData.length} requirements
        </p>

        {/* Results list */}
        {filteredResults.length > 0 ? (
          filteredResults.map((result) => (
            <ValidationCard
              key={result.id}
              result={result}
              onClick={() => setSelectedResult(result)}
            />
          ))
        ) : (
          <div className="text-center py-12 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p>No requirements match your search criteria</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#f8f9fb] p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-poppins text-[#1e293b] mb-2">
            Results Explorer
          </h1>
          <p className="text-[#64748b]">
            View and analyze validation results
          </p>
        </div>

        {/* Validation selector */}
        <Card className="p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Select Validation
            </h2>
            {selectedValidation && (
              <Button 
                onClick={() => setSelectedValidation(null)} 
                variant="ghost" 
                size="sm"
              >
                <X className="w-4 h-4 mr-2" />
                Clear Selection
              </Button>
            )}
          </div>

          {validationLoadError && (
            <InlineErrorMessage 
              error={{
                code: 'DATABASE_ERROR',
                message: validationLoadError,
                retryable: true,
              }}
              onRetry={handleRefreshStatus}
            />
          )}

          {/* Validation list or selected validation display */}
          {selectedValidation ? (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900">
                    {selectedValidation.unitCode} - {selectedValidation.unitTitle}
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    {getValidationTypeLabel(selectedValidation.validationType)} • 
                    {formatValidationDate(selectedValidation.validationDate)}
                  </p>
                </div>
                {/* Validation Status Badge */}
                {currentRecord && (
                  <ValidationStatusBadge
                    status={{
                      extractStatus: currentRecord.extract_status || 'Pending',
                      validationStatus: currentRecord.extract_status || 'Pending',
                    }}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Input
                placeholder="Search validations..."
                value={searchValidationTerm}
                onChange={(e) => setSearchValidationTerm(e.target.value)}
                className="mb-2"
              />
              {isLoadingValidations ? (
                <p className="text-sm text-gray-500 text-center py-4">Loading validations...</p>
              ) : filteredValidations.length > 0 ? (
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {filteredValidations.slice(0, 10).map((validation) => (
                    <button
                      key={validation.id}
                      onClick={() => setSelectedValidation(validation)}
                      className="w-full text-left p-3 hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors"
                    >
                      <p className="text-sm font-medium text-gray-900">
                        {validation.unitCode}
                      </p>
                      <p className="text-xs text-gray-600">
                        {formatValidationDate(validation.validationDate)}
                      </p>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">
                  No validations found
                </p>
              )}
            </div>
          )}
        </Card>

        {/* Validation evidence section */}
        {selectedValidation ? (
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">
              Validation Results
            </h2>
            {renderValidationEvidence()}
          </Card>
        ) : (
          <ValidationStatusMessage type="empty" />
        )}
      </div>
    </div>
  );
}
