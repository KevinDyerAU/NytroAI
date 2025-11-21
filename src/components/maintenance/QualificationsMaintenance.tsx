import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { Trash2, Edit, Plus, Search, ChevronLeft, ChevronRight, Checkbox } from 'lucide-react';
import { toast } from 'sonner';
import { insertQualification, updateQualification, deleteQualification } from '../../types/rto';
import { useAuth } from '../../hooks/useAuth';

interface QualificationRecord {
  id: number;
  qualifcaitionCode: string;
  rtocode: string;
  description?: string;
  Link?: string;
  created_at?: string;
}

interface RTO {
  id: number;
  code: string;
  legalname: string;
}

export function QualificationsMaintenance() {
  const { user } = useAuth();
  const [qualifications, setQualifications] = useState<QualificationRecord[]>([]);
  const [rtOs, setRTOs] = useState<RTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [formData, setFormData] = useState({
    qualifcaitionCode: '',
    rtocode: '',
    description: '',
    Link: '',
  });

  useEffect(() => {
    fetchQualifications();
    fetchRTOs();

    // Auto-filter by user's RTO code if available
    if (user?.rto_code) {
      console.log('[QualificationsMaintenance] Auto-filtering by RTO code:', user.rto_code);
      setSearchTerm(user.rto_code);
    }
  }, [user?.rto_code]);

  const fetchQualifications = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('Qualifications')
        .select('*')
        .order('qualifcaitionCode', { ascending: true });

      if (error) throw error;
      setQualifications(data || []);
    } catch (error) {
      toast.error('Failed to fetch qualifications');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRTOs = async () => {
    try {
      const { data, error } = await supabase
        .from('RTO')
        .select('id, code, legalname')
        .order('legalname', { ascending: true });

      if (error) throw error;
      setRTOs(data || []);
    } catch (error) {
      console.error('Error fetching RTOs:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this qualification?')) return;

    setIsLoading(true);
    try {
      const result = await deleteQualification(id);

      if (result.success) {
        toast.success(result.message);
        setQualifications(qualifications.filter(q => q.id !== id));
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Failed to delete qualification');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) {
      toast.error('No qualifications selected');
      return;
    }

    setIsLoading(true);
    try {
      let successCount = 0;
      let errorCount = 0;

      for (const id of selectedIds) {
        const result = await deleteQualification(id);
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} qualification(s) deleted successfully`);
        setQualifications(qualifications.filter(q => !selectedIds.has(q.id)));
        setSelectedIds(new Set());
        setShowDeleteModal(false);
      }

      if (errorCount > 0) {
        toast.error(`Failed to delete ${errorCount} qualification(s)`);
      }
    } catch (error) {
      toast.error('Failed to delete qualifications');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.size === paginatedQualifications.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedQualifications.map(q => q.id)));
    }
  };

  const handleSelectQualification = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleEdit = (qualification: QualificationRecord) => {
    setEditingId(qualification.id);
    setFormData({
      qualifcaitionCode: qualification.qualifcaitionCode || '',
      rtocode: qualification.rtocode || '',
      description: qualification.description || '',
      Link: qualification.Link || '',
    });
    setShowForm(true);
  };

  const handleCreate = () => {
    setEditingId(null);
    setFormData({
      qualifcaitionCode: '',
      rtocode: user?.rto_code || '',
      description: '',
      Link: '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.qualifcaitionCode || !formData.rtocode) {
      toast.error('Qualification Code and RTO are required');
      return;
    }

    setIsLoading(true);
    try {
      if (editingId) {
        const result = await updateQualification(editingId, formData);
        if (result.success) {
          toast.success(result.message);
          await fetchQualifications();
        } else {
          toast.error(result.message);
        }
      } else {
        const result = await insertQualification(formData);
        if (result.success) {
          toast.success(result.message);
          await fetchQualifications();
        } else {
          toast.error(result.message);
        }
      }
      setShowForm(false);
    } catch (error) {
      toast.error('Failed to save qualification');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredQualifications = qualifications.filter(q =>
    q.qualifcaitionCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.rtocode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const paginatedQualifications = filteredQualifications.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(filteredQualifications.length / pageSize);

  const getRTOName = (rtoCode: string) => {
    const rto = rtOs.find(r => r.code === rtoCode);
    return rto ? `${rto.code} - ${rto.legalname}` : rtoCode;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-poppins font-bold text-[#1e293b]">Qualifications Management</h2>
        <Button
          onClick={handleCreate}
          className="bg-[#8b5cf6] hover:bg-[#7c3aed] text-white font-semibold"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Qualification
        </Button>
      </div>

      {!showForm && (
        <>
          <Card className="border border-[#dbeafe] bg-white p-6">
            <div className="flex items-center gap-3 mb-4">
              <Search className="w-5 h-5 text-[#64748b]" />
              <Input
                placeholder="Search by code or RTO..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="border border-[#dbeafe] bg-white"
              />
            </div>

            {selectedIds.size > 0 && (
              <div className="mb-4 p-4 bg-[#dbeafe] rounded-lg flex items-center justify-between">
                <p className="text-[#1e293b] font-semibold">
                  {selectedIds.size} qualification(s) selected
                </p>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="px-4 py-2 bg-[#ef4444] hover:bg-[#dc2626] text-white font-semibold rounded transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Selected
                </button>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#dbeafe]">
                    <th className="text-left py-3 px-4 font-semibold text-[#1e293b] w-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === paginatedQualifications.length && paginatedQualifications.length > 0}
                        onChange={handleSelectAll}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Qualification Code</th>
                    <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">RTO</th>
                    <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Description</th>
                    <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-[#64748b]">
                        Loading qualifications...
                      </td>
                    </tr>
                  ) : paginatedQualifications.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-[#64748b]">
                        No qualifications found
                      </td>
                    </tr>
                  ) : (
                    paginatedQualifications.map((qual) => (
                      <tr key={qual.id} className="border-b border-[#e2e8f0] hover:bg-[#f8f9fb]">
                        <td className="py-3 px-4">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(qual.id)}
                            onChange={() => handleSelectQualification(qual.id)}
                            className="w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-4 text-[#1e293b] font-semibold">{qual.qualifcaitionCode}</td>
                        <td className="py-3 px-4 text-[#64748b]">{getRTOName(qual.rtocode)}</td>
                        <td className="py-3 px-4 text-[#64748b] max-w-xs truncate">{qual.description || '-'}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEdit(qual)}
                              className="p-2 hover:bg-[#dbeafe] text-[#3b82f6] rounded transition-colors"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(qual.id)}
                              className="p-2 hover:bg-[#fee2e2] text-[#ef4444] rounded transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-[#64748b]">
                  Page {currentPage} of {totalPages} ({filteredQualifications.length} total)
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="p-2 hover:bg-[#dbeafe] disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 hover:bg-[#dbeafe] disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </Card>
        </>
      )}

      {showForm && (
        <Card className="border border-[#dbeafe] bg-white p-8">
          <h3 className="text-xl font-poppins font-bold text-[#1e293b] mb-6">
            {editingId ? 'Edit Qualification' : 'Create New Qualification'}
          </h3>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="code" className="text-[#1e293b] font-semibold mb-2 block">
                Qualification Code <span className="text-[#ef4444]">*</span>
              </Label>
              <Input
                id="code"
                value={formData.qualifcaitionCode}
                onChange={(e) => setFormData({ ...formData, qualifcaitionCode: e.target.value })}
                placeholder="e.g., QUAL001"
                className="border border-[#dbeafe] bg-white"
                disabled={isLoading}
              />
            </div>

            <div>
              <Label htmlFor="rto" className="text-[#1e293b] font-semibold mb-2 block">
                RTO <span className="text-[#ef4444]">*</span>
              </Label>
              <select
                id="rto"
                value={formData.rtocode}
                onChange={(e) => setFormData({ ...formData, rtocode: e.target.value })}
                className="w-full px-3 py-2 border border-[#dbeafe] bg-white rounded text-[#1e293b]"
                disabled={isLoading}
              >
                <option value="">Select an RTO</option>
                {rtOs.map((rto) => (
                  <option key={rto.id} value={rto.code}>
                    {rto.code} - {rto.legalname}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="description" className="text-[#1e293b] font-semibold mb-2 block">
                Description
              </Label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Qualification description"
                className="w-full px-3 py-2 border border-[#dbeafe] bg-white rounded text-[#1e293b]"
                rows={4}
                disabled={isLoading}
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="link" className="text-[#1e293b] font-semibold mb-2 block">
                Link
              </Label>
              <Input
                id="link"
                value={formData.Link}
                onChange={(e) => setFormData({ ...formData, Link: e.target.value })}
                placeholder="https://example.com"
                className="border border-[#dbeafe] bg-white"
                disabled={isLoading}
              />
            </div>

            <div className="md:col-span-2 flex gap-3 pt-4">
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 py-2 px-4 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white font-semibold rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Saving...' : editingId ? 'Update Qualification' : 'Create Qualification'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                disabled={isLoading}
                className="flex-1 py-2 px-4 bg-[#e2e8f0] hover:bg-[#cbd5e1] text-[#1e293b] font-semibold rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </Card>
      )}

      <AlertDialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#1e293b]">Confirm Bulk Delete</AlertDialogTitle>
            <AlertDialogDescription className="text-[#64748b]">
              This will delete {selectedIds.size} qualification(s).
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="bg-[#fef2f2] border border-[#fecaca] rounded-lg p-4 my-4">
            <p className="font-semibold text-[#991b1b] mb-2">Qualifications to Delete:</p>
            <ul className="text-sm text-[#7f1d1d] space-y-1">
              {Array.from(selectedIds).map(id => {
                const qual = qualifications.find(q => q.id === id);
                return (
                  <li key={id}>• {qual?.qualifcaitionCode} - {getRTOName(qual?.rtocode || '')}</li>
                );
              })}
            </ul>
          </div>

          <div className="flex gap-3 justify-end">
            <AlertDialogCancel disabled={isLoading} className="text-[#1e293b]">
              Cancel
            </AlertDialogCancel>
            <button
              onClick={handleBulkDelete}
              disabled={isLoading}
              className="px-4 py-2 bg-[#ef4444] hover:bg-[#dc2626] text-white font-semibold rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Deleting...' : 'Delete All'}
            </button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
