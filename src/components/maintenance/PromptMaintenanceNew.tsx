/**
 * PromptMaintenance - NEW SCHEMA
 * 
 * Manages prompts using the new 'prompts' table schema with:
 * - prompt_type (validation, smart_question, report, summary)
 * - requirement_type (knowledge_evidence, performance_evidence, etc.)
 * - document_type (unit, learner_guide, both)
 * - is_active, is_default flags
 * - output_schema (JSON schema for structured output)
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';
import { Trash2, Edit, Plus, Search, ChevronLeft, ChevronRight, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Prompt {
  id: number;
  prompt_type: string;
  requirement_type: string | null;
  document_type: string | null;
  name: string;
  description: string | null;
  prompt_text: string;
  system_instruction: string | null;
  output_schema: any;
  generation_config: any;
  version: string;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

const PROMPT_TYPES = ['validation', 'smart_question', 'report', 'summary', 'chat', 'requirement_revalidation'];
const REQUIREMENT_TYPES = [
  'knowledge_evidence',
  'performance_evidence',
  'foundation_skills',
  'elements_performance_criteria',
  'assessment_conditions',
  'assessment_instructions',
  'general',
  'all'
];
const DOCUMENT_TYPES = ['unit', 'learner_guide', 'both', 'all'];

// Filter options
const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active Only' },
  { value: 'inactive', label: 'Inactive Only' },
];
const DEFAULT_FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'default', label: 'Default Only' },
  { value: 'not_default', label: 'Non-Default Only' },
];

export function PromptMaintenanceNew() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Filter states
  const [filterPromptType, setFilterPromptType] = useState<string>('all');
  const [filterRequirementType, setFilterRequirementType] = useState<string>('all');
  const [filterDocumentType, setFilterDocumentType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDefault, setFilterDefault] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [formData, setFormData] = useState<Partial<Prompt>>({
    prompt_type: 'validation',
    requirement_type: 'knowledge_evidence',
    document_type: 'unit',
    name: '',
    description: '',
    prompt_text: '',
    system_instruction: '',
    output_schema: null,
    generation_config: {
      temperature: 0.2,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192,
      responseMimeType: 'application/json'
    },
    version: 'v1.0',
    is_active: true,
    is_default: false,
  });

  useEffect(() => {
    loadPrompts();
  }, []);

  const loadPrompts = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('prompts')
        .select('*')
        .order('prompt_type', { ascending: true })
        .order('requirement_type', { ascending: true })
        .order('document_type', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPrompts(data || []);
    } catch (error) {
      console.error('[PromptMaintenance] Error loading prompts:', error);
      toast.error(`Failed to load prompts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this prompt?')) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.from('prompts').delete().eq('id', id);
      if (error) throw error;
      toast.success('Prompt deleted successfully');
      await loadPrompts();
    } catch (error) {
      console.error('Error deleting prompt:', error);
      toast.error('Failed to delete prompt');
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
      prompt_type: 'validation',
      requirement_type: 'knowledge_evidence',
      document_type: 'unit',
      name: '',
      description: '',
      prompt_text: '',
      system_instruction: '',
      output_schema: null,
      generation_config: {
        temperature: 0.2,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json'
      },
      version: 'v1.0',
      is_active: true,
      is_default: false,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.prompt_text || !formData.prompt_type) {
      toast.error('Name, prompt text, and prompt type are required');
      return;
    }

    setIsLoading(true);
    try {
      if (editingId) {
        // When updating, instead of modifying the existing prompt:
        // 1. Set the old prompt to non-default
        // 2. Create a new prompt with the updated text as the new default

        // First, set the old prompt to non-default (keep it for history)
        const { error: updateOldError } = await supabase
          .from('prompts')
          .update({ is_default: false })
          .eq('id', editingId);

        if (updateOldError) throw updateOldError;

        // Increment version number
        const currentVersion = formData.version || 'v1.0';
        const versionMatch = currentVersion.match(/v?(\d+)\.?(\d*)/);
        let newVersion = 'v1.1';
        if (versionMatch) {
          const major = parseInt(versionMatch[1]);
          const minor = parseInt(versionMatch[2] || '0') + 1;
          newVersion = `v${major}.${minor}`;
        }

        // Create new prompt with updated content as the new default
        const newPromptData = {
          ...formData,
          version: newVersion,
          is_default: true, // New version becomes the default
          is_active: true,
        };
        // Remove id from the data so Supabase generates a new one
        delete (newPromptData as any).id;
        delete (newPromptData as any).created_at;
        delete (newPromptData as any).updated_at;

        const { error: insertError } = await supabase
          .from('prompts')
          .insert([newPromptData]);

        if (insertError) throw insertError;

        toast.success(`New prompt version ${newVersion} created as default. Previous version preserved.`);
      } else {
        // Creating new prompt
        const { error } = await supabase.from('prompts').insert([formData]);
        if (error) throw error;
        toast.success('Prompt created successfully');
      }
      setShowForm(false);
      await loadPrompts();
    } catch (error) {
      console.error('Error saving prompt:', error);
      toast.error('Failed to save prompt');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleActive = async (prompt: Prompt) => {
    try {
      const { error } = await supabase
        .from('prompts')
        .update({ is_active: !prompt.is_active })
        .eq('id', prompt.id);
      if (error) throw error;
      toast.success(`Prompt ${!prompt.is_active ? 'activated' : 'deactivated'}`);
      await loadPrompts();
    } catch (error) {
      console.error('Error toggling active status:', error);
      toast.error('Failed to update prompt status');
    }
  };

  const handleToggleDefault = async (prompt: Prompt) => {
    try {
      // First, unset any other defaults for this combination
      if (!prompt.is_default) {
        await supabase
          .from('prompts')
          .update({ is_default: false })
          .eq('prompt_type', prompt.prompt_type)
          .eq('requirement_type', prompt.requirement_type)
          .eq('document_type', prompt.document_type);
      }

      // Then set this one
      const { error } = await supabase
        .from('prompts')
        .update({ is_default: !prompt.is_default })
        .eq('id', prompt.id);
      if (error) throw error;
      toast.success(`Prompt ${!prompt.is_default ? 'set as' : 'removed from'} default`);
      await loadPrompts();
    } catch (error) {
      console.error('Error toggling default status:', error);
      toast.error('Failed to update prompt default status');
    }
  };

  // Detect duplicate active/default prompts
  const getDuplicates = () => {
    const activeByKey: Record<string, number> = {};
    const defaultByKey: Record<string, number> = {};

    prompts.forEach((prompt) => {
      const key = `${prompt.prompt_type}|${prompt.requirement_type}|${prompt.document_type}`;
      if (prompt.is_active) {
        activeByKey[key] = (activeByKey[key] || 0) + 1;
      }
      if (prompt.is_default) {
        defaultByKey[key] = (defaultByKey[key] || 0) + 1;
      }
    });

    const duplicateActive = Object.entries(activeByKey).filter(([_, count]) => count > 1).map(([key]) => key);
    const duplicateDefault = Object.entries(defaultByKey).filter(([_, count]) => count > 1).map(([key]) => key);

    return { duplicateActive, duplicateDefault };
  };

  const { duplicateActive, duplicateDefault } = getDuplicates();

  const filteredPrompts = prompts.filter(p => {
    // Text search
    const matchesSearch = !searchTerm ||
      p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.prompt_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.requirement_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.document_type?.toLowerCase().includes(searchTerm.toLowerCase());

    // Prompt type filter
    const matchesPromptType = filterPromptType === 'all' || p.prompt_type === filterPromptType;

    // Requirement type filter
    const matchesRequirementType = filterRequirementType === 'all' || p.requirement_type === filterRequirementType;

    // Document type filter
    const matchesDocumentType = filterDocumentType === 'all' || p.document_type === filterDocumentType;

    // Status filter
    const matchesStatus = filterStatus === 'all' ||
      (filterStatus === 'active' && p.is_active) ||
      (filterStatus === 'inactive' && !p.is_active);

    // Default filter
    const matchesDefault = filterDefault === 'all' ||
      (filterDefault === 'default' && p.is_default) ||
      (filterDefault === 'not_default' && !p.is_default);

    return matchesSearch && matchesPromptType && matchesRequirementType && matchesDocumentType && matchesStatus && matchesDefault;
  });

  const paginatedPrompts = filteredPrompts.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(filteredPrompts.length / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-poppins font-bold text-[#1e293b]">Prompt Management (New Schema)</h2>
          <p className="text-sm text-gray-600 mt-1">
            Using new <code>prompts</code> table with prompt_type, requirement_type, document_type
          </p>
        </div>
        <Button
          onClick={handleCreate}
          className="bg-[#10b981] hover:bg-[#059669] text-white font-semibold"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Prompt
        </Button>
      </div>

      {(duplicateActive.length > 0 || duplicateDefault.length > 0) && (
        <div className="p-3 bg-red-50 border border-red-300 rounded-lg">
          <p className="text-sm text-red-800 font-semibold">
            <AlertCircle className="w-4 h-4 inline mr-1" />
            <strong>Warning:</strong> Duplicate prompts detected!
          </p>
          {duplicateActive.length > 0 && (
            <p className="text-xs text-red-700 mt-1">
              Multiple ACTIVE prompts for: {duplicateActive.join(', ')}
            </p>
          )}
          {duplicateDefault.length > 0 && (
            <p className="text-xs text-red-700 mt-1">
              Multiple DEFAULT prompts for: {duplicateDefault.join(', ')}
            </p>
          )}
        </div>
      )}

      {!showForm && (
        <Card className="border border-[#dbeafe] bg-white p-6">
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              ℹ️ <strong>New Schema:</strong> Prompts are identified by 3 keys: <code>prompt_type</code>, <code>requirement_type</code>, <code>document_type</code>.
              Only prompts marked as <strong>ACTIVE</strong> and <strong>DEFAULT</strong> are used by n8n workflows.
            </p>
          </div>

          {/* Search and Filter Bar */}
          <div className="space-y-4 mb-6">
            {/* Search */}
            <div className="flex items-center gap-3">
              <Search className="w-5 h-5 text-[#64748b]" />
              <Input
                placeholder="Search by name, prompt type, requirement type, or document type..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="border border-[#dbeafe] bg-white"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <span className="text-sm font-medium text-gray-600">Filters:</span>

              {/* Prompt Type Filter */}
              <Select value={filterPromptType} onValueChange={(value) => { setFilterPromptType(value); setCurrentPage(1); }}>
                <SelectTrigger className="w-[160px] bg-white border-gray-200 text-sm">
                  <SelectValue placeholder="Prompt Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {PROMPT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Requirement Type Filter */}
              <Select value={filterRequirementType} onValueChange={(value) => { setFilterRequirementType(value); setCurrentPage(1); }}>
                <SelectTrigger className="w-[180px] bg-white border-gray-200 text-sm">
                  <SelectValue placeholder="Requirement Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Requirements</SelectItem>
                  {REQUIREMENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Document Type Filter */}
              <Select value={filterDocumentType} onValueChange={(value) => { setFilterDocumentType(value); setCurrentPage(1); }}>
                <SelectTrigger className="w-[150px] bg-white border-gray-200 text-sm">
                  <SelectValue placeholder="Document Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Documents</SelectItem>
                  {DOCUMENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Status Filter */}
              <Select value={filterStatus} onValueChange={(value) => { setFilterStatus(value); setCurrentPage(1); }}>
                <SelectTrigger className="w-[130px] bg-white border-gray-200 text-sm">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FILTER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Default Filter */}
              <Select value={filterDefault} onValueChange={(value) => { setFilterDefault(value); setCurrentPage(1); }}>
                <SelectTrigger className="w-[140px] bg-white border-gray-200 text-sm">
                  <SelectValue placeholder="Default" />
                </SelectTrigger>
                <SelectContent>
                  {DEFAULT_FILTER_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Clear Filters Button */}
              {(filterPromptType !== 'all' || filterRequirementType !== 'all' || filterDocumentType !== 'all' || filterStatus !== 'all' || filterDefault !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFilterPromptType('all');
                    setFilterRequirementType('all');
                    setFilterDocumentType('all');
                    setFilterStatus('all');
                    setFilterDefault('all');
                    setCurrentPage(1);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  Clear Filters
                </Button>
              )}
            </div>

            {/* Results count */}
            <div className="text-sm text-gray-500">
              Showing {filteredPrompts.length} of {prompts.length} prompts
              {(filterPromptType !== 'all' || filterRequirementType !== 'all' || filterDocumentType !== 'all' || filterStatus !== 'all' || filterDefault !== 'all' || searchTerm) && (
                <span className="ml-2 text-blue-600">(filtered)</span>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#dbeafe]">
                  <th className="text-left p-3 text-sm font-semibold text-[#64748b]">Name</th>
                  <th className="text-left p-3 text-sm font-semibold text-[#64748b]">Type</th>
                  <th className="text-left p-3 text-sm font-semibold text-[#64748b]">Requirement</th>
                  <th className="text-left p-3 text-sm font-semibold text-[#64748b]">Document</th>
                  <th className="text-left p-3 text-sm font-semibold text-[#64748b]">Version</th>
                  <th className="text-center p-3 text-sm font-semibold text-[#64748b]">Active</th>
                  <th className="text-center p-3 text-sm font-semibold text-[#64748b]">Default</th>
                  <th className="text-right p-3 text-sm font-semibold text-[#64748b]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPrompts.map((prompt) => (
                  <tr key={prompt.id} className="border-b border-[#f1f5f9] hover:bg-[#f8fafc]">
                    <td className="p-3">
                      <div className="font-medium text-[#1e293b]">{prompt.name}</div>
                      {prompt.description && (
                        <div className="text-xs text-[#64748b] mt-1">{prompt.description}</div>
                      )}
                    </td>
                    <td className="p-3 text-sm text-[#64748b]">{prompt.prompt_type}</td>
                    <td className="p-3 text-sm text-[#64748b]">{prompt.requirement_type || 'N/A'}</td>
                    <td className="p-3 text-sm text-[#64748b]">{prompt.document_type || 'N/A'}</td>
                    <td className="p-3 text-sm text-[#64748b]">{prompt.version}</td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleToggleActive(prompt)}
                        className="hover:opacity-70"
                      >
                        {prompt.is_active ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <XCircle className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleToggleDefault(prompt)}
                        className="hover:opacity-70"
                      >
                        {prompt.is_default ? (
                          <CheckCircle className="w-5 h-5 text-blue-600" />
                        ) : (
                          <XCircle className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(prompt)}
                          disabled
                          className="opacity-50 cursor-not-allowed"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(prompt.id)}
                          disabled
                          className="text-red-600 hover:text-red-700 opacity-50 cursor-not-allowed"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-[#64748b]">
                Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredPrompts.length)} of {filteredPrompts.length} prompts
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-[#64748b]">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {showForm && (
        <Card className="border border-[#dbeafe] bg-white p-6">
          <h3 className="text-xl font-semibold mb-2">
            {editingId ? 'Create New Prompt Version' : 'Create New Prompt'}
          </h3>
          {editingId && (
            <p className="text-sm text-amber-600 bg-amber-50 p-2 rounded mb-4">
              ℹ️ Saving will create a new version of this prompt and set it as the default. The previous version will be preserved.
            </p>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Prompt Type *</Label>
                <Select
                  value={formData.prompt_type}
                  onValueChange={(value) => setFormData({ ...formData, prompt_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROMPT_TYPES.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Requirement Type</Label>
                <Select
                  value={formData.requirement_type || ''}
                  onValueChange={(value) => setFormData({ ...formData, requirement_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select requirement type" />
                  </SelectTrigger>
                  <SelectContent>
                    {REQUIREMENT_TYPES.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Document Type</Label>
                <Select
                  value={formData.document_type || ''}
                  onValueChange={(value) => setFormData({ ...formData, document_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select document type" />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Version</Label>
                <Input
                  value={formData.version}
                  onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                  placeholder="v1.0"
                />
              </div>
            </div>

            <div>
              <Label>Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="KE Unit Validation v1.0"
              />
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of what this prompt does"
                rows={2}
              />
            </div>

            <div>
              <Label>System Instruction</Label>
              <Textarea
                value={formData.system_instruction || ''}
                onChange={(e) => setFormData({ ...formData, system_instruction: e.target.value })}
                placeholder="You are an expert RTO assessor..."
                rows={5}
              />
            </div>

            <div>
              <Label>Prompt Text *</Label>
              <Textarea
                value={formData.prompt_text}
                onChange={(e) => setFormData({ ...formData, prompt_text: e.target.value })}
                placeholder="Validate the following requirement: {{requirement_text}}..."
                rows={12}
              />
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                />
                <span className="text-sm">Active</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_default}
                  onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                />
                <span className="text-sm">Default</span>
              </label>
            </div>

            <div className="flex items-center gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="bg-[#10b981] hover:bg-[#059669]"
              >
                {isLoading ? 'Saving...' : editingId ? 'Save as New Version' : 'Create'}
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
