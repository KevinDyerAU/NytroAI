import React, { useState, useEffect, useCallback } from 'react';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { GlowButton } from './GlowButton';
import { Target, Search, ExternalLink, RefreshCw, Eye, X, RotateCcw, AlertTriangle, CheckCircle2, Clock, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import {
  AlertDialog,
  AlertDialogContent,
} from "./ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from './ui/tooltip';
import { RequirementCompleteness, AcquisitionStatusBadge } from './RequirementCompleteness';
import { useAcquisitionQueue } from '../hooks/useAcquisitionQueue';

// Import wizard logo
import wizardLogo from '../assets/wizard-logo.png';

interface UnitAcquisitionProps {
  selectedRTOId: string;
}

interface UnitOfCompetency {
  id: number;
  unitCode: string;
  Title?: string;
  created_at?: string;
  link?: string;
  // Completeness flags
  has_knowledge_evidence: boolean;
  has_performance_evidence: boolean;
  has_foundation_skills: boolean;
  has_elements_performance_criteria: boolean;
  has_assessment_conditions: boolean;
  acquisition_status: string;
  last_acquisition_error?: string;
  last_acquired_at?: string;
}

type AlertType = 'success' | 'error' | 'warning' | 'info';

interface AlertState {
  show: boolean;
  type: AlertType;
  title: string;
  message: string;
}

export function UnitAcquisition({ selectedRTOId }: UnitAcquisitionProps) {
  const [unitCode, setUnitCode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [alert, setAlert] = useState<AlertState>({ show: false, type: 'success', title: '', message: '' });
  const [existingUnits, setExistingUnits] = useState<UnitOfCompetency[]>([]);
  const [isLoadingUnits, setIsLoadingUnits] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  // Progress modal state
  const [showAcquisitionModal, setShowAcquisitionModal] = useState(false);
  const [acquisitionStep, setAcquisitionStep] = useState('');

  // Unit details dialog state
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [detailUnit, setDetailUnit] = useState<UnitOfCompetency | null>(null);
  const [activeTab, setActiveTab] = useState('ke');
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [keReqs, setKeReqs] = useState<any[]>([]);
  const [peReqs, setPeReqs] = useState<any[]>([]);
  const [fsReqs, setFsReqs] = useState<any[]>([]);
  const [epcReqs, setEpcReqs] = useState<any[]>([]);
  const [acReqs, setAcReqs] = useState<any[]>([]);

  // Queue hook for resilient acquisition
  const {
    queueItems,
    enqueueUnit,
    retryUnit,
    cancelUnit,
    getQueueItemForUnit,
  } = useAcquisitionQueue();

  const extractUnitCode = (input: string): string => {
    const match = input.match(/(?:\/details\/)?([A-Z0-9]+)(?:\/unitdetails)?$/i);
    return match ? match[1].toUpperCase() : '';
  };

  const buildWebhookUrl = (code: string): string => {
    if (!code.trim()) return '';
    return `https://training.gov.au/training/details/${code.trim()}/unitdetails`;
  };

  // Show alert helper
  const showAlert = useCallback((type: AlertType, title: string, message: string, autoDismiss = true) => {
    setAlert({ show: true, type, title, message });
    if (autoDismiss) {
      setTimeout(() => setAlert(prev => ({ ...prev, show: false })), 8000);
    }
  }, []);

  // Fetch existing units with completeness flags
  const fetchExistingUnits = useCallback(async () => {
    setIsLoadingUnits(true);
    try {
      const { data, error } = await supabase
        .from('UnitOfCompetency')
        .select('id, unitCode, Title, created_at, Link, has_knowledge_evidence, has_performance_evidence, has_foundation_skills, has_elements_performance_criteria, has_assessment_conditions, acquisition_status, last_acquisition_error, last_acquired_at')
        .order('unitCode', { ascending: true });

      if (error) {
        console.error('[UnitAcquisition] Fetch error:', error);
        return;
      }

      const formattedUnits = (data || []).map((unit: any) => ({
        id: unit.id,
        unitCode: unit.unitCode,
        Title: unit.Title,
        created_at: unit.created_at,
        link: unit.Link,
        has_knowledge_evidence: unit.has_knowledge_evidence || false,
        has_performance_evidence: unit.has_performance_evidence || false,
        has_foundation_skills: unit.has_foundation_skills || false,
        has_elements_performance_criteria: unit.has_elements_performance_criteria || false,
        has_assessment_conditions: unit.has_assessment_conditions || false,
        acquisition_status: unit.acquisition_status || 'pending',
        last_acquisition_error: unit.last_acquisition_error,
        last_acquired_at: unit.last_acquired_at,
      }));
      setExistingUnits(formattedUnits);
    } catch (error) {
      console.error('Failed to fetch units (exception):', error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoadingUnits(false);
    }
  }, []);

  useEffect(() => {
    fetchExistingUnits();
  }, [fetchExistingUnits]);

  // Subscribe to UnitOfCompetency changes for live flag updates
  useEffect(() => {
    const channel = supabase
      .channel('unit_completeness_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'UnitOfCompetency',
        },
        () => {
          // Refresh units when completeness flags change
          fetchExistingUnits();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchExistingUnits]);

  const isValidUnitCode = (code: string): boolean => {
    return code.trim().length > 0;
  };

  const handleUnitCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    const extracted = extractUnitCode(input);
    setUnitCode(extracted || input);
  };

  const unitCodeExists = existingUnits.some(
    unit => unit.unitCode.toUpperCase() === unitCode.toUpperCase()
  );

  const unitInQueue = unitCode.trim() ? getQueueItemForUnit(unitCode) : undefined;
  const isUnitQueued = unitInQueue && ['queued', 'in_progress', 'retry'].includes(unitInQueue.status);

  const isCodeValid = isValidUnitCode(unitCode);

  const filteredUnits = unitCode.trim()
    ? existingUnits.filter(unit =>
      unit.unitCode.toUpperCase().includes(unitCode.toUpperCase())
    )
    : existingUnits;

  // Pagination calculations
  const totalPages = Math.ceil(filteredUnits.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedUnits = filteredUnits.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [unitCode]);

  // Open unit details dialog and fetch requirements
  const openUnitDetails = async (unit: UnitOfCompetency) => {
    setDetailUnit(unit);
    setShowDetailsDialog(true);
    setActiveTab('ke');
    setIsLoadingDetails(true);

    setKeReqs([]);
    setPeReqs([]);
    setFsReqs([]);
    setEpcReqs([]);
    setAcReqs([]);

    try {
      const unitLink = unit.link || '';

      const [keResult, peResult, fsResult, epcResult, acResult] = await Promise.all([
        supabase.from('knowledge_evidence_requirements').select('*').eq('unit_url', unitLink),
        supabase.from('performance_evidence_requirements').select('*').eq('unit_url', unitLink),
        supabase.from('foundation_skills_requirements').select('*').eq('unit_url', unitLink),
        supabase.from('elements_performance_criteria_requirements').select('*').eq('unit_url', unitLink),
        supabase.from('assessment_conditions_requirements').select('*').eq('unit_url', unitLink),
      ]);

      setKeReqs(keResult.data || []);
      setPeReqs(peResult.data || []);
      setFsReqs(fsResult.data || []);
      setEpcReqs(epcResult.data || []);
      setAcReqs(acResult.data || []);
    } catch (error) {
      console.error('Failed to load unit requirements:', error);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  /**
   * New queue-based acquisition handler.
   * Instead of blocking the UI while scraping, we insert into the queue
   * and also fire the n8n webhook. The queue provides resilience if the
   * immediate request fails.
   */
  const handleAcquire = async () => {
    if (!isCodeValid || unitCodeExists || isUnitQueued) return;

    setIsScanning(true);
    setShowAcquisitionModal(true);
    setAcquisitionStep('Adding to acquisition queue...');

    try {
      // Step 1: Add to the queue table (this is the source of truth)
      const queueItem = await enqueueUnit(unitCode);

      if (!queueItem) {
        throw new Error('Failed to add unit to acquisition queue');
      }

      setAcquisitionStep('Queued successfully. Attempting immediate extraction...');
      await new Promise(resolve => setTimeout(resolve, 500));

      // Step 2: Attempt immediate extraction via n8n (best-effort)
      const n8nUrl = import.meta.env.VITE_N8N_WEB_SCRAPE_URL;

      if (n8nUrl) {
        setAcquisitionStep('Connecting to training.gov.au via n8n...');

        try {
          const originUrl = buildWebhookUrl(unitCode);
          const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scrape-training-gov-au`;

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

          const response = await fetch(n8nUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              originUrl,
              webhookUrl,
              executionMode: 'production',
              queueId: queueItem.id, // Pass queue ID for status updates
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            console.warn('[UnitAcquisition] n8n request failed:', response.status, errorText);

            // Update queue with error but don't throw — the queue retry mechanism will handle it
            await supabase
              .from('unit_acquisition_queue')
              .update({
                status: 'retry',
                last_error: `training.gov.au returned ${response.status}: ${errorText.substring(0, 200)}`,
                error_history: [
                  ...(queueItem.error_history || []),
                  {
                    timestamp: new Date().toISOString(),
                    error: `HTTP ${response.status}: ${errorText.substring(0, 200)}`,
                    retry_count: 0,
                  },
                ],
                next_retry_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // Retry in 5 min
              })
              .eq('id', queueItem.id);

            setShowAcquisitionModal(false);
            showAlert(
              'warning',
              'Queued for Retry',
              `Unit ${unitCode} has been queued but the initial extraction failed (training.gov.au may be experiencing issues). The system will automatically retry. You can also manually retry from the queue panel below.`
            );

            await fetchExistingUnits();
            return;
          }

          // Immediate success
          setAcquisitionStep('Processing requirements...');
          await new Promise(resolve => setTimeout(resolve, 500));

          setShowAcquisitionModal(false);
          showAlert(
            'success',
            'Extraction Initiated',
            `Unit ${unitCode} extraction request sent successfully. Requirements will be processed and saved. The completeness indicators will update in real-time as each section is captured.`
          );

          // Refresh units after a short delay to allow DB writes
          setTimeout(() => fetchExistingUnits(), 3000);
          setTimeout(() => fetchExistingUnits(), 8000);

        } catch (fetchError) {
          // Network error or timeout — the queue will handle retries
          const isTimeout = fetchError instanceof DOMException && fetchError.name === 'AbortError';
          const errorMsg = isTimeout
            ? 'Request timed out (training.gov.au may be down)'
            : (fetchError instanceof Error ? fetchError.message : 'Network error');

          console.warn('[UnitAcquisition] Immediate extraction failed:', errorMsg);

          await supabase
            .from('unit_acquisition_queue')
            .update({
              status: 'retry',
              last_error: errorMsg,
              error_history: [
                ...(queueItem.error_history || []),
                {
                  timestamp: new Date().toISOString(),
                  error: errorMsg,
                  retry_count: 0,
                },
              ],
              next_retry_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
            })
            .eq('id', queueItem.id);

          setShowAcquisitionModal(false);
          showAlert(
            'warning',
            'Queued — Immediate Extraction Failed',
            isTimeout
              ? `training.gov.au appears to be experiencing an outage. Unit ${unitCode} has been queued and will be automatically retried when the service recovers.`
              : `Could not reach training.gov.au right now. Unit ${unitCode} has been queued and will be automatically retried.`
          );
        }
      } else {
        // No n8n URL configured — just queue it
        setShowAcquisitionModal(false);
        showAlert(
          'info',
          'Queued for Processing',
          `Unit ${unitCode} has been added to the acquisition queue. It will be processed by the background worker.`
        );
      }

      await fetchExistingUnits();
      setTimeout(() => setUnitCode(''), 2000);

    } catch (error) {
      console.error('Error in acquisition:', error);
      setShowAcquisitionModal(false);
      showAlert(
        'error',
        'Acquisition Failed',
        `Failed to queue unit ${unitCode}: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`
      );
    } finally {
      setIsScanning(false);
    }
  };

  // Handle retry from the queue
  const handleRetry = async (queueId: number, unitCodeToRetry: string) => {
    const success = await retryUnit(queueId);
    if (success) {
      showAlert('info', 'Retry Queued', `Unit ${unitCodeToRetry} has been re-queued for extraction.`);

      // Also attempt immediate extraction
      const n8nUrl = import.meta.env.VITE_N8N_WEB_SCRAPE_URL;
      if (n8nUrl) {
        try {
          const originUrl = buildWebhookUrl(unitCodeToRetry);
          const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scrape-training-gov-au`;
          fetch(n8nUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              originUrl,
              webhookUrl,
              executionMode: 'production',
              queueId,
            }),
          }).catch(() => {
            // Silently fail — queue retry will handle it
          });
        } catch {
          // Silently fail
        }
      }
    } else {
      showAlert('error', 'Retry Failed', `Could not re-queue unit ${unitCodeToRetry}. Please try again.`);
    }
  };

  // Handle cancel from the queue
  const handleCancel = async (queueId: number, unitCodeToCancel: string) => {
    const success = await cancelUnit(queueId);
    if (success) {
      showAlert('info', 'Cancelled', `Unit ${unitCodeToCancel} has been removed from the queue.`);
    }
  };

  // Count active queue items
  const activeQueueCount = queueItems.filter(
    item => ['queued', 'in_progress', 'retry'].includes(item.status)
  ).length;

  const failedQueueCount = queueItems.filter(
    item => item.status === 'failed'
  ).length;

  // Alert styling
  const alertStyles: Record<AlertType, { bg: string; border: string; iconColor: string; titleColor: string; textColor: string; icon: React.ReactNode }> = {
    success: {
      bg: 'bg-[#dcfce7]', border: 'border-[#86efac]', iconColor: 'text-[#16a34a]',
      titleColor: 'text-[#166534]', textColor: 'text-[#15803d]',
      icon: <CheckCircle2 className="h-5 w-5 text-[#16a34a]" />,
    },
    error: {
      bg: 'bg-[#fee2e2]', border: 'border-[#fca5a5]', iconColor: 'text-[#dc2626]',
      titleColor: 'text-[#991b1b]', textColor: 'text-[#b91c1c]',
      icon: <X className="h-5 w-5 text-[#dc2626]" />,
    },
    warning: {
      bg: 'bg-[#fef3c7]', border: 'border-[#fcd34d]', iconColor: 'text-[#d97706]',
      titleColor: 'text-[#92400e]', textColor: 'text-[#a16207]',
      icon: <AlertTriangle className="h-5 w-5 text-[#d97706]" />,
    },
    info: {
      bg: 'bg-[#dbeafe]', border: 'border-[#93c5fd]', iconColor: 'text-[#2563eb]',
      titleColor: 'text-[#1e40af]', textColor: 'text-[#1d4ed8]',
      icon: <Clock className="h-5 w-5 text-[#2563eb]" />,
    },
  };

  return (
    <div className="min-h-screen bg-[#f8f9fb] p-4 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-poppins text-[#1e293b] mb-2">
          Unit Acquisition
        </h1>
        <p className="text-[#64748b]">Extract Units of Competency from training.gov.au</p>
      </div>

      {/* Targeting System */}
      <Card className="border border-[#dbeafe] bg-white p-4 md:p-8 shadow-soft mb-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-lg bg-[#dbeafe] border border-[#3b82f6] flex items-center justify-center">
            <Target className="w-6 h-6 text-[#3b82f6]" />
          </div>
          <div>
            <h2 className="font-poppins text-[#1e293b]">Extract Unit Requirements</h2>
            <p className="text-sm text-[#64748b]">Enter training.gov.au URL to extract requirements</p>
          </div>
        </div>

        <div className="relative">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Input
                value={unitCode}
                onChange={handleUnitCodeChange}
                placeholder="Unit Code (e.g., TLIF0025)"
                className="h-14 bg-white border-2 border-[#dbeafe] focus:border-[#3b82f6]"
              />
              {isScanning && (
                <div className="absolute inset-0 border-2 border-[#3b82f6] animate-pulse rounded-md"></div>
              )}
            </div>

            <GlowButton
              variant="primary"
              onClick={handleAcquire}
              disabled={isScanning || !isCodeValid || unitCodeExists || !!isUnitQueued}
              className="h-14 px-8"
            >
              {isScanning ? (
                <>
                  <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                  Queuing...
                </>
              ) : (
                <>
                  <Target className="w-5 h-5 mr-2" />
                  Extract Unit
                </>
              )}
            </GlowButton>
          </div>

          {/* Scan Animation */}
          {isScanning && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-[#e2e8f0] rounded-full overflow-hidden">
                  <div className="h-full bg-[#3b82f6] animate-pulse" style={{ width: '60%' }}></div>
                </div>
                <span className="text-xs text-[#64748b]">Adding to queue...</span>
              </div>
            </div>
          )}
        </div>

        {/* Unit Already Exists Message */}
        {unitCodeExists && isCodeValid && (
          <div className="mt-6 p-4 bg-[#fef3c7] border border-[#fcd34d] rounded-lg">
            <p className="text-sm text-[#92400e]">
              <span className="font-semibold">Unit {unitCode} already exists in the system.</span>
              {' '}Check the completeness indicators below to see if all requirement sections have been captured.
            </p>
          </div>
        )}

        {/* Unit Already in Queue Message */}
        {isUnitQueued && isCodeValid && !unitCodeExists && (
          <div className="mt-6 p-4 bg-[#dbeafe] border border-[#93c5fd] rounded-lg">
            <p className="text-sm text-[#1e40af]">
              <span className="font-semibold">Unit {unitCode} is already in the acquisition queue</span>
              {' '}(Status: {unitInQueue?.status}). It will be processed automatically.
            </p>
          </div>
        )}

        {/* Alert */}
        {alert.show && (
          <div className={`mt-6 p-4 ${alertStyles[alert.type].bg} border ${alertStyles[alert.type].border} rounded-lg`}>
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">{alertStyles[alert.type].icon}</div>
              <div className="flex-1">
                <p className={`text-sm font-semibold ${alertStyles[alert.type].titleColor}`}>{alert.title}</p>
                <p className={`text-sm ${alertStyles[alert.type].textColor} mt-1`}>{alert.message}</p>
              </div>
              <button
                onClick={() => setAlert(prev => ({ ...prev, show: false }))}
                className={`flex-shrink-0 ${alertStyles[alert.type].iconColor} hover:opacity-70 transition-opacity`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {/* Info Panel */}
        <div className="mt-6 p-4 bg-[#f8f9fb] border border-[#dbeafe] rounded-lg">
          <p className="text-xs text-[#64748b] leading-relaxed">
            <span className="text-[#3b82f6]">▸</span> Enter the unit code or paste the full training.gov.au URL
            <br />
            <span className="text-[#3b82f6]">▸</span> The unit will be queued for extraction. If training.gov.au is unavailable, the system will automatically retry
            <br />
            <span className="text-[#3b82f6]">▸</span> All 5 requirement sections (KE, PE, FS, EPC, AC) must be captured before validation can proceed
            <br />
            <span className="text-[#3b82f6]">▸</span> Completeness indicators update in real-time as each section is captured
          </p>
        </div>
      </Card>

      {/* Acquisition Queue Panel */}
      {(activeQueueCount > 0 || failedQueueCount > 0) && (
        <Card className="border border-[#fcd34d] bg-white p-6 shadow-soft mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#fef3c7] border border-[#fcd34d] flex items-center justify-center">
                <Clock className="w-5 h-5 text-[#d97706]" />
              </div>
              <div>
                <h2 className="font-poppins text-[#1e293b] text-lg">Acquisition Queue</h2>
                <p className="text-xs text-[#64748b]">
                  {activeQueueCount > 0 && `${activeQueueCount} active`}
                  {activeQueueCount > 0 && failedQueueCount > 0 && ' · '}
                  {failedQueueCount > 0 && <span className="text-[#ef4444]">{failedQueueCount} failed</span>}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {queueItems
              .filter(item => ['queued', 'in_progress', 'retry', 'failed', 'partial_success'].includes(item.status))
              .slice(0, 10)
              .map(item => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-[#e2e8f0] bg-[#f8f9fb] hover:bg-white transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm font-semibold text-[#3b82f6]">{item.unit_code}</span>
                    <AcquisitionStatusBadge status={item.status} lastError={item.last_error} />
                    {item.retry_count > 0 && (
                      <span className="text-xs text-[#94a3b8]">
                        Attempt {item.retry_count + 1}/{item.max_retries}
                      </span>
                    )}
                    {item.next_retry_at && item.status === 'retry' && (
                      <span className="text-xs text-[#94a3b8]">
                        Next retry: {new Date(item.next_retry_at).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {(item.status === 'failed' || item.status === 'partial_success' || item.status === 'retry') && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => handleRetry(item.id, item.unit_code)}
                            className="p-1.5 rounded hover:bg-[#dbeafe] text-[#3b82f6] transition-colors"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Retry now</TooltipContent>
                      </Tooltip>
                    )}
                    {(item.status === 'queued' || item.status === 'failed') && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => handleCancel(item.id, item.unit_code)}
                            className="p-1.5 rounded hover:bg-[#fee2e2] text-[#94a3b8] hover:text-[#ef4444] transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Remove from queue</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </Card>
      )}

      {/* Existing Units Table */}
      <Card className="border border-[#dbeafe] bg-white p-6 shadow-soft">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-poppins text-[#1e293b]">Existing Units</h2>
            {unitCode.trim() && filteredUnits.length > 0 && (
              <p className="text-xs text-[#64748b] mt-1">Showing {filteredUnits.length} result{filteredUnits.length !== 1 ? 's' : ''} for "{unitCode}"</p>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Search units..."
              className="w-64 bg-white border-[#dbeafe]"
            />
            <GlowButton variant="secondary" size="icon">
              <Search className="w-4 h-4" />
            </GlowButton>
          </div>
        </div>

        <div className="border border-[#dbeafe] rounded-lg overflow-hidden">
          {isLoadingUnits ? (
            <div className="p-8 text-center text-[#64748b]">
              <p className="text-sm">Loading units...</p>
            </div>
          ) : unitCode.trim() && filteredUnits.length === 0 ? (
            <div className="p-8 text-center text-[#64748b]">
              <p className="text-sm">No units matching "{unitCode}" found</p>
            </div>
          ) : existingUnits.length === 0 && !unitCode.trim() ? (
            <div className="p-8 text-center text-[#64748b]">
              <p className="text-sm">No units of competency in the system yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-[#dbeafe] bg-[#f8f9fb]">
                  <TableHead className="font-poppins text-[#64748b]">Unit Code</TableHead>
                  <TableHead className="font-poppins text-[#64748b]">Title</TableHead>
                  <TableHead className="font-poppins text-[#64748b]">Requirements</TableHead>
                  <TableHead className="font-poppins text-[#64748b]">Date Captured</TableHead>
                  <TableHead className="font-poppins text-[#64748b]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedUnits.map((unit) => (
                  <TableRow
                    key={unit.id}
                    className="border-[#dbeafe] hover:bg-[#f8f9fb] transition-colors"
                  >
                    <TableCell className="font-mono text-[#3b82f6]">{unit.unitCode}</TableCell>
                    <TableCell className="text-[#1e293b]">{unit.Title || '-'}</TableCell>
                    <TableCell>
                      <RequirementCompleteness
                        flags={{
                          has_knowledge_evidence: unit.has_knowledge_evidence,
                          has_performance_evidence: unit.has_performance_evidence,
                          has_foundation_skills: unit.has_foundation_skills,
                          has_elements_performance_criteria: unit.has_elements_performance_criteria,
                          has_assessment_conditions: unit.has_assessment_conditions,
                        }}
                        compact
                      />
                    </TableCell>
                    <TableCell className="text-sm text-[#64748b]">
                      {unit.created_at ? new Date(unit.created_at).toLocaleDateString('en-AU') : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openUnitDetails(unit)}
                          className="p-2 rounded transition-colors hover:bg-[#dbeafe] text-[#3b82f6] cursor-pointer"
                          title="View extracted requirements"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (unit.link) {
                              window.open(unit.link, '_blank', 'width=1024,height=768');
                            }
                          }}
                          disabled={!unit.link}
                          className={`p-2 rounded transition-colors ${unit.link
                            ? 'hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#3b82f6] cursor-pointer'
                            : 'text-[#cbd5e1] cursor-not-allowed opacity-50'
                            }`}
                          title={unit.link ? 'Open on training.gov.au' : 'No link available'}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Pagination Controls */}
        {filteredUnits.length > ITEMS_PER_PAGE && (
          <div className="flex items-center justify-between mt-4 px-2">
            <div className="text-sm text-[#64748b]">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredUnits.length)} of {filteredUnits.length} units
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className={`px-3 py-1 rounded border transition-colors ${currentPage === 1
                  ? 'border-[#e2e8f0] text-[#cbd5e1] cursor-not-allowed'
                  : 'border-[#dbeafe] text-[#64748b] hover:bg-[#f1f5f9] hover:border-[#3b82f6] hover:text-[#3b82f6]'
                  }`}
              >
                Previous
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                  const showPage =
                    page === 1 ||
                    page === totalPages ||
                    (page >= currentPage - 1 && page <= currentPage + 1);

                  const showEllipsis =
                    (page === 2 && currentPage > 3) ||
                    (page === totalPages - 1 && currentPage < totalPages - 2);

                  if (showEllipsis) {
                    return (
                      <span key={page} className="px-2 text-[#cbd5e1]">
                        ...
                      </span>
                    );
                  }

                  if (!showPage) return null;

                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`min-w-[2rem] px-3 py-1 rounded border transition-colors ${currentPage === page
                        ? 'border-[#3b82f6] bg-[#3b82f6] text-white'
                        : 'border-[#dbeafe] text-[#64748b] hover:bg-[#f1f5f9] hover:border-[#3b82f6] hover:text-[#3b82f6]'
                        }`}
                    >
                      {page}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className={`px-3 py-1 rounded border transition-colors ${currentPage === totalPages
                  ? 'border-[#e2e8f0] text-[#cbd5e1] cursor-not-allowed'
                  : 'border-[#dbeafe] text-[#64748b] hover:bg-[#f1f5f9] hover:border-[#3b82f6] hover:text-[#3b82f6]'
                  }`}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Unit Acquisition Loading Modal */}
      <AlertDialog open={showAcquisitionModal} onOpenChange={setShowAcquisitionModal}>
        <AlertDialogContent className="max-w-md bg-white">
          <div className="flex flex-col items-center justify-center py-8 px-4">
            <div className="mb-6 w-32">
              <img
                src={wizardLogo}
                alt="Nytro Wizard"
                className="w-full h-auto object-contain animate-pulse"
              />
            </div>

            <h3 className="font-poppins text-lg font-semibold text-[#1e293b] mb-3">
              Nytro is extracting...
            </h3>

            <div className="w-full max-w-xs mb-4">
              <div className="h-2 bg-[#e2e8f0] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#22c55e] to-[#3b82f6] animate-pulse"
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 mb-3 px-4 py-2 bg-[#f0fdf4] rounded-lg border border-[#86efac]">
              <Target className="w-4 h-4 text-[#16a34a] animate-spin" style={{ animationDuration: '1.5s' }} />
              <p className="text-sm font-medium text-[#166534]">
                {acquisitionStep || 'Initializing...'}
              </p>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-[#22c55e] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 bg-[#22c55e] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 bg-[#22c55e] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>

            <p className="text-xs text-[#94a3b8] text-center">
              Extracting requirements from training.gov.au for {unitCode}
            </p>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unit Details Dialog */}
      <AlertDialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <AlertDialogContent className="max-w-5xl w-[90vw] h-[85vh] overflow-hidden bg-white p-0 flex flex-col">
          <div className="flex flex-col h-full min-h-0">
            {/* Header */}
            <div className="flex flex-none items-start justify-between p-6 border-b border-[#e2e8f0]">
              <div>
                <h3 className="font-poppins text-xl font-bold text-[#1e293b]">
                  {detailUnit?.unitCode} - {detailUnit?.Title || 'Unit Details'}
                </h3>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="px-2 py-0.5 rounded bg-[#dbeafe] text-[#1e40af] text-xs font-medium">
                    KE: {keReqs.length}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#dcfce7] text-[#166534] text-xs font-medium">
                    PE: {peReqs.length}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#fef3c7] text-[#92400e] text-xs font-medium">
                    FS: {fsReqs.length}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#e0e7ff] text-[#4338ca] text-xs font-medium">
                    EPC: {epcReqs.length}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#fce7f3] text-[#be185d] text-xs font-medium">
                    AC: {acReqs.length}
                  </span>
                </div>
                {/* Completeness indicator in detail dialog */}
                {detailUnit && (
                  <div className="mt-3">
                    <RequirementCompleteness
                      flags={{
                        has_knowledge_evidence: detailUnit.has_knowledge_evidence,
                        has_performance_evidence: detailUnit.has_performance_evidence,
                        has_foundation_skills: detailUnit.has_foundation_skills,
                        has_elements_performance_criteria: detailUnit.has_elements_performance_criteria,
                        has_assessment_conditions: detailUnit.has_assessment_conditions,
                      }}
                    />
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowDetailsDialog(false)}
                className="p-2 rounded-lg hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#1e293b] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs Content */}
            <div className="flex-1 overflow-hidden flex flex-col min-h-0 p-6">
              {isLoadingDetails ? (
                <div className="flex items-center justify-center h-48">
                  <div className="text-center">
                    <RefreshCw className="w-8 h-8 text-[#3b82f6] animate-spin mx-auto mb-3" />
                    <p className="text-[#64748b]">Loading requirements...</p>
                  </div>
                </div>
              ) : (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                  <TabsList className="grid grid-cols-5 mb-4">
                    <TabsTrigger value="ke" className="text-xs">
                      Knowledge ({keReqs.length})
                    </TabsTrigger>
                    <TabsTrigger value="pe" className="text-xs">
                      Performance ({peReqs.length})
                    </TabsTrigger>
                    <TabsTrigger value="fs" className="text-xs">
                      Foundation ({fsReqs.length})
                    </TabsTrigger>
                    <TabsTrigger value="epc" className="text-xs">
                      Elements ({epcReqs.length})
                    </TabsTrigger>
                    <TabsTrigger value="ac" className="text-xs">
                      Conditions ({acReqs.length})
                    </TabsTrigger>
                  </TabsList>

                  <div className="flex-1 overflow-auto">
                    {/* Knowledge Evidence Tab */}
                    <TabsContent value="ke" className="mt-0 h-full">
                      {keReqs.length === 0 ? (
                        <div className="text-center py-8 text-[#64748b]">
                          <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-[#f59e0b]" />
                          <p className="font-medium">No knowledge evidence requirements captured</p>
                          <p className="text-sm mt-1">This section may need to be re-acquired from training.gov.au</p>
                        </div>
                      ) : (
                        <div className="border border-[#e2e8f0] rounded-lg overflow-hidden">
                          <table className="w-full">
                            <thead className="bg-[#f8f9fb]">
                              <tr className="border-b border-[#e2e8f0]">
                                <th className="text-left py-3 px-4 text-[#1e293b] font-semibold w-24">KE #</th>
                                <th className="text-left py-3 px-4 text-[#1e293b] font-semibold">Knowledge Point</th>
                              </tr>
                            </thead>
                            <tbody>
                              {keReqs.map((req: any) => (
                                <tr key={req.id} className="border-b border-[#e2e8f0] hover:bg-[#f8f9fb]">
                                  <td className="py-3 px-4 font-mono text-[#3b82f6] font-semibold">{req.ke_number}</td>
                                  <td className="py-3 px-4 text-[#1e293b]">{req.knowled_point}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </TabsContent>

                    {/* Performance Evidence Tab */}
                    <TabsContent value="pe" className="mt-0 h-full">
                      {peReqs.length === 0 ? (
                        <div className="text-center py-8 text-[#64748b]">
                          <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-[#f59e0b]" />
                          <p className="font-medium">No performance evidence requirements captured</p>
                          <p className="text-sm mt-1">This section may need to be re-acquired from training.gov.au</p>
                        </div>
                      ) : (
                        <div className="border border-[#e2e8f0] rounded-lg overflow-hidden">
                          <table className="w-full">
                            <thead className="bg-[#f8f9fb]">
                              <tr className="border-b border-[#e2e8f0]">
                                <th className="text-left py-3 px-4 text-[#1e293b] font-semibold w-24">PE #</th>
                                <th className="text-left py-3 px-4 text-[#1e293b] font-semibold">Performance Evidence</th>
                              </tr>
                            </thead>
                            <tbody>
                              {peReqs.map((req: any) => (
                                <tr key={req.id} className="border-b border-[#e2e8f0] hover:bg-[#f8f9fb]">
                                  <td className="py-3 px-4 font-mono text-[#22c55e] font-semibold">{req.pe_number}</td>
                                  <td className="py-3 px-4 text-[#1e293b]">{req.performance_evidence}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </TabsContent>

                    {/* Foundation Skills Tab */}
                    <TabsContent value="fs" className="mt-0 h-full">
                      {fsReqs.length === 0 ? (
                        <div className="text-center py-8 text-[#64748b]">
                          <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-[#f59e0b]" />
                          <p className="font-medium">No foundation skills requirements captured</p>
                          <p className="text-sm mt-1">This section may need to be re-acquired from training.gov.au</p>
                        </div>
                      ) : (
                        <div className="border border-[#e2e8f0] rounded-lg overflow-hidden">
                          <table className="w-full">
                            <thead className="bg-[#f8f9fb]">
                              <tr className="border-b border-[#e2e8f0]">
                                <th className="text-left py-3 px-4 text-[#1e293b] font-semibold w-24">FS #</th>
                                <th className="text-left py-3 px-4 text-[#1e293b] font-semibold">Skill Point</th>
                              </tr>
                            </thead>
                            <tbody>
                              {fsReqs.map((req: any) => (
                                <tr key={req.id} className="border-b border-[#e2e8f0] hover:bg-[#f8f9fb]">
                                  <td className="py-3 px-4 font-mono text-[#f59e0b] font-semibold">{req.fs_number}</td>
                                  <td className="py-3 px-4 text-[#1e293b]">{req.skill_point}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </TabsContent>

                    {/* Elements & Performance Criteria Tab */}
                    <TabsContent value="epc" className="mt-0 h-full">
                      {epcReqs.length === 0 ? (
                        <div className="text-center py-8 text-[#64748b]">
                          <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-[#f59e0b]" />
                          <p className="font-medium">No elements & performance criteria captured</p>
                          <p className="text-sm mt-1">This section may need to be re-acquired from training.gov.au</p>
                        </div>
                      ) : (
                        <div className="border border-[#e2e8f0] rounded-lg overflow-hidden">
                          <table className="w-full">
                            <thead className="bg-[#f8f9fb]">
                              <tr className="border-b border-[#e2e8f0]">
                                <th className="text-left py-3 px-4 text-[#1e293b] font-semibold w-24">EPC #</th>
                                <th className="text-left py-3 px-4 text-[#1e293b] font-semibold">Performance Criteria</th>
                              </tr>
                            </thead>
                            <tbody>
                              {epcReqs.map((req: any) => (
                                <tr key={req.id} className="border-b border-[#e2e8f0] hover:bg-[#f8f9fb]">
                                  <td className="py-3 px-4 font-mono text-[#6366f1] font-semibold">{req.epc_number}</td>
                                  <td className="py-3 px-4 text-[#1e293b]">{req.performance_criteria}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </TabsContent>

                    {/* Assessment Conditions Tab */}
                    <TabsContent value="ac" className="mt-0 h-full">
                      {acReqs.length === 0 ? (
                        <div className="text-center py-8 text-[#64748b]">
                          <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-[#f59e0b]" />
                          <p className="font-medium">No assessment conditions captured</p>
                          <p className="text-sm mt-1">This section may need to be re-acquired from training.gov.au</p>
                        </div>
                      ) : (
                        <div className="border border-[#e2e8f0] rounded-lg overflow-hidden">
                          <table className="w-full">
                            <thead className="bg-[#f8f9fb]">
                              <tr className="border-b border-[#e2e8f0]">
                                <th className="text-left py-3 px-4 text-[#1e293b] font-semibold w-24">AC #</th>
                                <th className="text-left py-3 px-4 text-[#1e293b] font-semibold">Condition</th>
                              </tr>
                            </thead>
                            <tbody>
                              {acReqs.map((req: any) => (
                                <tr key={req.id} className="border-b border-[#e2e8f0] hover:bg-[#f8f9fb]">
                                  <td className="py-3 px-4 font-mono text-[#ec4899] font-semibold">{req.ac_number}</td>
                                  <td className="py-3 px-4 text-[#1e293b]">{req.condition_text}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </TabsContent>
                  </div>
                </Tabs>
              )}
            </div>

            {/* Footer */}
            <div className="flex-none border-t border-[#e2e8f0] p-4 flex justify-end gap-3">
              {detailUnit?.link && (
                <button
                  onClick={() => window.open(detailUnit.link, '_blank')}
                  className="px-4 py-2 text-[#3b82f6] border border-[#3b82f6] rounded-lg hover:bg-[#dbeafe] transition-colors flex items-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  View on training.gov.au
                </button>
              )}
              <button
                onClick={() => setShowDetailsDialog(false)}
                className="px-4 py-2 bg-[#1e40af] text-white rounded-lg hover:bg-[#1e3a8a] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
