/**
 * Dashboard Component - Phase 3.4
 * Enhanced with virtual scrolling, toast notifications, and performance optimizations
 */

import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { KPIWidget } from './KPIWidget';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { supabase } from '../lib/supabase';
import { getRTOById, fetchRTOById, getActiveValidationsByRTO, getUserValidationsByRTO } from '../types/rto';
import { useDashboardMetrics, useValidationCredits } from '../hooks/useDashboardMetrics';
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  FileText,
  TrendingUp,
  Zap,
  Trash2,
  RotateCcw,
  AlertTriangle
} from 'lucide-react';
import type { ValidationRecord } from '../types/rto';
import { triggerDocumentProcessing } from '../lib/n8nApi';

interface ValidationStatus {
  file_name: string;
  embedding_status: string;
  gemini_status: string | null;
  progress_percentage: number | null;
  extractStatus: string | null;
  requirements_found: number | null;
  uploaded_at: string;
  minutes_ago: number;
}

interface Dashboard_v3Props {
  onValidationClick?: (validation: ValidationRecord) => void;
  selectedRTOId: string;
  selectedRTOCode?: string | null;
  creditsRefreshTrigger?: number;
  userId?: string | null;
  isAdmin?: boolean;
}

export function Dashboard_v3({
  onValidationClick,
  selectedRTOId,
  selectedRTOCode = null,
  creditsRefreshTrigger = 0,
  userId = null,
  isAdmin = false,
}: Dashboard_v3Props) {
  // Load persisted state
  const loadPersistedState = () => {
    try {
      const saved = sessionStorage.getItem('dashboardState');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  };

  const persistedState = loadPersistedState();

  // Use prop rtoCode if provided, otherwise fetch it
  const [rtoCode, setRtoCode] = useState<string | null>(selectedRTOCode);
  const [validations, setValidations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(persistedState.isInitialLoad !== false); // Only true on first visit
  const [currentPage, setCurrentPage] = useState(persistedState.currentPage || 1);
  const itemsPerPage = 20;


  // Save state to sessionStorage when it changes
  useEffect(() => {
    const stateToSave = {
      isInitialLoad: false, // Once loaded, never show initial spinner again
      currentPage,
    };
    try {
      sessionStorage.setItem('dashboardState', JSON.stringify(stateToSave));
    } catch (error) {
      console.warn('Failed to save Dashboard state:', error);
    }
  }, [currentPage]);

  // Use hooks for metrics and credits (pass userId and isAdmin for user-based filtering)
  const { metrics } = useDashboardMetrics(selectedRTOId, rtoCode, userId, isAdmin);
  // RTO users share the RTO's credit pool; non-RTO users have their own credits
  const hasRTO = !!selectedRTOId;
  const { credits: validationCredits } = useValidationCredits(
    hasRTO ? selectedRTOId : null,
    creditsRefreshTrigger,
    hasRTO ? undefined : userId
  );

  // Get RTO code from ID (only if not provided as prop)
  useEffect(() => {
    // If we already have rtoCode from props, use it
    if (selectedRTOCode) {
      setRtoCode(selectedRTOCode);
      return;
    }

    const loadRTOCode = async () => {
      if (!selectedRTOId) return;

      const cachedRTO = getRTOById(selectedRTOId);
      if (cachedRTO?.code) {
        setRtoCode(cachedRTO.code);
      } else {
        const rtoData = await fetchRTOById(selectedRTOId);
        if (rtoData?.code) {
          setRtoCode(rtoData.code);
        }
      }
    };

    loadRTOCode();
  }, [selectedRTOId, selectedRTOCode]);

  // Fetch validations using user-specific filtering
  useEffect(() => {
    const loadActiveValidations = async (isInitial = false) => {
      // $99 users without RTO can still see their own validations via user_id
      if (!rtoCode && !userId) return;

      // Only show loading spinner on true initial load (first visit ever)
      if (isInitial && isInitialLoad) {
        setIsLoading(true);
      }

      try {
        // Use user-specific validation filtering
        // Admin users see all validations, regular users see only their own
        const data = await getUserValidationsByRTO(
          rtoCode || '',
          userId || null,
          isAdmin || false
        );
        setValidations(data);
        if (isInitial && isInitialLoad) {
          setIsInitialLoad(false);
        }
      } catch (error) {
        console.error('[Dashboard_v3] Error fetching validations:', error);
        if (isInitial && isInitialLoad) {
          toast.error('Failed to load validations');
        }
        // Don't clear validations on error - preserve previous data
        // setValidations remains unchanged, keeping previous successful data
      } finally {
        if (isInitial && isInitialLoad) {
          setIsLoading(false);
        }
      }
    };

    loadActiveValidations(true);
    const subscription = supabase.channel('validation_detail_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'validation_detail' }, () => loadActiveValidations(false)).subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [rtoCode, creditsRefreshTrigger, isInitialLoad, userId, isAdmin]);

  // Calculate local metrics (for internal use)
  const localMetrics = useMemo(() => {
    const total = validations.length;
    const completed = validations.filter(v =>
      v.extract_status === 'Completed' ||
      (v.num_of_req > 0 && v.completed_count === v.num_of_req)
    ).length;
    const inProgress = validations.filter(v =>
      v.extract_status === 'ProcessingInBackground' ||
      v.extract_status === 'DocumentProcessing'
    ).length;
    const failed = validations.filter(v => v.extract_status === 'Failed').length;

    return {
      total,
      completed,
      inProgress,
      failed,
      completionRate: total > 0 ? (completed / total) * 100 : 0,
    };
  }, [validations]);


  // Auto-refresh validations every 30 seconds
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshValidations = async (showToast = false) => {
    if ((!rtoCode && !userId) || isRefreshing) return;
    setIsRefreshing(true);
    try {
      // Use user-specific validation filtering
      const data = await getUserValidationsByRTO(
        rtoCode || '',
        userId || null,
        isAdmin || false
      );
      setValidations(data || []);
      if (showToast) {
        toast.success('Validations refreshed');
      }
    } catch (error) {
      console.error('[Dashboard] Error refreshing validations:', error);
      if (showToast) {
        toast.error('Failed to refresh validations');
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  // Set up polling every 60 seconds as fallback (real-time subscription handles most updates)
  useEffect(() => {
    if (!rtoCode && !userId) return;
    const interval = setInterval(() => {
      refreshValidations(false);
    }, 60000); // 60 seconds
    return () => clearInterval(interval);
  }, [rtoCode, userId]);

  // Show ALL validations (not just actively processing ones)
  const activeValidations = validations;

  // Pagination
  const totalPages = Math.max(1, Math.ceil(activeValidations.length / itemsPerPage));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedValidations = activeValidations.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const formatValidationDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleDeleteValidation = async (e: React.MouseEvent, validationId: string, validation?: any) => {
    e.stopPropagation();
    
    // Admin can delete anything; non-admin can only delete their own failed validations
    const isFailed = validation && (
      validation.extract_status === 'Failed' || 
      validation.validation_status?.toLowerCase() === 'failed'
    );
    const isOwnValidation = validation?.user_id === userId;
    
    if (!isAdmin && !(isFailed && isOwnValidation)) return;
    
    if (window.confirm("Are you sure you want to delete this validation? This action cannot be undone.")) {
      try {
        const { error } = await supabase
          .from('validation_detail')
          .delete()
          .eq('id', validationId);
          
        if (error) throw error;
        
        toast.success("Validation deleted successfully");
        setValidations(prev => prev.filter(v => String(v.id) !== String(validationId)));
      } catch (err) {
        console.error("Error deleting validation:", err);
        toast.error("Failed to delete validation");
      }
    }
  };

  const [retryingIds, setRetryingIds] = useState<Set<number>>(new Set());

  const handleRetryValidation = async (e: React.MouseEvent, validation: any) => {
    e.stopPropagation();
    const validationId = validation.id;
    
    setRetryingIds(prev => new Set(prev).add(validationId));
    
    try {
      // 1. Fetch storage paths from documents table for this validation
      const { data: docs, error: docsError } = await supabase
        .from('documents')
        .select('storage_path')
        .eq('validation_detail_id', validationId);

      if (docsError) throw new Error(`Failed to fetch documents: ${docsError.message}`);
      
      const storagePaths = (docs || []).map((d: any) => d.storage_path).filter(Boolean);
      
      if (storagePaths.length === 0) {
        toast.error('No documents found for this validation. Cannot retry.');
        return;
      }

      // 2. Reset status in DB
      const { error: updateError } = await supabase
        .from('validation_detail')
        .update({
          extractStatus: 'Pending',
          validation_status: 'Pending',
          last_error: null,
          validation_progress: 0,
          completed_count: 0,
          validation_count: 0,
        })
        .eq('id', validationId);

      if (updateError) throw new Error(`Failed to reset validation: ${updateError.message}`);

      // 3. Optimistically update local state
      setValidations(prev => prev.map(v => 
        v.id === validationId 
          ? { ...v, extract_status: 'Pending', validation_status: 'Pending', last_error: null, error_message: null, validation_progress: 0, completed_count: 0, validation_count: 0 }
          : v
      ));

      // 4. Re-trigger n8n document processing
      await triggerDocumentProcessing(validationId, storagePaths);
      
      toast.success(`Validation for ${validation.unit_code || 'Unknown'} has been re-triggered`, {
        description: 'Processing will resume in the background.',
      });
    } catch (err) {
      console.error('[Dashboard] Retry validation error:', err);
      toast.error('Failed to retry validation', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setRetryingIds(prev => {
        const next = new Set(prev);
        next.delete(validationId);
        return next;
      });
    }
  };

  // Only show loading screen on initial load
  if (isLoading && isInitialLoad) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3b82f6] mx-auto mb-4"></div>
          <p className="text-[#64748b]">Loading validations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fb] p-4 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-sans text-2xl font-bold text-[#1e293b] mb-2">
          Dashboard Overview
        </h1>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <KPIWidget
          title="Total Validations"
          value={metrics?.totalValidations?.count?.toString() || '0'}
          subtitle={metrics?.totalValidations?.monthlyGrowth || '+0 this month'}
          icon={FileText}
          variant="blue"
          tooltip="Total number of validation records created for this RTO across all time"
        />

        <KPIWidget
          title="Success Rate"
          value={`${metrics?.successRate?.rate || 0}%`}
          subtitle={metrics?.successRate?.changeText || '↑ 0% from last month'}
          icon={TrendingUp}
          variant="green"
          tooltip="Percentage of requirements marked as 'met' across all completed validations"
        />

        <KPIWidget
          title="Total Validated"
          value={metrics?.activeUnits?.count?.toString() || '0'}
          subtitle={metrics?.activeUnits?.status || '0 currently processing'}
          icon={Activity}
          variant="grey"
          tooltip="Total units validated for this RTO. Subtitle shows non-expired validations still being processed."
        />

        <KPIWidget
          title="AI Queries"
          value={metrics?.aiQueries?.period || '0 this month / 0 all time'}
          subtitle="Smart questions, revalidations & AI chat"
          icon={Zap}
          variant="blue"
          tooltip="Smart question regeneration, requirement revalidation, and AI chat queries"
        />
      </div>

      {/* Credits Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 mb-8">
        {/* Validation Credits */}
        {(() => {
          const vc = validationCredits?.current || 0;
          const isLow = vc > 0 && vc < 5;
          const isZero = vc === 0;
          const borderColor = isZero ? 'border-red-300' : isLow ? 'border-amber-300' : 'border-[#dbeafe]';
          const bgGlow = isZero ? 'shadow-red-100' : isLow ? 'shadow-amber-100' : 'shadow-soft';
          return (
            <Card className={`border ${borderColor} bg-white p-4 ${bgGlow} transition-all duration-500 relative overflow-hidden`}>
              {/* Decorative gradient strip */}
              <div className={`absolute top-0 left-0 right-0 h-1 ${isZero ? 'bg-gradient-to-r from-red-400 to-red-500' : isLow ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-gradient-to-r from-blue-400 to-blue-500'}`} />
              
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[10px] uppercase tracking-wider font-sans text-[#64748b] font-semibold">
                  Validation Credits
                </h3>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isZero ? 'bg-red-50' : isLow ? 'bg-amber-50' : 'bg-blue-50'}`}>
                  <FileText className={`w-3.5 h-3.5 ${isZero ? 'text-red-500' : isLow ? 'text-amber-500' : 'text-[#3b82f6]'}`} />
                </div>
              </div>

              <div className="mb-3">
                <div className="flex justify-between items-baseline">
                  <span className={`font-sans text-3xl font-bold ${isZero ? 'text-red-500' : isLow ? 'text-amber-600' : 'text-[#1e293b]'} ${(isZero || isLow) ? 'animate-pulse' : ''}`}>
                    {vc}
                  </span>
                  <span className={`text-[10px] uppercase font-semibold tracking-wide ${isZero ? 'text-red-400' : isLow ? 'text-amber-500' : 'text-[#94a3b8]'}`}>
                    {isZero ? 'depleted' : isLow ? 'running low' : 'available'}
                  </span>
                </div>
                <div className="mt-2 h-1.5 bg-[#f1f5f9] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${isZero ? 'bg-red-400' : isLow ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-gradient-to-r from-blue-400 to-blue-500'}`}
                    style={{ width: `${Math.min(100, (vc / Math.max(vc, 100)) * 100) || 0}%` }}
                  />
                </div>
              </div>

              {/* Low credits warning */}
              {isLow && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-2">
                  <div className="w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-[8px] font-bold">!</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-amber-800">Credits running low</p>
                    <p className="text-[9px] text-amber-600">
                      Only {vc} credit{vc !== 1 ? 's' : ''} remaining.{' '}
                      <a href="/dashboard?view=settings" className="text-amber-700 font-bold underline underline-offset-2 hover:text-amber-900 transition-colors">
                        Purchase more →
                      </a>
                    </p>
                  </div>
                </div>
              )}

              {/* Zero credits warning */}
              {isZero && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-start gap-2">
                  <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5 animate-pulse">
                    <span className="text-white text-[8px] font-bold">✕</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-red-800">No credits available</p>
                    <p className="text-[9px] text-red-600">
                      Validation features are disabled.{' '}
                      <a href="/dashboard?view=settings" className="text-red-700 font-bold underline underline-offset-2 hover:text-red-900 transition-colors">
                        Purchase credits →
                      </a>
                    </p>
                  </div>
                </div>
              )}

              {/* Normal state footer */}
              {!isLow && !isZero && (
                <div className="flex justify-between items-center text-[9px] text-[#94a3b8]">
                  <span>{validationCredits?.percentageText || '0 credits available'}</span>
                  <span className="uppercase font-medium">Credits</span>
                </div>
              )}
            </Card>
          );
        })()}

      </div>

      {/* Validation History */}
      <Card className="p-6 bg-white border border-[#dbeafe] shadow-soft">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[#1e293b] flex items-center gap-2">
            <span>Validation History</span>
            <span className="text-sm font-normal text-[#64748b]">({activeValidations.length})</span>
          </h3>
        </div>

        <div className="space-y-3">
          {activeValidations.length > 0 ? (
            paginatedValidations.map((validation) => {
              // Calculate progress percentage
              const progress = Math.min(100, Math.round(validation.validation_progress || 0));

              // Determine which stages are complete based on extract_status and validation_status
              const extractStatus = validation.extract_status || 'Pending';
              const validationStatus = validation.validation_status || 'Pending';

              // Detect failed state
              const isFailed = extractStatus === 'Failed' || validationStatus.toLowerCase() === 'failed';
              const isRetrying = retryingIds.has(validation.id);

              // Detect stuck state (in-progress for >30 min with no progress)
              const isStuck = (() => {
                if (isFailed || validationStatus === 'Finalised') return false;
                const isProcessing = extractStatus === 'ProcessingInBackground' || extractStatus === 'DocumentProcessing' || validationStatus === 'In Progress';
                if (!isProcessing) return false;
                const lastUpdate = validation.last_updated_at || validation.created_at;
                const minutesSinceUpdate = (Date.now() - new Date(lastUpdate).getTime()) / (1000 * 60);
                return minutesSinceUpdate > 30;
              })();

              // Can this user delete? Admin always; non-admin only their own failed
              const canDelete = isAdmin || (isFailed && validation.user_id === userId);

              // REQ: Requirements stage - complete when extraction has started or completed
              const reqComplete = extractStatus !== 'Pending' && !isFailed;

              // DOC: Document processing - complete when extraction is completed
              const docComplete = !isFailed && (extractStatus === 'Completed' ||
                validationStatus === 'In Progress' ||
                validationStatus === 'Finalised');

              // REV: Under Review - complete when validation has results (completed_count > 0 or progress > 0)
              const revComplete = !isFailed && ((validation.completed_count || 0) > 0 || progress > 0 || validationStatus === 'Finalised');

              // REP: Report - complete only when validation_status is Finalised (report generated)
              const repComplete = !isFailed && validationStatus === 'Finalised';

              // Calculate stage-based progress (25% per stage)
              const stageProgress = isFailed ? 0 : (reqComplete ? 25 : 0) + (docComplete ? 25 : 0) + (revComplete ? 25 : 0) + (repComplete ? 25 : 0);

              // Format date like Results Explorer
              const formatDate = (dateString: string) => {
                const date = new Date(dateString);
                return date.toLocaleString('en-AU', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });
              };

              // Check validation age for expiry status (48 hours)
              const getExpiryStatus = () => {
                const createdDate = new Date(validation.created_at);
                const now = new Date();
                const hoursDiff = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60);
                if (hoursDiff > 48) return 'expired';
                if (hoursDiff > 36) return 'expiring'; // Less than 12 hours left
                return 'active';
              };
              const expiryStatus = getExpiryStatus();

              // Status indicator component with tooltip
              const StatusPill = ({ label, isComplete, isFailed: pillFailed, tooltip }: { label: string; isComplete: boolean; isFailed?: boolean; tooltip: string }) => (
                <div
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full cursor-help ${pillFailed ? 'bg-red-50' : 'bg-[#f1f5f9]'}`}
                  title={tooltip}
                >
                  <div
                    className={`w-2 h-2 rounded-full ${pillFailed ? 'bg-red-500' : isComplete ? 'bg-[#22c55e]' : 'bg-[#cbd5e1]'}`}
                  />
                  <span className={`text-xs font-medium ${pillFailed ? 'text-red-600' : 'text-[#64748b]'}`}>{label}</span>
                </div>
              );

              // Row border color
              const borderColor = isFailed ? 'border-l-red-500' : isStuck ? 'border-l-amber-400' : 'border-l-[#3b82f6]';
              const bgColor = isFailed ? 'bg-red-50/50' : 'bg-white';

              return (
                <div
                  key={validation.id}
                  className={`p-4 border-l-4 ${borderColor} ${bgColor} border border-[#e2e8f0] rounded-lg hover:shadow-md transition-all cursor-pointer`}
                  onClick={() => !isFailed && onValidationClick?.(validation as any)}
                  title={isFailed ? 'This validation has failed. Use Retry or Delete.' : 'Click to view validation results in Results Explorer'}
                >
                  {/* Error Banner */}
                  {isFailed && (
                    <div className="flex items-center gap-3 mb-3 p-2.5 bg-red-100 border border-red-200 rounded-lg">
                      <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-red-800">Validation Failed</p>
                        {validation.last_error && (
                          <p className="text-xs text-red-600 truncate mt-0.5" title={validation.last_error}>{validation.last_error}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2.5 text-xs bg-white border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800"
                          onClick={(e) => handleRetryValidation(e, validation)}
                          disabled={isRetrying}
                          title="Reset and re-trigger this validation"
                        >
                          <RotateCcw className={`w-3.5 h-3.5 mr-1 ${isRetrying ? 'animate-spin' : ''}`} />
                          {isRetrying ? 'Retrying...' : 'Retry'}
                        </Button>
                        {canDelete && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2.5 text-xs bg-white border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800"
                            onClick={(e) => handleDeleteValidation(e, validation.id, validation)}
                            title="Delete this failed validation"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1" />
                            Delete
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Stuck Warning Banner */}
                  {isStuck && !isFailed && (
                    <div className="flex items-center gap-3 mb-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <p className="text-xs text-amber-800 flex-1">
                        <strong>Possible stall detected</strong> — This validation has not progressed for over 30 minutes.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2.5 text-xs bg-white border-amber-300 text-amber-700 hover:bg-amber-50"
                        onClick={(e) => handleRetryValidation(e, validation)}
                        disabled={isRetrying}
                        title="Reset and re-trigger this validation"
                      >
                        <RotateCcw className={`w-3.5 h-3.5 mr-1 ${isRetrying ? 'animate-spin' : ''}`} />
                        {isRetrying ? 'Retrying...' : 'Retry'}
                      </Button>
                    </div>
                  )}

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    {/* Left side: Unit Code, Type, Date - fixed width */}
                    <div className="flex flex-wrap items-center gap-2 md:gap-4 md:min-w-[480px]">
                      <div className="flex items-center gap-2">
                        <span className="text-xs md:text-sm text-[#64748b]">Unit:</span>
                        <span className={`font-bold text-base md:text-lg ${isFailed ? 'text-red-800' : 'text-[#1e293b]'}`}>{validation.unit_code || 'N/A'}</span>
                      </div>
                      <div className="hidden md:block h-6 w-px bg-[#e2e8f0]" />
                      <div className="flex items-center gap-2">
                        <span className="text-xs md:text-sm text-[#64748b]">Type:</span>
                        <span className="text-xs md:text-sm font-medium text-[#1e293b] capitalize">{validation.validation_type || 'Unit'}</span>
                      </div>
                      <div className="hidden md:block h-6 w-px bg-[#e2e8f0]" />
                      <div className="flex items-center gap-2">
                        <span className="text-xs md:text-sm text-[#64748b]">Date:</span>
                        <span className="text-xs md:text-sm font-medium text-[#1e293b]">{formatDate(validation.created_at)}</span>
                        {isFailed && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">Failed</span>
                        )}
                        {!isFailed && expiryStatus === 'expired' && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full" title="Validation expired (>48 hours). AI features disabled.">Expired</span>
                        )}
                        {!isFailed && expiryStatus === 'expiring' && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full" title="Validation expiring soon (<12 hours remaining)">Expiring</span>
                        )}
                      </div>

                    </div>

                    {/* Progress Bar - fixed width for alignment */}
                    <div className="w-[180px] hidden md:block flex-shrink-0">
                      <div className={`h-2 rounded-full overflow-hidden ${isFailed ? 'bg-red-200' : 'bg-[#e2e8f0]'}`}>
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${isFailed ? 'bg-red-500' : 'bg-[#3b82f6]'}`}
                          style={{ width: `${isFailed ? 100 : stageProgress}%` }}
                        />
                      </div>
                    </div>

                    {/* Right side: Status Indicators */}
                    <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                      <StatusPill
                        label="REQ"
                        isComplete={reqComplete}
                        isFailed={isFailed}
                        tooltip={isFailed ? 'Requirements: Failed' : reqComplete ? 'Requirements: Extraction started' : 'Requirements: Waiting to start'}
                      />
                      <StatusPill
                        label="DOC"
                        isComplete={docComplete}
                        isFailed={isFailed}
                        tooltip={isFailed ? 'Documents: Failed' : docComplete ? 'Documents: Processing complete' : 'Documents: Processing in progress'}
                      />
                      <StatusPill
                        label="REV"
                        isComplete={revComplete}
                        isFailed={isFailed}
                        tooltip={isFailed ? 'Review: Failed' : revComplete ? 'Review: Validation results available' : 'Review: Validation in progress'}
                      />
                      <StatusPill
                        label="REP"
                        isComplete={repComplete}
                        isFailed={isFailed}
                        tooltip={isFailed ? 'Report: Failed' : repComplete ? 'Report: Generated and finalised' : 'Report: Not yet generated'}
                      />
                      {/* Action buttons for non-failed rows */}
                      {!isFailed && canDelete && (
                        <div className="ml-2 border-l border-gray-200 pl-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 w-7 p-0"
                            onClick={(e) => handleDeleteValidation(e, validation.id, validation)}
                            title="Delete Validation"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-[#64748b]">
              No validation history for this RTO
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-6 border-t border-[#dbeafe]">
            <div className="text-sm text-[#64748b]">
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, activeValidations.length)} of {activeValidations.length} validations
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-[#64748b]">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
