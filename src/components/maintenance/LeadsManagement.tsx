/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Admin — Leads Management
 * Dashboard-style page where admins review $99 validation leads,
 * check uploaded documents, change/correct unit codes, and approve
 * validation runs. Statuses: landed → processing → completed.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { triggerDocumentProcessing } from '../../lib/n8nApi';
import {
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Loader2,
  Flag,
  Eye,
  Save,
  ExternalLink,
  Play,
  FileText,
  Download,
  X,
  ChevronRight,
  User,
  Building2,
  Mail,
  Phone,
  Calendar,
  Tag,
  MessageSquare,
  ArrowRight,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface ValidationLead {
  id: number;
  created_at: string;
  first_name: string;
  last_name: string;
  company_name: string | null;
  phone_number: string | null;
  email: string;
  file_url: string | null;
  file_name: string | null;
  subscribe_newsletter: boolean;
  status: string;
  stripe_session_id: string | null;
  stripe_payment_status: string | null;
  validation_type: string | null;
  amount_paid: number | null;
  notes: string | null;
  updated_at: string;
  user_id: string | null;
  unit_code: string | null;
  unit_not_found: boolean;
  validation_id: number | null;
  admin_notes: string | null;
}

type LeadStatus = 'all' | 'landed' | 'processing' | 'completed';

// ─── Status config ──────────────────────────────────────────────────────────
const statusConfig: Record<string, { bg: string; border: string; text: string; icon: React.ReactNode; label: string }> = {
  pending: {
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    text: 'text-gray-600',
    icon: <Clock className="w-4 h-4" />,
    label: 'Pending Payment',
  },
  landed: {
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    text: 'text-amber-700',
    icon: <Flag className="w-4 h-4" />,
    label: 'Landed',
  },
  processing: {
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    text: 'text-blue-700',
    icon: <Loader2 className="w-4 h-4 animate-spin" />,
    label: 'Processing',
  },
  completed: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-300',
    text: 'text-emerald-700',
    icon: <CheckCircle className="w-4 h-4" />,
    label: 'Completed',
  },
  cancelled: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-600',
    icon: <X className="w-4 h-4" />,
    label: 'Cancelled',
  },
};

