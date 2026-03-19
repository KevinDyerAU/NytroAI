/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Admin — Stripe Discounts / Promo Codes Management
 * Full CRUD for promo_codes table: create, edit, toggle active, delete.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Search,
  RefreshCw,
  Loader2,
  AlertTriangle,
  X,
  Save,
  Tag,
  Percent,
  DollarSign,
  Calendar,
  Users,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface PromoCode {
  id: number;
  code: string;
  description: string | null;
  discount_percent: number | null;
  discount_amount: number | null;
  valid_from: string | null;
  valid_until: string | null;
  max_uses: number | null;
  current_uses: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface PromoFormData {
  code: string;
  description: string;
  discountType: 'percent' | 'amount';
  discountValue: string;
  maxUses: string;
  validDays: string;
}

const emptyForm: PromoFormData = {
  code: '',
  description: '',
  discountType: 'percent',
  discountValue: '',
  maxUses: '',
  validDays: '365',
};

// ─── Main Component ──────────────────────────────────────────────────────────
export function StripeDiscountsMaintenance() {
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(false);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<PromoFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // ─── Fetch promo codes ────────────────────────────────────────────────
  const fetchPromoCodes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('promo_codes')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setPromoCodes(data || []);
    } catch (err) {
      console.error('[StripeDiscounts] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load promo codes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPromoCodes();
  }, [fetchPromoCodes]);

  // ─── Filtered list ────────────────────────────────────────────────────
  const filteredCodes = useMemo(() => {
    let result = [...promoCodes];
    if (showActiveOnly) {
      result = result.filter((p) => p.is_active);
    }
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (p) =>
          p.code.toLowerCase().includes(term) ||
          (p.description && p.description.toLowerCase().includes(term))
      );
    }
    return result;
  }, [promoCodes, showActiveOnly, searchTerm]);

  // ─── Stats ────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = promoCodes.length;
    const active = promoCodes.filter((p) => p.is_active).length;
    const totalUses = promoCodes.reduce((sum, p) => sum + p.current_uses, 0);
    const expired = promoCodes.filter(
      (p) => p.valid_until && new Date(p.valid_until) < new Date()
    ).length;
    return { total, active, totalUses, expired };
  }, [promoCodes]);

  // ─── Open create form ─────────────────────────────────────────────────
  const openCreate = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setFormError(null);
    setShowForm(true);
  };

  // ─── Open edit form ───────────────────────────────────────────────────
  const openEdit = (promo: PromoCode) => {
    setEditingId(promo.id);
    setFormData({
      code: promo.code,
      description: promo.description || '',
      discountType: promo.discount_percent != null ? 'percent' : 'amount',
      discountValue: String(promo.discount_percent ?? promo.discount_amount ?? ''),
      maxUses: promo.max_uses != null ? String(promo.max_uses) : '',
      validDays: '', // not applicable for edit
    });
    setFormError(null);
    setShowForm(true);
  };

  // ─── Save (create or update) ──────────────────────────────────────────
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.code.trim()) {
      setFormError('Promo code is required');
      return;
    }
    if (!formData.discountValue || Number(formData.discountValue) <= 0) {
      setFormError('Please enter a valid discount value');
      return;
    }
    if (formData.discountType === 'percent' && Number(formData.discountValue) > 100) {
      setFormError('Percentage discount cannot exceed 100%');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        // Update
        const { error: updateError } = await supabase
          .from('promo_codes')
          .update({
            code: formData.code.trim().toUpperCase(),
            description: formData.description || null,
            discount_percent:
              formData.discountType === 'percent' ? Number(formData.discountValue) : null,
            discount_amount:
              formData.discountType === 'amount' ? Number(formData.discountValue) : null,
            max_uses: formData.maxUses ? Number(formData.maxUses) : null,
          })
          .eq('id', editingId);

        if (updateError) throw updateError;
      } else {
        // Create
        const validUntil = new Date();
        validUntil.setDate(validUntil.getDate() + Number(formData.validDays || 365));

        const { error: insertError } = await supabase.from('promo_codes').insert({
          code: formData.code.trim().toUpperCase(),
          description: formData.description || null,
          discount_percent:
            formData.discountType === 'percent' ? Number(formData.discountValue) : null,
          discount_amount:
            formData.discountType === 'amount' ? Number(formData.discountValue) : null,
          max_uses: formData.maxUses ? Number(formData.maxUses) : null,
          valid_until: validUntil.toISOString(),
          is_active: true,
        });

        if (insertError) {
          if (insertError.code === '23505') {
            setFormError('A promo code with this name already exists');
            return;
          }
          throw insertError;
        }
      }

      setShowForm(false);
      setFormData(emptyForm);
      setEditingId(null);
      await fetchPromoCodes();
    } catch (err) {
      console.error('[StripeDiscounts] Save error:', err);
      setFormError(err instanceof Error ? err.message : 'Failed to save promo code');
    } finally {
      setSaving(false);
    }
  };

  // ─── Toggle active ────────────────────────────────────────────────────
  const toggleActive = async (promo: PromoCode) => {
    try {
      const { error: updateError } = await supabase
        .from('promo_codes')
        .update({ is_active: !promo.is_active })
        .eq('id', promo.id);

      if (updateError) throw updateError;
      await fetchPromoCodes();
    } catch (err) {
      console.error('[StripeDiscounts] Toggle error:', err);
      alert('Failed to toggle promo code status');
    }
  };

  // ─── Delete ───────────────────────────────────────────────────────────
  const deletePromo = async (promo: PromoCode) => {
    if (!confirm(`Are you sure you want to delete promo code "${promo.code}"?`)) return;
    try {
      const { error: deleteError } = await supabase
        .from('promo_codes')
        .delete()
        .eq('id', promo.id);

      if (deleteError) throw deleteError;
      await fetchPromoCodes();
    } catch (err) {
      console.error('[StripeDiscounts] Delete error:', err);
      alert('Failed to delete promo code');
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────
  if (loading && promoCodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[#3b82f6] animate-spin" />
          <p className="text-[#64748b] text-sm">Loading promo codes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Stats ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-[#dbeafe] rounded-xl p-4 shadow-sm">
          <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">Total Codes</p>
          <p className="text-2xl font-sans font-bold text-[#1e293b] mt-1">{stats.total}</p>
        </div>
        <div className="bg-white border border-green-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">Active</p>
          <p className="text-2xl font-sans font-bold text-green-700 mt-1">{stats.active}</p>
        </div>
        <div className="bg-white border border-[#dbeafe] rounded-xl p-4 shadow-sm">
          <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">Total Uses</p>
          <p className="text-2xl font-sans font-bold text-[#1e293b] mt-1">{stats.totalUses}</p>
        </div>
        <div className="bg-white border border-amber-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-[#64748b] font-medium uppercase tracking-wide">Expired</p>
          <p className="text-2xl font-sans font-bold text-amber-700 mt-1">{stats.expired}</p>
        </div>
      </div>

      {/* ─── Toolbar ──────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
            <input
              type="text"
              placeholder="Search codes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border border-[#dbeafe] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-transparent w-56"
            />
          </div>
          <button
            onClick={() => setShowActiveOnly(!showActiveOnly)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
              showActiveOnly
                ? 'bg-green-50 border-green-300 text-green-700'
                : 'bg-white border-[#dbeafe] text-[#64748b] hover:bg-[#f1f5f9]'
            }`}
          >
            {showActiveOnly ? (
              <ToggleRight className="w-4 h-4" />
            ) : (
              <ToggleLeft className="w-4 h-4" />
            )}
            Active Only
          </button>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchPromoCodes}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 border border-[#dbeafe] rounded-lg text-sm text-[#64748b] hover:bg-[#f1f5f9] transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#3b82f6] text-white rounded-lg text-sm font-semibold hover:bg-[#2563eb] transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Promo Code
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ─── Cards Grid ───────────────────────────────────────────────── */}
      {filteredCodes.length === 0 ? (
        <div className="bg-white border border-[#dbeafe] rounded-xl p-12 text-center">
          <Tag className="w-12 h-12 text-[#cbd5e1] mx-auto mb-3" />
          <p className="text-[#94a3b8] text-sm">
            {promoCodes.length === 0
              ? 'No promo codes yet. Create one to get started.'
              : 'No promo codes match your filters.'}
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCodes.map((promo) => {
            const isExpired = promo.valid_until && new Date(promo.valid_until) < new Date();
            const usageFull = promo.max_uses != null && promo.current_uses >= promo.max_uses;

            return (
              <div
                key={promo.id}
                className={`bg-white border rounded-xl p-5 shadow-sm transition-all hover:shadow-md ${
                  !promo.is_active || isExpired
                    ? 'border-[#e2e8f0] opacity-70'
                    : 'border-[#dbeafe]'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-lg font-bold text-[#1e293b]">
                        {promo.code}
                      </span>
                      {!promo.is_active && (
                        <span className="text-xs bg-[#f1f5f9] text-[#94a3b8] px-2 py-0.5 rounded-full font-medium">
                          Inactive
                        </span>
                      )}
                      {isExpired && (
                        <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-medium">
                          Expired
                        </span>
                      )}
                    </div>
                    {promo.description && (
                      <p className="text-xs text-[#94a3b8] mt-1">{promo.description}</p>
                    )}
                  </div>
                  {/* Discount badge */}
                  <div className="flex items-center gap-1 bg-[#f0fdf4] text-green-700 px-2.5 py-1 rounded-lg text-sm font-bold">
                    {promo.discount_percent != null ? (
                      <>
                        <Percent className="w-3.5 h-3.5" />
                        {promo.discount_percent}%
                      </>
                    ) : (
                      <>
                        <DollarSign className="w-3.5 h-3.5" />
                        {promo.discount_amount?.toFixed(2)}
                      </>
                    )}
                  </div>
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-2 text-xs text-[#64748b] mb-4">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3 h-3" />
                    <span>
                      {promo.current_uses}
                      {promo.max_uses != null ? ` / ${promo.max_uses}` : ''} uses
                    </span>
                    {usageFull && (
                      <span className="text-amber-500 font-semibold">(Full)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" />
                    <span>
                      {promo.valid_until
                        ? `Until ${new Date(promo.valid_until).toLocaleDateString('en-AU', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}`
                        : 'No expiry'}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3 border-t border-[#f1f5f9]">
                  <button
                    onClick={() => openEdit(promo)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#3b82f6] hover:bg-[#eff6ff] rounded-lg transition-colors"
                  >
                    <Pencil className="w-3 h-3" />
                    Edit
                  </button>
                  <button
                    onClick={() => toggleActive(promo)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      promo.is_active
                        ? 'text-amber-600 hover:bg-amber-50'
                        : 'text-green-600 hover:bg-green-50'
                    }`}
                  >
                    {promo.is_active ? (
                      <>
                        <ToggleLeft className="w-3 h-3" />
                        Deactivate
                      </>
                    ) : (
                      <>
                        <ToggleRight className="w-3 h-3" />
                        Activate
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => deletePromo(promo)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-auto"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Create / Edit Dialog ─────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setShowForm(false)}
          />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl border border-[#dbeafe]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-sans font-bold text-[#1e293b]">
                {editingId ? 'Edit Promo Code' : 'New Promo Code'}
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="p-2 hover:bg-[#f1f5f9] rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-[#64748b]" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs text-[#64748b] mb-1 font-medium">
                  Code *
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))
                  }
                  placeholder="e.g. WELCOME10"
                  className="w-full px-3 py-2 border border-[#dbeafe] rounded-lg text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-[#64748b] mb-1 font-medium">
                  Description
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Brief description of this promo"
                  className="w-full px-3 py-2 border border-[#dbeafe] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#64748b] mb-1 font-medium">
                    Discount Type
                  </label>
                  <select
                    value={formData.discountType}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        discountType: e.target.value as 'percent' | 'amount',
                      }))
                    }
                    className="w-full px-3 py-2 border border-[#dbeafe] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
                  >
                    <option value="percent">Percentage (%)</option>
                    <option value="amount">Fixed Amount ($)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[#64748b] mb-1 font-medium">
                    Value *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={formData.discountType === 'percent' ? '100' : undefined}
                    value={formData.discountValue}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, discountValue: e.target.value }))
                    }
                    placeholder={formData.discountType === 'percent' ? '10' : '25.00'}
                    className="w-full px-3 py-2 border border-[#dbeafe] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#64748b] mb-1 font-medium">
                    Max Uses
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.maxUses}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, maxUses: e.target.value }))
                    }
                    placeholder="Unlimited"
                    className="w-full px-3 py-2 border border-[#dbeafe] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
                  />
                </div>
                {!editingId && (
                  <div>
                    <label className="block text-xs text-[#64748b] mb-1 font-medium">
                      Valid For (days)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.validDays}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, validDays: e.target.value }))
                      }
                      placeholder="365"
                      className="w-full px-3 py-2 border border-[#dbeafe] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
                    />
                  </div>
                )}
              </div>

              {formError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {formError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2.5 border border-[#dbeafe] rounded-lg text-sm font-medium text-[#64748b] hover:bg-[#f1f5f9] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#3b82f6] text-white rounded-lg text-sm font-semibold hover:bg-[#2563eb] disabled:opacity-50 transition-colors shadow-sm"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      {editingId ? 'Update' : 'Create'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
