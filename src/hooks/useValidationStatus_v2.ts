/**
 * useValidationStatus Hook - Phase 3.4
 * Enhanced with debounced refresh, optimistic updates, and retry logic
 */

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { debounce } from 'lodash-es';
import { supabase } from '../lib/supabase';
import { retryWithBackoff } from '../lib/retryWithBackoff';

export interface ValidationStatus {
  id: number;
  validation_count: number;
  validation_total: number;
  validation_progress: number;
  validation_status: 'pending' | 'in_progress' | 'partial' | 'completed' | 'failed';
  extract_status: string;
  doc_extracted: boolean;
  last_updated_at: string;
  created_at: string;
}

export interface ValidationStatusWithDetails extends ValidationStatus {
  validation_type_name?: string;
  rtoCode?: string;
  unitCode?: string;
  status_variant: 'success' | 'warning' | 'error' | 'info' | 'default';
  status_description: string;
}

interface UseValidationStatusReturn {
  status: ValidationStatus | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to track a single validation's status with real-time updates
 * Enhanced with retry logic and optimistic updates
 */
export function useValidationStatus(validationId: number | null): UseValidationStatusReturn {
  const [status, setStatus] = useState<ValidationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!validationId) {
      setStatus(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // ✅ Use retry logic for resilience
      await retryWithBackoff(
        async () => {
          const { data, error: fetchError } = await supabase
            .from('validation_detail')
            .select('*')
            .eq('id', validationId)
            .single();

          if (fetchError) {
            throw new Error(`Failed to fetch validation status: ${fetchError.message}`);
          }

          setStatus(data);
        },
        {
          maxAttempts: 3,
          initialDelay: 1000,
          onRetry: (attempt, err) => {
            console.log(`[useValidationStatus] Retry attempt ${attempt}:`, err.message);
          },
        }
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch validation status';
      setError(errorMsg);
      console.error('[useValidationStatus] Error:', errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [validationId]);

  useEffect(() => {
    if (!validationId) {
      setStatus(null);
      setIsLoading(false);
      return;
    }

    // Initial fetch
    fetchStatus();

    // Subscribe to real-time updates
    const subscription = supabase
      .channel(`validation-status-${validationId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'validation_detail',
          filter: `id=eq.${validationId}`,
        },
        (payload) => {
          console.log('[useValidationStatus] Status updated:', payload.new);
          // ✅ Optimistic update - apply immediately
          setStatus(payload.new as ValidationStatus);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'validation_detail',
          filter: `id=eq.${validationId}`,
        },
        (payload) => {
          console.log('[useValidationStatus] Validation deleted:', payload.old);
          setStatus(null);
          setError('This validation has been deleted');
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[useValidationStatus] Subscribed to validation changes');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[useValidationStatus] Subscription error, attempting to reconnect...');
          fetchStatus().catch(err => {
            console.error('[useValidationStatus] Failed to refresh after error:', err);
          });
        } else if (status === 'TIMED_OUT') {
          console.error('[useValidationStatus] Subscription timed out');
        } else if (status === 'CLOSED') {
          console.log('[useValidationStatus] Subscription closed');
        }
      });

    return () => {
      console.log('[useValidationStatus] Unsubscribing from validation changes');
      subscription.unsubscribe();
    };
  }, [validationId, fetchStatus]);

  return {
    status,
    isLoading,
    error,
    refresh: fetchStatus,
  };
}

interface UseValidationStatusListReturn {
  validations: ValidationStatusWithDetails[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to track all validations for an RTO with real-time updates
 * Enhanced with debouncing, optimistic updates, and retry logic
 */
export function useValidationStatusList(rtoCode: string): UseValidationStatusListReturn {
  const [validations, setValidations] = useState<ValidationStatusWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track if this is the initial load
  const isInitialLoadRef = useRef(true);

  const fetchValidations = useCallback(async () => {
    if (!rtoCode) {
      setValidations([]);
      setIsLoading(false);
      return;
    }

    try {
      const isInitialLoad = isInitialLoadRef.current;
      
      // ✅ Only show loading spinner on initial load
      if (isInitialLoad) {
        setIsLoading(true);
      }
      setError(null);

      // ✅ Use retry logic for resilience
      await retryWithBackoff(
        async () => {
          const { data, error: fetchError } = await supabase
            .from('validation_detail_with_stats')
            .select('*')
            .eq('rtoCode', rtoCode)
            .order('last_updated_at', { ascending: false });

          if (fetchError) {
            console.error('[useValidationStatusList] Fetch error:', fetchError);
            
            // ✅ Only throw on initial load, otherwise just log and keep existing data
            if (isInitialLoad) {
              throw new Error(`Failed to fetch validations: ${fetchError.message}`);
            }
            return; // Keep existing data
          }

          setValidations(data || []);
          console.log(`[useValidationStatusList] Fetched ${data?.length || 0} validations`);
        },
        {
          maxAttempts: 3,
          initialDelay: 1000,
          onRetry: (attempt, err) => {
            console.log(`[useValidationStatusList] Retry attempt ${attempt}:`, err.message);
          },
        }
      );

      isInitialLoadRef.current = false;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch validations';
      setError(errorMsg);
      console.error('[useValidationStatusList] Error:', errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [rtoCode]);

  // ✅ Create debounced version of fetchValidations
  const debouncedFetch = useMemo(
    () =>
      debounce(
        () => {
          fetchValidations().catch(err => {
            console.error('[useValidationStatusList] Debounced fetch error:', err);
          });
        },
        500, // Wait 500ms after last change
        {
          leading: false,
          trailing: true,
          maxWait: 2000, // Force refresh after 2 seconds max
        }
      ),
    [fetchValidations]
  );

  useEffect(() => {
    if (!rtoCode) {
      setValidations([]);
      setIsLoading(false);
      return;
    }

    // Initial fetch
    fetchValidations();

    // Subscribe to real-time updates for all validation_detail changes
    const subscription = supabase
      .channel(`validation-list-${rtoCode}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'validation_detail',
        },
        (payload) => {
          console.log('[useValidationStatusList] Validation inserted:', payload.new);
          
          // ✅ Optimistically add to local state
          setValidations(prev => [payload.new as ValidationStatusWithDetails, ...prev]);
          
          // Then refresh for computed fields (debounced)
          debouncedFetch();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'validation_detail',
        },
        (payload) => {
          console.log('[useValidationStatusList] Validation updated:', payload.new);
          
          // ✅ Optimistically update local state
          setValidations(prev =>
            prev.map(v =>
              v.id === payload.new.id
                ? { ...v, ...payload.new } as ValidationStatusWithDetails
                : v
            )
          );
          
          // Then refresh for computed fields (debounced)
          debouncedFetch();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'validation_detail',
        },
        (payload) => {
          console.log('[useValidationStatusList] Validation deleted:', payload.old);
          
          // ✅ Immediately remove from local state for responsiveness
          setValidations(prev => prev.filter(v => v.id !== payload.old.id));
          
          // Also refresh to ensure consistency (debounced)
          debouncedFetch();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[useValidationStatusList] Subscribed to validation changes');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[useValidationStatusList] Subscription error, attempting to reconnect...');
          // Refresh data on subscription error (not debounced - immediate)
          fetchValidations().catch(err => {
            console.error('[useValidationStatusList] Failed to refresh after error:', err);
          });
        } else if (status === 'TIMED_OUT') {
          console.error('[useValidationStatusList] Subscription timed out');
        } else if (status === 'CLOSED') {
          console.log('[useValidationStatusList] Subscription closed');
        }
      });

    return () => {
      console.log('[useValidationStatusList] Unsubscribing from validation changes');
      subscription.unsubscribe();
      // Cancel any pending debounced calls
      debouncedFetch.cancel();
    };
  }, [rtoCode, fetchValidations, debouncedFetch]);

  return {
    validations,
    isLoading,
    error,
    refresh: fetchValidations,
  };
}

/**
 * Get status badge color based on validation status
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-800';
    case 'partial':
      return 'bg-yellow-100 text-yellow-800';
    case 'in_progress':
      return 'bg-blue-100 text-blue-800';
    case 'failed':
      return 'bg-red-100 text-red-800';
    case 'pending':
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

/**
 * Get human-readable status description
 */
export function getStatusDescription(status: string): string {
  switch (status) {
    case 'completed':
      return 'All requirements validated';
    case 'partial':
      return 'Some requirements validated';
    case 'in_progress':
      return 'Validation in progress';
    case 'failed':
      return 'Validation failed';
    case 'pending':
      return 'Waiting to start';
    default:
      return 'Unknown status';
  }
}
