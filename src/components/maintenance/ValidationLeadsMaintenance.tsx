/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Admin — Validation Leads Management
 * View all $99 validation leads, look up unit codes, flag missing units,
 * add admin notes, and export to CSV.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Search,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  CreditCard,
  FileText,
  ChevronDown,
  ChevronUp,
  X,
  Loader2,
  Flag,
  Eye,
  Save,
  ExternalLink,
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
  promo_code: string | null;
  discount_amount: number | null;
}

type StatusFilter = 'all' | 'pending' | 'paid' | 'landed' | 'processing' | 'completed' | 'cancelled';
type SortField = 'created_at' | 'status' | 'email' | 'company_name';
type SortDir = 'asc' | 'desc';

// ─── Status badge colours ────────────────────────────────────────────────────
const statusConfig: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  pending: {
    bg: 'bg-amber-50 border-amber-200',
    text: 'text-amber-700',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  paid: {
    bg: 'bg-green-50 border-green-200',
    text: 'text-green-700',
    icon: <CreditCard className="w-3.5 h-3.5" />,
  },
  landed: {
    bg: 'bg-amber-50 border-amber-300',
    text: 'text-amber-700',
    icon: <Flag className="w-3.5 h-3.5" />,
  },
  processing: {
    bg: 'bg-blue-50 border-blue-200',
    text: 'text-blue-700',
    icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
  },
  completed: {
    bg: 'bg-emerald-50 border-emerald-200',
    text: 'text-emerald-700',
    icon: <CheckCircle className="w-3.5 h-3.5" />,
  },
  cancelled: {
    bg: 'bg-red-50 border-red-200',
    text: 'text-red-700',
    icon: <X className="w-3.5 h-3.5" />,
  },
};

