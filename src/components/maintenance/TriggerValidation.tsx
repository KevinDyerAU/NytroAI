/**
 * TriggerValidation - Manual Validation Trigger Tool
 * 
 * Allows admins to manually trigger validation for a validation_detail_id.
 * Useful for debugging, re-running failed validations, or manual intervention.
 */

import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { PlayCircle, AlertCircle, CheckCircle, Loader2, Search, ExternalLink, FileText, Eye, Activity } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';

interface TriggerValidationProps {
  onViewResults?: (detailId: number) => void;
}

interface ValidationStatus {
  file_name: string;
  embedding_status: string;
  gemini_status: string | null;
  progress_percentage: number | null;
  extractStatus: string | null;
  requirements_found: number | null;
  uploaded_at: string;
  minutes_ago: number;
}

interface ValidationDetail {
  detail_id: number;
  unitCode: string;
  extractStatus: string;
  namespace_code: string;
  document_count: number;
  created_at: string;
  rto_id: number;
}

interface PromptOption {
  id: number;
  validation_type_id: number;
  name: string;
  current: boolean;
}

export function TriggerValidation({ onViewResults }: TriggerValidationProps = {}) {
  const [validationDetailId, setValidationDetailId] = useState('');
  const [isTriggering, setIsTriggering] = useState(false);
  const [lastResult, setLastResult] = useState<{
    success: boolean;
    message: string;
    timestamp: string;
  } | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [recentValidations, setRecentValidations] = useState<ValidationDetail[]>([]);
  const [isLoadingValidations, setIsLoadingValidations] = useState(false);
  
  const [selectedPromptId, setSelectedPromptId] = useState<number | null>(null);
  const [availablePrompts, setAvailablePrompts] = useState<PromptOption[]>([]);
  
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [validationStatuses, setValidationStatuses] = useState<ValidationStatus[]>([]);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);

  // Load recent validations
  useEffect(() => {
    loadRecentValidations();
  }, [searchTerm]);

  // Load available prompts
  useEffect(() => {
    loadAvailablePrompts();
  }, []);

  const loadRecentValidations = async () => {
    setIsLoadingValidations(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-validation-details', {
        body: { search: searchTerm },
      });

      if (error) {
        console.error('[TriggerValidation] Error loading validations:', error);
        toast.error('Failed to load recent validations');
        return;
      }

      setRecentValidations(data?.validations || []);
    } catch (err) {
      console.error('[TriggerValidation] Exception loading validations:', err);
    } finally {
      setIsLoadingValidations(false);
    }
  };

  const loadAvailablePrompts = async () => {
    try {
      const { data, error } = await supabase
        .from('prompt')
        .select('id, validation_type_id, name, current')
        .eq('validation_type_id', 10) // full_validation
        .order('current', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[TriggerValidation] Error loading prompts:', error);
        return;
      }

      setAvailablePrompts(data || []);
      
      // Set default to current prompt
      const currentPrompt = data?.find(p => p.current);
      if (currentPrompt) {
        setSelectedPromptId(currentPrompt.id);
      }
    } catch (err) {
      console.error('[TriggerValidation] Exception loading prompts:', err);
    }
  };

  const loadValidationStatus = async () => {
    setIsLoadingStatus(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-validation-status');

      console.log('[TriggerValidation] Status response:', { data, error });

      if (error) {
        console.error('Error loading status:', error);
        toast.error('Failed to load validation status');
        return;
      }

      // The edge function returns {status: [...], total: N}
      const statusData = data?.status || [];

      console.log('[TriggerValidation] Parsed status data:', statusData);
      console.log('[TriggerValidation] Debug: JSON =', JSON.stringify(statusData));
      console.log('[TriggerValidation] Debug: isArray =', Array.isArray(statusData));
      setValidationStatuses(statusData);
      setShowStatusModal(true);
    } catch (err) {
      console.error('Exception loading status:', err);
      toast.error('Failed to load validation status');
    } finally {
      setIsLoadingStatus(false);
    }
  };

  const handleTrigger = async () => {
    const detailId = parseInt(validationDetailId);
    
    if (isNaN(detailId) || detailId <= 0) {
      toast.error('Please enter a valid validation detail ID');
      return;
    }

    setIsTriggering(true);
    const startTime = Date.now();

    try {
      console.log('[TriggerValidation] Retriggering validation from source detail:', detailId);
      console.log('[TriggerValidation] Using prompt ID:', selectedPromptId || 'default');

      // Call retrigger-validation edge function to clone validation_detail and reuse documents
      const { data, error } = await supabase.functions.invoke('retrigger-validation', {
        body: {
          sourceValidationDetailId: detailId,
          ...(selectedPromptId && { promptId: selectedPromptId }),
        },
      });

      const duration = Date.now() - startTime;

      if (error) {
        console.error('[TriggerValidation] Error:', error);
        setLastResult({
          success: false,
          message: `Error: ${error.message || 'Unknown error'}`,
          timestamp: new Date().toISOString(),
        });
        toast.error(`Validation retrigger failed: ${error.message}`);
        return;
      }

      console.log('[TriggerValidation] Success:', data);
      const newDetailId = data?.newValidationDetailId;
      setLastResult({
        success: true,
        message: `Validation retriggered successfully! New detail ID: ${newDetailId} (cloned from ${detailId}) - ${data?.documentsLinked || 0} documents reused - Duration: ${duration}ms`,
        timestamp: new Date().toISOString(),
      });
      toast.success(`Validation retriggered! New validation detail #${newDetailId}`);

      // Optionally navigate to results if callback provided
      if (onViewResults && newDetailId) {
        setTimeout(() => {
          if (confirm(`Validation started! View results for new validation #${newDetailId}?`)) {
            onViewResults(newDetailId);
          }
        }, 1000);
      }

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[TriggerValidation] Exception:', err);
      setLastResult({
        success: false,
        message: `Exception: ${errorMsg}`,
        timestamp: new Date().toISOString(),
      });
      toast.error(`Failed to retrigger validation: ${errorMsg}`);
    } finally {
      setIsTriggering(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Prompt Testing Lab</h1>
            <p className="mt-2 text-blue-100">
              Test and compare validation prompts on existing documents without re-uploading.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={loadValidationStatus}
              disabled={isLoadingStatus}
              className="flex items-center gap-2 bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              {isLoadingStatus ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Activity className="w-4 h-4" />
              )}
              Check Status
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open('/#/maintenance', '_blank')}
              className="flex items-center gap-2 bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              <FileText className="w-4 h-4" />
              Edit Prompts
              <ExternalLink className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Workflow Steps */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 border-2 border-blue-200 bg-blue-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">1</div>
            <div>
              <h3 className="font-semibold text-gray-900">Find Documents</h3>
              <p className="text-xs text-gray-600">Search by unit code</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border-2 border-purple-200 bg-purple-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold">2</div>
            <div>
              <h3 className="font-semibold text-gray-900">Select Prompt</h3>
              <p className="text-xs text-gray-600">Choose validation approach</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border-2 border-green-200 bg-green-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold">3</div>
            <div>
              <h3 className="font-semibold text-gray-900">Run & Compare</h3>
              <p className="text-xs text-gray-600">View results instantly</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Step 1: Find Your Documents */}
      <Card className="border-2 border-blue-200">
        <div className="bg-blue-50 px-6 py-4 border-b border-blue-200">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">1</div>
            Find Your Documents
          </h2>
          <p className="text-sm text-gray-600 mt-1">Search for processed documents by unit code</p>
        </div>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Search className="w-5 h-5 text-blue-600" />
            <Input
              type="text"
              placeholder="Enter unit code (e.g., TLIF0025, BSBWHS332A)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 border-blue-200 focus:border-blue-400"
            />
          </div>

          {/* Documents Table */}
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Detail ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Unit Code</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Namespace</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Documents</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Created</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoadingValidations ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
                      <p className="mt-2 text-sm text-gray-600">Searching for documents...</p>
                    </td>
                  </tr>
                ) : recentValidations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                <div className="text-gray-400">
                  <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-gray-600 font-medium">No documents found</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {searchTerm ? `Try a different unit code` : 'Enter a unit code to search'}
                  </p>
                </div>
              </td>
            </tr>
          ) : (
            recentValidations.map((validation) => (
              <tr 
                key={validation.detail_id} 
                className={`hover:bg-blue-50 transition-colors ${
                  validationDetailId === validation.detail_id.toString() 
                    ? 'bg-blue-100 border-l-4 border-blue-600' 
                    : ''
                }`}
              >
                <td className="px-4 py-3 text-sm font-mono text-gray-900">
                  {validation.detail_id}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {validation.unitCode}
                </td>
                <td className="px-4 py-3 text-sm">
                  <span
                    className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                      validation.extractStatus === 'Completed'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {validation.extractStatus}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm font-mono text-gray-600">
                  {validation.namespace_code || '-'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {validation.document_count}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {new Date(validation.created_at).toLocaleDateString()}
                </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant={validationDetailId === validation.detail_id.toString() ? "default" : "outline"}
                              onClick={() => setValidationDetailId(validation.detail_id.toString())}
                              className="text-xs"
                            >
                              {validationDetailId === validation.detail_id.toString() ? '✓ Selected' : 'Select'}
                            </Button>
                            {onViewResults && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => onViewResults(validation.detail_id)}
                                className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              >
                                <Eye className="w-3 h-3" />
                                View
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Card>

      {/* Step 2: Select Prompt */}
      <Card className="border-2 border-purple-200">
        <div className="bg-purple-50 px-6 py-4 border-b border-purple-200">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-sm font-bold">2</div>
            Select Prompt
          </h2>
          <p className="text-sm text-gray-600 mt-1">Choose which validation approach to test</p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Available Prompts
            </label>
            <select
              value={selectedPromptId || ''}
              onChange={(e) => setSelectedPromptId(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-3 py-2 border-2 border-purple-200 rounded-lg focus:border-purple-400 focus:ring-2 focus:ring-purple-200"
            >
              <option value="">Use Current Active Prompt</option>
              {availablePrompts.map((prompt) => (
                <option key={prompt.id} value={prompt.id}>
                  {prompt.name} {prompt.current && '⭐ (Active)'}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-2">
              {selectedPromptId 
                ? '✓ Testing with selected prompt' 
                : 'Using currently active prompt (recommended)'}
            </p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Selected Document Set
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="text"
                value={validationDetailId}
                onChange={(e) => setValidationDetailId(e.target.value)}
                placeholder="Select from table above"
                className="flex-1 border-2 border-purple-200"
                readOnly
              />
              {validationDetailId && (
                <CheckCircle className="w-5 h-5 text-green-600" />
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {validationDetailId 
                ? '✓ Document set selected' 
                : 'Click "Select" in the table above'}
            </p>
          </div>
        </div>
      </Card>

      {/* Step 3: Run Test */}
      <Card className="border-2 border-green-200">
        <div className="bg-green-50 px-6 py-4 border-b border-green-200">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-bold">3</div>
            Run Test
          </h2>
          <p className="text-sm text-gray-600 mt-1">Execute validation and view results</p>
        </div>
        <div className="p-6 space-y-4">
          {/* Status Display */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Test Configuration</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Document Set:</span>
                <span className="font-mono font-medium">{validationDetailId || 'Not selected'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Prompt:</span>
                <span className="font-medium">
                  {selectedPromptId 
                    ? availablePrompts.find(p => p.id === selectedPromptId)?.name || 'Custom'
                    : 'Active prompt'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Status:</span>
                <span className={`font-medium ${
                  validationDetailId && !isTriggering ? 'text-green-600' : 'text-gray-400'
                }`}>
                  {isTriggering ? 'Running...' : validationDetailId ? 'Ready' : 'Select documents'}
                </span>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <Button
            onClick={handleTrigger}
            disabled={isTriggering || !validationDetailId}
            className="w-full h-12 text-lg font-semibold bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 disabled:from-gray-400 disabled:to-gray-400"
          >
            {isTriggering ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Running Test...
              </>
            ) : (
              <>
                <PlayCircle className="w-5 h-5 mr-2" />
                {validationDetailId ? 'Run Validation Test' : 'Select Documents First'}
              </>
            )}
          </Button>
          
          {!validationDetailId && (
            <p className="text-xs text-center text-gray-500">
              Select a document set from Step 1 to continue
            </p>
          )}
        </div>
      </Card>

      {/* Last Result */}
      {lastResult && (
        <Card className={`p-6 ${lastResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border-2`}>
          <div className="flex items-start gap-3">
            {lastResult.success ? (
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            )}
            <div className="flex-1">
              <h3 className={`font-semibold ${lastResult.success ? 'text-green-900' : 'text-red-900'}`}>
                {lastResult.success ? 'Success' : 'Failed'}
              </h3>
              <p className={`text-sm mt-1 ${lastResult.success ? 'text-green-700' : 'text-red-700'}`}>
                {lastResult.message}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                {new Date(lastResult.timestamp).toLocaleString()}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* How It Works */}
      <Card className="bg-gradient-to-r from-gray-50 to-gray-100 border-2 border-gray-200">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-white rounded-lg shadow-sm">
              <AlertCircle className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-gray-900 text-lg mb-3">How This Works</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <h4 className="font-semibold text-sm text-blue-900 mb-2">💾 Reuses Existing Data</h4>
                  <p className="text-xs text-gray-600">Documents and embeddings are already in Gemini - no re-upload needed!</p>
                </div>
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <h4 className="font-semibold text-sm text-purple-900 mb-2">🔄 Creates New Validation</h4>
                  <p className="text-xs text-gray-600">Each test creates a new record so you can compare results side-by-side</p>
                </div>
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <h4 className="font-semibold text-sm text-green-900 mb-2">⚡ Fast Testing</h4>
                  <p className="text-xs text-gray-600">Only runs validation logic - typically completes in under 30 seconds</p>
                </div>
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <h4 className="font-semibold text-sm text-orange-900 mb-2">📊 Perfect For</h4>
                  <p className="text-xs text-gray-600">A/B testing prompts, debugging validation logic, or refining your approach</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Validation Status Modal */}
      <Dialog open={showStatusModal} onOpenChange={setShowStatusModal}>
        <DialogContent className="w-[100vw] max-w-[100vw] h-[75vh] max-h-[75vh] overflow-y-auto bg-white p-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Validation Processing Status (Last 6 Hours)
            </DialogTitle>
          </DialogHeader>
          
          <div className="mt-4">
            {validationStatuses.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No recent validation activity in the last 6 hours
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase w-[35%]">File Name</th>
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase w-[12%]">Embedding</th>
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase w-[12%]">Gemini</th>
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase w-[18%]">Progress</th>
                      <th className="px-2 py-2 text-left text-[10px] font-medium text-gray-500 uppercase w-[12%]">Validation</th>
                      <th className="px-2 py-2 text-right text-[10px] font-medium text-gray-500 uppercase w-[11%]">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {validationStatuses.map((status, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-2 py-2 text-xs text-gray-900 truncate max-w-0" title={status.file_name}>
                          {status.file_name}
                        </td>
                        <td className="px-2 py-2">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            status.embedding_status === 'completed' 
                              ? 'bg-green-100 text-green-800'
                              : status.embedding_status === 'processing'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {status.embedding_status}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          {status.gemini_status ? (
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              status.gemini_status === 'completed' 
                                ? 'bg-green-100 text-green-800'
                                : status.gemini_status === 'processing'
                                ? 'bg-yellow-100 text-yellow-800'
                                : status.gemini_status === 'failed'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {status.gemini_status}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          {status.progress_percentage !== null ? (
                            <div className="flex items-center gap-1.5">
                              <div className="flex-1 bg-gray-200 rounded-full h-1.5 min-w-[50px]">
                                <div 
                                  className="bg-blue-600 h-1.5 rounded-full" 
                                  style={{ width: `${status.progress_percentage}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-gray-600 whitespace-nowrap">{status.progress_percentage}%</span>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          {status.extractStatus ? (
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              status.extractStatus === 'Completed' 
                                ? 'bg-green-100 text-green-800'
                                : status.extractStatus === 'Processing'
                                ? 'bg-yellow-100 text-yellow-800'
                                : status.extractStatus === 'Failed'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {status.extractStatus}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-xs text-gray-600 text-right whitespace-nowrap">
                          {status.minutes_ago}m
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
