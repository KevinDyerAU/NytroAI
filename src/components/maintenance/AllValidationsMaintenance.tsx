/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Admin — All Validations View
 * Displays every validation_detail record across all RTOs and users.
 * Admin can see status, progress, and download validation reports.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import {
  generateAssessmentReport,
  generateLearnerGuideReport,
  downloadExcelFile,
} from '../../lib/assessmentReportGenerator';
import {
  Search,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Download,
  CheckCircle,
  Clock,
  XCircle,
  Activity,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  Filter,
  Eye,
  X,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface ValidationDetail {
  id: number;
  created_at: string;
  summary_id: number | null;
  extractStatus: string | null;
  validation_status: string | null;
  docExtracted: boolean;
  numOfReq: number | null;
  validation_total: number | null;
  validation_count: number | null;
  completed_count: number | null;
  validation_progress: number | null;
  namespace_code: string | null;
  user_id: string | null;
  validationType_id: number | null;
  // Joined fields
  validation_summary?: {
    unitCode: string | null;
    rtoCode: string | null;
    reqTotal: number | null;
    user_id: string | null;
  } | null;
  validation_type?: {
    code: string | null;
  } | null;
}

type StatusFilter = 'all' | 'pending' | 'processing' | 'completed' | 'failed';
type SortField = 'created_at' | 'extractStatus' | 'unit_code';
type SortDir = 'asc' | 'desc';

// ─── Status helpers ──────────────────────────────────────────────────────────
function getStageLabel(detail: ValidationDetail): string {
  const status = detail.extractStatus || 'Pending';
  const numReq = detail.validation_total || detail.numOfReq || 0;
  const completed = detail.validation_count || detail.completed_count || 0;

  if (numReq > 0 && completed >= numReq) return 'Validated';
  if (status === 'DocumentProcessing') return 'Processing Documents';
  if (status === 'ProcessingInBackground') return 'Processing';
  if (status === 'Completed') return 'Completed';
  if (status === 'Failed') return 'Failed';
  if (detail.docExtracted) return 'Documents Extracted';
  return status;
}

function getStatusCategory(detail: ValidationDetail): string {
  const status = detail.extractStatus || 'Pending';
  const numReq = detail.validation_total || detail.numOfReq || 0;
  const completed = detail.validation_count || detail.completed_count || 0;

  if (status === 'Failed') return 'failed';
  if (numReq > 0 && completed >= numReq) return 'completed';
  if (status === 'Completed') return 'completed';
  if (status === 'DocumentProcessing' || status === 'ProcessingInBackground') return 'processing';
  return 'pending';
}

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="w-3.5 h-3.5 text-amber-500" />,
  processing: <Activity className="w-3.5 h-3.5 text-blue-500 animate-pulse" />,
  completed: <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />,
  failed: <XCircle className="w-3.5 h-3.5 text-red-500" />,
};

const statusBadgeStyles: Record<string, string> = {
  pending: 'bg-amber-50 border-amber-200 text-amber-700',
  processing: 'bg-blue-50 border-blue-200 text-blue-700',
  completed: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  failed: 'bg-red-50 border-red-200 text-red-700',
};

