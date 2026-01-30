/**
 * ResultsExplorer Component - Phase 3.2 Update
 * Comprehensive error handling and status management
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  MessageSquare,
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
  selectedValidationId: propValidationId,
  aiCreditsAvailable = true,
  selectedRTOId
}: ResultsExplorerProps) {
  // URL-based state for filters (persists across refresh)
  const [searchParams, setSearchParams] = useSearchParams();

  // Read validationId from URL (takes precedence) or fall back to prop
  const urlValidationId = searchParams.get('validationId');
  const selectedValidationId = urlValidationId || propValidationId;

  // Log the prop on every render to debug
  console.log('[ResultsExplorer RENDER] Props:', { propValidationId, selectedRTOId });

  // Log current URL params
  console.log('[ResultsExplorer RENDER] URL params:', {
    view: searchParams.get('view'),
    validationId: urlValidationId,
    selectedValidationId,
    unit: searchParams.get('unit'),
    search: searchParams.get('search'),
    status: searchParams.get('status'),
  });

  // Read filter state from URL
  const urlSearchTerm = searchParams.get('search') || '';
  const urlStatusFilter = searchParams.get('status') || 'all';
  const urlTypeFilter = searchParams.get('type') || 'all';

  // Update URL params helper
  const updateFilterParams = useCallback((updates: { search?: string; status?: string; type?: string }) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);

      if (updates.search !== undefined) {
        if (updates.search === '') {
          newParams.delete('search');
        } else {
          newParams.set('search', updates.search);
        }
      }

      if (updates.status !== undefined) {
        if (updates.status === 'all') {
          newParams.delete('status');
        } else {
          newParams.set('status', updates.status);
        }
      }

      if (updates.type !== undefined) {
        if (updates.type === 'all') {
          newParams.delete('type');
        } else {
          newParams.set('type', updates.type);
        }
      }

      return newParams;
    }, { replace: true }); // Use replace to avoid cluttering history with filter changes
  }, [setSearchParams]);

  // Use URL values for filters
  const searchTerm = urlSearchTerm;
  const statusFilter = urlStatusFilter;
  const typeFilter = urlTypeFilter;

  // Setters that update URL
  const setSearchTerm = useCallback((value: string) => {
    updateFilterParams({ search: value });
  }, [updateFilterParams]);

  const setStatusFilter = useCallback((value: string) => {
    updateFilterParams({ status: value });
  }, [updateFilterParams]);

  const setTypeFilter = useCallback((value: string) => {
    updateFilterParams({ type: value });
  }, [updateFilterParams]);

  // State management for non-filter state
  const [selectedValidation, setSelectedValidation] = useState<Validation | null>(null);
  const [showAIChat, setShowAIChat] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showDetailedReport, setShowDetailedReport] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  // Credits state - default to positive values to prevent showing "No credits" while loading
  const [aiCredits, setAICredits] = useState({ current: 100, total: 100 });
  const [creditsLoaded, setCreditsLoaded] = useState(false);
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
  const [sessionTotal, setSessionTotal] = useState<number | null>(null);

  // Expiry functionality removed - Gemini file caching no longer used
  // All validations are now always 'active'
  const validationExpiryStatus = 'active';
  const isValidationExpired = false;


  // Load AI credits
  useEffect(() => {
    const loadAICredits = async () => {
      const currentRTO = getRTOById(selectedRTOId);
      if (!currentRTO?.code) return;

      try {
        console.log('[ResultsExplorer] Loading AI credits for RTO:', currentRTO.code);
        const credits = await getAICredits(currentRTO.code);
        console.log('[ResultsExplorer] AI credits loaded:', credits);
        setAICredits(credits);
        setCreditsLoaded(true);
      } catch (error) {
        console.error('[ResultsExplorer] Error loading AI credits:', error);
        // On error, keep default positive values so features aren't disabled
        setCreditsLoaded(true);
      }
    };

    loadAICredits();
  }, [selectedRTOId]);

  // Load validation records - fetch RTO first if cache is empty
  useEffect(() => {
    const loadValidations = async () => {
      try {
        setIsLoadingValidations(true);
        setValidationLoadError(null);

        if (!selectedRTOId) {
          console.warn('[ResultsExplorer] No RTO ID provided');
          setValidationRecords([]);
          setIsLoadingValidations(false);
          return;
        }

        // Try cache first, then fetch directly if not found
        let currentRTO = getRTOById(selectedRTOId);

        if (!currentRTO?.code) {
          console.log('[ResultsExplorer] RTO not in cache, fetching directly...');
          // Import and use fetchRTOById to get RTO data
          const { fetchRTOById } = await import('../types/rto');
          const rtoData = await fetchRTOById(selectedRTOId);
          if (rtoData) {
            currentRTO = {
              id: rtoData.id.toString(),
              code: rtoData.code,
              name: rtoData.legalname,
              legalname: rtoData.legalname,
              validationCredits: { current: 10, total: 10 },
              stats: {} as any,
            };
          }
        }

        if (!currentRTO?.code) {
          console.warn('[ResultsExplorer] Could not get RTO code for ID:', selectedRTOId);
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

  // Reset filters and state when navigating directly to Results Explorer (no validation ID)
  useEffect(() => {
    if (!selectedValidationId) {
      console.log('[ResultsExplorer] No validation ID provided - resetting all filters and state');
      setSearchTerm('');
      setStatusFilter('all');
      setTypeFilter('all');
      setSelectedValidation(null);
      setSessionTotal(null);
      setShowAIChat(false);
    }
  }, [selectedValidationId, setSearchTerm, setStatusFilter, setTypeFilter]);

  // Auto-select validation if ID provided (from URL or dashboard double-click)
  // This runs when validationRecords load AND when selectedValidationId changes
  useEffect(() => {
    console.log('[ResultsExplorer AUTO-SELECT] Effect triggered:', {
      selectedValidationId,
      isLoadingValidations,
      validationRecordsCount: validationRecords.length,
      currentSelectedId: selectedValidation?.id,
    });

    // Wait for records to load
    if (isLoadingValidations) {
      console.log('[ResultsExplorer AUTO-SELECT] Still loading validations, waiting...');
      return;
    }

    if (!selectedValidationId) {
      console.log('[ResultsExplorer AUTO-SELECT] No validation ID in URL/props');
      return;
    }

    if (validationRecords.length === 0) {
      console.log('[ResultsExplorer AUTO-SELECT] No validation records available');
      return;
    }

    // Check if we already have this validation selected
    if (selectedValidation?.id === selectedValidationId) {
      console.log('[ResultsExplorer AUTO-SELECT] Validation already selected:', selectedValidationId);
      return;
    }

    console.log('[ResultsExplorer AUTO-SELECT] Looking for validation ID:', selectedValidationId);
    console.log('[ResultsExplorer AUTO-SELECT] Available IDs:', validationRecords.map(r => r.id).slice(0, 10));

    const record = validationRecords.find(r => r.id.toString() === selectedValidationId);

    if (record) {
      console.log('[ResultsExplorer AUTO-SELECT] Found validation record:', record.id, record.unit_code);
      setSelectedValidation({
        id: record.id.toString(),
        unitCode: record.unit_code || 'N/A',
        unitTitle: record.qualification_code || 'Unit',
        validationType: (record.validation_type?.toLowerCase() as any) || 'unit',
        rtoId: selectedRTOId,
        validationDate: record.created_at,
        status: record.req_extracted ? 'docExtracted' : 'pending',
        progress: record.num_of_req ? Math.round((record.completed_count || 0) / record.num_of_req * 100) : 0,
        sector: 'N/A',
      });
    } else {
      console.warn('[ResultsExplorer AUTO-SELECT] Validation ID not found in records:', selectedValidationId);
      console.warn('[ResultsExplorer AUTO-SELECT] Record IDs available:', validationRecords.map(r => r.id));
    }
  }, [selectedValidationId, validationRecords, isLoadingValidations, selectedRTOId, selectedValidation?.id]);

  // Derived state for the currently selected validation record
  const currentRecord = useMemo(() =>
    validationRecords.find(r => r.id.toString() === selectedValidation?.id),
    [validationRecords, selectedValidation?.id]
  );

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

    console.log('[ResultsExplorer] handleRefreshStatus called - reloading data');

    try {
      // Show loading state
      setIsLoadingEvidence(true);

      // Reload validation records
      const records = await getActiveValidationsByRTO(currentRTO.code);
      setValidationRecords(records);

      // Force reload of evidence data by resetting the lastLoadedValidationId
      // This triggers the existing useEffect to reload data
      if (selectedValidation?.id) {
        setLastLoadedValidationId(null);

        // Import and call the validation results function directly
        const { getValidationResults } = await import('../lib/validationResults');

        // Get the valDetailId from the selected validation (parse to number)
        const valDetailId = parseInt(selectedValidation.id.toString(), 10);

        const response = await getValidationResults(selectedValidation.id.toString(), valDetailId);

        if (response && 'data' in response && Array.isArray(response.data)) {
          console.log('[ResultsExplorer] handleRefreshStatus reloaded', response.data.length, 'records');
          setValidationEvidenceData(response.data);

          // Update total if found in polling response
          if (response.totalRequirements) {
            setSessionTotal(response.totalRequirements);
          }

          setLastLoadedValidationId(selectedValidation.id.toString());
        }
      }

      setIsLoadingEvidence(false);
      toast.success('Results refreshed', { duration: 2000 });
    } catch (error) {
      console.error('[ResultsExplorer] Failed to refresh status:', error);
      toast.error('Failed to refresh status');
      setIsLoadingEvidence(false);
    }
  }, [selectedRTOId, selectedValidation]);

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
        setSessionTotal(null);
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
          // NEW: Capture total from response if available
          if (response.totalRequirements) {
            setSessionTotal(response.totalRequirements);
          }
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

  // Auto-refresh validation data every 5 seconds if in progress
  useEffect(() => {
    let intervalId: any = null;

    const isValidationInProgress = selectedValidation &&
      selectedValidation.progress >= 0 &&
      selectedValidation.progress < 100;

    const isRecordProcessing = currentRecord &&
      (currentRecord.validation_status === 'In Progress' ||
        currentRecord.validation_status === 'Pending' ||
        currentRecord.validation_status === 'processing');

    if (isValidationInProgress || isRecordProcessing) {
      console.log('[ResultsExplorer polling] Starting 5s auto-refresh interval');
      intervalId = setInterval(() => {
        handleRefreshStatus();
      }, 5000);
    }

    return () => {
      if (intervalId) {
        console.log('[ResultsExplorer polling] Clearing refresh interval');
        clearInterval(intervalId);
      }
    };
  }, [selectedValidation?.id, selectedValidation?.progress, currentRecord?.validation_status, handleRefreshStatus]);
  // Filter results based on search and status
  const filteredResults = validationEvidenceData.filter(result => {
    const matchesSearch = !searchTerm ||
      result.requirement_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
      result.requirement_number.toLowerCase().includes(searchTerm.toLowerCase());

    // Normalize status comparison to handle various formats:
    // Database: "Partially Met", "Met", "Not Met"
    // Filter values: "partial", "met", "not-met"
    const normalizeStatus = (status: string) => {
      const lower = status.toLowerCase().replace(/[\s_]/g, '-');
      // Map "partially-met" to "partial" for filter matching
      if (lower === 'partially-met') return 'partial';
      return lower;
    };
    const matchesStatus = statusFilter === 'all' ||
      normalizeStatus(result.status) === normalizeStatus(statusFilter);

    const matchesType = typeFilter === 'all' ||
      result.requirement_type === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  // Render validation evidence section
  const renderValidationEvidence = () => {
    // Get progress info from current validation record (use num_of_req for total)
    const progressInfo = currentRecord ? {
      completed: currentRecord.completed_count || 0,
      total: currentRecord.num_of_req || 0,
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
        <div className="flex flex-col md:flex-row gap-3 md:gap-4 md:items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#94a3b8] w-4 h-4" />
            <Input
              placeholder="Search requirements..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex flex-wrap gap-2 md:gap-4 items-center">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] md:w-[150px] bg-white text-xs md:text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="met">Met</SelectItem>
                <SelectItem value="not-met">Not Met</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[140px] md:w-[180px] bg-white text-xs md:text-sm">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="knowledge_evidence">Knowledge Evidence</SelectItem>
                <SelectItem value="performance_evidence">Performance Evidence</SelectItem>
                <SelectItem value="foundation_skills">Foundation Skills</SelectItem>
                <SelectItem value="elements_performance_criteria">Performance Criteria</SelectItem>
                <SelectItem value="assessment_conditions">Assessment Conditions</SelectItem>
                <SelectItem value="assessment_instructions">Assessment Instructions</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={handleRefreshStatus}
              size="sm"
              className="bg-[#dbeafe] text-[#3b82f6] border-[#93c5fd] hover:bg-[#bfdbfe] hover:border-[#3b82f6]"
            >
              <RefreshCw className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">Refresh</span>
            </Button>
            {/* Chat with Documents Button */}
            {currentRecord && selectedValidation && (
              <Button
                onClick={() => setShowAIChat(true)}
                size="sm"
                className="bg-[#dbeafe] text-[#3b82f6] border-[#93c5fd] hover:bg-[#bfdbfe] hover:border-[#3b82f6] disabled:opacity-50"
                disabled={aiCredits.current <= 0 || isValidationExpired}
                title={isValidationExpired ? "Validation expired (>48 hours). AI features disabled." : aiCredits.current <= 0 ? "No AI credits available" : "Chat with AI about the uploaded documents"}
              >
                <MessageSquare className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Chat with Documents</span>
              </Button>
            )}
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
        </div>

        {/* Validation Expired Warning Banner */}
        {isValidationExpired && selectedValidation && (
          <div className="p-4 bg-[#fef3c7] border border-[#f59e0b] rounded-lg flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="text-sm text-[#92400e] font-semibold">Validation Expired</p>
              <p className="text-sm text-[#78350f]">
                This validation is older than 48 hours. AI features (AI Chat, Smart Questions, Revalidation) are disabled. You can still download the report.
              </p>
            </div>
          </div>
        )}

        {/* Results count and active progress indicator */}
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-gray-700">
            Showing <span className="text-[#3b82f6] font-bold">{filteredResults.length}</span> of {Math.max(sessionTotal || currentRecord?.num_of_req || 0, validationEvidenceData.length)} requirements
          </p>

          {selectedValidation && selectedValidation.progress > 0 && selectedValidation.progress < 100 && (
            <div className="flex items-center gap-4 py-2 px-4 bg-blue-50 border border-blue-100 rounded-lg mb-2">
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">
                    🤖 Nytro is Validating...
                  </span>
                  <span className="text-xs font-bold text-blue-800">
                    {selectedValidation.progress}% Complete
                  </span>
                </div>
                <Progress value={selectedValidation.progress} className="h-2 bg-blue-100" />
              </div>
              <div className="flex flex-col items-center justify-center min-w-[80px]">
                <span className="text-[10px] text-blue-600 font-medium mb-1">Checking Item</span>
                <span className="text-lg font-bold text-blue-800 leading-tight">
                  {currentRecord?.completed_count || 0}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Results list */}
        {filteredResults.length > 0 ? (
          filteredResults.map((record) => {
            // Pass raw database record directly to ValidationCard
            // ValidationCard has all the parsing logic built-in
            return (
              <ValidationCard
                key={record.id}
                result={record as any}
                isReportSigned={false}
                aiCreditsAvailable={aiCredits.current > 0}
                isValidationExpired={isValidationExpired}
                validationContext={{
                  rtoId: selectedRTOId,
                  unitCode: selectedValidation?.unitCode,
                  unitTitle: selectedValidation?.unitTitle,
                  validationType: selectedValidation?.validationType,
                  validationId: selectedValidation?.id,
                }}
                onCreditConsumed={(newBalance) => {
                  setAICredits(prev => ({ ...prev, current: newBalance }));
                }}
                onRefresh={handleRefreshStatus}
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
    <div className="min-h-screen bg-[#f8f9fb] p-4 md:p-8">
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

        {/* Unit Info Header */}
        {selectedValidation && (() => {
          const extractStatus = currentRecord?.extract_status || 'Pending';
          const validationStatus = currentRecord?.validation_status || 'Pending';
          const progress = currentRecord?.num_of_req ? Math.round(((currentRecord?.completed_count || 0) / currentRecord.num_of_req) * 100) : 0;

          // Status logic matching Dashboard
          const reqComplete = extractStatus !== 'Pending';
          const docComplete = extractStatus === 'Completed' ||
            validationStatus === 'In Progress' ||
            validationStatus === 'Finalised';
          const revComplete = validationEvidenceData.length > 0 || progress > 0 || validationStatus === 'Finalised';
          const repComplete = validationStatus === 'Finalised';

          // Status indicator component matching Dashboard with tooltip
          const StatusPill = ({ label, isComplete, tooltip }: { label: string; isComplete: boolean; tooltip: string }) => (
            <div
              className="flex items-center gap-1.5 px-3 py-1 bg-[#f1f5f9] rounded-full cursor-help"
              title={tooltip}
            >
              <div
                className={`w-2 h-2 rounded-full ${isComplete ? 'bg-[#22c55e]' : 'bg-[#cbd5e1]'}`}
              />
              <span className="text-xs font-medium text-[#64748b]">{label}</span>
            </div>
          );

          return (
            <div className="p-3 md:p-4 border-l-4 border-l-[#3b82f6] bg-white border border-[#e2e8f0] rounded-lg mb-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 md:gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs md:text-sm text-[#64748b]">Unit:</span>
                    <span className="font-bold text-[#1e293b] text-base md:text-lg">{selectedValidation.unitCode}</span>
                  </div>
                  <div className="hidden md:block h-6 w-px bg-[#e2e8f0]" />
                  <div className="flex items-center gap-2">
                    <span className="text-xs md:text-sm text-[#64748b]">Type:</span>
                    <span className="text-xs md:text-sm font-medium text-[#1e293b] capitalize">{selectedValidation.validationType || 'Assessment'}</span>
                  </div>
                  <div className="hidden md:block h-6 w-px bg-[#e2e8f0]" />
                  <div className="flex items-center gap-2">
                    <span className="text-xs md:text-sm text-[#64748b]">Date:</span>
                    <span className="text-xs md:text-sm font-medium text-[#1e293b]">
                      {selectedValidation.validationDate
                        ? new Date(selectedValidation.validationDate).toLocaleString('en-AU', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                        : 'N/A'}
                    </span>
                    {validationExpiryStatus === 'expired' && (
                      <div
                        className="flex items-center gap-1 px-2 py-0.5 bg-[#fef3c7] text-[#b45309] rounded-full text-xs font-medium cursor-help"
                        title="This validation is older than 48 hours. AI features are disabled."
                      >
                        <span>⚠️</span>
                        <span className="hidden sm:inline">Expired</span>
                      </div>
                    )}
                    {validationExpiryStatus === 'expiring' && (
                      <div
                        className="flex items-center gap-1 px-2 py-0.5 bg-[#dcfce7] text-[#166534] rounded-full text-xs font-medium cursor-help"
                        title="Less than 12 hours remaining before AI features are disabled."
                      >
                        <span>⏰</span>
                        <span className="hidden sm:inline">Expiring Soon</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                  <StatusPill
                    label="REQ"
                    isComplete={reqComplete}
                    tooltip={reqComplete ? 'Requirements: Extraction started' : 'Requirements: Waiting to start'}
                  />
                  <StatusPill
                    label="DOC"
                    isComplete={docComplete}
                    tooltip={docComplete ? 'Documents: Processing complete' : 'Documents: Processing in progress'}
                  />
                  <StatusPill
                    label="REV"
                    isComplete={revComplete}
                    tooltip={revComplete ? 'Review: Validation results available' : 'Review: Validation in progress'}
                  />
                  <StatusPill
                    label="REP"
                    isComplete={repComplete}
                    tooltip={repComplete ? 'Report: Generated and finalised' : 'Report: Not yet generated'}
                  />
                </div>
              </div>
            </div>
          );
        })()}

        {validationLoadError && (
          <Card className="p-4 bg-white mb-6">
            <InlineErrorMessage
              error={{
                code: 'DATABASE_ERROR',
                message: validationLoadError,
                retryable: true,
              }}
              onRetry={handleRefreshStatus}
            />
          </Card>
        )}

        {!selectedValidation && !validationLoadError && (
          <Card className="p-6 bg-white mb-6">
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium mb-2">No Validation Selected</p>
              <p className="text-sm">Please select a validation from the dashboard to view results.</p>
            </div>
          </Card>
        )}

        {/* Validation evidence section */}
        {selectedValidation ? (
          <Card className="p-3 md:p-6 bg-white border border-[#e2e8f0]">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">
              Validation Results
            </h2>
            {renderValidationEvidence()}
          </Card>
        ) : (
          <ValidationStatusMessage type="empty" />
        )}
      </div>

      {/* AI Chat Dialog - Chat with Documents */}
      {showAIChat && selectedValidation && (
        <AIChat
          context={selectedValidation.unitCode}
          onClose={() => setShowAIChat(false)}
          selectedRTOId={selectedRTOId}
          validationDetailId={currentRecord?.id}
          onCreditConsumed={(newBalance) => {
            setAICredits(prev => ({ ...prev, current: newBalance }));
          }}
          validationResults={validationEvidenceData.map(r => ({
            requirement_number: r.requirement_number || '',
            requirement_text: r.requirement_text || '',
            status: r.status || '',
            reasoning: r.reasoning || '',
          }))}
        />
      )}
    </div>
  );
}
