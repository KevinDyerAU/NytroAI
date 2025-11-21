import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { Trash2, Edit, Plus, Search, ChevronLeft, ChevronRight, Checkbox, Eye, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { insertSmartQuestion, updateSmartQuestion, deleteSmartQuestion } from '../../types/rto';

interface SmartQuestionRecord {
  id: number;
  question?: string;
  validationId?: number;
  requirementId?: number;
  created_at?: string;
}

export function SmartQuestionMaintenance() {
  const [questions, setQuestions] = useState<SmartQuestionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [formData, setFormData] = useState({
    question: '',
    validationId: '',
    requirementId: '',
  });

  const [detailQuestion, setDetailQuestion] = useState<SmartQuestionRecord | null>(null);
  const [answers, setAnswers] = useState<any[]>([]);
  const [parentRequirement, setParentRequirement] = useState<any | null>(null);

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('SmartQuestion')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setQuestions(data || []);
    } catch (error) {
      toast.error('Failed to fetch smart questions');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this smart question?')) return;

    setIsLoading(true);
    try {
      const result = await deleteSmartQuestion(id);

      if (result.success) {
        toast.success(result.message);
        setQuestions(questions.filter(q => q.id !== id));
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Failed to delete question');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) {
      toast.error('No questions selected');
      return;
    }

    setIsLoading(true);
    try {
      let successCount = 0;
      let errorCount = 0;

      for (const id of selectedIds) {
        const result = await deleteSmartQuestion(id);
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} question(s) deleted successfully`);
        setQuestions(questions.filter(q => !selectedIds.has(q.id)));
        setSelectedIds(new Set());
        setShowDeleteModal(false);
      }

      if (errorCount > 0) {
        toast.error(`Failed to delete ${errorCount} question(s)`);
      }
    } catch (error) {
      toast.error('Failed to delete questions');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.size === paginatedQuestions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedQuestions.map(q => q.id)));
    }
  };

  const handleSelectQuestion = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleEdit = (question: SmartQuestionRecord) => {
    setEditingId(question.id);
    setFormData({
      question: question.question || '',
      validationId: question.validationId?.toString() || '',
      requirementId: question.requirementId?.toString() || '',
    });
    setShowForm(true);
  };

  const handleCreate = () => {
    setEditingId(null);
    setFormData({
      question: '',
      validationId: '',
      requirementId: '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.question) {
      toast.error('Question text is required');
      return;
    }

    setIsLoading(true);
    try {
      const submitData = {
        question: formData.question,
        validationId: formData.validationId ? parseInt(formData.validationId) : null,
        requirementId: formData.requirementId ? parseInt(formData.requirementId) : null,
      };

      if (editingId) {
        const result = await updateSmartQuestion(editingId, submitData);
        if (result.success) {
          toast.success(result.message);
          await fetchQuestions();
        } else {
          toast.error(result.message);
        }
      } else {
        const result = await insertSmartQuestion(submitData);
        if (result.success) {
          toast.success(result.message);
          await fetchQuestions();
        } else {
          toast.error(result.message);
        }
      }
      setShowForm(false);
    } catch (error) {
      toast.error('Failed to save question');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredQuestions = questions.filter(q =>
    q.question?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openQuestionDetails = async (q: SmartQuestionRecord) => {
    setDetailQuestion(q);
    // load answers
    const { data: ans } = await supabase.from('BenchmarkAnswer').select('*').eq('smartQuestionId', q.id);
    setAnswers(ans || []);

    // find parent requirement by probing known tables
    let found: any = null;
    const tables = [
      { name: 'knowledge_evidence_requirements', codeField: 'ke_number' },
      { name: 'performance_evidence_requirements', codeField: 'pe_number' },
      { name: 'foundation_skills_requirements', codeField: 'fs_number' },
      { name: 'elements_performance_criteria_requirements', codeField: 'epc_number' },
    ];
    for (const t of tables) {
      const { data } = await supabase.from(t.name).select('*').eq('id', q.requirementId || -1);
      if (data && data.length) { found = { table: t.name, record: data[0] }; break; }
    }
    setParentRequirement(found);
  };

  const paginatedQuestions = filteredQuestions.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(filteredQuestions.length / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-poppins font-bold text-[#1e293b]">Smart Questions Management</h2>
        <Button
          onClick={handleCreate}
          className="bg-[#f59e0b] hover:bg-[#d97706] text-white font-semibold"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Question
        </Button>
      </div>

      {!showForm && (
        <>
          <Card className="border border-[#dbeafe] bg-white p-6">
            <div className="flex items-center gap-3 mb-4">
              <Search className="w-5 h-5 text-[#64748b]" />
              <Input
                placeholder="Search by question text..."
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
                  {selectedIds.size} question(s) selected
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
                        checked={selectedIds.size === paginatedQuestions.length && paginatedQuestions.length > 0}
                        onChange={handleSelectAll}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Question</th>
                    <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Validation ID</th>
                    <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Requirement ID</th>
                    <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-[#64748b]">
                        Loading questions...
                      </td>
                    </tr>
                  ) : paginatedQuestions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-[#64748b]">
                        No smart questions found
                      </td>
                    </tr>
                  ) : (
                    paginatedQuestions.map((question) => (
                      <tr key={question.id} className="border-b border-[#e2e8f0] hover:bg-[#f8f9fb]">
                        <td className="py-3 px-4">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(question.id)}
                            onChange={() => handleSelectQuestion(question.id)}
                            className="w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-4 text-[#1e293b] max-w-md truncate">{question.question || '-'}</td>
                        <td className="py-3 px-4 text-[#64748b]">{question.validationId || '-'}</td>
                        <td className="py-3 px-4 text-[#64748b]">{question.requirementId || '-'}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openQuestionDetails(question)}
                              className="p-2 hover:bg-[#dbeafe] text-[#0ea5e9] rounded transition-colors"
                              title="View"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleEdit(question)}
                              className="p-2 hover:bg-[#dbeafe] text-[#3b82f6] rounded transition-colors"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(question.id)}
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
                  Page {currentPage} of {totalPages} ({filteredQuestions.length} total)
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
            {editingId ? 'Edit Smart Question' : 'Create New Smart Question'}
          </h3>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6">
            <div>
              <Label htmlFor="question" className="text-[#1e293b] font-semibold mb-2 block">
                Question <span className="text-[#ef4444]">*</span>
              </Label>
              <textarea
                id="question"
                value={formData.question}
                onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                placeholder="Enter the smart question"
                className="w-full px-3 py-2 border border-[#dbeafe] bg-white rounded text-[#1e293b]"
                rows={6}
                disabled={isLoading}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="validationId" className="text-[#1e293b] font-semibold mb-2 block">
                  Validation ID
                </Label>
                <Input
                  id="validationId"
                  type="number"
                  value={formData.validationId}
                  onChange={(e) => setFormData({ ...formData, validationId: e.target.value })}
                  placeholder="Optional validation ID"
                  className="border border-[#dbeafe] bg-white"
                  disabled={isLoading}
                />
              </div>

              <div>
                <Label htmlFor="requirementId" className="text-[#1e293b] font-semibold mb-2 block">
                  Requirement ID
                </Label>
                <Input
                  id="requirementId"
                  type="number"
                  value={formData.requirementId}
                  onChange={(e) => setFormData({ ...formData, requirementId: e.target.value })}
                  placeholder="Optional requirement ID"
                  className="border border-[#dbeafe] bg-white"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 py-2 px-4 bg-[#f59e0b] hover:bg-[#d97706] text-white font-semibold rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Saving...' : editingId ? 'Update Question' : 'Create Question'}
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
              This will delete {selectedIds.size} question(s).
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="bg-[#fef2f2] border border-[#fecaca] rounded-lg p-4 my-4">
            <p className="font-semibold text-[#991b1b] mb-2">Questions to Delete:</p>
            <ul className="text-sm text-[#7f1d1d] space-y-1">
              {Array.from(selectedIds).map(id => {
                const question = questions.find(q => q.id === id);
                return (
                  <li key={id}>• {question?.question || 'Untitled'}</li>
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

      {detailQuestion && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl p-6 border border-[#dbeafe]">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-poppins font-bold text-[#1e293b]">Smart Question</h3>
                <p className="text-sm text-[#64748b] max-w-xl">{detailQuestion.question}</p>
                {parentRequirement && (
                  <button
                    onClick={() => window.dispatchEvent(new CustomEvent('app:navigate', { detail: { view: 'maintenance', module: 'requirements' } }))}
                    className="inline-flex items-center gap-2 text-sm text-[#3b82f6] mt-1"
                  >
                    <Link2 className="w-4 h-4" /> Open parent requirement
                  </button>
                )}
              </div>
              <button onClick={() => setDetailQuestion(null)} className="px-3 py-1 rounded bg-[#e2e8f0] hover:bg-[#cbd5e1] text-[#1e293b]">Close</button>
            </div>

            <Card className="border border-[#e2e8f0] bg-white p-4">
              <h4 className="font-semibold text-[#1e293b] mb-2">Benchmark Answers</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {answers.length === 0 ? (
                  <p className="text-sm text-[#64748b]">No answers found</p>
                ) : (
                  answers.map((a:any) => (
                    <p key={a.id} className="text-sm text-[#1e293b]">• {a.answer}</p>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
