import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Trash2, Edit, Plus, Search, ChevronLeft, ChevronRight, Checkbox, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { insertUnitOfCompetency, updateUnitOfCompetency, deleteUnitOfCompetency, fetchUnitsOfCompetency } from '../../types/rto';

interface UnitRecord {
  id: number;
  unitCode: string;
  Title?: string;
  Type?: string;
  Status?: string;
  Link?: string;
  qualificationLink?: string;
  created_at?: string;
}

export function UnitOfCompetencyMaintenance() {
  const [units, setUnits] = useState<UnitRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [formData, setFormData] = useState({
    unitCode: '',
    Title: '',
    Type: '',
    Status: '',
    Link: '',
    qualificationLink: '',
  });

  const [detailUnit, setDetailUnit] = useState<UnitRecord | null>(null);
  const [activeTab, setActiveTab] = useState('ke');
  const [keReqs, setKeReqs] = useState<any[]>([]);
  const [peReqs, setPeReqs] = useState<any[]>([]);
  const [fsReqs, setFsReqs] = useState<any[]>([]);
  const [epcReqs, setEpcReqs] = useState<any[]>([]);
  const [assessQs, setAssessQs] = useState<any[]>([]);

  useEffect(() => {
    fetchUnits();
  }, []);

  const fetchUnits = async () => {
    setIsLoading(true);
    try {
      const data = await fetchUnitsOfCompetency();
      setUnits((data as UnitRecord[]) || []);
    } catch (error) {
      toast.error('Failed to fetch units of competency');
      console.error('Error fetching units of competency:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this unit of competency?')) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('delete_unit_of_competency_cascade', {
        unit_id: id,
      });

      if (error) throw error;

      const result = data as any;
      if (result.success) {
        toast.success(result.message);
        setUnits(units.filter(u => u.id !== id));
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Failed to delete unit');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) {
      toast.error('No units selected');
      return;
    }

    setIsLoading(true);
    try {
      let successCount = 0;
      let errorCount = 0;

      for (const id of selectedIds) {
        const { data, error } = await supabase.rpc('delete_unit_of_competency_cascade', {
          unit_id: id,
        });

        if (!error && data?.success) {
          successCount++;
        } else {
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} unit(s) deleted successfully with their child records`);
        setUnits(units.filter(u => !selectedIds.has(u.id)));
        setSelectedIds(new Set());
        setShowDeleteModal(false);
      }

      if (errorCount > 0) {
        toast.error(`Failed to delete ${errorCount} unit(s)`);
      }
    } catch (error) {
      toast.error('Failed to delete units');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (unit: UnitRecord) => {
    setEditingId(unit.id);
    setFormData({
      unitCode: unit.unitCode || '',
      Title: unit.Title || '',
      Type: unit.Type || '',
      Status: unit.Status || '',
      Link: unit.Link || '',
      qualificationLink: unit.qualificationLink || '',
    });
    setShowForm(true);
  };

  const handleCreate = () => {
    setEditingId(null);
    setFormData({
      unitCode: '',
      Title: '',
      Type: '',
      Status: '',
      Link: '',
      qualificationLink: '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.unitCode) {
      toast.error('Unit Code is required');
      return;
    }

    setIsLoading(true);
    try {
      if (editingId) {
        const result = await updateUnitOfCompetency(editingId, formData);
        if (result.success) {
          toast.success(result.message);
          await fetchUnits();
        } else {
          toast.error(result.message);
        }
      } else {
        const result = await insertUnitOfCompetency(formData);
        if (result.success) {
          toast.success(result.message);
          await fetchUnits();
        } else {
          toast.error(result.message);
        }
      }
      setShowForm(false);
    } catch (error) {
      toast.error('Failed to save unit');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.size === paginatedUnits.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedUnits.map(u => u.id)));
    }
  };

  const handleSelectUnit = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const filteredUnits = units.filter(u =>
    u.unitCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.Title?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openDetails = async (unit: UnitRecord) => {
    setDetailUnit(unit);
    setActiveTab('ke');
    try {
      const code = unit.unitCode;
      const like = `%${code}%`;
      const [ke, pe, fs, epc, aq] = await Promise.all([
        supabase.from('knowledge_evidence_requirements').select('*').ilike('unit_url', like),
        supabase.from('performance_evidence_requirements').select('*').ilike('unit_url', like),
        supabase.from('foundation_skills_requirements').select('*').ilike('unit_url', like),
        supabase.from('elements_performance_criteria_requirements').select('*').ilike('unit_url', like),
        supabase.from('UnitOfCompetencyAssessmentQuestions').select('*').eq('unitCode', code)
      ]);
      setKeReqs(ke.data || []);
      setPeReqs(pe.data || []);
      setFsReqs(fs.data || []);
      setEpcReqs(epc.data || []);
      setAssessQs(aq.data || []);
    } catch (e) {
      console.error('Failed to load related entities', e);
    }
  };

  const paginatedUnits = filteredUnits.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(filteredUnits.length / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-poppins font-bold text-[#1e293b]">Units of Competency Management</h2>
        <Button
          onClick={handleCreate}
          className="bg-[#10b981] hover:bg-[#059669] text-white font-semibold"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Unit
        </Button>
      </div>

      {!showForm && (
        <>
          <Card className="border border-[#dbeafe] bg-white p-6">
            <div className="flex items-center gap-3 mb-4">
              <Search className="w-5 h-5 text-[#64748b]" />
              <Input
                placeholder="Search by code or title..."
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
                  {selectedIds.size} unit(s) selected
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
                        checked={selectedIds.size === paginatedUnits.length && paginatedUnits.length > 0}
                        onChange={handleSelectAll}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Unit Code</th>
                    <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Title</th>
                    <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Type</th>
                    <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-[#64748b]">
                        Loading units...
                      </td>
                    </tr>
                  ) : paginatedUnits.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-[#64748b]">
                        No units found
                      </td>
                    </tr>
                  ) : (
                    paginatedUnits.map((unit) => (
                      <tr key={unit.id} className="border-b border-[#e2e8f0] hover:bg-[#f8f9fb]">
                        <td className="py-3 px-4">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(unit.id)}
                            onChange={() => handleSelectUnit(unit.id)}
                            className="w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-4 text-[#1e293b] font-semibold">{unit.unitCode}</td>
                        <td className="py-3 px-4 text-[#64748b] max-w-xs truncate">{unit.Title || '-'}</td>
                        <td className="py-3 px-4 text-[#64748b]">{unit.Type || '-'}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            unit.Status === 'Active' ? 'bg-[#dcfce7] text-[#166534]' : 'bg-[#fecaca] text-[#991b1b]'
                          }`}>
                            {unit.Status || 'Unknown'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openDetails(unit)}
                              className="p-2 hover:bg-[#dbeafe] text-[#0ea5e9] rounded transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleEdit(unit)}
                              className="p-2 hover:bg-[#dbeafe] text-[#3b82f6] rounded transition-colors"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(unit.id)}
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
                  Page {currentPage} of {totalPages} ({filteredUnits.length} total)
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
            {editingId ? 'Edit Unit of Competency' : 'Create New Unit of Competency'}
          </h3>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="code" className="text-[#1e293b] font-semibold mb-2 block">
                Unit Code <span className="text-[#ef4444]">*</span>
              </Label>
              <Input
                id="code"
                value={formData.unitCode}
                onChange={(e) => setFormData({ ...formData, unitCode: e.target.value })}
                placeholder="e.g., UNIT001"
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
                value={formData.Status}
                onChange={(e) => setFormData({ ...formData, Status: e.target.value })}
                placeholder="e.g., Active"
                className="border border-[#dbeafe] bg-white"
                disabled={isLoading}
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="title" className="text-[#1e293b] font-semibold mb-2 block">
                Title
              </Label>
              <Input
                id="title"
                value={formData.Title}
                onChange={(e) => setFormData({ ...formData, Title: e.target.value })}
                placeholder="Unit title"
                className="border border-[#dbeafe] bg-white"
                disabled={isLoading}
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="type" className="text-[#1e293b] font-semibold mb-2 block">
                Type
              </Label>
              <Input
                id="type"
                value={formData.Type}
                onChange={(e) => setFormData({ ...formData, Type: e.target.value })}
                placeholder="e.g., Core, Elective"
                className="border border-[#dbeafe] bg-white"
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

            <div className="md:col-span-2">
              <Label htmlFor="qualLink" className="text-[#1e293b] font-semibold mb-2 block">
                Qualification Link
              </Label>
              <Input
                id="qualLink"
                value={formData.qualificationLink}
                onChange={(e) => setFormData({ ...formData, qualificationLink: e.target.value })}
                placeholder="Link to qualification"
                className="border border-[#dbeafe] bg-white"
                disabled={isLoading}
              />
            </div>

            <div className="md:col-span-2 flex gap-3 pt-4">
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 py-2 px-4 bg-[#10b981] hover:bg-[#059669] text-white font-semibold rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Saving...' : editingId ? 'Update Unit' : 'Create Unit'}
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

      {/* Details Modal */}
      {detailUnit && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl p-6 border border-[#dbeafe]">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-poppins font-bold text-[#1e293b]">{detailUnit.unitCode} - {detailUnit.Title}</h3>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="px-2 py-0.5 rounded bg-[#e0f2fe] text-[#0369a1] text-xs">Type: {detailUnit.Type || '-'}</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${detailUnit.Status === 'Active' ? 'bg-[#dcfce7] text-[#166534]' : 'bg-[#fee2e2] text-[#991b1b]'}`}>Status: {detailUnit.Status || '-'}</span>
                  <span className="px-2 py-0.5 rounded bg-[#f1f5f9] text-[#334155] text-xs">KE: {keReqs.length}</span>
                  <span className="px-2 py-0.5 rounded bg-[#f1f5f9] text-[#334155] text-xs">PE: {peReqs.length}</span>
                  <span className="px-2 py-0.5 rounded bg-[#f1f5f9] text-[#334155] text-xs">FS: {fsReqs.length}</span>
                  <span className="px-2 py-0.5 rounded bg-[#f1f5f9] text-[#334155] text-xs">EPC: {epcReqs.length}</span>
                  <span className="px-2 py-0.5 rounded bg-[#f1f5f9] text-[#334155] text-xs">AQ: {assessQs.length}</span>
                </div>
              </div>
              <button onClick={() => setDetailUnit(null)} className="px-3 py-1 rounded bg-[#e2e8f0] hover:bg-[#cbd5e1] text-[#1e293b]">Close</button>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid grid-cols-5">
                <TabsTrigger value="ke">Knowledge Evidence ({keReqs.length})</TabsTrigger>
                <TabsTrigger value="pe">Performance Evidence ({peReqs.length})</TabsTrigger>
                <TabsTrigger value="fs">Foundation Skills ({fsReqs.length})</TabsTrigger>
                <TabsTrigger value="epc">Elements & Criteria ({epcReqs.length})</TabsTrigger>
                <TabsTrigger value="aq">Assessment Questions ({assessQs.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="ke" className="mt-4">
                {keReqs.length === 0 ? (<p className="text-[#64748b]">No knowledge evidence requirements found.</p>) : (
                  <div className="overflow-x-auto max-h-64 overflow-y-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#e2e8f0]"><th className="text-left py-2 px-3 text-[#334155]">KE#</th><th className="text-left py-2 px-3 text-[#334155]">Knowledge Point</th><th className="text-left py-2 px-3 text-[#334155]">Actions</th></tr>
                      </thead>
                      <tbody>
                        {keReqs.map((r:any) => (
                          <tr key={r.id} className="border-b border-[#e2e8f0]">
                            <td className="py-2 px-3 text-[#1e293b] font-semibold">{r.ke_number}</td>
                            <td className="py-2 px-3 text-[#64748b]">{r.knowled_point}</td>
                            <td className="py-2 px-3"><button onClick={() => window.dispatchEvent(new CustomEvent('app:navigate', { detail: { view: 'maintenance', module: 'requirements' } }))} className="text-[#3b82f6] text-sm">Open in Requirements</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="pe" className="mt-4">
                {peReqs.length === 0 ? (<p className="text-[#64748b]">No performance evidence requirements found.</p>) : (
                  <div className="overflow-x-auto max-h-64 overflow-y-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#e2e8f0]"><th className="text-left py-2 px-3 text-[#334155]">PE#</th><th className="text-left py-2 px-3 text-[#334155]">Performance Evidence</th><th className="text-left py-2 px-3 text-[#334155]">Actions</th></tr>
                      </thead>
                      <tbody>
                        {peReqs.map((r:any) => (
                          <tr key={r.id} className="border-b border-[#e2e8f0]">
                            <td className="py-2 px-3 text-[#1e293b] font-semibold">{r.pe_number}</td>
                            <td className="py-2 px-3 text-[#64748b]">{r.performance_evidence}</td>
                            <td className="py-2 px-3"><button onClick={() => window.dispatchEvent(new CustomEvent('app:navigate', { detail: { view: 'maintenance', module: 'requirements' } }))} className="text-[#3b82f6] text-sm">Open in Requirements</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="fs" className="mt-4">
                {fsReqs.length === 0 ? (<p className="text-[#64748b]">No foundation skills requirements found.</p>) : (
                  <div className="overflow-x-auto max-h-64 overflow-y-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#e2e8f0]"><th className="text-left py-2 px-3 text-[#334155]">FS#</th><th className="text-left py-2 px-3 text-[#334155]">Skill Point</th><th className="text-left py-2 px-3 text-[#334155]">Actions</th></tr>
                      </thead>
                      <tbody>
                        {fsReqs.map((r:any) => (
                          <tr key={r.id} className="border-b border-[#e2e8f0]">
                            <td className="py-2 px-3 text-[#1e293b] font-semibold">{r.fs_number}</td>
                            <td className="py-2 px-3 text-[#64748b]">{r.skill_point}</td>
                            <td className="py-2 px-3"><button onClick={() => window.dispatchEvent(new CustomEvent('app:navigate', { detail: { view: 'maintenance', module: 'requirements' } }))} className="text-[#3b82f6] text-sm">Open in Requirements</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="epc" className="mt-4">
                {epcReqs.length === 0 ? (<p className="text-[#64748b]">No elements & criteria requirements found.</p>) : (
                  <div className="overflow-x-auto max-h-64 overflow-y-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-[#e2e8f0]"><th className="text-left py-2 px-3 text-[#334155]">EPC#</th><th className="text-left py-2 px-3 text-[#334155]">Performance Criteria</th><th className="text-left py-2 px-3 text-[#334155]">Actions</th></tr>
                      </thead>
                      <tbody>
                        {epcReqs.map((r:any) => (
                          <tr key={r.id} className="border-b border-[#e2e8f0]">
                            <td className="py-2 px-3 text-[#1e293b] font-semibold">{r.epc_number}</td>
                            <td className="py-2 px-3 text-[#64748b]">{r.performance_criteria}</td>
                            <td className="py-2 px-3"><button onClick={() => window.dispatchEvent(new CustomEvent('app:navigate', { detail: { view: 'maintenance', module: 'requirements' } }))} className="text-[#3b82f6] text-sm">Open in Requirements</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="aq" className="mt-4">
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {assessQs.length === 0 ? (<p className="text-[#64748b]">No assessment questions found.</p>) : (
                    assessQs.map((r:any) => (
                      <div key={r.id} className="p-3 border border-[#e2e8f0] rounded">
                        <p className="font-semibold text-[#1e293b]">Q{r.number}</p>
                        <p className="text-sm text-[#64748b]">{r.content}</p>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}

      <AlertDialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#1e293b]">Confirm Bulk Delete</AlertDialogTitle>
            <AlertDialogDescription className="text-[#64748b]">
              This will delete {selectedIds.size} unit(s) and all their child records (assessment questions, etc.).
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="bg-[#fef2f2] border border-[#fecaca] rounded-lg p-4 my-4">
            <p className="font-semibold text-[#991b1b] mb-2">Units to Delete:</p>
            <ul className="text-sm text-[#7f1d1d] space-y-1">
              {Array.from(selectedIds).map(id => {
                const unit = units.find(u => u.id === id);
                return (
                  <li key={id}>• {unit?.unitCode} - {unit?.Title || 'Untitled'}</li>
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