function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || statusConfig.pending;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.bg} ${config.text}`}
    >
      {config.icon}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export function ValidationLeadsMaintenance() {
  const [leads, setLeads] = useState<ValidationLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Detail panel
  const [selectedLead, setSelectedLead] = useState<ValidationLead | null>(null);
  const [editUnitCode, setEditUnitCode] = useState('');
  const [editAdminNotes, setEditAdminNotes] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [unitLookupResult, setUnitLookupResult] = useState<{
    found: boolean;
    title?: string;
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
      console.error('[ValidationLeads] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // ─── Filter + sort ────────────────────────────────────────────────────
  const filteredLeads = useMemo(() => {
    let result = [...leads];

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((l) => l.status === statusFilter);
    }

    // Flagged only
    if (showFlaggedOnly) {
      result = result.filter((l) => l.unit_not_found === true);
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

    // Sort
    result.sort((a, b) => {
      let valA: string | number = '';
      let valB: string | number = '';
      switch (sortField) {
        case 'created_at':
          valA = new Date(a.created_at).getTime();
          valB = new Date(b.created_at).getTime();
          break;
        case 'status':
          valA = a.status || '';
          valB = b.status || '';
          break;
        case 'email':
          valA = a.email.toLowerCase();
          valB = b.email.toLowerCase();
          break;
        case 'company_name':
          valA = (a.company_name || '').toLowerCase();
          valB = (b.company_name || '').toLowerCase();
          break;
      }
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [leads, statusFilter, showFlaggedOnly, searchTerm, sortField, sortDir]);

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
        setUnitLookupResult({ found: true, title: data.Title || '' });
      }
    } catch {
      setUnitLookupResult({ found: false });
    } finally {
      setLookingUp(false);
    }
  };

  // ─── Open detail panel ────────────────────────────────────────────────
  const openDetail = (lead: ValidationLead) => {
    setSelectedLead(lead);
    setEditUnitCode(lead.unit_code || '');
    setEditAdminNotes(lead.admin_notes || '');
    setEditStatus(lead.status || 'pending');
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
          status: editStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedLead.id);

      if (updateError) throw updateError;

      // Refresh the list
      await fetchLeads();

      // Update selected lead in-place
      setSelectedLead((prev) =>
        prev
          ? {
              ...prev,
              unit_code: editUnitCode.trim() || null,
              unit_not_found: unitNotFound,
              admin_notes: editAdminNotes.trim() || null,
              status: editStatus,
            }
          : null
      );
    } catch (err) {
      console.error('[ValidationLeads] Save error:', err);
      alert('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ─── CSV Export ───────────────────────────────────────────────────────
  const exportCSV = () => {
    const headers = [
      'ID',
      'Created',
      'First Name',
      'Last Name',
      'Email',
      'Company',
      'Phone',
      'Status',
      'Payment Status',
      'Amount Paid',
      'Unit Code',
      'Unit Not Found',
      'File Name',
      'Admin Notes',
    ];

    const rows = filteredLeads.map((l) => [
      l.id,
      new Date(l.created_at).toLocaleString('en-AU'),
      l.first_name,
      l.last_name,
      l.email,
      l.company_name || '',
      l.phone_number || '',
      l.status,
      l.stripe_payment_status || '',
      l.amount_paid != null ? `$${l.amount_paid.toFixed(2)}` : '',
      l.unit_code || '',
      l.unit_not_found ? 'YES' : '',
      l.file_name || '',
      l.admin_notes || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `validation-leads-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // ─── Stats ────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = leads.length;
    const paid = leads.filter((l) => l.status === 'paid' || l.stripe_payment_status === 'paid').length;
    const pending = leads.filter((l) => l.status === 'pending').length;
    const flagged = leads.filter((l) => l.unit_not_found === true).length;
    const revenue = leads
      .filter((l) => l.amount_paid != null)
      .reduce((sum, l) => sum + (l.amount_paid || 0), 0);
    return { total, paid, pending, flagged, revenue };
  }, [leads]);

  // ─── Render ───────────────────────────────────────────────────────────
  if (loading && leads.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[#3b82f6] animate-spin" />
          <p className="text-[#64748b] text-sm">Loading validation leads...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Stats Cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white border border-[#dbeafe] rounded-xl p-4 shadow-sm">
          <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">Total Leads</p>
          <p className="text-2xl font-poppins font-bold text-[#1e293b] mt-1">{stats.total}</p>
        </div>
        <div className="bg-white border border-green-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">Paid</p>
          <p className="text-2xl font-poppins font-bold text-green-700 mt-1">{stats.paid}</p>
        </div>
        <div className="bg-white border border-amber-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">Pending</p>
          <p className="text-2xl font-poppins font-bold text-amber-700 mt-1">{stats.pending}</p>
        </div>
        <div className="bg-white border border-red-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">Flagged</p>
          <p className="text-2xl font-poppins font-bold text-red-700 mt-1">{stats.flagged}</p>
        </div>
        <div className="bg-white border border-[#dbeafe] rounded-xl p-4 shadow-sm">
          <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">Revenue</p>
          <p className="text-2xl font-poppins font-bold text-[#1e293b] mt-1">
            ${stats.revenue.toFixed(2)}
          </p>
        </div>
      </div>

      {/* ─── Toolbar ──────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
            <input
              type="text"
              placeholder="Search leads..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border border-[#dbeafe] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-transparent w-64"
            />
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="px-3 py-2 border border-[#dbeafe] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="landed">Landed</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {/* Flagged toggle */}
          <button
            onClick={() => setShowFlaggedOnly(!showFlaggedOnly)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
              showFlaggedOnly
                ? 'bg-red-50 border-red-300 text-red-700'
                : 'bg-white border-[#dbeafe] text-[#64748b] hover:bg-[#f1f5f9]'
            }`}
          >
            <Flag className="w-3.5 h-3.5" />
            Flagged Only
          </button>
        </div>

        <div className="flex gap-3">
          <button
            onClick={fetchLeads}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 border border-[#dbeafe] rounded-lg text-sm text-[#64748b] hover:bg-[#f1f5f9] transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#3b82f6] text-white rounded-lg text-sm font-semibold hover:bg-[#2563eb] transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
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
                <th className="text-left px-4 py-3 font-semibold text-[#64748b]">
                  <button onClick={() => toggleSort('created_at')} className="hover:text-[#1e293b]">
                    Date <SortIcon field="created_at" />
                  </button>
                </th>
                <th className="text-left px-4 py-3 font-semibold text-[#64748b]">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-[#64748b]">
                  <button onClick={() => toggleSort('email')} className="hover:text-[#1e293b]">
                    Email <SortIcon field="email" />
                  </button>
                </th>
                <th className="text-left px-4 py-3 font-semibold text-[#64748b]">
                  <button onClick={() => toggleSort('company_name')} className="hover:text-[#1e293b]">
                    Company <SortIcon field="company_name" />
                  </button>
                </th>
                <th className="text-left px-4 py-3 font-semibold text-[#64748b]">Unit Code</th>
                <th className="text-left px-4 py-3 font-semibold text-[#64748b]">
                  <button onClick={() => toggleSort('status')} className="hover:text-[#1e293b]">
                    Status <SortIcon field="status" />
                  </button>
                </th>
                <th className="text-left px-4 py-3 font-semibold text-[#64748b]">Paid</th>
                <th className="text-left px-4 py-3 font-semibold text-[#64748b]">File</th>
                <th className="text-right px-4 py-3 font-semibold text-[#64748b]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-[#94a3b8]">
                    {leads.length === 0
                      ? 'No validation leads yet.'
                      : 'No leads match your filters.'}
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => (
                  <tr
                    key={lead.id}
                    className={`border-b border-[#f1f5f9] hover:bg-[#f8f9fb] transition-colors cursor-pointer ${
                      lead.unit_not_found ? 'bg-red-50/50' : ''
                    }`}
                    onClick={() => openDetail(lead)}
                  >
                    <td className="px-4 py-3 text-[#64748b] whitespace-nowrap">
                      {new Date(lead.created_at).toLocaleDateString('en-AU', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3 font-medium text-[#1e293b] whitespace-nowrap">
                      {lead.first_name} {lead.last_name}
                    </td>
                    <td className="px-4 py-3 text-[#64748b]">{lead.email}</td>
                    <td className="px-4 py-3 text-[#64748b]">{lead.company_name || '—'}</td>
                    <td className="px-4 py-3">
                      {lead.unit_code ? (
                        <span className="flex items-center gap-1.5">
                          <span className="font-mono text-xs bg-[#f1f5f9] px-2 py-0.5 rounded">
                            {lead.unit_code}
                          </span>
                          {lead.unit_not_found && (
                            <span title="Unit not found in system" className="text-red-500">
                              <AlertTriangle className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-[#cbd5e1] text-xs">Not set</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={lead.status || 'pending'} />
                    </td>
                    <td className="px-4 py-3 text-[#64748b]">
                      {lead.amount_paid != null ? `$${lead.amount_paid.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {lead.file_name ? (
                        (() => {
                          const fileNames = lead.file_name!.split(',').map(n => n.trim()).filter(Boolean);
                          return (
                            <span className="flex items-center gap-1 text-[#3b82f6]" title={fileNames.join('\n')}>
                              <FileText className="w-3.5 h-3.5" />
                              {fileNames.length === 1 ? (
                                <span className="text-xs truncate max-w-[80px]">{fileNames[0]}</span>
                              ) : (
                                <span className="text-xs font-medium">{fileNames.length} files</span>
                              )}
                            </span>
                          );
                        })()
                      ) : (
                        <span className="text-[#cbd5e1] text-xs">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openDetail(lead);
                        }}
                        className="text-[#3b82f6] hover:text-[#2563eb] p-1"
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 bg-[#f8f9fb] border-t border-[#dbeafe] text-xs text-[#94a3b8]">
          Showing {filteredLeads.length} of {leads.length} leads
        </div>
      </div>

      {/* ─── Detail Slide-over Panel ──────────────────────────────────── */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setSelectedLead(null)}
          />
          <div className="relative w-full max-w-lg bg-white shadow-2xl overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-[#dbeafe] px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h3 className="text-lg font-poppins font-bold text-[#1e293b]">
                  Lead #{selectedLead.id}
                </h3>
                <p className="text-xs text-[#94a3b8]">
                  {new Date(selectedLead.created_at).toLocaleString('en-AU')}
                </p>
              </div>
              <button
                onClick={() => setSelectedLead(null)}
                className="p-2 hover:bg-[#f1f5f9] rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-[#64748b]" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Contact Info */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-[#1e293b] uppercase tracking-wide">
                  Contact Details
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[#94a3b8] text-xs">Name</p>
                    <p className="font-medium text-[#1e293b]">
                      {selectedLead.first_name} {selectedLead.last_name}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#94a3b8] text-xs">Email</p>
                    <p className="font-medium text-[#1e293b]">{selectedLead.email}</p>
                  </div>
                  <div>
                    <p className="text-[#94a3b8] text-xs">Company</p>
                    <p className="font-medium text-[#1e293b]">
                      {selectedLead.company_name || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#94a3b8] text-xs">Phone</p>
                    <p className="font-medium text-[#1e293b]">
                      {selectedLead.phone_number || '—'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Payment Info */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-[#1e293b] uppercase tracking-wide">
                  Payment
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[#94a3b8] text-xs">Amount</p>
                    <p className="font-medium text-[#1e293b]">
                      {selectedLead.amount_paid != null
                        ? `$${selectedLead.amount_paid.toFixed(2)}`
                        : 'Not paid'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#94a3b8] text-xs">Stripe Status</p>
                    <p className={`font-medium ${selectedLead.stripe_payment_status === 'paid' ? 'text-emerald-600' : 'text-[#1e293b]'}`}>
                      {selectedLead.stripe_payment_status || '—'}
                    </p>
                  </div>
                  {selectedLead.promo_code && (
                    <div>
                      <p className="text-[#94a3b8] text-xs">Promo Code</p>
                      <p className="font-mono font-semibold text-purple-600">{selectedLead.promo_code}</p>
                    </div>
                  )}
                  {selectedLead.discount_amount != null && selectedLead.discount_amount > 0 && (
                    <div>
                      <p className="text-[#94a3b8] text-xs">Discount</p>
                      <p className="font-semibold text-orange-600">-${selectedLead.discount_amount.toFixed(2)}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Files */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-[#1e293b] uppercase tracking-wide">
                  Uploaded Files
                </h4>
                {selectedLead.file_url ? (
                  <div className="space-y-2">
                    {(() => {
                      const paths = selectedLead.file_url!.split(',').map(p => p.trim()).filter(Boolean);
                      const names = (selectedLead.file_name || '').split(',').map(n => n.trim()).filter(Boolean);
                      return paths.map((storagePath, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-3 bg-[#f8f9fb] border border-[#dbeafe] rounded-lg">
                          <FileText className="w-5 h-5 text-[#3b82f6] flex-shrink-0" />
                          <span className="text-sm text-[#1e293b] truncate flex-1">
                            {names[idx] || `File ${idx + 1}`}
                          </span>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              const fileName = names[idx] || `file-${idx + 1}`;
                              const { data } = await supabase.storage
                                .from('documents')
                                .createSignedUrl(storagePath, 3600, { download: fileName });
                              if (data?.signedUrl) {
                                window.location.href = data.signedUrl;
                              } else {
                                alert('Could not generate download link. Please try again.');
                              }
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 bg-[#3b82f6] text-white text-xs font-semibold rounded-lg hover:bg-[#2563eb] transition-colors"
                            title="Download file"
                          >
                            <Download className="w-3 h-3" />
                            Download
                          </button>
                        </div>
                      ));
                    })()}
                  </div>
                ) : (
                  <div className="text-sm text-[#94a3b8] bg-[#f8f9fb] border border-[#dbeafe] rounded-lg p-3">
                    No files uploaded
                  </div>
                )}
              </div>

              {/* ─── Admin Editable Fields ─────────────────────────────── */}
              <div className="border-t border-[#dbeafe] pt-6 space-y-4">
                <h4 className="text-sm font-semibold text-[#1e293b] uppercase tracking-wide">
                  Admin Actions
                </h4>

                {/* Status */}
                <div>
                  <label className="block text-xs text-[#64748b] mb-1 font-medium">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-[#dbeafe] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
                  >
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="processing">Processing</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                {/* Unit Code with lookup */}
                <div>
                  <label className="block text-xs text-[#64748b] mb-1 font-medium">
                    Unit Code
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editUnitCode}
                      onChange={(e) => {
                        setEditUnitCode(e.target.value.toUpperCase());
                        setUnitLookupResult(null);
                      }}
                      placeholder="e.g. BSBWHS411"
                      className="flex-1 px-3 py-2 border border-[#dbeafe] rounded-lg text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
                    />
                    <button
                      onClick={() => lookupUnitCode(editUnitCode)}
                      disabled={lookingUp || editUnitCode.trim().length < 3}
                      className="px-3 py-2 bg-[#f1f5f9] border border-[#dbeafe] rounded-lg text-sm text-[#64748b] hover:bg-[#e2e8f0] disabled:opacity-50 transition-colors"
                    >
                      {lookingUp ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {unitLookupResult && (
                    <div className="mt-2">
                      {unitLookupResult.found ? (
                        <div className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Found: {unitLookupResult.title}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Unit not found in system — will be flagged
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Admin Notes */}
                <div>
                  <label className="block text-xs text-[#64748b] mb-1 font-medium">
                    Admin Notes
                  </label>
                  <textarea
                    value={editAdminNotes}
                    onChange={(e) => setEditAdminNotes(e.target.value)}
                    rows={3}
                    placeholder="Internal notes about this lead..."
                    className="w-full px-3 py-2 border border-[#dbeafe] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6] resize-none"
                  />
                </div>

                {/* Save */}
                <button
                  onClick={saveLead}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#3b82f6] text-white rounded-lg text-sm font-semibold hover:bg-[#2563eb] disabled:opacity-50 transition-colors shadow-sm"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
