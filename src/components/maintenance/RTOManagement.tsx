import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { Card } from '../ui/card';
import { Plus, Pencil, X, Search, Building2 } from 'lucide-react';

interface RTO {
  id: number;
  code: string;
  legalname: string | null;
  businessnames: string | null;
  status: string | null;
  abn: string | null;
  email: string | null;
  contactPhoneNumber: string | null;
  webaddress: string | null;
  created_at: string | null;
  _userCount?: number;
}

interface RTOFormData {
  code: string;
  legalname: string;
  businessnames: string;
  status: string;
  abn: string;
  email: string;
  contactPhoneNumber: string;
  webaddress: string;
}

const emptyForm: RTOFormData = {
  code: '',
  legalname: '',
  businessnames: '',
  status: 'Current',
  abn: '',
  email: '',
  contactPhoneNumber: '',
  webaddress: '',
};

export function RTOManagement() {
  const [rtos, setRtos] = useState<RTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<RTOFormData>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  const loadRTOs = async () => {
    setIsLoading(true);
    try {
      // Fetch RTOs
      const { data: rtoData, error: rtoError } = await supabase
        .from('RTO')
        .select('*')
        .order('legalname', { ascending: true });

      if (rtoError) throw rtoError;

      // Fetch user counts per RTO
      const { data: userCounts, error: ucError } = await supabase
        .from('user_profiles')
        .select('rto_id');

      if (ucError) {
        console.error('Error fetching user counts:', ucError);
      }

      // Count users per RTO
      const countMap: Record<number, number> = {};
      (userCounts || []).forEach((u: any) => {
        if (u.rto_id) {
          countMap[u.rto_id] = (countMap[u.rto_id] || 0) + 1;
        }
      });

      const enriched = (rtoData || []).map((rto: any) => ({
        ...rto,
        _userCount: countMap[rto.id] || 0,
      }));

      setRtos(enriched);
    } catch (err) {
      console.error('Error loading RTOs:', err);
      toast.error('Failed to load RTOs');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRTOs();
  }, []);

  const handleEdit = (rto: RTO) => {
    setEditingId(rto.id);
    setFormData({
      code: rto.code || '',
      legalname: rto.legalname || '',
      businessnames: rto.businessnames || '',
      status: rto.status || 'Current',
      abn: rto.abn || '',
      email: rto.email || '',
      contactPhoneNumber: rto.contactPhoneNumber || '',
      webaddress: rto.webaddress || '',
    });
    setShowForm(true);
  };

  const handleCreate = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData(emptyForm);
  };

  const handleSave = async () => {
    if (!formData.code.trim()) {
      toast.error('RTO code is required');
      return;
    }
    if (!formData.legalname.trim()) {
      toast.error('Legal name is required');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        code: formData.code.trim(),
        legalname: formData.legalname.trim(),
        businessnames: formData.businessnames.trim() || null,
        status: formData.status || 'Current',
        abn: formData.abn.trim() || null,
        email: formData.email.trim() || null,
        contactPhoneNumber: formData.contactPhoneNumber.trim() || null,
        webaddress: formData.webaddress.trim() || null,
      };

      if (editingId) {
        // Update existing
        const { error } = await supabase
          .from('RTO')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
        toast.success('RTO updated successfully');
      } else {
        // Create new
        const { error } = await supabase
          .from('RTO')
          .insert(payload);
        if (error) throw error;
        toast.success('RTO created successfully');
      }

      handleCancel();
      await loadRTOs();
    } catch (err: any) {
      console.error('Error saving RTO:', err);
      if (err.message?.includes('duplicate') || err.message?.includes('unique')) {
        toast.error('An RTO with this code already exists');
      } else {
        toast.error(err.message || 'Failed to save RTO');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const filteredRTOs = rtos.filter((rto) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      rto.code?.toLowerCase().includes(term) ||
      rto.legalname?.toLowerCase().includes(term) ||
      rto.abn?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-poppins font-bold text-[#1e293b]">RTO Management</h2>
          <p className="text-[#64748b] text-sm mt-1">Create and manage Registered Training Organisations</p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white font-semibold rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create RTO
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
        <input
          type="text"
          placeholder="Search by code, name, or ABN..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-transparent"
        />
      </div>

      {/* Form */}
      {showForm && (
        <Card className="border border-[#dbeafe] bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-[#1e293b]">
              {editingId ? 'Edit RTO' : 'Create New RTO'}
            </h3>
            <button onClick={handleCancel} className="text-[#94a3b8] hover:text-[#64748b]">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#64748b] mb-1">RTO Code *</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
                placeholder="e.g. 71480000"
                disabled={!!editingId}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#64748b] mb-1">Legal Name *</label>
              <input
                type="text"
                value={formData.legalname}
                onChange={(e) => setFormData({ ...formData, legalname: e.target.value })}
                className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
                placeholder="e.g. Nytro Pty Ltd"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#64748b] mb-1">Business Names</label>
              <input
                type="text"
                value={formData.businessnames}
                onChange={(e) => setFormData({ ...formData, businessnames: e.target.value })}
                className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
                placeholder="Trading names"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#64748b] mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
              >
                <option value="Current">Current</option>
                <option value="Inactive">Inactive</option>
                <option value="Suspended">Suspended</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#64748b] mb-1">ABN</label>
              <input
                type="text"
                value={formData.abn}
                onChange={(e) => setFormData({ ...formData, abn: e.target.value })}
                className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
                placeholder="12 345 678 901"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#64748b] mb-1">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
                placeholder="admin@rto.com.au"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#64748b] mb-1">Phone</label>
              <input
                type="text"
                value={formData.contactPhoneNumber}
                onChange={(e) => setFormData({ ...formData, contactPhoneNumber: e.target.value })}
                className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
                placeholder="02 1234 5678"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#64748b] mb-1">Website</label>
              <input
                type="text"
                value={formData.webaddress}
                onChange={(e) => setFormData({ ...formData, webaddress: e.target.value })}
                className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
                placeholder="https://www.rto.com.au"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={handleCancel}
              className="px-4 py-2 border border-[#e2e8f0] rounded-lg text-sm font-semibold text-[#64748b] hover:bg-[#f1f5f9] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white font-semibold rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : editingId ? 'Update RTO' : 'Create RTO'}
            </button>
          </div>
        </Card>
      )}

      {/* RTO List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3b82f6]"></div>
        </div>
      ) : filteredRTOs.length === 0 ? (
        <Card className="border border-[#e2e8f0] p-8 text-center">
          <Building2 className="w-12 h-12 text-[#cbd5e1] mx-auto mb-3" />
          <p className="text-[#64748b]">
            {searchTerm ? 'No RTOs match your search' : 'No RTOs found. Create one to get started.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredRTOs.map((rto) => (
            <Card key={rto.id} className="border border-[#e2e8f0] p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-sm font-mono font-semibold text-[#3b82f6] bg-[#eff6ff] px-2 py-0.5 rounded">
                      {rto.code}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      rto.status === 'Current'
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : rto.status === 'Suspended'
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : 'bg-gray-50 text-gray-700 border border-gray-200'
                    }`}>
                      {rto.status || 'Unknown'}
                    </span>
                    <span className="text-xs text-[#94a3b8]">
                      {rto._userCount} {rto._userCount === 1 ? 'user' : 'users'}
                    </span>
                  </div>
                  <h4 className="font-semibold text-[#1e293b] truncate">{rto.legalname || 'Unnamed RTO'}</h4>
                  <div className="flex items-center gap-4 mt-1 text-xs text-[#94a3b8]">
                    {rto.abn && <span>ABN: {rto.abn}</span>}
                    {rto.email && <span>{rto.email}</span>}
                    {rto.webaddress && <span>{rto.webaddress}</span>}
                  </div>
                </div>
                <button
                  onClick={() => handleEdit(rto)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#3b82f6] hover:bg-[#eff6ff] rounded-lg transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
