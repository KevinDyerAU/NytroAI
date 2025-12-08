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
import { ValidationStatusBadge } from './ValidationStatusBadge';
import {
  Activity,
  FileText,
  TrendingUp,
  Zap,
  Info
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


  // Auto-refresh validations every 30 seconds
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshValidations = async (showToast = false) => {
    if (!rtoCode || isRefreshing) return;

    setIsRefreshing(true);
    try {
      const data = await getActiveValidationsByRTO(rtoCode);
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

  // Set up polling every 30 seconds
  useEffect(() => {
    if (!rtoCode) return;

    const interval = setInterval(() => {
      refreshValidations(false);
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [rtoCode]);

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
          subtitle="Smart questions, revalidations & AI chat"
          icon={Zap}
          variant="blue"
          tooltip="Smart question regeneration, requirement revalidation, and AI chat queries"
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
        </div>

        {/* Processing Information Banner - n8n 4-Stage Flow */}
        {activeValidations.some(v => 
          v.extract_status === 'In Progress' || 
          v.extract_status === 'ProcessingInBackground' || 
          v.extract_status === 'DocumentProcessing' ||
          v.validation_status === 'In Progress'
        ) && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900 flex items-center gap-2">
              <Info className="w-4 h-4 flex-shrink-0" />
              <span>
                <strong>Note:</strong> Validations progress through 4 stages: (1) Document Upload → (2) AI Learning → (3) Under Review → (4) Finalised. Processing happens automatically in the background.
              </span>
            </p>
          </div>
        )}

        <div className="space-y-4">
          {/* 
            n8n 4-Stage Status Flow:
            1. Document Upload: extractStatus='Pending', validationStatus='Pending'
            2. AI Learning: extractStatus='In Progress' (files processing by Gemini)
            3. Under Review: extractStatus='Completed', validationStatus='In Progress'
            4. Finalised: validationStatus='Finalised' (results ready)
          */}
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

              // Use validation_progress directly from database, cap at 100
              const progress = Math.min(100, Math.round(validation.validation_progress || 0));

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
                        <ValidationStatusBadge
                          status={{
                            extractStatus: validation.extract_status || 'Pending',
                            validationStatus: validation.validation_status || 'Pending',
                          }}
                          className="text-xs"
                        />
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
                    <div className="flex items-center gap-2">
                      <ValidationStatusIndicator
                        status={statusMap}
                        progress={progress}
                        size="sm"
                        showLabel={true}
                        compact={false}
                        extractStatus={validation.extract_status}
                        validationStatus={validation.validation_status}
                      />
                    </div>
                  </div>

                  {/* Show progress tracker for active validations (Stage 2 & 3) */}
                  {(validation.extract_status === 'In Progress' || 
                    validation.extract_status === 'DocumentProcessing' || 
                    validation.extract_status === 'ProcessingInBackground' ||
                    validation.validation_status === 'In Progress' ||
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
                      <span>Validation Progress</span>
                      <span>
                        {(validation.extract_status === 'In Progress' || 
                          validation.extract_status === 'DocumentProcessing')
                          ? 'Processing...'
                          : `${progress}%`
                        }
                      </span>
                    </div>
                    <Progress
                      value={
                        (validation.extract_status === 'In Progress' || 
                         validation.extract_status === 'DocumentProcessing') 
                          ? 0 
                          : progress
                      }
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
    </div>
  );
}
