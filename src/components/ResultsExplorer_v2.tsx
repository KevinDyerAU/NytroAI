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
  CheckCircle,
  Info,
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
  const [searchTerm, setSearchTerm] = useState(persistedState.searchTerm || '');
  const [statusFilter, setStatusFilter] = useState(persistedState.statusFilter || 'all');
  const [selectedResult, setSelectedResult] = useState<any>(null);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showDetailedReport, setShowDetailedReport] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  // Save state to sessionStorage when it changes
  useEffect(() => {
    const stateToSave = {
      selectedValidation,
      searchTerm,
      statusFilter,
    };
    try {
      sessionStorage.setItem('resultsExplorerState', JSON.stringify(stateToSave));
    } catch (error) {
      console.warn('Failed to save Results Explorer state:', error);
    }
  }, [selectedValidation, searchTerm, statusFilter]);

  // Cleanup: Reset all fields and filters when component unmounts (navigating away)
  useEffect(() => {
    return () => {
      console.log('[ResultsExplorer] Cleaning up - resetting all filters and state');
      
      // Clear persisted state from sessionStorage
      try {
        sessionStorage.removeItem('resultsExplorerState');
      } catch (error) {
        console.warn('Failed to clear Results Explorer state:', error);
      }
      
      // Reset all UI state
      setSearchTerm('');
      setStatusFilter('all');
      setSelectedValidation(null);
      setSelectedResult(null);
      setShowReportDialog(false);
      setShowDetailedReport(false);
      setConfirmText('');
      setUnitSearchTerm('');
      setShowUnitDropdown(false);
    };
  }, []);
  
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
  
  // Unit autocomplete state
  const [unitSearchTerm, setUnitSearchTerm] = useState('');
  const [allUnits, setAllUnits] = useState<any[]>([]);
  const [filteredUnits, setFilteredUnits] = useState<any[]>([]);
  const [showUnitDropdown, setShowUnitDropdown] = useState(false);
  const [isLoadingUnits, setIsLoadingUnits] = useState(false);

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

  // Load all units on mount
  useEffect(() => {
    const loadUnits = async () => {
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

        console.log('[ResultsExplorer] Loaded units:', result.data?.length || 0);
        setAllUnits(result.data || []);
      } catch (error) {
        console.error('[ResultsExplorer] Error loading units:', error);
        toast.error('Failed to load units of competency');
      } finally {
        setIsLoadingUnits(false);
      }
    };

    loadUnits();
  }, []);

  // Filter units based on search term
  useEffect(() => {
    if (!unitSearchTerm) {
      setFilteredUnits([]);
      setShowUnitDropdown(false);
      return;
    }

    const searchLower = unitSearchTerm.toLowerCase();
    const filtered = allUnits.filter(unit => 
      unit.unitCode?.toLowerCase().includes(searchLower) ||
      unit.Title?.toLowerCase().includes(searchLower)
    ).slice(0, 10); // Limit to 10 results

    setFilteredUnits(filtered);
    setShowUnitDropdown(filtered.length > 0);
  }, [unitSearchTerm, allUnits]);

  // Handle unit selection from dropdown
  const handleUnitSelect = (unit: any) => {
    console.log('[ResultsExplorer] Unit selected:', unit.unitCode);
    
    // Find validation for this unit
    const validation = validationRecords.find(r => r.unit_code === unit.unitCode);
    
    if (validation) {
      const validationObj: Validation = {
        id: validation.id.toString(),
        unitCode: validation.unit_code || 'N/A',
        unitTitle: validation.qualification_code || 'Unit',
        validationType: (validation.validation_type?.toLowerCase() as 'learner-guide' | 'assessment' | 'unit') || 'unit',
        rtoId: selectedRTOId,
        validationDate: validation.created_at,
        status: validation.req_extracted ? 'docExtracted' : 'pending',
        progress: validation.req_total ? Math.round((validation.completed_count || 0) / validation.req_total * 100) : 0,
        requirementsChecked: validation.completed_count || 0,
        totalRequirements: validation.req_total || 0,
        sector: 'General',
        documentsValidated: validation.doc_extracted ? 1 : 0,
        reportSigned: false
      };
      setSelectedValidation(validationObj);
      toast.success(`Validation loaded for ${unit.unitCode}`);
    } else {
      toast.error(`No validation found for ${unit.unitCode}`);
    }
    
    setUnitSearchTerm(unit.unitCode);
    setShowUnitDropdown(false);
  };

  // Handle search input change
  const handleSearchChange = (value: string) => {
    setUnitSearchTerm(value);
  };

  // Handle Enter key to auto-select exact match
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && unitSearchTerm && filteredUnits.length > 0) {
      // Check for exact match first
      const exactMatch = filteredUnits.find(
        unit => unit.unitCode?.toUpperCase() === unitSearchTerm.toUpperCase()
      );
      
      if (exactMatch) {
        handleUnitSelect(exactMatch);
      } else {
        // Select first result if no exact match
        handleUnitSelect(filteredUnits[0]);
      }
    }
  };

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
          sector: 'N/A',
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
      const selectedValidationId = selectedValidation?.id;

      console.log('[ResultsExplorer useEffect] Starting effect', {
        hasSelectedValidation: !!selectedValidation,
        selectedValidationId,
        lastLoadedValidationId,
        isLoadingValidations,
        validationRecordsCount: validationRecords.length
      });

      if (!selectedValidation) {
        console.log('[ResultsExplorer useEffect] No validation selected, clearing state');
        setValidationEvidenceData([]);
        setEvidenceError(null);
        setIsProcessing(false);
        setLastLoadedValidationId(null);
        setIsLoadingEvidence(false);
        return;
      }

      // Only reload if validation ID actually changed
      if (selectedValidationId === lastLoadedValidationId) {
        console.log('[ResultsExplorer useEffect] Same validation, skipping reload');
        return;
      }

      // Find the validation record - use the current validationRecords without depending on it
      const currentRecord = validationRecords.find(r => r.id.toString() === selectedValidationId);
      if (!currentRecord) {
        // If records aren't loaded yet, wait for them
        if (isLoadingValidations) {
          console.log('[ResultsExplorer useEffect] Waiting for validation records to load...');
          return;
        }

        console.log('[ResultsExplorer useEffect] Validation record not found');
        setEvidenceError({
          code: 'NOT_FOUND',
          message: 'Validation record not found',
          retryable: false,
        });
        setIsLoadingEvidence(false);
        return;
      }

      const valDetailId = currentRecord.id;

      console.log('[ResultsExplorer useEffect] Starting data fetch, setting loading=true');
      setIsLoadingEvidence(true);
      setEvidenceError(null);

      try {
        console.log('[ResultsExplorer useEffect] Fetching validation results for ID:', valDetailId);

        const response = await getValidationResults(selectedValidationId, valDetailId);

        console.log('[ResultsExplorer useEffect] Fetch complete:', {
          cancelled,
          hasError: !!response.error,
          dataLength: response.data.length,
          isEmpty: response.isEmpty,
          isProcessing: response.isProcessing
        });

        if (cancelled) {
          console.log('[ResultsExplorer useEffect] Effect cancelled, ignoring response');
          return;
        }

        if (response.error) {
          console.log('[ResultsExplorer useEffect] Setting error state:', response.error);
          setEvidenceError(response.error);
          setIsProcessing(response.isProcessing);
          setValidationEvidenceData([]);

          // Show toast for errors (but not for processing state)
          if (!response.isProcessing) {
            toast.error(response.error.message);
          }
        } else {
          console.log('[ResultsExplorer useEffect] Setting success state with', response.data.length, 'records');
          setValidationEvidenceData(response.data);
          setEvidenceError(null);
          setIsProcessing(false);
          // Only mark as loaded after successful data fetch
          setLastLoadedValidationId(selectedValidationId);
        }
      } catch (error) {
        if (cancelled) {
          console.log('[ResultsExplorer useEffect] Effect cancelled during error handling');
          return;
        }

        const errorMsg = error instanceof Error ? error.message : 'Failed to load validation results';
        console.error('[ResultsExplorer useEffect] Unexpected error:', error);

        setEvidenceError({
          code: 'UNKNOWN',
          message: errorMsg,
          retryable: true,
        });
        setValidationEvidenceData([]);
        toast.error(errorMsg);
      } finally {
        if (!cancelled) {
          console.log('[ResultsExplorer useEffect] Setting loading=false in finally block');
          setIsLoadingEvidence(false);
        } else {
          console.log('[ResultsExplorer useEffect] Effect cancelled, NOT setting loading=false');
        }
      }
    };

    loadValidationEvidence();

    return () => {
      console.log('[ResultsExplorer useEffect] Cleanup - cancelling effect');
      cancelled = true;
    };
  }, [selectedValidation?.id, isLoadingValidations, lastLoadedValidationId]);

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
      // Reset filters to show all results after refresh
      setSearchTerm('');
      setStatusFilter('all');
      
      const records = await getActiveValidationsByRTO(currentRTO.code);
      setValidationRecords(records);
      
      // Force reload of evidence data
      setLastLoadedValidationId(null);
      
      toast.success('Status refreshed');
    } catch (error) {
      toast.error('Failed to refresh status');
    }
  }, [selectedRTOId]);

  // Filter results based on search and status
  const filteredResults = validationEvidenceData.filter(result => {
    const matchesSearch = !searchTerm || 
      result.requirement_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
      result.requirement_number.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Normalize status comparison to handle both hyphen and underscore formats
    const normalizeStatus = (status: string) => status.toLowerCase().replace(/_/g, '-');
    const matchesStatus = statusFilter === 'all' || 
      normalizeStatus(result.status) === normalizeStatus(statusFilter);
    
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

    console.log('[ResultsExplorer RENDER] Render state:', {
      selectedValidationId: selectedValidation?.id,
      currentRecordId: currentRecord?.id,
      progressInfo,
      totalRecords: validationRecords.length,
      isLoadingEvidence,
      validationEvidenceDataLength: validationEvidenceData.length,
      hasError: !!evidenceError,
      validationStatus: currentRecord?.validation_status,
      errorCode: evidenceError?.code,
      lastLoadedValidationId
    });

    // Loading state
    if (isLoadingEvidence) {
      console.log('[ResultsExplorer RENDER] Returning loading component because isLoadingEvidence=true');
      return <ValidationStatusMessage type="loading" validationProgress={progressInfo} />;
    }

    console.log('[ResultsExplorer RENDER] Not loading, checking other states...');

    // Error state
    if (evidenceError) {
      console.log('[ResultsExplorer RENDER] Returning error component');
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
      console.log('[ResultsExplorer RENDER] Returning no-results component');
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
    console.log('[ResultsExplorer RENDER] Rendering results list with', validationEvidenceData.length, 'items');
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
            <SelectTrigger className="w-[180px] bg-white">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent className="bg-white">
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
          {/* Report Generation with Popup */}
          {currentRecord && selectedValidation && (
            <ResultsExplorerActions
              validationDetailId={currentRecord.id}
              unitCode={selectedValidation.unitCode || currentRecord.unit_code || 'Unknown'}
              unitTitle={selectedValidation.unitTitle || currentRecord.qualification_code || 'Unknown'}
              rtoName={getRTOById(selectedRTOId)?.name || 'Unknown RTO'}
              validationType={(currentRecord.validation_type?.toLowerCase().includes('learner') || currentRecord.validation_type?.toLowerCase().includes('guide')) ? 'learner-guide' : 'assessment'}
              validationResults={validationEvidenceData as any}
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
          filteredResults.map((record) => {
            // Pass raw database record directly to ValidationCard
            // ValidationCard has all the parsing logic built-in
            return (
              <ValidationCard
                key={record.id}
                result={record as any}
                onChatClick={() => setSelectedResult(record)}
                isReportSigned={false}
                aiCreditsAvailable={aiCredits.current > 0}
                validationContext={{
                  rtoId: selectedRTOId,
                  unitCode: selectedValidation?.unitCode,
                  unitTitle: selectedValidation?.unitTitle,
                  validationType: selectedValidation?.validationType,
                  validationId: selectedValidation?.id,
                }}
              />
            );
          })
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
          <h1 className="text-3xl font-bold text-[#1e293b] mb-2">
            Results Explorer
          </h1>
          <p className="text-[#64748b]">
            View and analyze validation results
          </p>
        </div>

        {/* Unit Selection */}
        <Card className="p-6 bg-white mb-6">
          <h2 className="text-xl font-semibold text-[#1e293b] mb-4">1. Select Unit of Competency</h2>
          <div className="space-y-4">
            <div className="relative">
              <label className="block text-sm font-medium text-[#64748b] mb-2">
                Unit Code
              </label>
              <input
                type="text"
                placeholder={isLoadingUnits ? "Loading units..." : "Search by code or title (e.g., BSBWHS521). Press Enter to select."}
                value={unitSearchTerm}
                onChange={(e) => handleSearchChange(e.target.value.toUpperCase())}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                  // Show dropdown if user is searching
                  if (unitSearchTerm && (!selectedValidation || unitSearchTerm !== selectedValidation.unitCode)) {
                    setShowUnitDropdown(true);
                  }
                }}
                onBlur={() => {
                  // Close dropdown when clicking outside (with small delay to allow click on dropdown items)
                  setTimeout(() => setShowUnitDropdown(false), 200);
                }}
                disabled={isLoadingUnits}
                className="w-full px-4 py-2 border border-[#e2e8f0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3b82f6] disabled:bg-gray-100"
              />
              
              {/* Autocomplete Dropdown */}
              {showUnitDropdown && filteredUnits.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-[#e2e8f0] rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredUnits.map((unit) => (
                    <button
                      key={unit.id}
                      type="button"
                      onClick={() => handleUnitSelect(unit)}
                      className="w-full text-left px-4 py-3 hover:bg-[#f8f9fb] border-b border-[#e2e8f0] last:border-b-0 transition-colors"
                    >
                      <p className="font-semibold text-[#1e293b]">{unit.unitCode}</p>
                      <p className="text-sm text-[#64748b] truncate">{unit.Title}</p>
                    </button>
                  ))}
                </div>
              )}
              
              {unitSearchTerm && filteredUnits.length === 0 && !isLoadingUnits && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-[#e2e8f0] rounded-lg shadow-lg p-4 text-center text-[#64748b]">
                  <Info className="w-5 h-5 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No units found matching "{unitSearchTerm}"</p>
                </div>
              )}
            </div>
            
            {selectedValidation && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-semibold text-green-900">{selectedValidation.unitCode}</p>
                    <p className="text-sm text-green-700">{selectedValidation.unitTitle}</p>
                  </div>
                </div>
              </div>
            )}
            
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
          </div>
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

      {/* AI Chat Dialog */}
      {selectedResult && (
        <AIChat
          context={`Requirement ${selectedResult.requirement_number}: ${selectedResult.requirement_text}`}
          onClose={() => setSelectedResult(null)}
          selectedRTOId={selectedRTOId}
          validationDetailId={selectedResult.validation_detail_id}
          onCreditConsumed={(newBalance) => {
            setAICredits(prev => ({ ...prev, current: newBalance }));
          }}
        />
      )}
    </div>
  );
}
