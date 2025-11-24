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

      if (error) {
        console.error('[TriggerValidation] Error loading status:', error);
        toast.error('Failed to load validation status');
        return;
      }

      setValidationStatuses(data?.status || []);
      setShowStatusModal(true);
    } catch (err) {
      console.error('[TriggerValidation] Exception loading status:', err);
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
      console.log('[TriggerValidation] Triggering validation for detail:', detailId);

      // Call trigger-validation edge function
      const { data, error } = await supabase.functions.invoke('trigger-validation', {
        body: {
          validationDetailId: detailId,
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
        toast.error(`Validation trigger failed: ${error.message}`);
        return;
      }

      console.log('[TriggerValidation] Success:', data);
      setLastResult({
        success: true,
        message: `Validation triggered successfully in ${duration}ms`,
        timestamp: new Date().toISOString(),
      });
      toast.success(`Validation triggered successfully for detail #${detailId}`);

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[TriggerValidation] Exception:', err);
      setLastResult({
        success: false,
        message: `Exception: ${errorMsg}`,
        timestamp: new Date().toISOString(),
      });
      toast.error(`Failed to trigger validation: ${errorMsg}`);
    } finally {
      setIsTriggering(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Manual Validation Trigger</h2>
          <p className="text-gray-600 mt-1">
            Manually trigger validation for a specific validation_detail record.
            Use this for debugging, re-running failed validations, or manual intervention.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={loadValidationStatus}
            disabled={isLoadingStatus}
            className="flex items-center gap-2"
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
            className="flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            Prompt Maintenance
            <ExternalLink className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <Search className="w-5 h-5 text-gray-400" />
          <Input
            type="text"
            placeholder="Search by unit code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1"
          />
          {isLoadingValidations && (
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
          )}
        </div>
      </Card>

      {/* Recent Validations Table */}
      <Card className="overflow-hidden">
        <div className="p-4 bg-gray-50 border-b">
          <h3 className="font-semibold text-gray-900">Recent Validations (Last 7 Days)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Detail ID</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Namespace</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Documents</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {recentValidations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    {isLoadingValidations ? 'Loading...' : 'No recent validations found'}
                  </td>
                </tr>
              ) : (
                recentValidations.map((validation) => (
                  <tr key={validation.detail_id} className="hover:bg-gray-50">
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
                          variant="outline"
                          onClick={() => setValidationDetailId(validation.detail_id.toString())}
                          className="text-xs"
                        >
                          Select
                        </Button>
                        {onViewResults && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onViewResults(validation.detail_id)}
                            className="text-xs flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            View Results
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
      </Card>

      <Card className="p-6">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Validation Detail ID
              </label>
              <Input
                type="number"
                value={validationDetailId}
                onChange={(e) => setValidationDetailId(e.target.value)}
                placeholder="e.g., 123"
                disabled={isTriggering}
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter or select a validation_detail.id from the table above
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Validation Prompt
              </label>
              <select
                value={selectedPromptId || ''}
                onChange={(e) => setSelectedPromptId(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isTriggering}
              >
                <option value="">Use Current Prompt</option>
                {availablePrompts.map((prompt) => (
                  <option key={prompt.id} value={prompt.id}>
                    {prompt.name} {prompt.current && '(Current)'}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Select a specific prompt to test different validation approaches
              </p>
            </div>
          </div>

          <Button
            onClick={handleTrigger}
            disabled={isTriggering || !validationDetailId}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isTriggering ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Triggering...
              </>
            ) : (
              <>
                <PlayCircle className="w-4 h-4 mr-2" />
                Trigger Validation
              </>
            )}
          </Button>
        </div>
      </Card>

      {lastResult && (
        <Card className={`p-6 ${lastResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
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

      <Card className="p-6 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-blue-900">Usage Notes</h3>
            <ul className="text-sm text-blue-700 mt-2 space-y-1">
              <li>• This manually calls the <code className="bg-blue-100 px-1 rounded">trigger-validation</code> edge function</li>
              <li>• Use this only when the automatic background processor fails</li>
              <li>• Check Supabase logs for detailed error messages</li>
              <li>• Ensure all documents for the validation are fully indexed first</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Validation Status Modal */}
      <Dialog open={showStatusModal} onOpenChange={setShowStatusModal}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Validation Processing Status (Last Hour)
            </DialogTitle>
          </DialogHeader>
          
          <div className="mt-4">
            {validationStatuses.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No recent validation activity in the last hour
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">File Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Embedding</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gemini Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Progress</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Validation</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requirements</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {validationStatuses.map((status, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate" title={status.file_name}>
                          {status.file_name}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            status.embedding_status === 'completed' 
                              ? 'bg-green-100 text-green-800'
                              : status.embedding_status === 'processing'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {status.embedding_status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {status.gemini_status ? (
                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
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
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {status.progress_percentage !== null ? (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-200 rounded-full h-2 w-20">
                                <div 
                                  className="bg-blue-600 h-2 rounded-full" 
                                  style={{ width: `${status.progress_percentage}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-600">{status.progress_percentage}%</span>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {status.extractStatus ? (
                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
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
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-center">
                          {status.requirements_found || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {status.minutes_ago} min ago
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