// ─── Main Component ──────────────────────────────────────────────────────────
export function AllValidationsMaintenance() {
  const [validations, setValidations] = useState<ValidationDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Report download
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  // Detail panel
  const [selectedValidation, setSelectedValidation] = useState<ValidationDetail | null>(null);

  // ─── Fetch all validations ────────────────────────────────────────────
  const fetchValidations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('validation_detail')
        .select(`
          *,
          validation_summary:summary_id(unitCode, rtoCode, reqTotal, user_id),
          validation_type:validationType_id(code)
        `)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setValidations(data || []);
    } catch (err) {
      console.error('[AllValidations] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load validations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchValidations();

    // Real-time subscription
    const subscription = supabase
      .channel('admin_validation_detail_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'validation_detail' }, () => {
        fetchValidations();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchValidations]);

  // ─── Filter + sort ────────────────────────────────────────────────────
  const filteredValidations = useMemo(() => {
    let result = [...validations];

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((v) => getStatusCategory(v) === statusFilter);
    }

    // Search
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (v) =>
          (v.validation_summary?.unitCode && v.validation_summary.unitCode.toLowerCase().includes(term)) ||
          (v.validation_summary?.rtoCode && v.validation_summary.rtoCode.toLowerCase().includes(term)) ||
          (v.namespace_code && v.namespace_code.toLowerCase().includes(term)) ||
          String(v.id).includes(term)
      );
    }

    // Sort
    result.sort((a, b) => {
      let valA: string | number = '';
      let valB: string | number = '';
      switch (sortField) {
        case 'created_at':
          valA = new Date(a.created_at).getTime();
          valB = new Date(b.created_at).getTime();
          break;
        case 'extractStatus':
          valA = getStageLabel(a).toLowerCase();
          valB = getStageLabel(b).toLowerCase();
          break;
        case 'unit_code':
          valA = (a.validation_summary?.unitCode || '').toLowerCase();
          valB = (b.validation_summary?.unitCode || '').toLowerCase();
          break;
      }
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [validations, statusFilter, searchTerm, sortField, sortDir]);

  // ─── Sort toggle ──────────────────────────────────────────────────────
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? (
      <ChevronUp className="w-3 h-3 inline ml-1" />
    ) : (
      <ChevronDown className="w-3 h-3 inline ml-1" />
    );
  };

  // ─── Download report ──────────────────────────────────────────────────
  const downloadReport = async (validation: ValidationDetail) => {
    const validationDetailId = validation.id;
    const unitCode = validation.validation_summary?.unitCode || 'Unknown';
    const validationType = validation.validation_type?.code || 'assessment';

    setDownloadingId(validationDetailId);
    try {
      // Fetch validation results for this validation
      const { data: results, error: resultsError } = await supabase
        .from('validation_results')
        .select('*')
        .eq('validation_detail_id', validationDetailId);

      if (resultsError) throw resultsError;

      if (!results || results.length === 0) {
        alert('No validation results found for this validation. The report cannot be generated yet.');
        return;
      }

      // Map results to the expected ValidationEvidenceRecord format
      const validationResults = results.map((r: any) => ({
        id: String(r.id),
        validation_detail_id: r.validation_detail_id,
        requirement_number: r.requirement_number || '',
        requirement_text: r.requirement_text || '',
        requirement_type: r.requirement_type || '',
        status: r.status || 'not-met',
        reasoning: r.reasoning || '',
        mapped_content: r.mapped_content || '[]',
        doc_references: r.doc_references || '',
        smart_questions: r.smart_questions || '',
        benchmark_answer: r.benchmark_answer || '',
        citations: r.citations || '[]',
        created_at: r.created_at,
      }));

      const params = {
        unitCode,
        unitTitle: unitCode, // Admin can refine later
        rtoName: validation.validation_summary?.rtoCode || '',
        validationType: validationType as 'assessment' | 'learner-guide',
        validationDetailId,
      };

      // Generate the report
      const blob =
        validationType === 'learner-guide'
          ? await generateLearnerGuideReport({ ...params, validationResults })
          : await generateAssessmentReport({ ...params, validationResults });

      // Download
      const timestamp = new Date().toISOString().split('T')[0];
      const reportTypeStr = validationType === 'learner-guide' ? 'Learner-Guide' : 'Assessment';
      const filename = `${unitCode}_${reportTypeStr}_Report_${timestamp}.xlsx`;
      downloadExcelFile(blob, filename);
    } catch (err) {
      console.error('[AllValidations] Report download error:', err);
      alert('Failed to generate report. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  };

  // ─── Stats ────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = validations.length;
    const completed = validations.filter((v) => getStatusCategory(v) === 'completed').length;
    const processing = validations.filter((v) => getStatusCategory(v) === 'processing').length;
    const failed = validations.filter((v) => getStatusCategory(v) === 'failed').length;
    return { total, completed, processing, failed };
  }, [validations]);

  // ─── Progress bar ─────────────────────────────────────────────────────
  function ProgressBar({ validation }: { validation: ValidationDetail }) {
    const numReq = validation.validation_total || validation.numOfReq || 0;
    const completed = validation.validation_count || validation.completed_count || 0;
    const progress =
      validation.validation_progress ??
      (numReq > 0 ? Math.round((completed / numReq) * 100) : 0);

    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-[#f1f5f9] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              progress >= 100
                ? 'bg-emerald-500'
                : progress > 50
                ? 'bg-blue-500'
                : progress > 0
                ? 'bg-amber-500'
                : 'bg-[#e2e8f0]'
            }`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        <span className="text-xs text-[#64748b] font-mono w-10 text-right">{progress}%</span>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────
  if (loading && validations.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[#3b82f6] animate-spin" />
          <p className="text-[#64748b] text-sm">Loading all validations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Stats ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-[#dbeafe] rounded-xl p-4 shadow-sm">
          <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">Total</p>
          <p className="text-2xl font-sans font-bold text-[#1e293b] mt-1">{stats.total}</p>
        </div>
        <div className="bg-white border border-emerald-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">Completed</p>
          <p className="text-2xl font-sans font-bold text-emerald-700 mt-1">{stats.completed}</p>
        </div>
        <div className="bg-white border border-blue-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">Processing</p>
          <p className="text-2xl font-sans font-bold text-blue-700 mt-1">{stats.processing}</p>
        </div>
        <div className="bg-white border border-red-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">Failed</p>
          <p className="text-2xl font-sans font-bold text-red-700 mt-1">{stats.failed}</p>
        </div>
      </div>

      {/* ─── Toolbar ──────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
            <input
              type="text"
              placeholder="Search unit code, RTO..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border border-[#dbeafe] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-transparent w-64"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="px-3 py-2 border border-[#dbeafe] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        <button
          onClick={fetchValidations}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 border border-[#dbeafe] rounded-lg text-sm text-[#64748b] hover:bg-[#f1f5f9] transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ─── Table ────────────────────────────────────────────────────── */}
      <div className="bg-white border border-[#dbeafe] rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#f8f9fb] border-b border-[#dbeafe]">
                <th className="text-left px-4 py-3 font-semibold text-[#64748b]">ID</th>
                <th className="text-left px-4 py-3 font-semibold text-[#64748b]">
                  <button onClick={() => toggleSort('created_at')} className="hover:text-[#1e293b]">
                    Date <SortIcon field="created_at" />
                  </button>
                </th>
                <th className="text-left px-4 py-3 font-semibold text-[#64748b]">
                  <button onClick={() => toggleSort('unit_code')} className="hover:text-[#1e293b]">
                    Unit Code <SortIcon field="unit_code" />
                  </button>
                </th>
                <th className="text-left px-4 py-3 font-semibold text-[#64748b]">RTO</th>
                <th className="text-left px-4 py-3 font-semibold text-[#64748b]">Type</th>
                <th className="text-left px-4 py-3 font-semibold text-[#64748b]">
                  <button onClick={() => toggleSort('extractStatus')} className="hover:text-[#1e293b]">
                    Status <SortIcon field="extractStatus" />
                  </button>
                </th>
                <th className="text-left px-4 py-3 font-semibold text-[#64748b] w-40">Progress</th>
                <th className="text-right px-4 py-3 font-semibold text-[#64748b]">Report</th>
              </tr>
            </thead>
            <tbody>
              {filteredValidations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-[#94a3b8]">
                    {validations.length === 0
                      ? 'No validations found.'
                      : 'No validations match your filters.'}
                  </td>
                </tr>
              ) : (
                filteredValidations.map((v) => {
                  const category = getStatusCategory(v);
                  const stageLabel = getStageLabel(v);
                  const unitCode = v.validation_summary?.unitCode || v.namespace_code || '—';
                  const rtoCode = v.validation_summary?.rtoCode || '—';
                  const validationType = v.validation_type?.code || '—';
                  const isCompleted = category === 'completed';

                  return (
                    <tr
                      key={v.id}
                      className="border-b border-[#f1f5f9] hover:bg-[#f8f9fb] transition-colors cursor-pointer"
                      onClick={() => setSelectedValidation(v)}
                    >
                      <td className="px-4 py-3 text-[#94a3b8] font-mono text-xs">#{v.id}</td>
                      <td className="px-4 py-3 text-[#64748b] whitespace-nowrap">
                        {new Date(v.created_at).toLocaleDateString('en-AU', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs bg-[#f1f5f9] px-2 py-0.5 rounded font-medium text-[#1e293b]">
                          {unitCode}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#64748b]">{rtoCode}</td>
                      <td className="px-4 py-3 text-[#64748b] capitalize text-xs">{validationType}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusBadgeStyles[category]}`}
                        >
                          {statusIcons[category]}
                          {stageLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <ProgressBar validation={v} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isCompleted ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadReport(v);
                            }}
                            disabled={downloadingId === v.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#3b82f6] text-white rounded-lg text-xs font-semibold hover:bg-[#2563eb] disabled:opacity-50 transition-colors shadow-sm"
                            title="Download validation report"
                          >
                            {downloadingId === v.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Download className="w-3 h-3" />
                            )}
                            Report
                          </button>
                        ) : (
                          <span className="text-xs text-[#cbd5e1]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 bg-[#f8f9fb] border-t border-[#dbeafe] text-xs text-[#94a3b8]">
          Showing {filteredValidations.length} of {validations.length} validations
          {' · '}
          <span className="text-[#64748b]">Real-time updates enabled</span>
        </div>
      </div>

      {/* ─── Detail Slide-over ────────────────────────────────────────── */}
      {selectedValidation && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setSelectedValidation(null)}
          />
          <div className="relative w-full max-w-lg bg-white shadow-2xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-[#dbeafe] px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h3 className="text-lg font-sans font-bold text-[#1e293b]">
                  Validation #{selectedValidation.id}
                </h3>
                <p className="text-xs text-[#94a3b8]">
                  {new Date(selectedValidation.created_at).toLocaleString('en-AU')}
                </p>
              </div>
              <button
                onClick={() => setSelectedValidation(null)}
                className="p-2 hover:bg-[#f1f5f9] rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-[#64748b]" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Unit & RTO */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-[#94a3b8] mb-1">Unit Code</p>
                  <p className="font-mono text-sm font-bold text-[#1e293b]">
                    {selectedValidation.validation_summary?.unitCode || selectedValidation.namespace_code || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#94a3b8] mb-1">RTO Code</p>
                  <p className="font-mono text-sm font-bold text-[#1e293b]">
                    {selectedValidation.validation_summary?.rtoCode || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#94a3b8] mb-1">Type</p>
                  <p className="text-sm text-[#1e293b] capitalize">
                    {selectedValidation.validation_type?.code || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#94a3b8] mb-1">Status</p>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                      statusBadgeStyles[getStatusCategory(selectedValidation)]
                    }`}
                  >
                    {statusIcons[getStatusCategory(selectedValidation)]}
                    {getStageLabel(selectedValidation)}
                  </span>
                </div>
              </div>

              {/* Progress */}
              <div>
                <p className="text-xs text-[#94a3b8] mb-2">Progress</p>
                <ProgressBar validation={selectedValidation} />
                <div className="flex justify-between text-xs text-[#94a3b8] mt-1">
                  <span>
                    {selectedValidation.validation_count || selectedValidation.completed_count || 0} completed
                  </span>
                  <span>
                    {selectedValidation.validation_total || selectedValidation.numOfReq || 0} total requirements
                  </span>
                </div>
              </div>

              {/* Technical details */}
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-[#1e293b] uppercase tracking-wide">
                  Technical Details
                </h4>
                <div className="bg-[#f8f9fb] rounded-lg p-4 text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-[#94a3b8]">Extract Status</span>
                    <span className="font-mono text-[#1e293b]">
                      {selectedValidation.extractStatus || 'Pending'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#94a3b8]">Validation Status</span>
                    <span className="font-mono text-[#1e293b]">
                      {selectedValidation.validation_status || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#94a3b8]">Doc Extracted</span>
                    <span className="font-mono text-[#1e293b]">
                      {selectedValidation.docExtracted ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#94a3b8]">Summary ID</span>
                    <span className="font-mono text-[#1e293b]">
                      {selectedValidation.summary_id || '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#94a3b8]">User ID</span>
                    <span className="font-mono text-[#1e293b] text-[10px] break-all">
                      {selectedValidation.user_id || selectedValidation.validation_summary?.user_id || '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Download button */}
              {getStatusCategory(selectedValidation) === 'completed' && (
                <button
                  onClick={() => downloadReport(selectedValidation)}
                  disabled={downloadingId === selectedValidation.id}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#3b82f6] text-white rounded-lg text-sm font-semibold hover:bg-[#2563eb] disabled:opacity-50 transition-colors shadow-sm"
                >
                  {downloadingId === selectedValidation.id ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating Report...
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="w-4 h-4" />
                      Download Validation Report
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
