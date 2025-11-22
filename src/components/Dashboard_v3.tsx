/**
 * Dashboard Component - Phase 3.4
 * Enhanced with virtual scrolling, toast notifications, and performance optimizations
 */

import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { KPIWidget } from './KPIWidget';
import { Card } from './ui/card';
import { Progress } from './ui/progress';
import { ValidationStatusIndicator } from './ValidationStatusIndicator';
import { ValidationProgressTracker } from './ValidationProgressTracker';
import { supabase } from '../lib/supabase';
import { getRTOById, fetchRTOById } from '../types/rto';
import { getValidationStage } from '../types/validation';
import { useDashboardMetrics, useValidationCredits, useAICredits } from '../hooks/useDashboardMetrics';
import {
  Activity,
  FileText,
  TrendingUp,
  Zap,
  Info
} from 'lucide-react';
import type { ValidationRecord } from '../types/rto';

interface Dashboard_v3Props {
  onValidationDoubleClick?: (validation: ValidationRecord) => void;
  selectedRTOId: string;
  creditsRefreshTrigger?: number;
}

export function Dashboard_v3({
  onValidationDoubleClick,
  selectedRTOId,
  creditsRefreshTrigger = 0,
}: Dashboard_v3Props) {
  const [rtoCode, setRtoCode] = useState<string | null>(null);
  const [validations, setValidations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Use hooks for metrics and credits
  const { metrics } = useDashboardMetrics(selectedRTOId, rtoCode);
  const { credits: validationCredits } = useValidationCredits(selectedRTOId, creditsRefreshTrigger);
  const { credits: aiCredits } = useAICredits(selectedRTOId, creditsRefreshTrigger);

  // Get RTO code from ID
  useEffect(() => {
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
  }, [selectedRTOId]);

  // Fetch validations
  useEffect(() => {
    const fetchValidations = async () => {
      if (!rtoCode) return;

      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('validation_detail')
          .select(`
            *,
            validation_summary!inner(rtoCode, unitCode),
            validation_type(validation_type)
          `)
          .eq('validation_summary.rtoCode', rtoCode)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const formatted = data?.map(v => ({
          id: v.id,
          unit_code: v.validation_summary?.unitCode || 'N/A',
          qualification_code: v.validation_summary?.qualificationCode || null,
          validation_type: v.validation_type?.validation_type || 'Unknown',
          extractStatus: v.extractStatus || 'pending',
          docExtracted: v.docExtracted || false,
          req_extracted: v.reqExtracted || false,
          num_of_req: v.numOfReq || 0,
          req_total: v.reqTotal || 0,
          completed_count: v.completedCount || 0,
          created_at: v.created_at,
          error_message: v.error_message,
          // Keep old names for compatibility
          extract_status: v.extractStatus || 'pending',
          doc_extracted: v.docExtracted || false,
        })) || [];

        setValidations(formatted);
      } catch (error) {
        console.error('[Dashboard_v3] Error fetching validations:', error);
        toast.error('Failed to load validations');
      } finally {
        setIsLoading(false);
      }
    };

    fetchValidations();

    // Set up real-time subscription
    const channel = supabase
      .channel('validation_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'validation_detail',
        },
        () => {
          fetchValidations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [rtoCode, creditsRefreshTrigger]);

  // Calculate local metrics (for internal use)
  const localMetrics = useMemo(() => {
    const total = validations.length;
    const completed = validations.filter(v => 
      v.extractStatus === 'Completed' || 
      (v.req_total > 0 && v.completed_count === v.req_total)
    ).length;
    const inProgress = validations.filter(v => 
      v.extractStatus === 'ProcessingInBackground' || 
      v.extractStatus === 'DocumentProcessing'
    ).length;
    const failed = validations.filter(v => v.extractStatus === 'Failed').length;

    return {
      total,
      completed,
      inProgress,
      failed,
      completionRate: total > 0 ? (completed / total) * 100 : 0,
    };
  }, [validations]);

  // Filter active validations
  const activeValidations = validations.filter(v => 
    v.extractStatus === 'ProcessingInBackground' ||
    v.extractStatus === 'DocumentProcessing' ||
    v.extractStatus === 'Uploading'
  );

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

  if (isLoading) {
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
          value={metrics?.aiQueries?.count?.toLocaleString() || '0'}
          subtitle={metrics?.aiQueries?.period || 'This month'}
          icon={Zap}
          variant="blue"
          tooltip="Total AI operations (document indexing + validation queries) this month vs all time"
        />
      </div>

      {/* Progress Bars Section */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Validation Credits */}
        <Card className="border border-[#dbeafe] bg-white p-6 shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <h3 className="uppercase tracking-wide font-poppins text-[#64748b]">
              Validation Credits
            </h3>
            <FileText className={`w-5 h-5 ${(validationCredits?.current || 0) > 0 ? 'text-[#3b82f6]' : 'text-[#ef4444]'}`} />
          </div>

          <div className="mb-4">
            <div className="flex justify-between items-baseline mb-2">
              <span className={`font-poppins text-3xl ${(validationCredits?.current || 0) > 0 ? 'text-[#1e293b]' : 'text-[#ef4444]'}`}>
                {validationCredits?.current || 0}
              </span>
              <span className="text-sm text-[#64748b]">/ {validationCredits?.total || 0}</span>
            </div>
            <Progress
              value={validationCredits?.total ? (validationCredits.current / validationCredits.total) * 100 : 0}
              className="h-3"
            />
          </div>

          <div className="flex justify-between items-center text-xs text-[#94a3b8]">
            <span>
              {validationCredits?.percentageText || '0% available'}
            </span>
            <span className="uppercase">Credits</span>
          </div>
        </Card>

        {/* AI Credits */}
        <Card className="border border-[#dbeafe] bg-white p-6 shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <h3 className="uppercase tracking-wide font-poppins text-[#64748b]">
              AI Credits
            </h3>
            <Zap className={`w-5 h-5 ${(aiCredits?.current || 0) > 0 ? 'text-[#3b82f6]' : 'text-[#ef4444]'}`} />
          </div>

          <div className="mb-4">
            <div className="flex justify-between items-baseline mb-2">
              <span className={`font-poppins text-3xl ${(aiCredits?.current || 0) > 0 ? 'text-[#1e293b]' : 'text-[#ef4444]'}`}>
                {aiCredits?.current || 0}
              </span>
              <span className="text-sm text-[#64748b]">/ {aiCredits?.total || 0}</span>
            </div>
            <Progress
              value={aiCredits?.total ? (aiCredits.current / aiCredits.total) * 100 : 0}
              className="h-3"
            />
          </div>

          <div className="flex justify-between items-center text-xs text-[#94a3b8]">
            <span>
              {aiCredits?.percentageText || '0% available'}
            </span>
            <span className="uppercase">Credits</span>
          </div>
        </Card>
      </div>

      {/* Active Validations */}
      <Card className="p-6 bg-white border border-[#dbeafe] shadow-soft">
        <h3 className="text-lg font-semibold text-[#1e293b] mb-4 flex items-center gap-2">
          <span>Active Validations</span>
          <span className="text-sm font-normal text-[#64748b]">({activeValidations.length})</span>
        </h3>

        {/* Processing Information Banner */}
        {activeValidations.some(v => v.extractStatus === 'ProcessingInBackground' || v.extractStatus === 'DocumentProcessing') && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900 flex items-center gap-2">
              <Info className="w-4 h-4 flex-shrink-0" />
              <span>Validations are being processed in the background. Progress updates automatically every 5 seconds.</span>
            </p>
          </div>
        )}

        <div className="space-y-4">
          {activeValidations.length > 0 ? (
            paginatedValidations.map((validation) => {
              const stage = getValidationStage(
                validation.extractStatus,
                validation.docExtracted,
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
                          (validation.extractStatus === 'ProcessingInBackground' || validation.extractStatus === 'DocumentProcessing')
                            ? 'bg-blue-100 text-blue-800'
                            : validation.extractStatus === 'Uploading'
                            ? 'bg-yellow-100 text-yellow-800'
                            : validation.extractStatus === 'Failed'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {validation.extractStatus === 'DocumentProcessing'
                            ? 'Stage 2: Document Processing'
                            : validation.extractStatus === 'ProcessingInBackground'
                            ? 'Stage 3: Validations'
                            : validation.extractStatus === 'Uploading'
                            ? 'Uploading'
                            : validation.extractStatus || 'Pending'}
                        </span>
                      </p>
                      <p className="text-xs text-[#94a3b8]">
                        Created: {formatValidationDate(validation.created_at)}
                      </p>
                      {validation.extractStatus === 'Failed' && validation.error_message && (
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
                  {(validation.extractStatus === 'DocumentProcessing' || 
                    validation.extractStatus === 'ProcessingInBackground' ||
                    validation.extractStatus === 'Uploading') && (
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
                        {validation.extractStatus === 'DocumentProcessing'
                          ? 'Document Processing'
                          : 'Validations Progress'
                        }
                      </span>
                      <span>
                        {validation.extractStatus === 'DocumentProcessing'
                          ? 'AI Learning...'
                          : `${validation.completed_count || 0} / ${validation.req_total || 0}`
                        }
                      </span>
                    </div>
                    <Progress
                      value={validation.extractStatus === 'DocumentProcessing' ? 0 : progress}
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
