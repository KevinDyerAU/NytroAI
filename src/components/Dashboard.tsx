import React, { useState, useEffect } from 'react';
import { KPIWidget } from './KPIWidget';
import { Card } from './ui/card';
import { StatusBadge } from './StatusBadge';
import { ValidationStatusIndicator } from './ValidationStatusIndicator';
import { ValidationProgressTracker } from './ValidationProgressTracker';
import {
  Activity,
  FileText,
  TrendingUp,
  Target,
  Zap,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Info
} from 'lucide-react';
import { Progress } from './ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { PieChart, Pie, Cell, Legend, ResponsiveContainer, Tooltip } from 'recharts';

import { mockValidations, getValidationTypeLabel, formatValidationDate, getValidationStage } from '../types/validation';
import { fetchRTOsFromSupabase, fetchRTOById, getRTOById, getRTOByCode, getCachedRTOs, getValidationCountByRTO, getValidationCredits, getAICredits, getActiveValidationsByRTO, type RTO, type ValidationRecord } from '../types/rto';
import { useDashboardMetrics, useValidationCredits, useAICredits } from '../hooks/useDashboardMetrics';
import { supabase } from '../lib/supabase';
import { validationWorkflowService } from '../services/ValidationWorkflowService';
import { toast } from 'sonner';

interface DashboardProps {
  onValidationDoubleClick?: (validation: ValidationRecord) => void;
  selectedRTOId: string;
  creditsRefreshTrigger?: number;
  showValidationSuccess?: boolean;
  onValidationSuccessClose?: () => void;
}

