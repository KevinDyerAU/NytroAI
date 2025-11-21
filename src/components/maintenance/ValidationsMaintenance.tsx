import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Trash2, Edit, Plus, Search, ChevronLeft, ChevronRight, Checkbox } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../hooks/useAuth';

interface ValidationSummaryRecord {
  id: number;
  rtoCode?: string;
  unitCode?: string;
  qualificationCode?: string;
  created_at?: string;
}

interface ValidationDetailRecord {
  id: number;
  namespace_code?: string;
  summary_id?: number;
  docExtracted?: boolean;
  extractStatus?: string;
  created_at?: string;
}

interface ValidationBasicFileRecord {
  id: number;
  file_namespace_code?: string;
  studentName?: string;
  docExtracted?: boolean;
  created_at?: string;
}

export function ValidationsMaintenance() {
  const { user } = useAuth();
  const [validationSummaries, setValidationSummaries] = useState<ValidationSummaryRecord[]>([]);
  const [validationDetails, setValidationDetails] = useState<ValidationDetailRecord[]>([]);
  const [validationFiles, setValidationFiles] = useState<ValidationBasicFileRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [activeTab, setActiveTab] = useState('summary');
  const [selectedSummaryIds, setSelectedSummaryIds] = useState<Set<number>>(new Set());
  const [selectedDetailIds, setSelectedDetailIds] = useState<Set<number>>(new Set());
  const [selectedFileIds, setSelectedFileIds] = useState<Set<number>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    fetchData();

    // Auto-filter by user's RTO code if available
    if (user?.rto_code) {
      console.log('[ValidationsMaintenance] Auto-filtering by RTO code:', user.rto_code);
      setSearchTerm(user.rto_code);
    }
  }, [user?.rto_code]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [summaries, details, files] = await Promise.all([
        supabase.from('validation_summary').select('*').order('created_at', { ascending: false }),
        supabase.from('validation_detail').select('*').order('created_at', { ascending: false }),
        supabase.from('validation_basic_file').select('*').order('created_at', { ascending: false }),
      ]);

      if (summaries.error) throw summaries.error;
      if (details.error) throw details.error;
      if (files.error) throw files.error;

      setValidationSummaries(summaries.data || []);
      setValidationDetails(details.data || []);
      setValidationFiles(files.data || []);
    } catch (error) {
      toast.error('Failed to fetch validation records');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (table: string, id: number) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.from(table).delete().eq('id', id);

      if (error) throw error;

      toast.success('Record deleted successfully');

      if (table === 'validation_summary') {
        setValidationSummaries(validationSummaries.filter(r => r.id !== id));
      } else if (table === 'validation_detail') {
        setValidationDetails(validationDetails.filter(r => r.id !== id));
      } else if (table === 'validation_basic_file') {
        setValidationFiles(validationFiles.filter(r => r.id !== id));
      }
    } catch (error) {
      toast.error('Failed to delete record');
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
      const idsArray = Array.from(ids);

      // If deleting summaries, first delete related details
      if (table === 'validation_summary') {
        const { error: dErr } = await supabase
          .from('validation_detail')
          .delete()
          .in('summary_id', idsArray);
        if (dErr) console.warn('Failed deleting related details:', dErr.message);
      }

      const { error } = await supabase.from(table).delete().in('id', idsArray);
      if (error) throw error;

      if (table === 'validation_summary') {
        setValidationSummaries(validationSummaries.filter(r => !ids.has(r.id)));
        setSelectedSummaryIds(new Set());
      } else if (table === 'validation_detail') {
        setValidationDetails(validationDetails.filter(r => !ids.has(r.id)));
        setSelectedDetailIds(new Set());
      } else if (table === 'validation_basic_file') {
        setValidationFiles(validationFiles.filter(r => !ids.has(r.id)));
        setSelectedFileIds(new Set());
      }

      setShowDeleteModal(false);
      toast.success(`${idsArray.length} record(s) deleted successfully`);
    } catch (error) {
      toast.error('Failed to delete records');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAllSummary = () => {
    if (selectedSummaryIds.size === paginatedSummaries.length) {
      setSelectedSummaryIds(new Set());
    } else {
      setSelectedSummaryIds(new Set(paginatedSummaries.map(r => r.id)));
    }
  };

  const handleSelectSummary = (id: number) => {
    const newSelected = new Set(selectedSummaryIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedSummaryIds(newSelected);
  };

  const handleSelectAllDetail = () => {
    if (selectedDetailIds.size === paginatedDetails.length) {
      setSelectedDetailIds(new Set());
    } else {
      setSelectedDetailIds(new Set(paginatedDetails.map(r => r.id)));
    }
  };

  const handleSelectDetail = (id: number) => {
    const newSelected = new Set(selectedDetailIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedDetailIds(newSelected);
  };

  const handleSelectAllFiles = () => {
    if (selectedFileIds.size === paginatedFiles.length) {
      setSelectedFileIds(new Set());
    } else {
      setSelectedFileIds(new Set(paginatedFiles.map(r => r.id)));
    }
  };

  const handleSelectFile = (id: number) => {
    const newSelected = new Set(selectedFileIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedFileIds(newSelected);
  };

  const filteredSummaries = validationSummaries.filter(v =>
    v.rtoCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.unitCode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredDetails = validationDetails.filter(v =>
    v.namespace_code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredFiles = validationFiles.filter(v =>
    v.file_namespace_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.studentName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const paginatedSummaries = filteredSummaries.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const paginatedDetails = filteredDetails.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const paginatedFiles = filteredFiles.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const totalPagesSummaries = Math.ceil(filteredSummaries.length / pageSize);
  const totalPagesDetails = Math.ceil(filteredDetails.length / pageSize);
  const totalPagesFiles = Math.ceil(filteredFiles.length / pageSize);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-poppins font-bold text-[#1e293b]">Validation Records Management</h2>

      <Card className="border border-[#dbeafe] bg-white p-6">
        <div className="flex items-center gap-3 mb-4">
          <Search className="w-5 h-5 text-[#64748b]" />
          <Input
            placeholder="Search records..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="border border-[#dbeafe] bg-white"
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="summary">Validation Summary</TabsTrigger>
            <TabsTrigger value="detail">Validation Detail</TabsTrigger>
            <TabsTrigger value="file">Validation Files</TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="mt-6">
            {selectedSummaryIds.size > 0 && (
              <div className="mb-4 p-4 bg-[#dbeafe] rounded-lg flex items-center justify-between">
                <p className="text-[#1e293b] font-semibold">
                  {selectedSummaryIds.size} record(s) selected
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
                        checked={selectedSummaryIds.size === paginatedSummaries.length && paginatedSummaries.length > 0}
                        onChange={handleSelectAllSummary}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">RTO Code</th>
                    <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Unit Code</th>
                    <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Qualification</th>
                    <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Created</th>
                    <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-[#64748b]">
                        Loading...
                      </td>
                    </tr>
                  ) : paginatedSummaries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-[#64748b]">
                        No validation summaries found
                      </td>
                    </tr>
                  ) : (
                    paginatedSummaries.map((record) => (
                      <tr key={record.id} className="border-b border-[#e2e8f0] hover:bg-[#f8f9fb]">
                        <td className="py-3 px-4">
                          <input
                            type="checkbox"
                            checked={selectedSummaryIds.has(record.id)}
                            onChange={() => handleSelectSummary(record.id)}
                            className="w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-4 text-[#1e293b]">{record.rtoCode || '-'}</td>
                        <td className="py-3 px-4 text-[#64748b]">{record.unitCode || '-'}</td>
                        <td className="py-3 px-4 text-[#64748b]">{record.qualificationCode || '-'}</td>
                        <td className="py-3 px-4 text-[#64748b] text-sm">
                          {record.created_at ? new Date(record.created_at).toLocaleDateString() : '-'}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => handleDelete('validation_summary', record.id)}
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

            {totalPagesSummaries > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-[#64748b]">
                  Page {currentPage} of {totalPagesSummaries} ({filteredSummaries.length} total)
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
                    onClick={() => setCurrentPage(Math.min(totalPagesSummaries, currentPage + 1))}
                    disabled={currentPage === totalPagesSummaries}
                    className="p-2 hover:bg-[#dbeafe] disabled:opacity-50 disabled:cursor-not-allowed rounded"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="detail" className="mt-6">
            {selectedDetailIds.size > 0 && (
              <div className="mb-4 p-4 bg-[#dbeafe] rounded-lg flex items-center justify-between">
                <p className="text-[#1e293b] font-semibold">
                  {selectedDetailIds.size} record(s) selected
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
                        checked={selectedDetailIds.size === paginatedDetails.length && paginatedDetails.length > 0}
                        onChange={handleSelectAllDetail}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Namespace Code</th>
                    <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Summary ID</th>
                    <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Doc Extracted</th>
                    <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-[#64748b]">
                        Loading...
                      </td>
                    </tr>
                  ) : paginatedDetails.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-[#64748b]">
                        No validation details found
                      </td>
                    </tr>
                  ) : (
                    paginatedDetails.map((record) => (
                      <tr key={record.id} className="border-b border-[#e2e8f0] hover:bg-[#f8f9fb]">
                        <td className="py-3 px-4">
                          <input
                            type="checkbox"
                            checked={selectedDetailIds.has(record.id)}
                            onChange={() => handleSelectDetail(record.id)}
                            className="w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-4 text-[#1e293b]">{record.namespace_code || '-'}</td>
                        <td className="py-3 px-4 text-[#64748b]">{record.summary_id || '-'}</td>
                        <td className="py-3 px-4">
                          <span className={record.docExtracted ? 'text-[#166534] font-semibold' : 'text-[#64748b]'}>
                            {record.docExtracted ? '✓ Yes' : 'No'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            record.extractStatus === 'Processing' ? 'bg-[#fef3c7] text-[#92400e]' : 'bg-[#dcfce7] text-[#166534]'
                          }`}>
                            {record.extractStatus || 'Unknown'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => handleDelete('validation_detail', record.id)}
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

            {totalPagesDetails > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-[#64748b]">
                  Page {currentPage} of {totalPagesDetails} ({filteredDetails.length} total)
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
                    onClick={() => setCurrentPage(Math.min(totalPagesDetails, currentPage + 1))}
                    disabled={currentPage === totalPagesDetails}
                    className="p-2 hover:bg-[#dbeafe] disabled:opacity-50 disabled:cursor-not-allowed rounded"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="file" className="mt-6">
            {selectedFileIds.size > 0 && (
              <div className="mb-4 p-4 bg-[#dbeafe] rounded-lg flex items-center justify-between">
                <p className="text-[#1e293b] font-semibold">
                  {selectedFileIds.size} record(s) selected
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
                        checked={selectedFileIds.size === paginatedFiles.length && paginatedFiles.length > 0}
                        onChange={handleSelectAllFiles}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">File Namespace</th>
                    <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Student Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Doc Extracted</th>
                    <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Created</th>
                    <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-[#64748b]">
                        Loading...
                      </td>
                    </tr>
                  ) : paginatedFiles.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-[#64748b]">
                        No validation files found
                      </td>
                    </tr>
                  ) : (
                    paginatedFiles.map((record) => (
                      <tr key={record.id} className="border-b border-[#e2e8f0] hover:bg-[#f8f9fb]">
                        <td className="py-3 px-4">
                          <input
                            type="checkbox"
                            checked={selectedFileIds.has(record.id)}
                            onChange={() => handleSelectFile(record.id)}
                            className="w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-4 text-[#1e293b]">{record.file_namespace_code || '-'}</td>
                        <td className="py-3 px-4 text-[#64748b]">{record.studentName || '-'}</td>
                        <td className="py-3 px-4">
                          <span className={record.docExtracted ? 'text-[#166534] font-semibold' : 'text-[#64748b]'}>
                            {record.docExtracted ? '✓ Yes' : 'No'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[#64748b] text-sm">
                          {record.created_at ? new Date(record.created_at).toLocaleDateString() : '-'}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => handleDelete('validation_basic_file', record.id)}
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

            {totalPagesFiles > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-[#64748b]">
                  Page {currentPage} of {totalPagesFiles} ({filteredFiles.length} total)
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
                    onClick={() => setCurrentPage(Math.min(totalPagesFiles, currentPage + 1))}
                    disabled={currentPage === totalPagesFiles}
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
              {activeTab === 'summary' && `This will delete ${selectedSummaryIds.size} summary record(s).`}
              {activeTab === 'detail' && `This will delete ${selectedDetailIds.size} detail record(s).`}
              {activeTab === 'file' && `This will delete ${selectedFileIds.size} file record(s).`}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="bg-[#fef2f2] border border-[#fecaca] rounded-lg p-4 my-4">
            <p className="font-semibold text-[#991b1b] mb-2">Records to Delete:</p>
            <ul className="text-sm text-[#7f1d1d] space-y-1 max-h-48 overflow-y-auto">
              {activeTab === 'summary' && Array.from(selectedSummaryIds).slice(0, 10).map(id => {
                const record = validationSummaries.find(r => r.id === id);
                return (
                  <li key={id}>• {record?.rtoCode} - {record?.unitCode || 'Untitled'}</li>
                );
              })}
              {activeTab === 'detail' && Array.from(selectedDetailIds).slice(0, 10).map(id => {
                const record = validationDetails.find(r => r.id === id);
                return (
                  <li key={id}>• {record?.namespace_code || 'Untitled'}</li>
                );
              })}
              {activeTab === 'file' && Array.from(selectedFileIds).slice(0, 10).map(id => {
                const record = validationFiles.find(r => r.id === id);
                return (
                  <li key={id}>• {record?.file_namespace_code || 'Untitled'}</li>
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
                if (activeTab === 'summary') handleBulkDelete('validation_summary', selectedSummaryIds);
                else if (activeTab === 'detail') handleBulkDelete('validation_detail', selectedDetailIds);
                else if (activeTab === 'file') handleBulkDelete('validation_basic_file', selectedFileIds);
              }}
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
