import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { GlowButton } from './GlowButton';
import {
  Target, Search, ExternalLink, RefreshCw, Eye, X, RotateCcw,
  AlertTriangle, CheckCircle2, Clock, Trash2, ChevronDown, ChevronUp,
  Database, Wifi, WifiOff, ArrowUp, Filter, LayoutGrid, List,
  Loader2, Shield, Info
} from 'lucide-react';
import { supabase } from '../lib/supabase';
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
import { useIsMobile } from './ui/use-mobile';
import wizardLogo from '../assets/wizard-logo.png';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UnitAcquisitionProps {
  selectedRTOId: string;
}

interface UnitOfCompetency {
  id: number;
  unitCode: string;
  Title?: string;
  created_at?: string;
  link?: string;
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

type ViewMode = 'grid' | 'list';

// ─── Constants ────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE_MOBILE = 10;
const ITEMS_PER_PAGE_DESKTOP = 20;

const SECTION_COLORS = {
  ke: { bg: '#dbeafe', text: '#1e40af', accent: '#3b82f6', label: 'KE', full: 'Knowledge Evidence' },
  pe: { bg: '#dcfce7', text: '#166534', accent: '#22c55e', label: 'PE', full: 'Performance Evidence' },
  fs: { bg: '#fef3c7', text: '#92400e', accent: '#f59e0b', label: 'FS', full: 'Foundation Skills' },
  epc: { bg: '#e0e7ff', text: '#4338ca', accent: '#6366f1', label: 'EPC', full: 'Elements & Performance Criteria' },
  ac: { bg: '#fce7f3', text: '#be185d', accent: '#ec4899', label: 'AC', full: 'Assessment Conditions' },
} as const;

const ALERT_STYLES: Record<AlertType, { bg: string; border: string; iconColor: string; titleColor: string; textColor: string }> = {
  success: { bg: 'bg-[#dcfce7]', border: 'border-[#86efac]', iconColor: 'text-[#16a34a]', titleColor: 'text-[#166534]', textColor: 'text-[#15803d]' },
  error: { bg: 'bg-[#fee2e2]', border: 'border-[#fca5a5]', iconColor: 'text-[#dc2626]', titleColor: 'text-[#991b1b]', textColor: 'text-[#b91c1c]' },
  warning: { bg: 'bg-[#fef3c7]', border: 'border-[#fcd34d]', iconColor: 'text-[#d97706]', titleColor: 'text-[#92400e]', textColor: 'text-[#a16207]' },
  info: { bg: 'bg-[#dbeafe]', border: 'border-[#93c5fd]', iconColor: 'text-[#2563eb]', titleColor: 'text-[#1e40af]', textColor: 'text-[#1d4ed8]' },
};

const ALERT_ICONS: Record<AlertType, React.ReactNode> = {
  success: <CheckCircle2 className="h-5 w-5 text-[#16a34a]" />,
  error: <X className="h-5 w-5 text-[#dc2626]" />,
  warning: <AlertTriangle className="h-5 w-5 text-[#d97706]" />,
  info: <Clock className="h-5 w-5 text-[#2563eb]" />,
};

// ─── Component ────────────────────────────────────────────────────────────────

export function UnitAcquisition({ selectedRTOId }: UnitAcquisitionProps) {
  const isMobile = useIsMobile();

  // Core state
  const [unitCode, setUnitCode] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [alert, setAlert] = useState<AlertState>({ show: false, type: 'success', title: '', message: '' });
  const [existingUnits, setExistingUnits] = useState<UnitOfCompetency[]>([]);
  const [isLoadingUnits, setIsLoadingUnits] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showQueuePanel, setShowQueuePanel] = useState(true);
  const [showBackToTop, setShowBackToTop] = useState(false);

  // Modal state
  const [showAcquisitionModal, setShowAcquisitionModal] = useState(false);
  const [acquisitionStep, setAcquisitionStep] = useState('');

  // Details dialog state
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [detailUnit, setDetailUnit] = useState<UnitOfCompetency | null>(null);
  const [activeTab, setActiveTab] = useState('ke');
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [keReqs, setKeReqs] = useState<any[]>([]);
  const [peReqs, setPeReqs] = useState<any[]>([]);
  const [fsReqs, setFsReqs] = useState<any[]>([]);
  const [epcReqs, setEpcReqs] = useState<any[]>([]);
  const [acReqs, setAcReqs] = useState<any[]>([]);

  // Queue hook
  const {
    queueItems,
    enqueueUnit,
    retryUnit,
    cancelUnit,
    getQueueItemForUnit,
  } = useAcquisitionQueue();

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const extractUnitCode = (input: string): string => {
    const match = input.match(/(?:\/details\/)?([A-Z0-9]+)(?:\/unitdetails)?$/i);
    return match ? match[1].toUpperCase() : '';
  };

  const buildWebhookUrl = (code: string): string => {
    if (!code.trim()) return '';
    return `https://training.gov.au/training/details/${code.trim()}/unitdetails`;
  };

  const showAlert = useCallback((type: AlertType, title: string, message: string, autoDismiss = true) => {
    setAlert({ show: true, type, title, message });
    if (autoDismiss) {
      setTimeout(() => setAlert(prev => ({ ...prev, show: false })), 8000);
    }
  }, []);

