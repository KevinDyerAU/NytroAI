import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Trash2, Search, ChevronLeft, ChevronRight, Checkbox, Eye, Link2 } from 'lucide-react';
import { toast } from 'sonner';

interface KnowledgeEvidenceRequirement {
  id: number;
  ke_number?: string;
  knowled_point?: string;
  unit_url?: string;
  created_at?: string;
}

interface PerformanceEvidenceRequirement {
  id: number;
  pe_number?: string;
  performance_evidence?: string;
  unit_url?: string;
  created_at?: string;
}

interface FoundationSkillsRequirement {
  id: number;
  fs_number?: string;
  skill_point?: string;
  unit_url?: string;
  created_at?: string;
}

interface ElementsPerformanceCriteriaRequirement {
  id: number;
  epc_number?: string;
  performance_criteria?: string;
  element?: string;
  unit_url?: string;
  created_at?: string;
}

export function RequirementsMaintenance() {
  const [keRequirements, setKERequirements] = useState<KnowledgeEvidenceRequirement[]>([]);
  const [peRequirements, setPERequirements] = useState<PerformanceEvidenceRequirement[]>([]);
  const [fsRequirements, setFSRequirements] = useState<FoundationSkillsRequirement[]>([]);
  const [epcRequirements, setEPCRequirements] = useState<ElementsPerformanceCriteriaRequirement[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [activeTab, setActiveTab] = useState('ke');
  const [selectedKEIds, setSelectedKEIds] = useState<Set<number>>(new Set());
  const [selectedPEIds, setSelectedPEIds] = useState<Set<number>>(new Set());
  const [selectedFSIds, setSelectedFSIds] = useState<Set<number>>(new Set());
  const [selectedEPCIds, setSelectedEPCIds] = useState<Set<number>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [detailType, setDetailType] = useState<'ke'|'pe'|'fs'|'epc'|null>(null);
  const [detailRecord, setDetailRecord] = useState<any | null>(null);
  const [parentUnit, setParentUnit] = useState<any | null>(null);
  const [smartQuestions, setSmartQuestions] = useState<any[]>([]);
  const [benchmarkAnswers, setBenchmarkAnswers] = useState<Record<number, any[]>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [ke, pe, fs, epc] = await Promise.all([
        supabase.from('knowledge_evidence_requirements').select('*').order('created_at', { ascending: false }),
        supabase.from('performance_evidence_requirements').select('*').order('created_at', { ascending: false }),
        supabase.from('foundation_skills_requirements').select('*').order('created_at', { ascending: false }),
        supabase.from('elements_performance_criteria_requirements').select('*').order('created_at', { ascending: false }),
      ]);

      if (ke.error) throw ke.error;
      if (pe.error) throw pe.error;
      if (fs.error) throw fs.error;
      if (epc.error) throw epc.error;

      setKERequirements(ke.data || []);
      setPERequirements(pe.data || []);
      setFSRequirements(fs.data || []);
      setEPCRequirements(epc.data || []);
    } catch (error) {
      toast.error('Failed to fetch requirements');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (table: string, id: number) => {
    if (!window.confirm('Are you sure you want to delete this requirement?')) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.from(table).delete().eq('id', id);

      if (error) throw error;

      toast.success('Requirement deleted successfully');

      if (table === 'knowledge_evidence_requirements') {
        setKERequirements(keRequirements.filter(r => r.id !== id));
      } else if (table === 'performance_evidence_requirements') {
        setPERequirements(peRequirements.filter(r => r.id !== id));
      } else if (table === 'foundation_skills_requirements') {
        setFSRequirements(fsRequirements.filter(r => r.id !== id));
      } else if (table === 'elements_performance_criteria_requirements') {
        setEPCRequirements(epcRequirements.filter(r => r.id !== id));
      }
    } catch (error) {
      toast.error('Failed to delete requirement');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkDelete = async (table: string, ids: Set<number>) => {
    if (ids.size === 0) {
      toast.error('No records selected');
      return;
    }

    setIsLoading(true);
    try {
      let successCount = 0;
      let errorCount = 0;

      for (const id of ids) {
        const { error } = await supabase.from(table).delete().eq('id', id);
        if (!error) {
          successCount++;
        } else {
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} record(s) deleted successfully`);
        if (table === 'knowledge_evidence_requirements') {
          setKERequirements(keRequirements.filter(r => !ids.has(r.id)));
          setSelectedKEIds(new Set());
        } else if (table === 'performance_evidence_requirements') {
          setPERequirements(peRequirements.filter(r => !ids.has(r.id)));
          setSelectedPEIds(new Set());
        } else if (table === 'foundation_skills_requirements') {
          setFSRequirements(fsRequirements.filter(r => !ids.has(r.id)));
          setSelectedFSIds(new Set());
        } else if (table === 'elements_performance_criteria_requirements') {
          setEPCRequirements(epcRequirements.filter(r => !ids.has(r.id)));
          setSelectedEPCIds(new Set());
        }
        setShowDeleteModal(false);
      }

      if (errorCount > 0) {
        toast.error(`Failed to delete ${errorCount} record(s)`);
      }
    } catch (error) {
      toast.error('Failed to delete records');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAllKE = () => {
    if (selectedKEIds.size === paginatedKE.length) {
      setSelectedKEIds(new Set());
    } else {
      setSelectedKEIds(new Set(paginatedKE.map(r => r.id)));
    }
  };

  const handleSelectKE = (id: number) => {
    const newSelected = new Set(selectedKEIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedKEIds(newSelected);
  };

  const handleSelectAllPE = () => {
    if (selectedPEIds.size === paginatedPE.length) {
      setSelectedPEIds(new Set());
    } else {
      setSelectedPEIds(new Set(paginatedPE.map(r => r.id)));
    }
  };

  const handleSelectPE = (id: number) => {
    const newSelected = new Set(selectedPEIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedPEIds(newSelected);
  };

  const handleSelectAllFS = () => {
    if (selectedFSIds.size === paginatedFS.length) {
      setSelectedFSIds(new Set());
    } else {
      setSelectedFSIds(new Set(paginatedFS.map(r => r.id)));
    }
  };

  const handleSelectFS = (id: number) => {
    const newSelected = new Set(selectedFSIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedFSIds(newSelected);
  };

  const handleSelectAllEPC = () => {
    if (selectedEPCIds.size === paginatedEPC.length) {
      setSelectedEPCIds(new Set());
    } else {
      setSelectedEPCIds(new Set(paginatedEPC.map(r => r.id)));
    }
  };

  const handleSelectEPC = (id: number) => {
    const newSelected = new Set(selectedEPCIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedEPCIds(newSelected);
  };

  const filteredKE = keRequirements.filter(r =>
    r.ke_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.knowled_point?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPE = peRequirements.filter(r =>
    r.pe_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.performance_evidence?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredFS = fsRequirements.filter(r =>
    r.fs_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.skill_point?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredEPC = epcRequirements.filter(r =>
    r.epc_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.performance_criteria?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openRequirementDetails = async (type: 'ke'|'pe'|'fs'|'epc', rec: any) => {
    setDetailType(type);
    setDetailRecord(rec);
    setSmartQuestions([]);
    setBenchmarkAnswers({});
    setParentUnit(null);

    // derive unit code from unit_url
    const url: string = (rec as any).unit_url || '';
    let unitCode = '';
    const m = url.match(/Details\/([A-Za-z0-9]+)/);
    if (m && m[1]) unitCode = m[1];
    if (!unitCode) {
      const parts = url.split('/');
      unitCode = parts[parts.length - 1] || '';
    }

    if (unitCode) {
      const { data: unit } = await supabase.from('UnitOfCompetency').select('*').eq('unitCode', unitCode).single();
      setParentUnit(unit || null);
    }

    // get smart questions by requirementId
    const { data: questions } = await supabase.from('SmartQuestion').select('*').eq('requirementId', rec.id);
    setSmartQuestions(questions || []);
    const ids = (questions || []).map((q: any) => q.id);
    if (ids.length) {
      const { data: answers } = await supabase.from('BenchmarkAnswer').select('*').in('smartQuestionId', ids);
      const grouped: Record<number, any[]> = {};
      (answers || []).forEach((a: any) => {
        if (!grouped[a.smartQuestionId]) grouped[a.smartQuestionId] = [];
        grouped[a.smartQuestionId].push(a);
      });
      setBenchmarkAnswers(grouped);
    }
  };

  const paginatedKE = filteredKE.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const paginatedPE = filteredPE.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const paginatedFS = filteredFS.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const paginatedEPC = filteredEPC.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const totalPagesKE = Math.ceil(filteredKE.length / pageSize);
  const totalPagesPE = Math.ceil(filteredPE.length / pageSize);
  const totalPagesFS = Math.ceil(filteredFS.length / pageSize);
  const totalPagesEPC = Math.ceil(filteredEPC.length / pageSize);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-poppins font-bold text-[#1e293b]">Requirements Management</h2>

      <Card className="border border-[#dbeafe] bg-white p-6">
        <div className="flex items-center gap-3 mb-4">
          <Search className="w-5 h-5 text-[#64748b]" />
          <Input
            placeholder="Search requirements..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="border border-[#dbeafe] bg-white"
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="ke">Knowledge Evidence</TabsTrigger>
            <TabsTrigger value="pe">Performance Evidence</TabsTrigger>
            <TabsTrigger value="fs">Foundation Skills</TabsTrigger>
            <TabsTrigger value="epc">Elements & Criteria</TabsTrigger>
          </TabsList>

          <TabsContent value="ke" className="mt-6">
            {selectedKEIds.size > 0 && (
              <div className="mb-4 p-4 bg-[#dbeafe] rounded-lg flex items-center justify-between">
                <p className="text-[#1e293b] font-semibold">
                  {selectedKEIds.size} record(s) selected
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
                        checked={selectedKEIds.size === paginatedKE.length && paginatedKE.length > 0}
                        onChange={handleSelectAllKE}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">KE Number</th>
                    <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Knowledge Point</th>
                    <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-[#64748b]">
                        Loading...
                      </td>
                    </tr>
                  ) : paginatedKE.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-[#64748b]">
                        No knowledge evidence requirements found
                      </td>
                    </tr>
                  ) : (
                    paginatedKE.map((record) => (
                      <tr key={record.id} className="border-b border-[#e2e8f0] hover:bg-[#f8f9fb]">
                        <td className="py-3 px-4">
                          <input
                            type="checkbox"
                            checked={selectedKEIds.has(record.id)}
                            onChange={() => handleSelectKE(record.id)}
                            className="w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-4 text-[#1e293b] font-semibold">{record.ke_number || '-'}</td>
                        <td className="py-3 px-4 text-[#64748b] max-w-md truncate">{record.knowled_point || '-'}</td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => openRequirementDetails('ke', record)}
                            className="p-2 hover:bg-[#dbeafe] text-[#0ea5e9] rounded transition-colors"
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete('knowledge_evidence_requirements', record.id)}
                            className="p-2 hover:bg-[#fee2e2] text-[#ef4444] rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {totalPagesKE > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-[#64748b]">
                  Page {currentPage} of {totalPagesKE} ({filteredKE.length} total)
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="p-2 hover:bg-[#dbeafe] disabled:opacity-50 disabled:cursor-not-allowed rounded"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPagesKE, currentPage + 1))}
                    disabled={currentPage === totalPagesKE}
                    className="p-2 hover:bg-[#dbeafe] disabled:opacity-50 disabled:cursor-not-allowed rounded"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="pe" className="mt-6">
            {selectedPEIds.size > 0 && (
              <div className="mb-4 p-4 bg-[#dbeafe] rounded-lg flex items-center justify-between">
                <p className="text-[#1e293b] font-semibold">
                  {selectedPEIds.size} record(s) selected
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
                        checked={selectedPEIds.size === paginatedPE.length && paginatedPE.length > 0}
                        onChange={handleSelectAllPE}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">PE Number</th>
                    <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Performance Evidence</th>
                    <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-[#64748b]">
                        Loading...
                      </td>
                    </tr>
                  ) : paginatedPE.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-[#64748b]">
                        No performance evidence requirements found
                      </td>
                    </tr>
                  ) : (
                    paginatedPE.map((record) => (
                      <tr key={record.id} className="border-b border-[#e2e8f0] hover:bg-[#f8f9fb]">
                        <td className="py-3 px-4">
                          <input
                            type="checkbox"
                            checked={selectedPEIds.has(record.id)}
                            onChange={() => handleSelectPE(record.id)}
                            className="w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-4 text-[#1e293b] font-semibold">{record.pe_number || '-'}</td>
                        <td className="py-3 px-4 text-[#64748b] max-w-md truncate">{record.performance_evidence || '-'}</td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => openRequirementDetails('pe', record)}
                            className="p-2 hover:bg-[#dbeafe] text-[#0ea5e9] rounded transition-colors"
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete('performance_evidence_requirements', record.id)}
                            className="p-2 hover:bg-[#fee2e2] text-[#ef4444] rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {totalPagesPE > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-[#64748b]">
                  Page {currentPage} of {totalPagesPE} ({filteredPE.length} total)
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="p-2 hover:bg-[#dbeafe] disabled:opacity-50 disabled:cursor-not-allowed rounded"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPagesPE, currentPage + 1))}
                    disabled={currentPage === totalPagesPE}
                    className="p-2 hover:bg-[#dbeafe] disabled:opacity-50 disabled:cursor-not-allowed rounded"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="fs" className="mt-6">
            {selectedFSIds.size > 0 && (
              <div className="mb-4 p-4 bg-[#dbeafe] rounded-lg flex items-center justify-between">
                <p className="text-[#1e293b] font-semibold">
                  {selectedFSIds.size} record(s) selected
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
                        checked={selectedFSIds.size === paginatedFS.length && paginatedFS.length > 0}
                        onChange={handleSelectAllFS}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">FS Number</th>
                    <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Skill Point</th>
                    <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-[#64748b]">
                        Loading...
                      </td>
                    </tr>
                  ) : paginatedFS.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-[#64748b]">
                        No foundation skills requirements found
                      </td>
                    </tr>
                  ) : (
                    paginatedFS.map((record) => (
                      <tr key={record.id} className="border-b border-[#e2e8f0] hover:bg-[#f8f9fb]">
                        <td className="py-3 px-4">
                          <input
                            type="checkbox"
                            checked={selectedFSIds.has(record.id)}
                            onChange={() => handleSelectFS(record.id)}
                            className="w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-4 text-[#1e293b] font-semibold">{record.fs_number || '-'}</td>
                        <td className="py-3 px-4 text-[#64748b] max-w-md truncate">{record.skill_point || '-'}</td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => openRequirementDetails('fs', record)}
                            className="p-2 hover:bg-[#dbeafe] text-[#0ea5e9] rounded transition-colors"
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete('foundation_skills_requirements', record.id)}
                            className="p-2 hover:bg-[#fee2e2] text-[#ef4444] rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {totalPagesFS > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-[#64748b]">
                  Page {currentPage} of {totalPagesFS} ({filteredFS.length} total)
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="p-2 hover:bg-[#dbeafe] disabled:opacity-50 disabled:cursor-not-allowed rounded"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPagesFS, currentPage + 1))}
                    disabled={currentPage === totalPagesFS}
                    className="p-2 hover:bg-[#dbeafe] disabled:opacity-50 disabled:cursor-not-allowed rounded"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="epc" className="mt-6">
            {selectedEPCIds.size > 0 && (
              <div className="mb-4 p-4 bg-[#dbeafe] rounded-lg flex items-center justify-between">
                <p className="text-[#1e293b] font-semibold">
                  {selectedEPCIds.size} record(s) selected
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
                        checked={selectedEPCIds.size === paginatedEPC.length && paginatedEPC.length > 0}
                        onChange={handleSelectAllEPC}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">EPC Number</th>
                    <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Performance Criteria</th>
                    <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Element</th>
                    <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-[#64748b]">
                        Loading...
                      </td>
                    </tr>
                  ) : paginatedEPC.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-[#64748b]">
                        No elements & performance criteria requirements found
                      </td>
                    </tr>
                  ) : (
                    paginatedEPC.map((record) => (
                      <tr key={record.id} className="border-b border-[#e2e8f0] hover:bg-[#f8f9fb]">
                        <td className="py-3 px-4">
                          <input
                            type="checkbox"
                            checked={selectedEPCIds.has(record.id)}
                            onChange={() => handleSelectEPC(record.id)}
                            className="w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-4 text-[#1e293b] font-semibold">{record.epc_number || '-'}</td>
                        <td className="py-3 px-4 text-[#64748b] max-w-md truncate">{record.performance_criteria || '-'}</td>
                        <td className="py-3 px-4 text-[#64748b] max-w-xs truncate">{record.element || '-'}</td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => openRequirementDetails('epc', record)}
                            className="p-2 hover:bg-[#dbeafe] text-[#0ea5e9] rounded transition-colors"
                            title="View"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete('elements_performance_criteria_requirements', record.id)}
                            className="p-2 hover:bg-[#fee2e2] text-[#ef4444] rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {totalPagesEPC > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-[#64748b]">
                  Page {currentPage} of {totalPagesEPC} ({filteredEPC.length} total)
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="p-2 hover:bg-[#dbeafe] disabled:opacity-50 disabled:cursor-not-allowed rounded"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPagesEPC, currentPage + 1))}
                    disabled={currentPage === totalPagesEPC}
                    className="p-2 hover:bg-[#dbeafe] disabled:opacity-50 disabled:cursor-not-allowed rounded"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </Card>

      <AlertDialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#1e293b]">Confirm Bulk Delete</AlertDialogTitle>
            <AlertDialogDescription className="text-[#64748b]">
              {activeTab === 'ke' && `This will delete ${selectedKEIds.size} record(s).`}
              {activeTab === 'pe' && `This will delete ${selectedPEIds.size} record(s).`}
              {activeTab === 'fs' && `This will delete ${selectedFSIds.size} record(s).`}
              {activeTab === 'epc' && `This will delete ${selectedEPCIds.size} record(s).`}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="bg-[#fef2f2] border border-[#fecaca] rounded-lg p-4 my-4">
            <p className="font-semibold text-[#991b1b] mb-2">Records to Delete:</p>
            <ul className="text-sm text-[#7f1d1d] space-y-1 max-h-48 overflow-y-auto">
              {activeTab === 'ke' && Array.from(selectedKEIds).slice(0, 10).map(id => {
                const record = keRequirements.find(r => r.id === id);
                return (
                  <li key={id}>• {record?.ke_number || 'Untitled'}</li>
                );
              })}
              {activeTab === 'pe' && Array.from(selectedPEIds).slice(0, 10).map(id => {
                const record = peRequirements.find(r => r.id === id);
                return (
                  <li key={id}>• {record?.pe_number || 'Untitled'}</li>
                );
              })}
              {activeTab === 'fs' && Array.from(selectedFSIds).slice(0, 10).map(id => {
                const record = fsRequirements.find(r => r.id === id);
                return (
                  <li key={id}>• {record?.fs_number || 'Untitled'}</li>
                );
              })}
              {activeTab === 'epc' && Array.from(selectedEPCIds).slice(0, 10).map(id => {
                const record = epcRequirements.find(r => r.id === id);
                return (
                  <li key={id}>• {record?.epc_number || 'Untitled'}</li>
                );
              })}
            </ul>
          </div>

          <div className="flex gap-3 justify-end">
            <AlertDialogCancel disabled={isLoading} className="text-[#1e293b]">
              Cancel
            </AlertDialogCancel>
            <button
              onClick={() => {
                if (activeTab === 'ke') handleBulkDelete('knowledge_evidence_requirements', selectedKEIds);
                else if (activeTab === 'pe') handleBulkDelete('performance_evidence_requirements', selectedPEIds);
                else if (activeTab === 'fs') handleBulkDelete('foundation_skills_requirements', selectedFSIds);
                else if (activeTab === 'epc') handleBulkDelete('elements_performance_criteria_requirements', selectedEPCIds);
              }}
              disabled={isLoading}
              className="px-4 py-2 bg-[#ef4444] hover:bg-[#dc2626] text-white font-semibold rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Deleting...' : 'Delete All'}
            </button>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {detailRecord && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl p-6 border border-[#dbeafe]">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-poppins font-bold text-[#1e293b]">Requirement Details</h3>
                {parentUnit ? (
                  <button
                    onClick={() => window.dispatchEvent(new CustomEvent('app:navigate', { detail: { view: 'maintenance', module: 'units' } }))}
                    className="inline-flex items-center gap-2 text-sm text-[#3b82f6] mt-1"
                  >
                    <Link2 className="w-4 h-4" /> {parentUnit.unitCode} - {parentUnit.Title}
                  </button>
                ) : (
                  <p className="text-sm text-[#64748b]">Parent unit not found</p>
                )}
              </div>
              <button onClick={() => setDetailRecord(null)} className="px-3 py-1 rounded bg-[#e2e8f0] hover:bg-[#cbd5e1] text-[#1e293b]">Close</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border border-[#e2e8f0] bg-white p-4">
                <h4 className="font-semibold text-[#1e293b] mb-2">Smart Questions</h4>
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {smartQuestions.length === 0 ? (
                    <p className="text-sm text-[#64748b]">No questions found</p>
                  ) : (
                    smartQuestions.map((q:any) => (
                      <div key={q.id} className="p-3 border border-[#e2e8f0] rounded">
                        <p className="text-sm text-[#1e293b]">{q.question}</p>
                        <p className="text-xs text-[#64748b]">ID: {q.id}</p>
                      </div>
                    ))
                  )}
                </div>
              </Card>

              <Card className="border border-[#e2e8f0] bg-white p-4">
                <h4 className="font-semibold text-[#1e293b] mb-2">Benchmark Answers</h4>
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {smartQuestions.length === 0 ? (
                    <p className="text-sm text-[#64748b]">No answers found</p>
                  ) : (
                    smartQuestions.map((q:any) => (
                      <div key={q.id} className="p-3 border border-[#e2e8f0] rounded">
                        <p className="text-xs text-[#64748b] mb-1">Question ID: {q.id}</p>
                        {(benchmarkAnswers[q.id] || []).map((a:any) => (
                          <p key={a.id} className="text-sm text-[#1e293b]">• {a.answer}</p>
                        ))}
                        {!(benchmarkAnswers[q.id] || []).length && (
                          <p className="text-sm text-[#64748b]">No answers</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
