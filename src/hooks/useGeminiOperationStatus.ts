import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export interface GeminiOperationStatus {
  id: number;
  operationName: string;
  operationType: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'timeout';
  progressPercentage: number;
  elapsedSeconds: number;
  maxWaitSeconds: number;
  estimatedTimeRemaining: number | null;
  checkCount: number;
  lastCheckAt: string | null;
  isComplete: boolean;
  isFailed: boolean;
  isProcessing: boolean;
  errorMessage?: string;
  startedAt: string;
  completedAt: string | null;
  updatedAt: string;
}

interface UseGeminiOperationStatusOptions {
  operationName?: string;
  operationId?: number;
  documentId?: number;
  validationDetailId?: number;
  enabled?: boolean;
  pollingInterval?: number; // in milliseconds
  onComplete?: (operation: GeminiOperationStatus) => void;
  onError?: (error: string) => void;
}

interface UseGeminiOperationStatusReturn {
  operation: GeminiOperationStatus | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useGeminiOperationStatus(
  options: UseGeminiOperationStatusOptions
): UseGeminiOperationStatusReturn {
  const {
    operationName,
    operationId,
    documentId,
    validationDetailId,
    enabled = true,
    pollingInterval = 5000, // Poll every 5 seconds by default
    onComplete,
    onError,
  } = options;

  const [operation, setOperation] = useState<GeminiOperationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingIntervalRef = useRef<number | null>(null);
  const hasCalledOnCompleteRef = useRef(false);

  const fetchStatus = async () => {
    if (!enabled || (!operationName && !operationId && !documentId && !validationDetailId)) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/get-gemini-operation-status`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            operationName,
            operationId,
            documentId,
            validationDetailId,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch operation status: ${response.statusText}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch operation status');
      }

      if (result.found) {
        setOperation(result.operation);

        // Check if operation just completed
        if (result.operation.isComplete && !hasCalledOnCompleteRef.current) {
          hasCalledOnCompleteRef.current = true;
          onComplete?.(result.operation);
          // Stop polling
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        }

        // Check if operation failed
        if (result.operation.isFailed && !hasCalledOnCompleteRef.current) {
          hasCalledOnCompleteRef.current = true;
          onError?.(result.operation.errorMessage || 'Operation failed');
          // Stop polling
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        }
      } else {
        setOperation(null);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('[useGeminiOperationStatus] Error:', err);
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch and polling setup
  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Reset completion flag when parameters change
    hasCalledOnCompleteRef.current = false;

    // Fetch immediately
    fetchStatus();

    // Set up polling
    pollingIntervalRef.current = window.setInterval(() => {
      fetchStatus();
    }, pollingInterval);

    // Cleanup
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [operationName, operationId, documentId, validationDetailId, enabled, pollingInterval]);

  return {
    operation,
    isLoading,
    error,
    refetch: fetchStatus,
  };
}