  // ─── Data Fetching ────────────────────────────────────────────────────────

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
        has_knowledge_evidence: unit.has_knowledge_evidence ?? false,
        has_performance_evidence: unit.has_performance_evidence ?? false,
        has_foundation_skills: unit.has_foundation_skills ?? false,
        has_elements_performance_criteria: unit.has_elements_performance_criteria ?? false,
        has_assessment_conditions: unit.has_assessment_conditions ?? false,
        acquisition_status: unit.acquisition_status || 'unknown',
        last_acquisition_error: unit.last_acquisition_error,
        last_acquired_at: unit.last_acquired_at,
      }));

      setExistingUnits(formattedUnits);
    } catch (err) {
      console.error('[UnitAcquisition] Exception:', err);
    } finally {
      setIsLoadingUnits(false);
    }
  }, []);

  useEffect(() => {
    fetchExistingUnits();
  }, [fetchExistingUnits]);

  // Realtime subscription for completeness flag updates
  useEffect(() => {
    const channel = supabase
      .channel('unit_completeness_changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'UnitOfCompetency' }, () => {
        fetchExistingUnits();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchExistingUnits]);

  // Back to top scroll listener
  useEffect(() => {
    const handleScroll = () => setShowBackToTop(window.scrollY > 400);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // ─── Derived State ────────────────────────────────────────────────────────

  const isValidUnitCode = (code: string): boolean => code.trim().length > 0;

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

  const filteredUnits = useMemo(() => {
    const query = searchQuery.trim().toUpperCase();
    if (!query) return existingUnits;
    return existingUnits.filter(unit =>
      unit.unitCode.toUpperCase().includes(query) ||
      (unit.Title || '').toUpperCase().includes(query)
    );
  }, [existingUnits, searchQuery]);

  const ITEMS_PER_PAGE = isMobile ? ITEMS_PER_PAGE_MOBILE : ITEMS_PER_PAGE_DESKTOP;
  const totalPages = Math.ceil(filteredUnits.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedUnits = filteredUnits.slice(startIndex, endIndex);

  useEffect(() => { setCurrentPage(1); }, [searchQuery]);

  // Stats
  const stats = useMemo(() => {
    const total = existingUnits.length;
    const complete = existingUnits.filter(u =>
      u.has_knowledge_evidence && u.has_performance_evidence &&
      u.has_foundation_skills && u.has_elements_performance_criteria &&
      u.has_assessment_conditions
    ).length;
    const partial = existingUnits.filter(u =>
      (u.has_knowledge_evidence || u.has_performance_evidence ||
        u.has_foundation_skills || u.has_elements_performance_criteria ||
        u.has_assessment_conditions) &&
      !(u.has_knowledge_evidence && u.has_performance_evidence &&
        u.has_foundation_skills && u.has_elements_performance_criteria &&
        u.has_assessment_conditions)
    ).length;
    const activeQueue = queueItems.filter(i => ['queued', 'in_progress', 'retry'].includes(i.status)).length;
    const failedQueue = queueItems.filter(i => i.status === 'failed').length;
    return { total, complete, partial, activeQueue, failedQueue };
  }, [existingUnits, queueItems]);

  // ─── Details Dialog ───────────────────────────────────────────────────────

  const openUnitDetails = async (unit: UnitOfCompetency) => {
    setDetailUnit(unit);
    setShowDetailsDialog(true);
    setActiveTab('ke');
    setIsLoadingDetails(true);
    setKeReqs([]); setPeReqs([]); setFsReqs([]); setEpcReqs([]); setAcReqs([]);

    try {
      const unitLink = unit.link || '';
      // Fetch from dedicated requirements tables
      const [keResult, peResult, fsResult, epcResult, acResult] = await Promise.all([
        supabase.from('knowledge_evidence_requirements').select('*').eq('unit_url', unitLink),
        supabase.from('performance_evidence_requirements').select('*').eq('unit_url', unitLink),
        supabase.from('foundation_skills_requirements').select('*').eq('unit_url', unitLink),
        supabase.from('elements_performance_criteria_requirements').select('*').eq('unit_url', unitLink),
        supabase.from('assessment_conditions_requirements').select('*').eq('unit_url', unitLink),
      ]);
      setKeReqs(keResult.data || []);
      setPeReqs(peResult.data || []);
      setEpcReqs(epcResult.data || []);

      // For Foundation Skills and Assessment Conditions, fall back to UnitOfCompetency text columns
      // when the dedicated tables are empty (the scraper stores data in UoC columns, not always in the tables)
      if ((fsResult.data || []).length > 0) {
        setFsReqs(fsResult.data || []);
      } else {
        // Fetch the fs text from UnitOfCompetency and parse into displayable rows
        const { data: uocData } = await supabase
          .from('UnitOfCompetency')
          .select('fs')
          .eq('unitCode', unit.unitCode)
          .single();
        if (uocData?.fs) {
          const fsLines = uocData.fs.split(/\n/).filter((l: string) => l.trim().length > 0);
          setFsReqs(fsLines.map((line: string, idx: number) => ({
            id: idx + 1,
            fs_number: `FS.${idx + 1}`,
            skill_point: line.trim(),
            unit_url: unitLink,
          })));
        } else {
          setFsReqs([]);
        }
      }

      if ((acResult.data || []).length > 0) {
        setAcReqs(acResult.data || []);
      } else {
        // Fetch the ac text from UnitOfCompetency and parse into displayable rows
        const { data: uocData } = await supabase
          .from('UnitOfCompetency')
          .select('ac')
          .eq('unitCode', unit.unitCode)
          .single();
        if (uocData?.ac) {
          const acLines = uocData.ac.split(/\n/).filter((l: string) => l.trim().length > 0);
          setAcReqs(acLines.map((line: string, idx: number) => ({
            id: idx + 1,
            ac_number: `AC.${idx + 1}`,
            condition_point: line.trim(),
            unit_url: unitLink,
          })));
        } else {
          setAcReqs([]);
        }
      }
    } catch (error) {
      console.error('Failed to load unit requirements:', error);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // ─── Acquisition Handler ──────────────────────────────────────────────────

  const handleAcquire = async () => {
    if (!isCodeValid || unitCodeExists || isUnitQueued) return;

    setIsScanning(true);
    setShowAcquisitionModal(true);
    setAcquisitionStep('Adding to acquisition queue...');

    try {
      const queueItem = await enqueueUnit(unitCode);
      if (!queueItem) throw new Error('Failed to add unit to acquisition queue');

      setAcquisitionStep('Queued successfully. Attempting immediate extraction...');
      await new Promise(resolve => setTimeout(resolve, 500));

      const n8nUrl = import.meta.env.VITE_N8N_WEB_SCRAPE_URL;
      if (n8nUrl) {
        setAcquisitionStep('Connecting to training.gov.au...');
        try {
          const originUrl = buildWebhookUrl(unitCode);
          const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scrape-training-gov-au`;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);

          const response = await fetch(n8nUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              originUrl, webhookUrl,
              executionMode: 'production',
              queueId: queueItem.id,
            }),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            console.warn('[UnitAcquisition] n8n request failed:', response.status, errorText);

            await supabase.from('unit_acquisition_queue').update({
              status: 'retry',
              last_error: `HTTP ${response.status}: ${errorText.substring(0, 200)}`,
              error_history: [
                ...(queueItem.error_history || []),
                { timestamp: new Date().toISOString(), error: `HTTP ${response.status}`, retry_count: 0 },
              ],
              next_retry_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
            }).eq('id', queueItem.id);

            setShowAcquisitionModal(false);
            showAlert('warning', 'Queued for Retry',
              `Unit ${unitCode} has been queued but the initial extraction failed. The system will automatically retry.`
            );
            await fetchExistingUnits();
            return;
          }

          setAcquisitionStep('Processing requirements...');
          await new Promise(resolve => setTimeout(resolve, 500));
          setShowAcquisitionModal(false);
          showAlert('success', 'Extraction Initiated',
            `Unit ${unitCode} extraction sent successfully. Completeness indicators will update in real-time.`
          );
          setTimeout(() => fetchExistingUnits(), 3000);
          setTimeout(() => fetchExistingUnits(), 8000);
        } catch (fetchError) {
          const isTimeout = fetchError instanceof DOMException && fetchError.name === 'AbortError';
          const errorMsg = isTimeout
            ? 'Request timed out (training.gov.au may be down)'
            : (fetchError instanceof Error ? fetchError.message : 'Network error');

          await supabase.from('unit_acquisition_queue').update({
            status: 'retry',
            last_error: errorMsg,
            error_history: [
              ...(queueItem.error_history || []),
              { timestamp: new Date().toISOString(), error: errorMsg, retry_count: 0 },
            ],
            next_retry_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          }).eq('id', queueItem.id);

          setShowAcquisitionModal(false);
          showAlert('warning', 'Queued — Automatic Retry Scheduled',
            isTimeout
              ? `training.gov.au appears to be experiencing an outage. Unit ${unitCode} has been queued and will be automatically retried.`
              : `Could not reach training.gov.au. Unit ${unitCode} has been queued and will be automatically retried.`
          );
        }
      } else {
        setShowAcquisitionModal(false);
        showAlert('info', 'Queued for Processing',
          `Unit ${unitCode} has been added to the acquisition queue. It will be processed by the background worker.`
        );
      }

      await fetchExistingUnits();
      setTimeout(() => setUnitCode(''), 2000);
    } catch (error) {
      setShowAcquisitionModal(false);
      showAlert('error', 'Acquisition Failed',
        `Failed to queue unit ${unitCode}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsScanning(false);
    }
  };

  const handleRetry = async (queueId: number, unitCodeToRetry: string) => {
    const success = await retryUnit(queueId);
    if (success) {
      showAlert('info', 'Retry Queued', `Unit ${unitCodeToRetry} has been re-queued for extraction.`);
      const n8nUrl = import.meta.env.VITE_N8N_WEB_SCRAPE_URL;
      if (n8nUrl) {
        try {
          fetch(n8nUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              originUrl: buildWebhookUrl(unitCodeToRetry),
              webhookUrl: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scrape-training-gov-au`,
              executionMode: 'production',
              queueId,
            }),
          }).catch(() => {});
        } catch {}
      }
    } else {
      showAlert('error', 'Retry Failed', `Could not re-queue unit ${unitCodeToRetry}.`);
    }
  };

  const handleCancel = async (queueId: number, unitCodeToCancel: string) => {
    const success = await cancelUnit(queueId);
    if (success) {
      showAlert('info', 'Cancelled', `Unit ${unitCodeToCancel} removed from queue.`);
    }
  };

  // ─── Render Helpers ───────────────────────────────────────────────────────

  const getCompletenessPercent = (unit: UnitOfCompetency): number => {
    const flags = [
      unit.has_knowledge_evidence, unit.has_performance_evidence,
      unit.has_foundation_skills, unit.has_elements_performance_criteria,
      unit.has_assessment_conditions,
    ];
    return Math.round((flags.filter(Boolean).length / 5) * 100);
  };

  const getStatusColor = (unit: UnitOfCompetency) => {
    const pct = getCompletenessPercent(unit);
    if (pct === 100) return { bg: 'bg-[#dcfce7]', border: 'border-[#86efac]', text: 'text-[#166534]', bar: 'bg-[#22c55e]' };
    if (pct > 0) return { bg: 'bg-[#fef3c7]', border: 'border-[#fcd34d]', text: 'text-[#92400e]', bar: 'bg-[#f59e0b]' };
    return { bg: 'bg-[#fee2e2]', border: 'border-[#fca5a5]', text: 'text-[#991b1b]', bar: 'bg-[#ef4444]' };
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#f8f9fb] p-3 md:p-6 lg:p-8 relative">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="font-poppins text-xl md:text-2xl text-[#1e293b] font-bold flex items-center gap-2">
              <Database className="w-6 h-6 md:w-7 md:h-7 text-[#3b82f6]" />
              Unit Acquisition
            </h1>
            <p className="text-sm text-[#64748b] mt-1">
              Extract and manage Units of Competency from training.gov.au
            </p>
          </div>
          <div className="flex items-center gap-2">
            {stats.activeQueue > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#dbeafe] text-[#1e40af] text-xs font-medium border border-[#93c5fd] animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" />
                {stats.activeQueue} processing
              </span>
            )}
            {stats.failedQueue > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#fee2e2] text-[#991b1b] text-xs font-medium border border-[#fca5a5]">
                <AlertTriangle className="w-3 h-3" />
                {stats.failedQueue} failed
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Stats Cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        <div className="bg-white rounded-xl border border-[#dbeafe] p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#dbeafe] flex items-center justify-center flex-shrink-0">
              <Database className="w-5 h-5 text-[#3b82f6]" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold text-[#1e293b]">{stats.total}</p>
              <p className="text-xs text-[#64748b] truncate">Total Units</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[#86efac] p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#dcfce7] flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-5 h-5 text-[#22c55e]" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold text-[#166534]">{stats.complete}</p>
              <p className="text-xs text-[#64748b] truncate">Complete</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[#fcd34d] p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#fef3c7] flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-[#f59e0b]" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold text-[#92400e]">{stats.partial}</p>
              <p className="text-xs text-[#64748b] truncate">Partial</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-[#93c5fd] p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#dbeafe] flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5 text-[#3b82f6]" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold text-[#1e40af]">{stats.activeQueue}</p>
              <p className="text-xs text-[#64748b] truncate">In Queue</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Extract Unit Card ──────────────────────────────────────────────── */}
      <Card className="border border-[#dbeafe] bg-white rounded-xl p-4 md:p-6 shadow-sm mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-[#dbeafe] border border-[#3b82f6] flex items-center justify-center flex-shrink-0">
            <Target className="w-5 h-5 text-[#3b82f6]" />
          </div>
          <div>
            <h2 className="font-poppins text-base md:text-lg font-semibold text-[#1e293b]">Extract Unit Requirements</h2>
            <p className="text-xs text-[#64748b]">Enter a unit code or paste a training.gov.au URL</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Input
              value={unitCode}
              onChange={handleUnitCodeChange}
              placeholder="e.g. TLIF0025 or paste URL"
              className="h-12 bg-white border-2 border-[#dbeafe] focus:border-[#3b82f6] text-base rounded-lg"
            />
            {isScanning && (
              <div className="absolute inset-0 border-2 border-[#3b82f6] animate-pulse rounded-lg pointer-events-none" />
            )}
          </div>
          <GlowButton
            variant="primary"
            onClick={handleAcquire}
            disabled={isScanning || !isCodeValid || unitCodeExists || !!isUnitQueued}
            className="h-12 px-6 whitespace-nowrap"
          >
            {isScanning ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Queuing...</>
            ) : (
              <><Target className="w-4 h-4 mr-2" />Extract Unit</>
            )}
          </GlowButton>
        </div>

        {/* Contextual Messages */}
        {unitCodeExists && isCodeValid && (
          <div className="mt-4 p-3 bg-[#fef3c7] border border-[#fcd34d] rounded-lg flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-[#d97706] mt-0.5 flex-shrink-0" />
            <p className="text-sm text-[#92400e]">
              <span className="font-semibold">Unit {unitCode} already exists.</span>
              {' '}Check completeness indicators below.
            </p>
          </div>
        )}

        {isUnitQueued && isCodeValid && !unitCodeExists && (
          <div className="mt-4 p-3 bg-[#dbeafe] border border-[#93c5fd] rounded-lg flex items-start gap-2">
            <Loader2 className="w-4 h-4 text-[#2563eb] mt-0.5 flex-shrink-0 animate-spin" />
            <p className="text-sm text-[#1e40af]">
              <span className="font-semibold">Unit {unitCode} is in the queue</span>
              {' '}(Status: {unitInQueue?.status}). Processing automatically.
            </p>
          </div>
        )}

        {/* Alert Banner */}
        {alert.show && (
          <div className={`mt-4 p-3 ${ALERT_STYLES[alert.type].bg} border ${ALERT_STYLES[alert.type].border} rounded-lg`}>
            <div className="flex items-start gap-2">
              <div className="flex-shrink-0 mt-0.5">{ALERT_ICONS[alert.type]}</div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${ALERT_STYLES[alert.type].titleColor}`}>{alert.title}</p>
                <p className={`text-sm ${ALERT_STYLES[alert.type].textColor} mt-0.5`}>{alert.message}</p>
              </div>
              <button
                onClick={() => setAlert(prev => ({ ...prev, show: false }))}
                className={`flex-shrink-0 ${ALERT_STYLES[alert.type].iconColor} hover:opacity-70 transition-opacity`}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Info Tips */}
        <div className="mt-4 p-3 bg-[#f8f9fb] border border-[#e2e8f0] rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-[#3b82f6] mt-0.5 flex-shrink-0" />
            <div className="text-xs text-[#64748b] space-y-1">
              <p>All 5 requirement sections (KE, PE, FS, EPC, AC) must be captured before validation can proceed.</p>
              <p>If training.gov.au is unavailable, units are queued and retried automatically with exponential backoff.</p>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Acquisition Queue Panel ────────────────────────────────────────── */}
      {(stats.activeQueue > 0 || stats.failedQueue > 0) && (
        <Card className="border border-[#fcd34d] bg-white rounded-xl shadow-sm mb-6 overflow-hidden">
          <button
            onClick={() => setShowQueuePanel(!showQueuePanel)}
            className="w-full flex items-center justify-between p-4 hover:bg-[#fefce8] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#fef3c7] border border-[#fcd34d] flex items-center justify-center">
                <Clock className="w-4 h-4 text-[#d97706]" />
              </div>
              <div className="text-left">
                <h3 className="font-poppins text-sm font-semibold text-[#1e293b]">Acquisition Queue</h3>
                <p className="text-xs text-[#64748b]">
                  {stats.activeQueue > 0 && `${stats.activeQueue} active`}
                  {stats.activeQueue > 0 && stats.failedQueue > 0 && ' · '}
                  {stats.failedQueue > 0 && <span className="text-[#ef4444]">{stats.failedQueue} failed</span>}
                </p>
              </div>
            </div>
            {showQueuePanel ? <ChevronUp className="w-4 h-4 text-[#64748b]" /> : <ChevronDown className="w-4 h-4 text-[#64748b]" />}
          </button>

          {showQueuePanel && (
            <div className="px-4 pb-4 space-y-2">
              {queueItems
                .filter(item => ['queued', 'in_progress', 'retry', 'failed', 'partial_success'].includes(item.status))
                .slice(0, 10)
                .map(item => (
                  <div
                    key={item.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border border-[#e2e8f0] bg-[#f8f9fb] hover:bg-white transition-colors gap-2"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-semibold text-[#3b82f6]">{item.unit_code}</span>
                      <AcquisitionStatusBadge status={item.status} lastError={item.last_error} />
                      {item.retry_count > 0 && (
                        <span className="text-xs text-[#94a3b8]">
                          Attempt {item.retry_count + 1}/{item.max_retries}
                        </span>
                      )}
                      {item.next_retry_at && item.status === 'retry' && (
                        <span className="text-xs text-[#94a3b8]">
                          Next: {new Date(item.next_retry_at).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 self-end sm:self-auto">
                      {(item.status === 'failed' || item.status === 'partial_success' || item.status === 'retry') && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => handleRetry(item.id, item.unit_code)}
                              className="p-2 rounded-lg hover:bg-[#dbeafe] text-[#3b82f6] transition-colors"
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
                              className="p-2 rounded-lg hover:bg-[#fee2e2] text-[#94a3b8] hover:text-[#ef4444] transition-colors"
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
          )}
        </Card>
      )}

      {/* ── Units List ─────────────────────────────────────────────────────── */}
      <Card className="border border-[#dbeafe] bg-white rounded-xl shadow-sm overflow-hidden">
        {/* Search & Controls Bar */}
        <div className="p-4 border-b border-[#e2e8f0]">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by unit code or title..."
                className="pl-10 h-10 bg-white border-[#dbeafe] rounded-lg"
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center border border-[#dbeafe] rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-[#3b82f6] text-white' : 'bg-white text-[#64748b] hover:bg-[#f1f5f9]'}`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-[#3b82f6] text-white' : 'bg-white text-[#64748b] hover:bg-[#f1f5f9]'}`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={() => fetchExistingUnits()}
                className="p-2 rounded-lg border border-[#dbeafe] text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#3b82f6] transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingUnits ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
          {searchQuery.trim() && (
            <p className="text-xs text-[#64748b] mt-2">
              Showing {filteredUnits.length} result{filteredUnits.length !== 1 ? 's' : ''} for "{searchQuery}"
            </p>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          {isLoadingUnits ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-[#3b82f6] animate-spin mb-3" />
              <p className="text-sm text-[#64748b]">Loading units...</p>
            </div>
          ) : filteredUnits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Database className="w-10 h-10 text-[#cbd5e1] mb-3" />
              <p className="text-sm text-[#64748b] font-medium">
                {searchQuery.trim() ? `No units matching "${searchQuery}"` : 'No units of competency yet'}
              </p>
              <p className="text-xs text-[#94a3b8] mt-1">
                {searchQuery.trim() ? 'Try a different search term' : 'Use the form above to extract your first unit'}
              </p>
            </div>
          ) : viewMode === 'grid' || isMobile ? (
            /* ── Grid / Card View (mobile-first) ─────────────────────────── */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {paginatedUnits.map((unit) => {
                const pct = getCompletenessPercent(unit);
                const colors = getStatusColor(unit);
                return (
                  <div
                    key={unit.id}
                    className={`group relative rounded-xl border ${colors.border} bg-white hover:shadow-md transition-all cursor-pointer overflow-hidden`}
                    onClick={() => openUnitDetails(unit)}
                  >
                    {/* Completeness Bar */}
                    <div className="h-1.5 bg-[#e2e8f0]">
                      <div
                        className={`h-full ${colors.bar} transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    <div className="p-4">
                      {/* Unit Code & Status */}
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <span className="font-mono text-base font-bold text-[#3b82f6]">{unit.unitCode}</span>
                          <span className={`ml-2 text-xs font-medium ${colors.text}`}>{pct}%</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (unit.link) window.open(unit.link, '_blank', 'width=1024,height=768');
                            }}
                            disabled={!unit.link}
                            className={`p-1.5 rounded-lg transition-colors ${unit.link
                              ? 'hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#3b82f6]'
                              : 'text-[#cbd5e1] cursor-not-allowed'
                            }`}
                            title={unit.link ? 'Open on training.gov.au' : 'No link'}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Title */}
                      <p className="text-sm text-[#1e293b] line-clamp-2 mb-3 min-h-[2.5rem]">
                        {unit.Title || 'Untitled Unit'}
                      </p>

                      {/* Completeness Dots */}
                      <div className="flex items-center gap-1.5 mb-2">
                        {Object.entries(SECTION_COLORS).map(([key, sec]) => {
                          const flagKey = `has_${key === 'ke' ? 'knowledge_evidence' : key === 'pe' ? 'performance_evidence' : key === 'fs' ? 'foundation_skills' : key === 'epc' ? 'elements_performance_criteria' : 'assessment_conditions'}` as keyof UnitOfCompetency;
                          const captured = !!unit[flagKey];
                          return (
                            <Tooltip key={key}>
                              <TooltipTrigger asChild>
                                <span
                                  className={`inline-flex items-center justify-center w-7 h-6 rounded text-[10px] font-bold border transition-all ${
                                    captured
                                      ? 'opacity-100'
                                      : 'opacity-30 border-[#e2e8f0]'
                                  }`}
                                  style={captured ? {
                                    backgroundColor: sec.bg,
                                    color: sec.text,
                                    borderColor: sec.accent,
                                  } : undefined}
                                >
                                  {sec.label}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="bg-[#1e293b] text-white text-xs">
                                {sec.full}: {captured ? 'Captured' : 'Missing'}
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>

                      {/* Date */}
                      <p className="text-xs text-[#94a3b8]">
                        {unit.created_at ? new Date(unit.created_at).toLocaleDateString('en-AU') : 'Unknown date'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ── Table View (desktop) ────────────────────────────────────── */
            <div className="border border-[#e2e8f0] rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-[#f8f9fb]">
                  <tr className="border-b border-[#e2e8f0]">
                    <th className="text-left py-3 px-4 font-poppins text-xs font-semibold text-[#64748b] uppercase tracking-wider">Unit Code</th>
                    <th className="text-left py-3 px-4 font-poppins text-xs font-semibold text-[#64748b] uppercase tracking-wider">Title</th>
                    <th className="text-left py-3 px-4 font-poppins text-xs font-semibold text-[#64748b] uppercase tracking-wider">Requirements</th>
                    <th className="text-left py-3 px-4 font-poppins text-xs font-semibold text-[#64748b] uppercase tracking-wider">Date</th>
                    <th className="text-right py-3 px-4 font-poppins text-xs font-semibold text-[#64748b] uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedUnits.map((unit) => (
                    <tr
                      key={unit.id}
                      className="border-b border-[#e2e8f0] hover:bg-[#f8f9fb] transition-colors cursor-pointer"
                      onClick={() => openUnitDetails(unit)}
                    >
                      <td className="py-3 px-4 font-mono text-sm font-semibold text-[#3b82f6]">{unit.unitCode}</td>
                      <td className="py-3 px-4 text-sm text-[#1e293b] max-w-xs truncate">{unit.Title || '-'}</td>
                      <td className="py-3 px-4">
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
                      </td>
                      <td className="py-3 px-4 text-sm text-[#64748b]">
                        {unit.created_at ? new Date(unit.created_at).toLocaleDateString('en-AU') : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); openUnitDetails(unit); }}
                            className="p-2 rounded-lg hover:bg-[#dbeafe] text-[#3b82f6] transition-colors"
                            title="View requirements"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (unit.link) window.open(unit.link, '_blank', 'width=1024,height=768');
                            }}
                            disabled={!unit.link}
                            className={`p-2 rounded-lg transition-colors ${unit.link
                              ? 'hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#3b82f6]'
                              : 'text-[#cbd5e1] cursor-not-allowed opacity-50'
                            }`}
                            title={unit.link ? 'Open on training.gov.au' : 'No link'}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Pagination ─────────────────────────────────────────────────── */}
        {filteredUnits.length > ITEMS_PER_PAGE && (
          <div className="border-t border-[#e2e8f0] p-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-xs text-[#64748b]">
                {startIndex + 1}–{Math.min(endIndex, filteredUnits.length)} of {filteredUnits.length} units
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${currentPage === 1
                    ? 'border-[#e2e8f0] text-[#cbd5e1] cursor-not-allowed'
                    : 'border-[#dbeafe] text-[#64748b] hover:bg-[#f1f5f9] hover:border-[#3b82f6] hover:text-[#3b82f6]'
                  }`}
                >
                  Prev
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                  const show = page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1);
                  const ellipsis = (page === 2 && currentPage > 3) || (page === totalPages - 1 && currentPage < totalPages - 2);
                  if (ellipsis) return <span key={page} className="px-1.5 text-[#cbd5e1] text-sm">…</span>;
                  if (!show) return null;
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`min-w-[2rem] px-2.5 py-1.5 rounded-lg text-sm border transition-colors ${currentPage === page
                        ? 'border-[#3b82f6] bg-[#3b82f6] text-white'
                        : 'border-[#dbeafe] text-[#64748b] hover:bg-[#f1f5f9] hover:border-[#3b82f6] hover:text-[#3b82f6]'
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${currentPage === totalPages
                    ? 'border-[#e2e8f0] text-[#cbd5e1] cursor-not-allowed'
                    : 'border-[#dbeafe] text-[#64748b] hover:bg-[#f1f5f9] hover:border-[#3b82f6] hover:text-[#3b82f6]'
                  }`}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* ── Acquisition Loading Modal ──────────────────────────────────────── */}
      <AlertDialog open={showAcquisitionModal} onOpenChange={setShowAcquisitionModal}>
        <AlertDialogContent className="max-w-sm bg-white rounded-2xl">
          <div className="flex flex-col items-center justify-center py-6 px-4">
            <div className="mb-5 w-24">
              <img src={wizardLogo} alt="Nytro Wizard" className="w-full h-auto object-contain animate-pulse" />
            </div>
            <h3 className="font-poppins text-lg font-semibold text-[#1e293b] mb-3">
              Nytro is extracting...
            </h3>
            <div className="w-full max-w-xs mb-4">
              <div className="h-2 bg-[#e2e8f0] rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#22c55e] to-[#3b82f6] animate-pulse" style={{ width: '100%' }} />
              </div>
            </div>
            <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-[#f0fdf4] rounded-lg border border-[#86efac]">
              <Target className="w-4 h-4 text-[#16a34a] animate-spin" style={{ animationDuration: '1.5s' }} />
              <p className="text-sm font-medium text-[#166534]">{acquisitionStep || 'Initializing...'}</p>
            </div>
            <div className="flex gap-1 mb-2">
              <span className="w-2 h-2 bg-[#22c55e] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-[#22c55e] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-[#22c55e] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <p className="text-xs text-[#94a3b8] text-center">
              Extracting requirements for {unitCode}
            </p>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Unit Details Dialog ─────────────────────────────────────────────── */}
      <AlertDialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <AlertDialogContent className={`bg-white p-0 flex flex-col ${
          isMobile ? 'max-w-full w-full h-full max-h-full rounded-none' : 'max-w-5xl w-[90vw] h-[85vh] rounded-2xl'
        }`}>
          <div className="flex flex-col h-full min-h-0">
            {/* Header */}
            <div className="flex-none p-4 md:p-6 border-b border-[#e2e8f0]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="font-poppins text-base md:text-xl font-bold text-[#1e293b] truncate">
                    {detailUnit?.unitCode}
                    <span className="text-[#64748b] font-normal ml-2 text-sm md:text-base">
                      {detailUnit?.Title || 'Unit Details'}
                    </span>
                  </h3>

                  {/* Section Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-3">
                    {[
                      { key: 'ke', count: keReqs.length },
                      { key: 'pe', count: peReqs.length },
                      { key: 'fs', count: fsReqs.length },
                      { key: 'epc', count: epcReqs.length },
                      { key: 'ac', count: acReqs.length },
                    ].map(({ key, count }) => {
                      const sec = SECTION_COLORS[key as keyof typeof SECTION_COLORS];
                      return (
                        <span
                          key={key}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
                          style={{ backgroundColor: sec.bg, color: sec.text }}
                        >
                          {sec.label}: {count}
                        </span>
                      );
                    })}
                  </div>

                  {/* Completeness */}
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
                  className="p-2 rounded-lg hover:bg-[#f1f5f9] text-[#64748b] hover:text-[#1e293b] transition-colors flex-shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Tabs Content */}
            <div className="flex-1 overflow-hidden flex flex-col min-h-0 p-4 md:p-6">
              {isLoadingDetails ? (
                <div className="flex items-center justify-center h-48">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 text-[#3b82f6] animate-spin mx-auto mb-3" />
                    <p className="text-[#64748b]">Loading requirements...</p>
                  </div>
                </div>
              ) : (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                  <TabsList className={`${isMobile ? 'flex overflow-x-auto gap-1 pb-1' : 'grid grid-cols-5'} mb-4`}>
                    {[
                      { value: 'ke', label: 'Knowledge', count: keReqs.length },
                      { value: 'pe', label: 'Performance', count: peReqs.length },
                      { value: 'fs', label: 'Foundation', count: fsReqs.length },
                      { value: 'epc', label: 'Elements', count: epcReqs.length },
                      { value: 'ac', label: 'Conditions', count: acReqs.length },
                    ].map(tab => (
                      <TabsTrigger
                        key={tab.value}
                        value={tab.value}
                        className={`text-xs whitespace-nowrap ${isMobile ? 'flex-shrink-0 px-3' : ''}`}
                      >
                        {isMobile ? tab.label.slice(0, 4) : tab.label} ({tab.count})
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  <div className="flex-1 overflow-auto">
                    {/* Knowledge Evidence */}
                    <TabsContent value="ke" className="mt-0 h-full">
                      {keReqs.length === 0 ? (
                        <EmptySection label="knowledge evidence" />
                      ) : (
                        <RequirementTable
                          items={keReqs}
                          numberKey="ke_number"
                          contentKey="knowled_point"
                          accentColor="#3b82f6"
                          headerLabel="Knowledge Point"
                          isMobile={isMobile}
                        />
                      )}
                    </TabsContent>

                    {/* Performance Evidence */}
                    <TabsContent value="pe" className="mt-0 h-full">
                      {peReqs.length === 0 ? (
                        <EmptySection label="performance evidence" />
                      ) : (
                        <RequirementTable
                          items={peReqs}
                          numberKey="pe_number"
                          contentKey="performance_evidence"
                          accentColor="#22c55e"
                          headerLabel="Performance Evidence"
                          isMobile={isMobile}
                        />
                      )}
                    </TabsContent>

                    {/* Foundation Skills */}
                    <TabsContent value="fs" className="mt-0 h-full">
                      {fsReqs.length === 0 ? (
                        <EmptySection label="foundation skills" />
                      ) : (
                        <RequirementTable
                          items={fsReqs}
                          numberKey="fs_number"
                          contentKey="skill_point"
                          accentColor="#f59e0b"
                          headerLabel="Skill Point"
                          isMobile={isMobile}
                        />
                      )}
                    </TabsContent>

                    {/* Elements & Performance Criteria */}
                    <TabsContent value="epc" className="mt-0 h-full">
                      {epcReqs.length === 0 ? (
                        <EmptySection label="elements & performance criteria" />
                      ) : (
                        <RequirementTable
                          items={epcReqs}
                          numberKey="epc_number"
                          contentKey="performance_criteria"
                          accentColor="#6366f1"
                          headerLabel="Performance Criteria"
                          isMobile={isMobile}
                        />
                      )}
                    </TabsContent>

                    {/* Assessment Conditions */}
                    <TabsContent value="ac" className="mt-0 h-full">
                      {acReqs.length === 0 ? (
                        <EmptySection label="assessment conditions" />
                      ) : (
                        <RequirementTable
                          items={acReqs}
                          numberKey="ac_number"
                          contentKey="condition_point"
                          accentColor="#ec4899"
                          headerLabel="Condition"
                          isMobile={isMobile}
                        />
                      )}
                    </TabsContent>
                  </div>
                </Tabs>
              )}
            </div>

            {/* Footer */}
            <div className="flex-none border-t border-[#e2e8f0] p-4 flex flex-col sm:flex-row justify-end gap-2">
              {detailUnit?.link && (
                <button
                  onClick={() => window.open(detailUnit.link, '_blank')}
                  className="px-4 py-2 text-[#3b82f6] border border-[#3b82f6] rounded-lg hover:bg-[#dbeafe] transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  View on training.gov.au
                </button>
              )}
              <button
                onClick={() => setShowDetailsDialog(false)}
                className="px-4 py-2 bg-[#1e40af] text-white rounded-lg hover:bg-[#1e3a8a] transition-colors text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Back to Top Button (Gold) ──────────────────────────────────────── */}
      {showBackToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-gradient-to-br from-[#f59e0b] to-[#d97706] text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center"
          title="Back to top"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}

// ─── Sub-Components ─────────────────────────────────────────────────────────

function EmptySection({ label }: { label: string }) {
  return (
    <div className="text-center py-12">
      <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-[#f59e0b]" />
      <p className="font-medium text-[#1e293b]">No {label} captured</p>
      <p className="text-sm text-[#64748b] mt-1">
        This section may need to be re-acquired from training.gov.au
      </p>
    </div>
  );
}

function RequirementTable({
  items,
  numberKey,
  contentKey,
  accentColor,
  headerLabel,
  isMobile,
}: {
  items: any[];
  numberKey: string;
  contentKey: string;
  accentColor: string;
  headerLabel: string;
  isMobile: boolean;
}) {
  if (isMobile) {
    return (
      <div className="space-y-2">
        {items.map((req: any) => (
          <div key={req.id} className="p-3 rounded-lg border border-[#e2e8f0] bg-[#f8f9fb]">
            <span
              className="inline-block font-mono text-xs font-bold px-2 py-0.5 rounded mb-1.5"
              style={{ color: accentColor, backgroundColor: `${accentColor}15` }}
            >
              {req[numberKey]}
            </span>
            <p className="text-sm text-[#1e293b]">{req[contentKey]}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="border border-[#e2e8f0] rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-[#f8f9fb]">
          <tr className="border-b border-[#e2e8f0]">
            <th className="text-left py-3 px-4 text-[#1e293b] font-semibold text-sm w-24">#</th>
            <th className="text-left py-3 px-4 text-[#1e293b] font-semibold text-sm">{headerLabel}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((req: any) => (
            <tr key={req.id} className="border-b border-[#e2e8f0] hover:bg-[#f8f9fb]">
              <td className="py-3 px-4 font-mono font-semibold text-sm" style={{ color: accentColor }}>
                {req[numberKey]}
              </td>
              <td className="py-3 px-4 text-sm text-[#1e293b]">{req[contentKey]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
