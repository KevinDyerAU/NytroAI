import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { Trash2, Edit, Plus, Search, ChevronLeft, ChevronRight, Checkbox } from 'lucide-react';
import { toast } from 'sonner';
import { deleteRTOWithCascade, insertRTO, updateRTO } from '../../types/rto';

interface RTORecord {
  id: number;
  code: string;
  legalname: string;
  status?: string;
  abn?: string;
  acn?: string;
  webaddress?: string;
  email?: string;
}

interface DependencyInfo {
  qualificationsCount: number;
  validationCreditsCount: number;
  aiCreditsCount: number;
  creditTransactionsCount: number;
  aiCreditTransactionsCount: number;
}

export function RTOMaintenance() {
  const [rtOs, setRTOs] = useState<RTORecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingRTO, setDeletingRTO] = useState<RTORecord | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [dependencyInfo, setDependencyInfo] = useState<DependencyInfo | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    legalname: '',
    status: '',
    abn: '',
    acn: '',
    webaddress: '',
    email: '',
  });

  useEffect(() => {
    fetchRTOs();
  }, []);

  const fetchRTOs = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('RTO')
        .select('*')
        .order('legalname', { ascending: true });

      if (error) throw error;
      setRTOs(data || []);
    } catch (error) {
      toast.error('Failed to fetch RTOs');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDependencies = async (rtoId: number, rtoCode: string) => {
    try {
      const [qualifications, validationCredits, aiCredits, creditTransactions, aiCreditTransactions] = await Promise.all([
        supabase.from('Qualifications').select('id', { count: 'exact' }).eq('rtocode', rtoCode),
        supabase.from('validation_credits').select('id', { count: 'exact' }).eq('rto_id', rtoId),
        supabase.from('ai_credits').select('id', { count: 'exact' }).eq('rto_id', rtoId),
        supabase.from('credit_transactions').select('id', { count: 'exact' }).eq('rto_id', rtoId),
        supabase.from('ai_credit_transactions').select('id', { count: 'exact' }).eq('rto_id', rtoId),
      ]);

      setDependencyInfo({
        qualificationsCount: qualifications.count || 0,
        validationCreditsCount: validationCredits.count || 0,
        aiCreditsCount: aiCredits.count || 0,
        creditTransactionsCount: creditTransactions.count || 0,
        aiCreditTransactionsCount: aiCreditTransactions.count || 0,
      });
    } catch (error) {
      console.error('Error fetching dependencies:', error);
    }
  };

  const handleDelete = async (rto: RTORecord) => {
    setDeletingRTO(rto);
    setDeleteConfirmation('');
    await fetchDependencies(rto.id, rto.code);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingRTO) return;

    const isValidConfirmation = deleteConfirmation === deletingRTO.code || deleteConfirmation === 'DELETE';

    if (!isValidConfirmation) {
      toast.error(`Please type "${deletingRTO.code}" or "DELETE" to confirm deletion`);
      return;
    }

    setIsLoading(true);
    try {
      const result = await deleteRTOWithCascade(deletingRTO.id);

      if (result.success) {
        toast.success(result.message);
        setRTOs(rtOs.filter(r => r.id !== deletingRTO.id));
        setDeleteModalOpen(false);
        setDeletingRTO(null);
        setDeleteConfirmation('');
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[RTOMaintenance] Failed to delete RTO:', JSON.stringify({
        message: errorMsg,
        stack: error instanceof Error ? error.stack : undefined,
      }, null, 2));
      toast.error('Failed to delete RTO');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) {
      toast.error('No RTOs selected');
      return;
    }

    setIsLoading(true);
    try {
      let successCount = 0;
      let errorCount = 0;

      for (const id of selectedIds) {
        const result = await deleteRTOWithCascade(id);
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} RTO(s) deleted successfully with their child records`);
        setRTOs(rtOs.filter(r => !selectedIds.has(r.id)));
        setSelectedIds(new Set());
        setShowBulkDeleteModal(false);
      }

      if (errorCount > 0) {
        toast.error(`Failed to delete ${errorCount} RTO(s)`);
      }
    } catch (error) {
      toast.error('Failed to delete RTOs');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.size === paginatedRTOs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedRTOs.map(r => r.id)));
    }
  };

  const handleSelectRTO = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleEdit = (rto: RTORecord) => {
    setEditingId(rto.id);
    setFormData({
      code: rto.code || '',
      legalname: rto.legalname || '',
      status: rto.status || '',
      abn: rto.abn || '',
      acn: rto.acn || '',
      webaddress: rto.webaddress || '',
      email: rto.email || '',
    });
    setShowForm(true);
  };

  const handleCreate = () => {
    setEditingId(null);
    setFormData({
      code: '',
      legalname: '',
      status: '',
      abn: '',
      acn: '',
      webaddress: '',
      email: '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.code || !formData.legalname) {
      toast.error('Code and Legal Name are required');
      return;
    }

    setIsLoading(true);
    try {
      if (editingId) {
        const result = await updateRTO(editingId, formData);
        if (result.success) {
          toast.success(result.message);
          await fetchRTOs();
        } else {
          toast.error(result.message);
        }
      } else {
        const result = await insertRTO(formData);
        if (result.success) {
          toast.success(result.message);
          await fetchRTOs();
        } else {
          toast.error(result.message);
        }
      }
      setShowForm(false);
    } catch (error) {
      toast.error('Failed to save RTO');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredRTOs = rtOs.filter(rto =>
    rto.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rto.legalname?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const paginatedRTOs = filteredRTOs.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(filteredRTOs.length / pageSize);

  const totalDependencies = dependencyInfo
    ? Object.values(dependencyInfo).reduce((a, b) => a + b, 0)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-poppins font-bold text-[#1e293b]">RTO Management</h2>
        <Button
          onClick={handleCreate}
          className="bg-[#3b82f6] hover:bg-[#2563eb] text-white font-semibold"
        >
          <Plus className="w-4 h-4 mr-2" />
          New RTO
        </Button>
      </div>

      {!showForm && (
        <>
          <Card className="border border-[#dbeafe] bg-white p-6">
            <div className="flex items-center gap-3 mb-4">
              <Search className="w-5 h-5 text-[#64748b]" />
              <Input
                placeholder="Search by code or legal name..."
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
                  {selectedIds.size} RTO(s) selected
                </p>
                <button
                  onClick={() => setShowBulkDeleteModal(true)}
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
                        checked={selectedIds.size === paginatedRTOs.length && paginatedRTOs.length > 0}
                        onChange={handleSelectAll}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Code</th>
                    <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Legal Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Email</th>
                    <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-[#64748b]">
                        Loading RTOs...
                      </td>
                    </tr>
                  ) : paginatedRTOs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-[#64748b]">
                        No RTOs found
                      </td>
                    </tr>
                  ) : (
                    paginatedRTOs.map((rto) => (
                      <tr key={rto.id} className="border-b border-[#e2e8f0] hover:bg-[#f8f9fb]">
                        <td className="py-3 px-4">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(rto.id)}
                            onChange={() => handleSelectRTO(rto.id)}
                            className="w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-4 text-[#1e293b]">{rto.code}</td>
                        <td className="py-3 px-4 text-[#64748b]">{rto.legalname}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            rto.status === 'Active' ? 'bg-[#dcfce7] text-[#166534]' : 'bg-[#fecaca] text-[#991b1b]'
                          }`}>
                            {rto.status || 'Unknown'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[#64748b]">{rto.email || '-'}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEdit(rto)}
                              className="p-2 hover:bg-[#dbeafe] text-[#3b82f6] rounded transition-colors"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(rto)}
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
                  Page {currentPage} of {totalPages} ({filteredRTOs.length} total)
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

      <AlertDialog open={showBulkDeleteModal} onOpenChange={setShowBulkDeleteModal}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#1e293b]">Confirm Bulk Delete</AlertDialogTitle>
            <AlertDialogDescription className="text-[#64748b]">
              This will delete {selectedIds.size} RTO(s) and all their child records (qualifications, credits, transactions, etc.).
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="bg-[#fef2f2] border border-[#fecaca] rounded-lg p-4 my-4">
            <p className="font-semibold text-[#991b1b] mb-2">RTOs to Delete:</p>
            <ul className="text-sm text-[#7f1d1d] space-y-1">
              {Array.from(selectedIds).map(id => {
                const rto = rtOs.find(r => r.id === id);
                return (
                  <li key={id}>• {rto?.code} - {rto?.legalname || 'Untitled'}</li>
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

      {showForm && (
        <Card className="border border-[#dbeafe] bg-white p-8">
          <h3 className="text-xl font-poppins font-bold text-[#1e293b] mb-6">
            {editingId ? 'Edit RTO' : 'Create New RTO'}
          </h3>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="code" className="text-[#1e293b] font-semibold mb-2 block">
                RTO Code <span className="text-[#ef4444]">*</span>
              </Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="e.g., RTO001"
                className="border border-[#dbeafe] bg-white"
                disabled={isLoading}
              />
            </div>

            <div>
              <Label htmlFor="legalname" className="text-[#1e293b] font-semibold mb-2 block">
                Legal Name <span className="text-[#ef4444]">*</span>
              </Label>
              <Input
                id="legalname"
                value={formData.legalname}
                onChange={(e) => setFormData({ ...formData, legalname: e.target.value })}
                placeholder="e.g., Training Organization Inc."
                className="border border-[#dbeafe] bg-white"
                disabled={isLoading}
              />
            </div>

            <div>
              <Label htmlFor="status" className="text-[#1e293b] font-semibold mb-2 block">
                Status
              </Label>
              <Input
                id="status"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                placeholder="e.g., Active"
                className="border border-[#dbeafe] bg-white"
                disabled={isLoading}
              />
            </div>

            <div>
              <Label htmlFor="email" className="text-[#1e293b] font-semibold mb-2 block">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="contact@rto.com"
                className="border border-[#dbeafe] bg-white"
                disabled={isLoading}
              />
            </div>

            <div>
              <Label htmlFor="abn" className="text-[#1e293b] font-semibold mb-2 block">
                ABN
              </Label>
              <Input
                id="abn"
                value={formData.abn}
                onChange={(e) => setFormData({ ...formData, abn: e.target.value })}
                placeholder="Australian Business Number"
                className="border border-[#dbeafe] bg-white"
                disabled={isLoading}
              />
            </div>

            <div>
              <Label htmlFor="acn" className="text-[#1e293b] font-semibold mb-2 block">
                ACN
              </Label>
              <Input
                id="acn"
                value={formData.acn}
                onChange={(e) => setFormData({ ...formData, acn: e.target.value })}
                placeholder="Australian Company Number"
                className="border border-[#dbeafe] bg-white"
                disabled={isLoading}
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="webaddress" className="text-[#1e293b] font-semibold mb-2 block">
                Web Address
              </Label>
              <Input
                id="webaddress"
                value={formData.webaddress}
                onChange={(e) => setFormData({ ...formData, webaddress: e.target.value })}
                placeholder="https://example.com"
                className="border border-[#dbeafe] bg-white"
                disabled={isLoading}
              />
            </div>

            <div className="md:col-span-2 flex gap-3 pt-4">
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 py-2 px-4 bg-[#3b82f6] hover:bg-[#2563eb] text-white font-semibold rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Saving...' : editingId ? 'Update RTO' : 'Create RTO'}
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

      <AlertDialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#1e293b]">Delete RTO - Cascading Delete Warning</AlertDialogTitle>
            <AlertDialogDescription className="text-[#64748b]">
              This action will permanently delete the RTO and all related records.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deletingRTO && dependencyInfo && (
            <div className="bg-[#fef2f2] border border-[#fecaca] rounded-lg p-4 my-4">
              <p className="font-semibold text-[#991b1b] mb-3">
                RTO to Delete: <span className="text-[#7f1d1d]">{deletingRTO.code}</span>
              </p>
              <p className="font-semibold text-[#991b1b] mb-2">Records that will be deleted:</p>
              <ul className="text-sm text-[#7f1d1d] space-y-1 ml-4">
                <li>• {dependencyInfo.qualificationsCount} Qualification(s)</li>
                <li>• {dependencyInfo.validationCreditsCount} Validation Credit record(s)</li>
                <li>• {dependencyInfo.aiCreditsCount} AI Credit record(s)</li>
                <li>• {dependencyInfo.creditTransactionsCount} Credit Transaction(s)</li>
                <li>• {dependencyInfo.aiCreditTransactionsCount} AI Credit Transaction(s)</li>
              </ul>
              <p className="font-bold text-[#991b1b] mt-3">
                Total dependent records: {totalDependencies}
              </p>

              <div className="mt-4">
                <Label htmlFor="confirm-delete" className="text-[#991b1b] font-semibold mb-2 block">
                  To confirm deletion, type: <span className="text-[#7f1d1d] font-bold">"{deletingRTO.code}"</span> or <span className="text-[#7f1d1d] font-bold">"DELETE"</span>
                </Label>
                <Input
                  id="confirm-delete"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder="Type confirmation text here"
                  className="border border-[#fecaca] bg-white"
                  disabled={isLoading}
                />
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <AlertDialogCancel disabled={isLoading} className="text-[#1e293b]">
              Cancel
            </AlertDialogCancel>
            <button
              onClick={confirmDelete}
              disabled={isLoading || !deleteConfirmation}
              className="px-4 py-2 bg-[#ef4444] hover:bg-[#dc2626] text-white font-semibold rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Deleting...' : 'Delete RTO'}
            </button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
