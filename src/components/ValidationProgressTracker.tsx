import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { GeminiProgressIndicator } from './GeminiProgressIndicator';
import { Card } from './ui/card';

interface GeminiOperationStatus {
  id: number;
  operation_name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'timeout';
  progress_percentage: number;
  elapsed_time_ms: number;
  max_wait_time_ms: number;
  error_message?: string;
  metadata?: any;
  started_at: string;
  updated_at: string;
}

interface ValidationProgressTrackerProps {
  validationDetailId: number;
  onComplete?: () => void;
  onError?: (error: string) => void;
  autoRefresh?: boolean;
  refreshInterval?: number;
  showValidationProgress?: boolean; // Show validation requirement progress
}

export function ValidationProgressTracker({
  validationDetailId,
  onComplete,
  onError,
  autoRefresh = true,
  refreshInterval = 5000, // 5 seconds
  showValidationProgress = false,
}: ValidationProgressTrackerProps) {
  const [operations, setOperations] = useState<GeminiOperationStatus[]>([]);
  const [validationDetail, setValidationDetail] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasCalledComplete, setHasCalledComplete] = useState(false);
  const [hasCalledError, setHasCalledError] = useState(false);

  const fetchOperations = useCallback(async () => {
    try {
      // Query all gemini operations for this validation
      const { data, error: queryError } = await supabase
        .from('gemini_operations')
        .select('*')
        .eq('validation_detail_id', validationDetailId)
        .order('created_at', { ascending: true });

      if (queryError) {
        console.error('[ValidationProgressTracker] Error fetching operations:', queryError);
        setError(queryError.message);
        onError?.(queryError.message);
        return;
      }

      setOperations(data || []);

      // Fetch validation detail for progress if requested
      // TODO: Fix RLS policy or PostgREST config - getting 400 errors on this query
      if (showValidationProgress && false) {
        const { data: detailData, error: detailError} = await supabase
          .from('validation_detail')
          .select('completed_count, numOfReq, extract_status')  // Use numOfReq for total requirements
          .eq('id', validationDetailId)
          .single();

        if (!detailError && detailData) {
          setValidationDetail(detailData);
        }
      }

      // Check if all operations are complete
      const allComplete = data && data.length > 0 && data.every(op => op.status === 'completed');
      const anyFailed = data && data.some(op => op.status === 'failed' || op.status === 'timeout');

      if (allComplete && !hasCalledComplete) {
        console.log('[ValidationProgressTracker] All operations completed - calling onComplete once');
        setHasCalledComplete(true);
        onComplete?.();
      }

      if (anyFailed && !allComplete && !hasCalledError) {
        const failedOp = data?.find(op => op.status === 'failed' || op.status === 'timeout');
        const errorMsg = failedOp?.error_message || 'One or more operations failed';
        console.error('[ValidationProgressTracker] Operation failed:', errorMsg);
        setHasCalledError(true);
        onError?.(errorMsg);
      }

      setIsLoading(false);
    } catch (err) {
      console.error('[ValidationProgressTracker] Unexpected error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      onError?.(errorMessage);
      setIsLoading(false);
    }
  }, [validationDetailId, showValidationProgress, hasCalledComplete, hasCalledError, onComplete, onError]);

  useEffect(() => {
    // Reset callback flags when validation changes
    setHasCalledComplete(false);
    setHasCalledError(false);
    
    // Initial fetch
    fetchOperations();

    // Set up polling if autoRefresh is enabled
    if (autoRefresh) {
      const interval = setInterval(fetchOperations, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [validationDetailId, autoRefresh, refreshInterval, fetchOperations]);

  if (error) {
    return (
      <Card className="p-4 bg-red-50 border-red-200">
        <p className="text-red-700 text-sm">Error tracking progress: {error}</p>
      </Card>
    );
  }

  if (isLoading && operations.length === 0) {
    return (
      <Card className="p-4">
        <p className="text-gray-600 text-sm">Loading progress...</p>
      </Card>
    );
  }

  if (operations.length === 0) {
    return null;
  }

  // Calculate aggregate progress
  const totalOperations = operations.length;
  const completedOperations = operations.filter(op => op.status === 'completed').length;
  const failedOperations = operations.filter(op => op.status === 'failed' || op.status === 'timeout').length;
  const processingOperations = operations.filter(op => op.status === 'processing' || op.status === 'pending').length;
  
  const aggregateProgress = totalOperations > 0 
    ? Math.floor((completedOperations / totalOperations) * 100)
    : 0;

  // Find the currently processing operation
  const currentOperation = operations.find(op => op.status === 'processing') || operations[0];

  // Transform to match GeminiProgressIndicator interface
  const transformedOperation = currentOperation ? {
    id: currentOperation.id,
    operationName: currentOperation.operation_name,
    operationType: 'document_embedding',
    status: currentOperation.status,
    progressPercentage: currentOperation.progress_percentage || 0,
    elapsedSeconds: Math.floor((currentOperation.elapsed_time_ms || 0) / 1000),
    maxWaitSeconds: Math.floor((currentOperation.max_wait_time_ms || 300000) / 1000),
    estimatedTimeRemaining: null,
    checkCount: 0,
    lastCheckAt: currentOperation.updated_at,
    isComplete: currentOperation.status === 'completed',
    isFailed: currentOperation.status === 'failed' || currentOperation.status === 'timeout',
    isProcessing: currentOperation.status === 'processing' || currentOperation.status === 'pending',
    errorMessage: currentOperation.error_message,
    startedAt: currentOperation.started_at,
    completedAt: null,
    updatedAt: currentOperation.updated_at,
  } : null;

  const allComplete = completedOperations === totalOperations;
  const anyFailed = failedOperations > 0;

  return (
    <div className="space-y-3">
      {/* Overall Progress Summary */}
      <Card className="p-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">
              AI Processing Progress
            </h3>
            <span className="text-xs text-gray-600">
              {completedOperations} of {totalOperations} files complete
            </span>
          </div>
          
          {allComplete && (
            <div className="text-sm text-green-700 font-medium">
              ✓ All documents successfully processed
            </div>
          )}
          
          {anyFailed && (
            <div className="text-sm text-red-700 font-medium">
              ⚠ {failedOperations} operation{failedOperations === 1 ? '' : 's'} failed
            </div>
          )}
          
          {processingOperations > 0 && (
            <div className="text-sm text-blue-700">
              Processing {processingOperations} file{processingOperations === 1 ? '' : 's'}...
            </div>
          )}

          {/* Validation Progress - NEW */}
          {showValidationProgress && validationDetail && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Validation Progress</span>
                <span className="text-xs text-gray-600">
                  {validationDetail.completed_count || 0} of {validationDetail.numOfReq || 0} requirements
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${validationDetail.numOfReq > 0 
                      ? (validationDetail.completed_count / validationDetail.numOfReq) * 100 
                      : 0}%` 
                  }}
                />
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {validationDetail.extract_status === 'ProcessingInBackground' 
                  ? 'Validating requirements...'
                  : validationDetail.extract_status === 'Completed'
                  ? '✓ Validation complete'
                  : 'Waiting for document processing...'}  {/* ✅ Fixed: Use snake_case */}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Current Operation Progress */}
      {transformedOperation && transformedOperation.isProcessing && (
        <GeminiProgressIndicator 
          operation={transformedOperation}
          showDetails={true}
        />
      )}
    </div>
  );
}
