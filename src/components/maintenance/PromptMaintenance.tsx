import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { Trash2, Edit, Plus, Search, ChevronLeft, ChevronRight, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Prompt {
  id: number;
  created_at: string;
  name: string;
  prompt: string;
  validation_type_id: number | null;
  current: boolean;
  zod: string | null;
}

interface ValidationType {
  id: number;
  code: string;
  description: string;
}

export function PromptMaintenance() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [validationTypes, setValidationTypes] = useState<ValidationType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [formData, setFormData] = useState<Partial<Prompt>>({
    name: '',
    prompt: '',
    validation_type_id: null,
    current: true,
    zod: null,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load validation types
      const { data: types, error: typesError } = await supabase
        .from('validation_type')
        .select('*')
        .order('code');

      if (typesError) throw typesError;
      setValidationTypes(types || []);

      // Load prompts
      const { data: promptsData, error: promptsError } = await supabase
        .from('prompt')
        .select('*')
        .order('validation_type_id', { ascending: true })
        .order('created_at', { ascending: false });

      if (promptsError) throw promptsError;
      setPrompts(promptsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load prompts');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this prompt?')) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.from('prompt').delete().eq('id', id);
      if (error) throw error;
      toast.success('Prompt deleted successfully');
      await loadData();
    } catch (error) {
      console.error('Error deleting prompt:', error);
      toast.error('Failed to delete prompt');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) {
      toast.error('No prompts selected');
      return;
    }

    setIsLoading(true);
    try {
      let successCount = 0;
      let errorCount = 0;

      for (const id of selectedIds) {
        const { error } = await supabase.from('prompt').delete().eq('id', id);
        if (!error) {
          successCount++;
        } else {
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} prompt(s) deleted successfully`);
        setSelectedIds(new Set());
        setShowDeleteModal(false);
        await loadData();
      }

      if (errorCount > 0) {
        toast.error(`Failed to delete ${errorCount} prompt(s)`);
      }
    } catch (error) {
      toast.error('Failed to delete prompts');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (prompt: Prompt) => {
    setEditingId(prompt.id);
    setFormData(prompt);
    setShowForm(true);
  };

  const handleCreate = () => {
    setEditingId(null);
    setFormData({
      name: '',
      prompt: '',
      validation_type_id: null,
      current: true,
      zod: null,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.prompt) {
      toast.error('Name and prompt are required');
      return;
    }

    setIsLoading(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from('prompt')
          .update(formData)
          .eq('id', editingId);
        if (error) throw error;
        toast.success('Prompt updated successfully');
      } else {
        const { error } = await supabase.from('prompt').insert([formData]);
        if (error) throw error;
        toast.success('Prompt created successfully');
      }
      setShowForm(false);
      await loadData();
    } catch (error) {
      console.error('Error saving prompt:', error);
      toast.error('Failed to save prompt');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleCurrent = async (prompt: Prompt) => {
    try {
      const { error } = await supabase
        .from('prompt')
        .update({ current: !prompt.current })
        .eq('id', prompt.id);
      if (error) throw error;
      toast.success(`Prompt ${!prompt.current ? 'activated' : 'deactivated'}`);
      await loadData();
    } catch (error) {
      console.error('Error toggling current status:', error);
      toast.error('Failed to update prompt status');
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.size === paginatedPrompts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedPrompts.map(p => p.id)));
    }
  };

  const handleSelectPrompt = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const getValidationTypeName = (typeId: number | null) => {
    if (!typeId) return 'No Type';
    const type = validationTypes.find((t) => t.id === typeId);
    return type?.description || `Type ${typeId}`;
  };

  // Detect duplicate active prompts
  const getDuplicateActivePrompts = () => {
    const activeByType: Record<number, number> = {};
    prompts.forEach((prompt) => {
      if (prompt.current && prompt.validation_type_id) {
        activeByType[prompt.validation_type_id] = (activeByType[prompt.validation_type_id] || 0) + 1;
      }
    });
    return Object.entries(activeByType)
      .filter(([_, count]) => count > 1)
      .map(([typeId]) => parseInt(typeId));
  };

  const duplicateActiveTypes = getDuplicateActivePrompts();

  const filteredPrompts = prompts.filter(p =>
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getValidationTypeName(p.validation_type_id).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const paginatedPrompts = filteredPrompts.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(filteredPrompts.length / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-poppins font-bold text-[#1e293b]">Prompt Management</h2>
        <Button
          onClick={handleCreate}
          className="bg-[#10b981] hover:bg-[#059669] text-white font-semibold"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Prompt
        </Button>
      </div>

      {duplicateActiveTypes.length > 0 && (
        <div className="p-3 bg-red-50 border border-red-300 rounded-lg">
          <p className="text-sm text-red-800 font-semibold">
            🚨 <strong>Warning:</strong> Multiple active prompts detected!
          </p>
          <p className="text-xs text-red-700 mt-1">
            The following validation types have MORE THAN ONE active prompt:{' '}
            {duplicateActiveTypes.map(typeId => getValidationTypeName(typeId)).join(', ')}
          </p>
          <p className="text-xs text-red-700 mt-1">
            Please deactivate all but one prompt for each validation type to ensure predictable behavior.
          </p>
        </div>
      )}

      {!showForm && (
        <>
          <Card className="border border-[#dbeafe] bg-white p-6">
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                ⚠️ <strong>Important:</strong> Only prompts marked as <strong>ACTIVE</strong> (current = true) are used by the validation system.
                Ensure only ONE prompt per validation type is active.
              </p>
            </div>

            <div className="flex items-center gap-3 mb-4">
              <Search className="w-5 h-5 text-[#64748b]" />
              <Input
                placeholder="Search by name or validation type..."
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
                  {selectedIds.size} prompt(s) selected
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
                        checked={selectedIds.size === paginatedPrompts.length && paginatedPrompts.length > 0}
                        onChange={handleSelectAll}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </th>
                    <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Validation Type</th>
                    <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Length</th>
                    <th className="text-left py-3 px-4 font-semibold text-[#1e293b]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-[#64748b]">
                        Loading prompts...
                      </td>
                    </tr>
                  ) : paginatedPrompts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-[#64748b]">
                        No prompts found
                      </td>
                    </tr>
                  ) : (
                    paginatedPrompts.map((prompt) => (
                      <tr key={prompt.id} className="border-b border-[#e2e8f0] hover:bg-[#f8f9fb]">
                        <td className="py-3 px-4">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(prompt.id)}
                            onChange={() => handleSelectPrompt(prompt.id)}
                            className="w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-4 text-[#1e293b] font-semibold max-w-xs truncate">
                          {prompt.name}
                        </td>
                        <td className="py-3 px-4 text-[#64748b]">
                          {getValidationTypeName(prompt.validation_type_id)}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${
                            prompt.current ? 'bg-[#dcfce7] text-[#166534]' : 'bg-[#fee2e2] text-[#991b1b]'
                          }`}>
                            {prompt.current ? 'ACTIVE' : 'INACTIVE'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[#64748b]">
                          {prompt.prompt?.length || 0} chars
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggleCurrent(prompt)}
                              className={`p-2 rounded transition-colors ${
                                prompt.current
                                  ? 'hover:bg-[#fee2e2] text-[#ef4444]'
                                  : 'hover:bg-[#dcfce7] text-[#10b981]'
                              }`}
                              title={prompt.current ? 'Deactivate' : 'Activate'}
                            >
                              {prompt.current ? (
                                <XCircle className="w-4 h-4" />
                              ) : (
                                <CheckCircle className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => handleEdit(prompt)}
                              className="p-2 hover:bg-[#dbeafe] text-[#3b82f6] rounded transition-colors"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(prompt.id)}
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
                  Page {currentPage} of {totalPages} ({filteredPrompts.length} total)
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
            {editingId ? 'Edit Prompt' : 'Create New Prompt'}
          </h3>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6">
            <div>
              <Label htmlFor="name" className="text-[#1e293b] font-semibold mb-2 block">
                Prompt Name <span className="text-[#ef4444]">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Knowledge Evidence Validation - V2"
                className="border border-[#dbeafe] bg-white"
                disabled={isLoading}
              />
            </div>

            <div>
              <Label htmlFor="validation_type" className="text-[#1e293b] font-semibold mb-2 block">
                Validation Type
              </Label>
              <select
                id="validation_type"
                value={formData.validation_type_id || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    validation_type_id: e.target.value ? parseInt(e.target.value) : null,
                  })
                }
                className="w-full px-3 py-2 border border-[#dbeafe] rounded-md bg-white"
                disabled={isLoading}
              >
                <option value="">No Type (Generic)</option>
                {validationTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.description} ({type.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="prompt" className="text-[#1e293b] font-semibold mb-2 block">
                Prompt Content <span className="text-[#ef4444]">*</span>
              </Label>
              <Textarea
                id="prompt"
                value={formData.prompt || ''}
                onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                placeholder="Enter the full Gemini prompt here..."
                rows={12}
                className="font-mono text-sm border border-[#dbeafe] bg-white"
                disabled={isLoading}
              />
              <p className="text-xs text-gray-500 mt-1">
                {formData.prompt?.length || 0} characters
              </p>
            </div>

            <div>
              <Label htmlFor="zod" className="text-[#1e293b] font-semibold mb-2 block">
                Zod Schema (Optional)
              </Label>
              <Textarea
                id="zod"
                value={formData.zod || ''}
                onChange={(e) => setFormData({ ...formData, zod: e.target.value })}
                placeholder="Optional Zod validation schema"
                rows={4}
                className="font-mono text-sm border border-[#dbeafe] bg-white"
                disabled={isLoading}
              />
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="current"
                  checked={formData.current || false}
                  onChange={(e) => setFormData({ ...formData, current: e.target.checked })}
                  className="rounded"
                  disabled={isLoading}
                />
                <Label htmlFor="current" className="cursor-pointer font-semibold">
                  Active (currently in use)
                </Label>
              </div>
              <p className="text-xs text-blue-700 mt-1 ml-6">
                ⚠️ Only active prompts are used. Ensure only ONE prompt per validation type is active.
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 py-2 px-4 bg-[#10b981] hover:bg-[#059669] text-white font-semibold rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Saving...' : editingId ? 'Update Prompt' : 'Create Prompt'}
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
              This will permanently delete {selectedIds.size} prompt(s). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="bg-[#fef2f2] border border-[#fecaca] rounded-lg p-4 my-4">
            <p className="font-semibold text-[#991b1b] mb-2">Prompts to Delete:</p>
            <ul className="text-sm text-[#7f1d1d] space-y-1">
              {Array.from(selectedIds).map(id => {
                const prompt = prompts.find(p => p.id === id);
                return (
                  <li key={id}>• {prompt?.name || 'Unnamed'}</li>
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