export function Dashboard({ onValidationDoubleClick, selectedRTOId, creditsRefreshTrigger = 0, showValidationSuccess = false, onValidationSuccessClose }: DashboardProps) {
  const [activeValidations, setActiveValidations] = useState<ValidationRecord[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [rtosLoaded, setRtosLoaded] = useState(false);
  const itemsPerPage = 20;

  // Get RTO code from ID for API calls
  const currentRTO = getRTOById(selectedRTOId);
  const rtoCode = currentRTO?.code || null;

  // Use new hooks for metrics and credits
  const { metrics } = useDashboardMetrics(selectedRTOId, rtoCode);
  const { credits: validationCredits } = useValidationCredits(selectedRTOId, creditsRefreshTrigger);
  const { credits: aiCredits } = useAICredits(selectedRTOId, creditsRefreshTrigger);

  useEffect(() => {
    // Load RTOs cache on mount for RTO lookup
    const loadRTOs = async () => {
      console.log('[Dashboard] Checking RTO cache...');
      const cached = getCachedRTOs();
      console.log('[Dashboard] Cached RTOs count:', cached.length);

      if (cached.length === 0) {
        console.log('[Dashboard] Cache empty, fetching RTOs from Supabase...');
        const fetched = await fetchRTOsFromSupabase();
        console.log('[Dashboard] Fetched RTOs count:', fetched.length);
      }

      setRtosLoaded(true);
      console.log('[Dashboard] RTOs loaded and ready');
    };
    loadRTOs();
  }, []);


  useEffect(() => {
    const loadActiveValidations = async () => {
      if (!selectedRTOId) return;

      // selectedRTOId is the RTO ID (integer as string)
      // First try to get from cache, then fetch from DB if needed
      let rtoCode: string | null = null;

      const cachedRTO = getRTOById(selectedRTOId);
      if (cachedRTO?.code) {
        rtoCode = cachedRTO.code;
      } else {
        // Fetch RTO directly from database
        const rtoData = await fetchRTOById(selectedRTOId);
        if (rtoData?.code) {
          rtoCode = rtoData.code;
        }
      }

      if (!rtoCode) {
        console.warn('Could not find RTO code for ID:', selectedRTOId);
        return;
      }

      const validations = await getActiveValidationsByRTO(rtoCode);
      setActiveValidations(validations);
    };

    loadActiveValidations();

    // Set up real-time subscription for validation status updates
    const subscription = supabase
      .channel('validation_detail_changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all changes (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'validation_detail',
        },
        (payload: any) => {
          console.log('[Dashboard] Validation detail changed:', payload);
          // Reload validations when any change occurs
          loadActiveValidations();
        }
      )
      .subscribe();

    // Also set up polling as a fallback every 5 seconds for active validations
    const interval = setInterval(loadActiveValidations, 5000);

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, [selectedRTOId]);

  // Reset to page 1 when validations change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeValidations]);

  const [selectedValidation, setSelectedValidation] = useState<string | null>(null);

  // Calculate pagination
  const totalPages = Math.ceil(activeValidations.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedValidations = activeValidations.slice(startIndex, endIndex);

  const handleProgressClick = (validationId: string) => {
    setSelectedValidation(validationId);
  };

  const selectedValidationData = activeValidations.find(v => v.id.toString() === selectedValidation);
  
  const getPieChartData = () => {
    if (!selectedValidationData) return [];
    const validated = selectedValidationData.num_of_req || 0;
    const total = selectedValidationData.req_total || 0;
    const pending = total - validated;
    
    return [
      { name: 'Validated Requirements', value: validated, color: '#22c55e' },
      { name: 'Pending Requirements', value: pending, color: '#e2e8f0' }
    ];
  };


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
          value={metrics?.totalValidations.count.toString() || '0'}
          subtitle={metrics?.totalValidations.monthlyGrowth || '+0 this month'}
          icon={FileText}
          variant="blue"
          tooltip="Total number of validation records created for this RTO across all time"
        />

        <KPIWidget
          title="Success Rate"
          value={`${metrics?.successRate.rate || 0}%`}
          subtitle={metrics?.successRate.changeText || '↑ 0% from last month'}
          icon={TrendingUp}
          variant="green"
          tooltip="Percentage of requirements marked as 'met' across all completed validations"
        />

        <KPIWidget
          title="Active Units"
          value={metrics?.activeUnits.count.toString() || '0'}
          subtitle={metrics?.activeUnits.status || 'Currently processing'}
          icon={Activity}
          variant="grey"
          tooltip="Number of validation units not yet in Report stage (pending, processing, or validating)"
        />

        <KPIWidget
          title="AI Queries"
          value={metrics?.aiQueries.count.toLocaleString() || '0'}
          subtitle={metrics?.aiQueries.period || 'This month'}
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
            <FileText className={`w-5 h-5 ${validationCredits.current > 0 ? 'text-[#3b82f6]' : 'text-[#ef4444]'}`} />
          </div>

          <div className="mb-4">
            <div className="flex justify-between items-baseline mb-2">
              <span className={`font-poppins ${validationCredits.current > 0 ? 'text-[#1e293b]' : 'text-[#ef4444]'}`}>
                {validationCredits.current}
              </span>
              <span className="text-sm text-[#64748b]">/ {validationCredits.total}</span>
            </div>
            <Progress
              value={(validationCredits.current / validationCredits.total) * 100}
              className="h-3"
            />
          </div>

          <div className="flex justify-between items-center text-xs text-[#94a3b8]">
            <span>
              {validationCredits.percentageText}
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
            <Zap className={`w-5 h-5 ${aiCredits.current > 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`} />
          </div>

          <div className="mb-4">
            <div className="flex justify-between items-baseline mb-2">
              <span className={`font-poppins ${aiCredits.current > 0 ? 'text-[#1e293b]' : 'text-[#ef4444]'}`}>
                {aiCredits.current}
              </span>
              <span className="text-sm text-[#64748b]">/ {aiCredits.total}</span>
            </div>
            <Progress value={(aiCredits.current / aiCredits.total) * 100} className="h-3" />
          </div>

          <div className="flex justify-between items-center text-xs text-[#94a3b8]">
            <span>
              {aiCredits.percentageText}
            </span>
            <span className="uppercase">Credits</span>
          </div>
        </Card>
      </div>

      {/* Active Validations Feed */}
      <Card className="border border-[#dbeafe] bg-white p-6 shadow-soft">
        <h3 className="mb-6 uppercase tracking-wide font-poppins text-[#64748b] flex items-center gap-2">
          <Target className="w-5 h-5" />
          Active Validations
        </h3>

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
                ? Math.round((validation.completed_count || 0) / validation.req_total * 100)
                : 0;

              return (
                <div
                  key={validation.id}
                  className="bg-[#f8f9fb] border border-[#dbeafe] rounded-lg p-4 hover:shadow-soft transition-all cursor-pointer group"
                  onDoubleClick={() => onValidationDoubleClick?.(validation)}
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

                  <div
                    className="space-y-2 cursor-pointer hover:bg-white/50 rounded p-2 -m-2 transition-colors"
                    onClick={() => handleProgressClick(validation.id.toString())}
                    title="Click to view workflow progress"
                  >
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
            <div className="text-sm text-[#64748b]">
              Showing {startIndex + 1} to {Math.min(endIndex, activeValidations.length)} of {activeValidations.length}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded border border-[#dbeafe] bg-white hover:bg-[#f8f9fb] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4 text-[#64748b]" />
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1 rounded text-sm transition-colors ${
                      currentPage === page
                        ? 'bg-[#3b82f6] text-white'
                        : 'bg-white text-[#64748b] border border-[#dbeafe] hover:bg-[#f8f9fb]'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded border border-[#dbeafe] bg-white hover:bg-[#f8f9fb] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4 text-[#64748b]" />
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Validation Workflow Dialog */}
      <Dialog open={selectedValidation !== null} onOpenChange={() => setSelectedValidation(null)}>
        <DialogContent className="bg-white border border-[#dbeafe] sm:max-w-[480px] p-4">
          <DialogHeader className="pb-2">
            <DialogTitle className="font-poppins text-[#1e293b] text-lg">
              Validation Workflow Process
            </DialogTitle>
            <DialogDescription className="text-xs">
              The validation process follows a 4-stage workflow to ensure comprehensive document analysis and compliance checking.
            </DialogDescription>
          </DialogHeader>
          {selectedValidationData && (
            <div className="space-y-3">
              <div className="bg-[#f8f9fb] rounded p-3 border border-[#dbeafe]">
                <div className="font-poppins text-[#1e293b] text-sm mb-0.5">
                  {selectedValidationData.unit_code}
                </div>
                <p className="text-xs text-[#64748b]">
                  {selectedValidationData.qualification_code}
                </p>
              </div>

              <div className="flex justify-center py-4">
                <ValidationStatusIndicator
                  status={
                    selectedValidationData.extract_status === 'DocumentProcessing' ? 'reqExtracted' :
                    selectedValidationData.extract_status === 'ProcessingInBackground' || selectedValidationData.doc_extracted === true ? 'docExtracted' :
                    selectedValidationData.num_of_req === selectedValidationData.req_total && selectedValidationData.req_total > 0 ? 'validated' :
                    'pending'
                  }
                  progress={
                    selectedValidationData.extract_status === 'DocumentProcessing' ? 0 :
                    selectedValidationData.req_total ? Math.round(((selectedValidationData.num_of_req || 0) / selectedValidationData.req_total) * 100) : 0
                  }
                  size="md"
                  showLabel={true}
                />
              </div>

              {/* Stage-specific content */}
              {selectedValidationData.extract_status === 'Uploading' ? (
                <>
                  {/* Uploading Stage */}
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                    <p className="text-xs uppercase text-yellow-800 font-semibold mb-2">Stage 1: Uploading Documents</p>
                    <p className="text-xs text-yellow-700 mb-3">
                      Your documents are being uploaded to secure storage. This may take a few moments depending on file size.
                    </p>
                    <ValidationProgressTracker
                      validationDetailId={selectedValidationData.id}
                      autoRefresh={true}
                      refreshInterval={2000}
                      onError={async (error) => {
                        console.error('[Dashboard] Upload error:', error);
                        await validationWorkflowService.markValidationError(
                          selectedValidationData.id,
                          error
                        );
                        toast.error(`Upload failed: ${error}`);
                      }}
                    />
                  </div>
                </>
              ) : selectedValidationData.extract_status === 'DocumentProcessing' ? (
                <>
                  {/* Document Processing Stage - Show Gemini Progress */}
                  <div className="bg-blue-50 border border-blue-200 rounded p-3">
                    <p className="text-xs uppercase text-blue-800 font-semibold mb-2">Stage 2: Document Processing</p>
                    <p className="text-xs text-blue-700 mb-3">
                      AI is learning from your PDF documents and creating embeddings for intelligent validation. Small PDFs typically complete in seconds.
                    </p>
                    <ValidationProgressTracker
                      validationDetailId={selectedValidationData.id}
                      autoRefresh={true}
                      refreshInterval={3000}
                      onComplete={async () => {
                        // All documents indexed - auto-trigger validation
                        console.log('[Dashboard] Document processing complete! Auto-triggering validation...');
                        try {
                          // Wait for File Search index to be ready (Google's secondary indexing)
                          console.log('[Dashboard] Waiting 15 seconds for File Search index...');
                          toast.info('Documents indexed! Starting validation in 15 seconds...');
                          await new Promise(resolve => setTimeout(resolve, 15000));
                          
                          await validationWorkflowService.triggerValidation(
                            selectedValidationData.id
                          );
                          
                          console.log('[Dashboard] Validation triggered successfully!');
                          toast.success('Validation started!');
                          
                          // Refresh validations to show new status
                          const { data } = await supabase
                            .from('validation_detail')
                            .select('*, validation_summary(*), validation_type(*)')
                            .eq('id', selectedValidationData.id)
                            .single();
                          
                          if (data) {
                            setActiveValidations(prev => 
                              prev.map(v => v.id === data.id ? data as ValidationRecord : v)
                            );
                          }
                        } catch (error) {
                          console.error('[Dashboard] Error triggering validation:', error);
                          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                          await validationWorkflowService.markValidationError(
                            selectedValidationData.id,
                            errorMessage
                          );
                          toast.error(`Validation failed: ${errorMessage}`);
                        }
                      }}
                      onError={async (error) => {
                        console.error('[Dashboard] Document processing error:', error);
                        await validationWorkflowService.markValidationError(
                          selectedValidationData.id,
                          error
                        );
                        toast.error(`Processing failed: ${error}`);
                      }}
                    />
                  </div>
                </>
              ) : selectedValidationData.extract_status === 'ProcessingInBackground' || (selectedValidationData.doc_extracted && selectedValidationData.num_of_req < selectedValidationData.req_total) ? (
                <>
                  {/* Validations Stage - Show Requirements Progress */}
                  <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-2">
                    <p className="text-xs uppercase text-blue-800 font-semibold mb-1">Stage 3: Validations In Progress</p>
                    <p className="text-xs text-blue-700">
                      AI is validating your documents against training.gov.au requirements. Results appear as each validation completes.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-[#dcfce7] rounded p-2.5 border border-[#86efac]">
                      <p className="text-xs uppercase text-[#166534] font-semibold mb-0.5">Requirements</p>
                      <p className="font-poppins text-lg text-[#166534]">
                        {selectedValidationData.num_of_req || 0} / {selectedValidationData.req_total || 0}
                      </p>
                    </div>
                    <div className="bg-[#f1f5f9] rounded p-2.5 border border-[#cbd5e1]">
                      <p className="text-xs uppercase text-[#475569] font-semibold mb-0.5">Progress</p>
                      <p className="font-poppins text-lg text-[#475569]">
                        {selectedValidationData.req_total ? Math.round(((selectedValidationData.num_of_req || 0) / selectedValidationData.req_total) * 100) : 0}%
                      </p>
                    </div>
                  </div>
                </>
              ) : selectedValidationData.num_of_req === selectedValidationData.req_total && selectedValidationData.req_total > 0 ? (
                <>
                  {/* Completed Stage - Show Final Results */}
                  <div className="bg-green-50 border border-green-200 rounded p-3 mb-2">
                    <p className="text-xs uppercase text-green-800 font-semibold mb-1">Stage 4: Validation Complete</p>
                    <p className="text-xs text-green-700">
                      All requirements have been validated. Reports are ready for review.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-[#dcfce7] rounded p-2.5 border border-[#86efac]">
                      <p className="text-xs uppercase text-[#166534] font-semibold mb-0.5">Requirements</p>
                      <p className="font-poppins text-lg text-[#166534]">
                        {selectedValidationData.num_of_req || 0} / {selectedValidationData.req_total || 0}
                      </p>
                    </div>
                    <div className="bg-[#dbeafe] rounded p-2.5 border border-[#93c5fd]">
                      <p className="text-xs uppercase text-[#1e40af] font-semibold mb-0.5">Status</p>
                      <p className="font-poppins text-lg text-[#1e40af]">
                        Complete ✓
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Pending Stage */}
                  <div className="bg-gray-50 border border-gray-200 rounded p-3">
                    <p className="text-xs uppercase text-gray-800 font-semibold mb-1">Stage 1: Pending</p>
                    <p className="text-xs text-gray-700">
                      Waiting for documents to upload and validation to be triggered.
                    </p>
                  </div>
                </>
              )}

              {/* Current Progress Footer */}
              {selectedValidationData && (
                <div className="bg-blue-50 border border-blue-200 rounded p-3 mt-2">
                  <p className="text-sm text-gray-700">
                    <span className="font-semibold">Current Progress: </span>
                    {selectedValidationData.extract_status === 'Uploading' && (
                      <span>Uploading documents - Upload stage</span>
                    )}
                    {selectedValidationData.extract_status === 'DocumentProcessing' && (
                      <span>Processing documents - Document Processing stage</span>
                    )}
                    {selectedValidationData.extract_status === 'ProcessingInBackground' && selectedValidationData.req_total > 0 && (
                      <span>
                        {Math.round(((selectedValidationData.num_of_req || 0) / selectedValidationData.req_total) * 100)}% complete - 
                        {' '}{selectedValidationData.num_of_req || 0} of {selectedValidationData.req_total} requirements validated
                      </span>
                    )}
                    {selectedValidationData.extract_status === 'Validated' && (
                      <span className="text-green-700 font-semibold">✓ Validation complete - All requirements validated</span>
                    )}
                    {selectedValidationData.extract_status === 'Failed' && (
                      <span className="text-red-700 font-semibold">⚠ Validation failed - {selectedValidationData.error_message || 'Unknown error'}</span>
                    )}
                    {!['Uploading', 'DocumentProcessing', 'ProcessingInBackground', 'Validated', 'Failed'].includes(selectedValidationData.extract_status || '') && (
                      <span>Waiting to start - Pending stage</span>
                    )}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Validation Success Dialog */}
      <Dialog open={showValidationSuccess} onOpenChange={(open: boolean) => {
        if (!open && onValidationSuccessClose) {
          onValidationSuccessClose();
        }
      }}>
        <DialogContent className="bg-white sm:max-w-lg border-0 shadow-2xl">
          <DialogHeader className="space-y-0">
            {/* Success Icon with animated background */}
            <div className="flex items-center justify-center mb-6 pt-2">
              <div className="relative">
                {/* Animated ring background */}
                <div className="absolute inset-0 bg-green-100 rounded-full animate-ping opacity-75"></div>
                {/* Static background */}
                <div className="relative bg-gradient-to-br from-green-400 to-green-600 rounded-full p-4">
                  <CheckCircle className="w-12 h-12 text-white" strokeWidth={2.5} />
                </div>
              </div>
            </div>
            
            {/* Title */}
            <DialogTitle className="text-center text-2xl font-bold text-gray-900 mb-3">
              Documents Submitted Successfully!
            </DialogTitle>
            
            {/* Description */}
            <DialogDescription className="text-center text-base text-gray-600 leading-relaxed px-2">
              Your documents have been submitted for processing. This may take a while depending on the size of your documents.
              <br />
              <span className="inline-block mt-2 font-semibold text-gray-700">
                Processing results will appear on the dashboard shortly.
              </span>
            </DialogDescription>
          </DialogHeader>
          
          {/* Action Button */}
          <div className="mt-8 mb-2">
            <button
              onClick={() => {
                if (onValidationSuccessClose) {
                  onValidationSuccessClose();
                }
              }}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-3.5 rounded-lg transition-all duration-200 font-semibold text-base shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Got it
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