function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || statusConfig.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${config.bg} ${config.border} ${config.text}`}>
      {config.icon}
      {config.label}
    </span>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export function LeadsManagement() {
  const [leads, setLeads] = useState<ValidationLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<LeadStatus>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Selected lead for detail view
  const [selectedLead, setSelectedLead] = useState<ValidationLead | null>(null);
  const [editUnitCode, setEditUnitCode] = useState('');
  const [editAdminNotes, setEditAdminNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);

  // Unit lookup
  const [lookingUp, setLookingUp] = useState(false);
  const [unitLookupResult, setUnitLookupResult] = useState<{
    found: boolean;
    title?: string;
    code?: string;
  } | null>(null);

  // ─── Fetch leads ──────────────────────────────────────────────────────
  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('validation_leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setLeads(data || []);
    } catch (err) {
      console.error('[LeadsManagement] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();

    // Real-time subscription
    const channel = supabase
      .channel('leads-management-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'validation_leads' },
        () => {
          fetchLeads();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLeads]);

  // ─── Filter leads ─────────────────────────────────────────────────────
  const filteredLeads = useMemo(() => {
    let result = [...leads];

    // Status filter — show relevant statuses
    if (statusFilter !== 'all') {
      result = result.filter((l) => l.status === statusFilter);
    } else {
      // In 'all' view, show landed + processing + completed (hide pending/cancelled)
      result = result.filter((l) => ['landed', 'processing', 'completed'].includes(l.status));
    }

    // Search
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (l) =>
          l.email.toLowerCase().includes(term) ||
          l.first_name.toLowerCase().includes(term) ||
          l.last_name.toLowerCase().includes(term) ||
          (l.company_name && l.company_name.toLowerCase().includes(term)) ||
          (l.unit_code && l.unit_code.toLowerCase().includes(term))
      );
    }

    return result;
  }, [leads, statusFilter, searchTerm]);

  // ─── Stats ────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const landed = leads.filter((l) => l.status === 'landed').length;
    const processing = leads.filter((l) => l.status === 'processing').length;
    const completed = leads.filter((l) => l.status === 'completed').length;
    const flagged = leads.filter((l) => l.unit_not_found === true).length;
    return { landed, processing, completed, flagged };
  }, [leads]);

  // ─── Unit code lookup ─────────────────────────────────────────────────
  const lookupUnitCode = async (code: string) => {
    if (!code || code.trim().length < 3) {
      setUnitLookupResult(null);
      return;
    }
    setLookingUp(true);
    setUnitLookupResult(null);
    try {
      const { data, error: lookupError } = await supabase
        .from('UnitOfCompetency')
        .select('unitCode, Title')
        .ilike('unitCode', code.trim())
        .limit(1)
        .single();

      if (lookupError || !data) {
        setUnitLookupResult({ found: false });
      } else {
        setUnitLookupResult({ found: true, title: data.Title || '', code: data.unitCode || code });
      }
    } catch {
      setUnitLookupResult({ found: false });
    } finally {
      setLookingUp(false);
    }
  };

  // ─── Open lead detail ─────────────────────────────────────────────────
  const openLead = (lead: ValidationLead) => {
    setSelectedLead(lead);
    setEditUnitCode(lead.unit_code || '');
    setEditAdminNotes(lead.admin_notes || '');
    setUnitLookupResult(null);
  };

  // ─── Save lead changes ────────────────────────────────────────────────
  const saveLead = async () => {
    if (!selectedLead) return;
    setSaving(true);
    try {
      const unitNotFound = unitLookupResult ? !unitLookupResult.found : selectedLead.unit_not_found;

      const { error: updateError } = await supabase
        .from('validation_leads')
        .update({
          unit_code: editUnitCode.trim() || null,
          unit_not_found: unitNotFound,
          admin_notes: editAdminNotes.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedLead.id);

      if (updateError) throw updateError;

      // Update local state
      setSelectedLead((prev) =>
        prev
          ? { ...prev, unit_code: editUnitCode.trim() || null, unit_not_found: unitNotFound, admin_notes: editAdminNotes.trim() || null }
          : null
      );
      await fetchLeads();
    } catch (err) {
      console.error('[LeadsManagement] Save error:', err);
      alert('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ─── Approve & trigger validation ─────────────────────────────────────
  const approveAndRun = async () => {
    if (!selectedLead) return;
    if (!editUnitCode.trim()) {
      alert('Please enter a unit code before approving the validation.');
      return;
    }

    // Check unit code first
    if (!unitLookupResult || !unitLookupResult.found) {
      const confirmFlag = window.confirm(
        'The unit code was not found in the system. Do you still want to approve and run the validation? The lead will be flagged for resolution.'
      );
      if (!confirmFlag) return;
    }

    setApproving(true);
    try {
      // 1. Save the unit code and update status to processing
      const unitNotFound = unitLookupResult ? !unitLookupResult.found : true;

      const { error: updateError } = await supabase
        .from('validation_leads')
        .update({
          unit_code: editUnitCode.trim(),
          unit_not_found: unitNotFound,
          admin_notes: editAdminNotes.trim() || null,
          status: 'processing',
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedLead.id);

      if (updateError) throw updateError;

      // 2. If there's a file_url (storage path), trigger the n8n document processing
      if (selectedLead.file_url) {
        try {
          // Create a validation_detail record for this lead if one doesn't exist
          let validationDetailId = selectedLead.validation_id;

          if (!validationDetailId) {
            // We need to create a validation_detail record
            // First, get the user's RTO or use a default admin RTO
            const { data: detailData, error: detailError } = await supabase
              .from('validation_detail')
              .insert({
                unit_code: editUnitCode.trim(),
                validation_type: selectedLead.validation_type || 'assessment',
                status: 'pending',
                created_at: new Date().toISOString(),
              })
              .select('id')
              .single();

            if (detailError) {
              console.error('[LeadsManagement] Failed to create validation_detail:', detailError);
              throw new Error('Failed to create validation record. Please try again.');
            }

            validationDetailId = detailData.id;

            // Link the validation_detail to the lead
            await supabase
              .from('validation_leads')
              .update({ validation_id: validationDetailId })
              .eq('id', selectedLead.id);
          }

          // Trigger n8n document processing
          await triggerDocumentProcessing(validationDetailId, [selectedLead.file_url]);

          console.log('[LeadsManagement] Validation triggered for lead:', selectedLead.id, 'validation_detail:', validationDetailId);
        } catch (triggerErr) {
          console.error('[LeadsManagement] Trigger error:', triggerErr);
          // Still mark as processing — admin can retrigger
          alert(`Validation record created but n8n trigger failed: ${triggerErr instanceof Error ? triggerErr.message : 'Unknown error'}. The lead is marked as processing — you can retrigger from the All Validations module.`);
        }
      } else {
        alert('No file URL found for this lead. The status has been updated to processing, but no validation was triggered. Please check the uploaded document.');
      }

      // Update local state
      setSelectedLead((prev) =>
        prev ? { ...prev, status: 'processing', unit_code: editUnitCode.trim(), unit_not_found: unitNotFound } : null
      );
      await fetchLeads();
    } catch (err) {
      console.error('[LeadsManagement] Approve error:', err);
      alert(`Failed to approve: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setApproving(false);
    }
  };

  // ─── Mark as completed ────────────────────────────────────────────────
  const markCompleted = async () => {
    if (!selectedLead) return;
    const confirm = window.confirm('Mark this lead as completed? This indicates the validation report has been sent to the customer.');
    if (!confirm) return;

    try {
      const { error: updateError } = await supabase
        .from('validation_leads')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedLead.id);

      if (updateError) throw updateError;

      setSelectedLead((prev) => (prev ? { ...prev, status: 'completed' } : null));
      await fetchLeads();
    } catch (err) {
      console.error('[LeadsManagement] Complete error:', err);
      alert('Failed to mark as completed.');
    }
  };

  // ─── Render loading ───────────────────────────────────────────────────
  if (loading && leads.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[#3b82f6] animate-spin" />
          <p className="text-[#64748b] text-sm">Loading leads...</p>
        </div>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ─── Header ──────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-3xl font-poppins font-bold text-[#1e293b]">Leads Management</h1>
        <p className="text-[#64748b] mt-1">Review leads, check documents, set unit codes, and approve validation runs</p>
      </div>

      {/* ─── Stats Row ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button
          onClick={() => setStatusFilter('landed')}
          className={`bg-white border rounded-xl p-4 shadow-sm text-left transition-all hover:shadow-md ${
            statusFilter === 'landed' ? 'border-amber-400 ring-2 ring-amber-200' : 'border-amber-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">Landed</p>
            <Flag className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-3xl font-poppins font-bold text-amber-700 mt-2">{stats.landed}</p>
          <p className="text-xs text-[#94a3b8] mt-1">Awaiting review</p>
        </button>

        <button
          onClick={() => setStatusFilter('processing')}
          className={`bg-white border rounded-xl p-4 shadow-sm text-left transition-all hover:shadow-md ${
            statusFilter === 'processing' ? 'border-blue-400 ring-2 ring-blue-200' : 'border-blue-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">Processing</p>
            <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
          </div>
          <p className="text-3xl font-poppins font-bold text-blue-700 mt-2">{stats.processing}</p>
          <p className="text-xs text-[#94a3b8] mt-1">Validation running</p>
        </button>

        <button
          onClick={() => setStatusFilter('completed')}
          className={`bg-white border rounded-xl p-4 shadow-sm text-left transition-all hover:shadow-md ${
            statusFilter === 'completed' ? 'border-emerald-400 ring-2 ring-emerald-200' : 'border-emerald-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">Completed</p>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-3xl font-poppins font-bold text-emerald-700 mt-2">{stats.completed}</p>
          <p className="text-xs text-[#94a3b8] mt-1">Report ready</p>
        </button>

        <button
          onClick={() => setStatusFilter('all')}
          className={`bg-white border rounded-xl p-4 shadow-sm text-left transition-all hover:shadow-md ${
            statusFilter === 'all' ? 'border-[#3b82f6] ring-2 ring-blue-200' : 'border-red-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">Flagged</p>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <p className="text-3xl font-poppins font-bold text-red-700 mt-2">{stats.flagged}</p>
          <p className="text-xs text-[#94a3b8] mt-1">Unit not found</p>
        </button>
      </div>

      {/* ─── Toolbar ─────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
          <input
            type="text"
            placeholder="Search by name, email, company, or unit code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-[#dbeafe] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-transparent"
          />
        </div>
        <button
          onClick={fetchLeads}
          disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2.5 border border-[#dbeafe] rounded-lg text-sm text-[#64748b] hover:bg-[#f1f5f9] transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ─── Lead Cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredLeads.length === 0 ? (
          <div className="col-span-full text-center py-16">
            <FileText className="w-12 h-12 text-[#cbd5e1] mx-auto mb-3" />
            <p className="text-[#64748b] text-sm">No leads found matching your filters</p>
          </div>
        ) : (
          filteredLeads.map((lead) => (
            <div
              key={lead.id}
              onClick={() => openLead(lead)}
              className={`bg-white border rounded-xl p-5 shadow-sm cursor-pointer transition-all hover:shadow-md hover:border-[#3b82f6] ${
                selectedLead?.id === lead.id ? 'border-[#3b82f6] ring-2 ring-blue-100' : 'border-[#e2e8f0]'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-[#1e293b] truncate">
                      {lead.first_name} {lead.last_name}
                    </h3>
                    {lead.unit_not_found && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-red-50 border border-red-200 rounded-full text-red-600 text-xs font-medium">
                        <AlertTriangle className="w-3 h-3" />
                        Unit Not Found
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[#64748b] truncate">{lead.email}</p>
                  {lead.company_name && (
                    <p className="text-xs text-[#94a3b8] mt-0.5">{lead.company_name}</p>
                  )}
                </div>
                <StatusBadge status={lead.status} />
              </div>

              <div className="flex items-center gap-4 text-xs text-[#94a3b8]">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(lead.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                {lead.unit_code && (
                  <span className="flex items-center gap-1 font-mono bg-[#f1f5f9] px-2 py-0.5 rounded text-[#475569]">
                    <Tag className="w-3 h-3" />
                    {lead.unit_code}
                  </span>
                )}
                {lead.file_name && (
                  <span className="flex items-center gap-1 truncate max-w-[200px]">
                    <FileText className="w-3 h-3" />
                    {lead.file_name}
                  </span>
                )}
                {lead.validation_type && (
                  <span className="capitalize">{lead.validation_type}</span>
                )}
              </div>

              <div className="flex items-center justify-end mt-3">
                <span className="text-xs text-[#3b82f6] font-medium flex items-center gap-1">
                  Review <ChevronRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ─── Detail Slide-over ───────────────────────────────────────── */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setSelectedLead(null)}
          />

          {/* Panel */}
          <div className="relative w-full max-w-lg bg-white shadow-2xl overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-[#e2e8f0] px-6 py-4 z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-poppins font-bold text-[#1e293b]">
                    {selectedLead.first_name} {selectedLead.last_name}
                  </h2>
                  <p className="text-sm text-[#64748b]">Lead #{selectedLead.id}</p>
                </div>
                <button
                  onClick={() => setSelectedLead(null)}
                  className="p-2 hover:bg-[#f1f5f9] rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-[#64748b]" />
                </button>
              </div>
              <div className="mt-2">
                <StatusBadge status={selectedLead.status} />
              </div>
            </div>

            <div className="px-6 py-5 space-y-6">
              {/* ─── Contact Info ─────────────────────────────────── */}
              <div>
                <h3 className="text-sm font-semibold text-[#1e293b] mb-3 uppercase tracking-wide">Contact Details</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="w-4 h-4 text-[#94a3b8]" />
                    <a href={`mailto:${selectedLead.email}`} className="text-[#3b82f6] hover:underline">
                      {selectedLead.email}
                    </a>
                  </div>
                  {selectedLead.phone_number && (
                    <div className="flex items-center gap-3 text-sm">
                      <Phone className="w-4 h-4 text-[#94a3b8]" />
                      <span className="text-[#475569]">{selectedLead.phone_number}</span>
                    </div>
                  )}
                  {selectedLead.company_name && (
                    <div className="flex items-center gap-3 text-sm">
                      <Building2 className="w-4 h-4 text-[#94a3b8]" />
                      <span className="text-[#475569]">{selectedLead.company_name}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar className="w-4 h-4 text-[#94a3b8]" />
                    <span className="text-[#475569]">
                      Submitted {new Date(selectedLead.created_at).toLocaleString('en-AU')}
                    </span>
                  </div>
                </div>
              </div>

              {/* ─── Document ────────────────────────────────────── */}
              <div>
                <h3 className="text-sm font-semibold text-[#1e293b] mb-3 uppercase tracking-wide">Uploaded Document</h3>
                {selectedLead.file_url ? (
                  <div className="bg-[#f8f9fb] border border-[#e2e8f0] rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <FileText className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#1e293b] truncate">
                          {selectedLead.file_name || 'Uploaded file'}
                        </p>
                        <p className="text-xs text-[#94a3b8]">
                          Type: {selectedLead.validation_type || 'Not specified'}
                        </p>
                      </div>
                      <a
                        href={selectedLead.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-3 py-1.5 bg-[#3b82f6] text-white text-xs font-semibold rounded-lg hover:bg-[#2563eb] transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Eye className="w-3 h-3" />
                        View
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-700 text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    No document uploaded
                  </div>
                )}
              </div>

              {/* ─── Unit Code ───────────────────────────────────── */}
              <div>
                <h3 className="text-sm font-semibold text-[#1e293b] mb-3 uppercase tracking-wide">Unit Code</h3>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editUnitCode}
                      onChange={(e) => {
                        setEditUnitCode(e.target.value.toUpperCase());
                        setUnitLookupResult(null);
                      }}
                      placeholder="e.g. BSBWHS411"
                      className="flex-1 px-3 py-2.5 border border-[#dbeafe] rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-transparent"
                    />
                    <button
                      onClick={() => lookupUnitCode(editUnitCode)}
                      disabled={lookingUp || !editUnitCode.trim()}
                      className="px-4 py-2.5 bg-[#f1f5f9] border border-[#dbeafe] rounded-lg text-sm font-semibold text-[#475569] hover:bg-[#e2e8f0] transition-colors disabled:opacity-50"
                    >
                      {lookingUp ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* Lookup result */}
                  {unitLookupResult && (
                    <div
                      className={`rounded-lg p-3 text-sm flex items-start gap-2 ${
                        unitLookupResult.found
                          ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                          : 'bg-red-50 border border-red-200 text-red-700'
                      }`}
                    >
                      {unitLookupResult.found ? (
                        <>
                          <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-semibold">{unitLookupResult.code}</p>
                            <p className="text-xs mt-0.5">{unitLookupResult.title}</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-semibold">Unit not found</p>
                            <p className="text-xs mt-0.5">This unit code does not exist in the system. The lead will be flagged for resolution.</p>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* ─── Admin Notes ──────────────────────────────────── */}
              <div>
                <h3 className="text-sm font-semibold text-[#1e293b] mb-3 uppercase tracking-wide flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Admin Notes
                </h3>
                <textarea
                  value={editAdminNotes}
                  onChange={(e) => setEditAdminNotes(e.target.value)}
                  placeholder="Add notes about this lead..."
                  rows={3}
                  className="w-full px-3 py-2.5 border border-[#dbeafe] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-transparent resize-none"
                />
              </div>

              {/* ─── Actions ─────────────────────────────────────── */}
              <div className="space-y-3 pt-2">
                {/* Save button — always available */}
                <button
                  onClick={saveLead}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#f1f5f9] border border-[#dbeafe] rounded-lg text-sm font-semibold text-[#475569] hover:bg-[#e2e8f0] transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Changes
                </button>

                {/* Approve & Run — only for 'landed' leads */}
                {selectedLead.status === 'landed' && (
                  <button
                    onClick={approveAndRun}
                    disabled={approving}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#3b82f6] text-white rounded-lg text-sm font-semibold hover:bg-[#2563eb] transition-colors disabled:opacity-50 shadow-sm"
                  >
                    {approving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    Approve & Run Validation
                  </button>
                )}

                {/* Mark Completed — only for 'processing' leads */}
                {selectedLead.status === 'processing' && (
                  <button
                    onClick={markCompleted}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Mark as Completed
                  </button>
                )}

                {/* Completed state */}
                {selectedLead.status === 'completed' && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center">
                    <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-emerald-700">Validation Complete</p>
                    <p className="text-xs text-emerald-600 mt-1">Download the report from the All Validations module and email it to the customer.</p>
                  </div>
                )}
              </div>

              {/* ─── Payment Info ─────────────────────────────────── */}
              {selectedLead.amount_paid && (
                <div className="border-t border-[#e2e8f0] pt-4">
                  <h3 className="text-sm font-semibold text-[#1e293b] mb-2 uppercase tracking-wide">Payment</h3>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#64748b]">Amount Paid</span>
                    <span className="font-semibold text-[#1e293b]">${selectedLead.amount_paid.toFixed(2)} AUD</span>
                  </div>
                  {selectedLead.stripe_payment_status && (
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span className="text-[#64748b]">Stripe Status</span>
                      <span className="text-[#475569] capitalize">{selectedLead.stripe_payment_status}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
