/**
 * Dashboard Component - Phase 3.4
 * Enhanced with virtual scrolling, toast notifications, and performance optimizations
 */

import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { KPIWidget } from './KPIWidget';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { ValidationStatusIndicator } from './ValidationStatusIndicator';
import { ValidationProgressTracker } from './ValidationProgressTracker';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { supabase } from '../lib/supabase';
import { getRTOById, fetchRTOById, getActiveValidationsByRTO } from '../types/rto';
import { getValidationStage } from '../types/validation';
import { useDashboardMetrics, useValidationCredits, useAICredits } from '../hooks/useDashboardMetrics';
import {
  Activity,
  FileText,
  TrendingUp,
  Zap,
  Info,
  RefreshCw,
  Loader2
} from 'lucide-react';
import type { ValidationRecord } from '../types/rto';

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
  onValidationDoubleClick?: (validation: ValidationRecord) => void;
  selectedRTOId: string;
  selectedRTOCode?: string | null;
  creditsRefreshTrigger?: number;
}

export function Dashboard_v3({
  onValidationDoubleClick,
  selectedRTOId,
  selectedRTOCode = null,
  creditsRefreshTrigger = 0,
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
  
  // Status modal state
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [validationStatuses, setValidationStatuses] = useState<ValidationStatus[]>([]);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);

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

  // Use hooks for metrics and credits
  const { metrics } = useDashboardMetrics(selectedRTOId, rtoCode);
  const { credits: validationCredits } = useValidationCredits(selectedRTOId, creditsRefreshTrigger);
  const { credits: aiCredits } = useAICredits(selectedRTOId, creditsRefreshTrigger);

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

  // Fetch validations using the same method as original Dashboard
  useEffect(() => {
    const loadActiveValidations = async (isInitial = false) => {
      if (!rtoCode) return;

      // Only show loading spinner on true initial load (first visit ever)
      if (isInitial && isInitialLoad) {
        setIsLoading(true);
      }

      try {
        const data = await getActiveValidationsByRTO(rtoCode);
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
    const subscription = supabase.channel('validation_detail_changes').on('postgres_changes', {event: '*', schema: 'public', table: 'validation_detail'}, () => loadActiveValidations(false)).subscribe();

    // Poll every 5 seconds as a fallback (real-time subscription handles most updates)
    const interval = setInterval(() => loadActiveValidations(false), 5000);

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, [rtoCode, creditsRefreshTrigger, isInitialLoad]);

  // Calculate local metrics (for internal use)
  const localMetrics = useMemo(() => {
    const total = validations.length;
    const completed = validations.filter(v => 
      v.extract_status === 'Completed' || 
      (v.req_total > 0 && v.completed_count === v.req_total)
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

  // Load validation status
  const loadValidationStatus = async () => {
    setIsLoadingStatus(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-validation-status');

      console.log('[Dashboard] Status response:', { data, error });

      if (error) {
        console.error('[Dashboard] Error loading status:', error);
        toast.error('Failed to load validation status');
        return;
      }

      // The edge function returns {status: [...], total: N}
      const statusData = data?.status || [];

      console.log('[Dashboard] Parsed status data:', statusData);
      setValidationStatuses(statusData);
      setShowStatusModal(true);
    } catch (err) {
      console.error('[Dashboard] Exception loading status:', err);
      toast.error('Failed to load validation status');
    } finally {
      setIsLoadingStatus(false);
    }
  };

  // Refresh validations
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const refreshValidations = async () => {
    if (!selectedRTOId || isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      const data = await getActiveValidationsByRTO(selectedRTOId);
      setValidations(data || []);
      toast.success('Validations refreshed');
    } catch (error) {
      console.error('[Dashboard] Error refreshing validations:', error);
      toast.error('Failed to refresh validations');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Show ALL validations (not just actively processing ones)
  const activeValidations = validations;

  // Pagination
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
    <div className="min-h-screen bg-[#f8f9fb] p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-poppins text-[#1e293b] mb-2">
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
          title="Active Units"
          value={metrics?.activeUnits?.count?.toString() || '0'}
          subtitle={metrics?.activeUnits?.status || 'Currently processing'}
          icon={Activity}
          variant="grey"
          tooltip="Number of validation units not yet in Report stage (pending, processing, or validating)"
        />

        <KPIWidget
          title="AI Queries"
          value={metrics?.aiQueries?.period || '0 this month / 0 all time'}
          subtitle="AI operations (indexing + validation)"
          icon={Zap}
          variant="blue"
          tooltip="Total AI operations (document indexing + validation queries) this month vs all time"
        />
      </div>

      {/* Progress Bars Section */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Validation Credits */}
        <Card className="border border-[#dbeafe] bg-white p-3 shadow-soft">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-[10px] uppercase tracking-wide font-poppins text-[#64748b]">
              Validation Credits
            </h3>
            <FileText className={`w-3 h-3 ${(validationCredits?.current || 0) > 0 ? 'text-[#3b82f6]' : 'text-[#ef4444]'}`} />
          </div>

          <div className="mb-1">
            <div className="flex justify-between items-baseline">
              <span className={`font-poppins text-lg ${(validationCredits?.current || 0) > 0 ? 'text-[#1e293b]' : 'text-[#ef4444]'}`}>
                {validationCredits?.current || 0}
              </span>
              <span className="text-[10px] text-[#64748b]">/ {validationCredits?.total || 0}</span>
            </div>
            <Progress
              value={validationCredits?.total ? (validationCredits.current / validationCredits.total) * 100 : 0}
              className="h-1"
            />
          </div>

          <div className="flex justify-between items-center text-[8px] text-[#94a3b8]">
            <span>
              {validationCredits?.percentageText || '0% available'}
            </span>
            <span className="uppercase">Credits</span>
          </div>
        </Card>

        {/* AI Credits */}
        <Card className="border border-[#dbeafe] bg-white p-3 shadow-soft">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-[10px] uppercase tracking-wide font-poppins text-[#64748b]">
              AI Credits
            </h3>
            <Zap className={`w-3 h-3 ${(aiCredits?.current || 0) > 0 ? 'text-[#3b82f6]' : 'text-[#ef4444]'}`} />
          </div>

          <div className="mb-1">
            <div className="flex justify-between items-baseline">
              <span className={`font-poppins text-lg ${(aiCredits?.current || 0) > 0 ? 'text-[#1e293b]' : 'text-[#ef4444]'}`}>
                {aiCredits?.current || 0}
              </span>
              <span className="text-[10px] text-[#64748b]">/ {aiCredits?.total || 0}</span>
            </div>
            <Progress
              value={aiCredits?.total ? (aiCredits.current / aiCredits.total) * 100 : 0}
              className="h-1"
            />
          </div>

          <div className="flex justify-between items-center text-[8px] text-[#94a3b8]">
            <span>
              {aiCredits?.percentageText || '0% available'}
            </span>
            <span className="uppercase">Credits</span>
          </div>
        </Card>
      </div>

      {/* Active Validations */}
      <Card className="p-6 bg-white border border-[#dbeafe] shadow-soft">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[#1e293b] flex items-center gap-2">
            <span>Active Validations</span>
            <span className="text-sm font-normal text-[#64748b]">({activeValidations.length})</span>
          </h3>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshValidations}
              disabled={isRefreshing}
              className="flex items-center gap-2"
            >
              {isRefreshing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={loadValidationStatus}
              disabled={isLoadingStatus}
              className="flex items-center gap-2"
            >
              {isLoadingStatus ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Activity className="w-4 h-4" />
              )}
              Check Status
            </Button>
          </div>
        </div>

        {/* Processing Information Banner */}
        {activeValidations.some(v => v.extract_status === 'ProcessingInBackground' || v.extract_status === 'DocumentProcessing') && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900 flex items-center gap-2">
              <Info className="w-4 h-4 flex-shrink-0" />
              <span>
                <strong>Note:</strong> Some validations are being processed by AI. Small PDFs typically complete Stage 2 (Document Processing) in seconds and automatically advance to Stage 3 (Validations). No action needed.
              </span>
            </p>
          </div>
        )}

        <div className="space-y-4">
          {activeValidations.length > 0 ? (
            paginatedValidations.map((validation) => {
              const stage = getValidationStage(
                validation.extract_status,
                validation.doc_extracted,
                validation.req_extracted,
                validation.num_of_req,
                validation.req_total
              );

              const statusMap: 'pending' | 'reqExtracted' | 'docExtracted' | 'validated' =
                stage === 'pending' ? 'pending' :
                stage === 'requirements' ? 'reqExtracted' :
                stage === 'documents' ? 'docExtracted' :
                'validated';

              const progress = validation.req_total
                ? Math.round((validation.completed_count / validation.req_total) * 100)
                : 0;

              return (
                <div
                  key={validation.id}
                  className="p-4 border border-[#dbeafe] rounded-lg hover:border-[#93c5fd] hover:shadow-md transition-all cursor-pointer"
                  onDoubleClick={() => onValidationDoubleClick?.(validation as any)}
                  title="Double-click to view validation results in Results Explorer"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="font-poppins text-[#1e293b]">
                          {validation.unit_code || 'N/A'}{validation.validation_type ? ` • ${validation.validation_type}` : ''}
                        </div>
                      </div>
                      <p className="text-sm text-[#64748b] mb-1 flex items-center gap-2">
                        <span>Status:</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          (validation.extract_status === 'ProcessingInBackground' || validation.extract_status === 'DocumentProcessing')
                            ? 'bg-blue-100 text-blue-800'
                            : validation.extract_status === 'Uploading'
                            ? 'bg-yellow-100 text-yellow-800'
                            : validation.extract_status === 'Failed'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {validation.extract_status === 'DocumentProcessing'
                            ? 'Stage 2: Document Processing'
                            : validation.extract_status === 'ProcessingInBackground'
                            ? 'Stage 3: Validations'
                            : validation.extract_status === 'Uploading'
                            ? 'Uploading'
                            : validation.extract_status || 'Pending'}
                        </span>
                      </p>
                      <p className="text-xs text-[#94a3b8]">
                        Created: {formatValidationDate(validation.created_at)}
                      </p>
                      {validation.extract_status === 'Failed' && validation.error_message && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                          <p className="text-xs text-red-800 flex items-center gap-1">
                            <span className="font-semibold">Error:</span>
                            <span>{validation.error_message}</span>
                          </p>
                        </div>
                      )}
                    </div>
                    <ValidationStatusIndicator
                      status={statusMap}
                      progress={progress}
                      size="sm"
                      showLabel={true}
                      compact={false}
                    />
                  </div>

                  {/* Show progress tracker for all active validations */}
                  {(validation.extract_status === 'DocumentProcessing' || 
                    validation.extract_status === 'ProcessingInBackground' ||
                    validation.extract_status === 'Uploading') && (
                    <div className="mt-3">
                      <ValidationProgressTracker
                        validationDetailId={validation.id}
                        autoRefresh={true}
                        refreshInterval={5000}
                        showValidationProgress={true}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-[#64748b]">
                      <span>
                        {validation.extract_status === 'DocumentProcessing'
                          ? 'Document Processing'
                          : 'Validations Progress'
                        }
                      </span>
                      <span>
                        {validation.extract_status === 'DocumentProcessing'
                          ? 'AI Learning...'
                          : `${validation.completed_count || 0} / ${validation.req_total || 0}`
                        }
                      </span>
                    </div>
                    <Progress
                      value={validation.extract_status === 'DocumentProcessing' ? 0 : progress}
                      className="h-2 bg-[#dbeafe]"
                    />
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-[#64748b]">
              No active validations for this RTO
            </div>
          )}
        </div>

        {activeValidations.length > itemsPerPage && (
          <div className="mt-6 pt-6 border-t border-[#dbeafe] flex items-center justify-between">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 text-sm font-medium text-[#3b82f6] disabled:text-[#cbd5e1] disabled:cursor-not-allowed"
            >
              ← Previous
            </button>
            <span className="text-sm text-[#64748b]">
              Page {currentPage} of {Math.ceil(activeValidations.length / itemsPerPage)}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(Math.ceil(activeValidations.length / itemsPerPage), p + 1))}
              disabled={currentPage >= Math.ceil(activeValidations.length / itemsPerPage)}
              className="px-4 py-2 text-sm font-medium text-[#3b82f6] disabled:text-[#cbd5e1] disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        )}
      </Card>

      {/* Validation Status Modal */}
      <Dialog open={showStatusModal} onOpenChange={setShowStatusModal}>
        <DialogContent className="w-[100vw] max-w-[100vw] h-[75vh] max-h-[75vh] overflow-y-auto bg-white p-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Validation Processing Status (Last 6 Hours)
            </DialogTitle>
          </DialogHeader>
          
          <div className="mt-4">
            {(!validationStatuses || validationStatuses.length === 0) ? (
              <div className="text-center py-8 text-gray-500">
                No recent validation activity in the last 6 hours
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase w-[35%]">File Name</th>
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase w-[12%]">Embedding</th>
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase w-[12%]">Gemini</th>
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase w-[18%]">Progress</th>
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase w-[12%]">Validation</th>
                      <th className="px-2 py-2 text-right text-[10px] font-medium text-gray-500 uppercase w-[11%]">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {validationStatuses.map((status, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-2 py-2 text-xs text-gray-900 truncate max-w-0" title={status.file_name}>
                          {status.file_name}
                        </td>
                        <td className="px-2 py-2">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            status.embedding_status === 'completed' 
                              ? 'bg-green-100 text-green-800'
                              : status.embedding_status === 'processing'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {status.embedding_status}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          {status.gemini_status ? (
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              status.gemini_status === 'completed' 
                                ? 'bg-green-100 text-green-800'
                                : status.gemini_status === 'processing'
                                ? 'bg-yellow-100 text-yellow-800'
                                : status.gemini_status === 'failed'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {status.gemini_status}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          {status.progress_percentage !== null ? (
                            <div className="flex items-center gap-1.5">
                              <div className="flex-1 bg-gray-200 rounded-full h-1.5 min-w-[50px]">
                                <div 
                                  className="bg-blue-600 h-1.5 rounded-full" 
                                  style={{ width: `${status.progress_percentage}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-gray-600 whitespace-nowrap">{status.progress_percentage}%</span>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          {status.extractStatus ? (
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              status.extractStatus === 'Completed' 
                                ? 'bg-green-100 text-green-800'
                                : status.extractStatus === 'Processing'
                                ? 'bg-yellow-100 text-yellow-800'
                                : status.extractStatus === 'Failed'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {status.extractStatus}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-xs text-gray-600 text-right whitespace-nowrap">
                          {status.minutes_ago}m
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
