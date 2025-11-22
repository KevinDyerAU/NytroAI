/**
 * useValidationStatus Hook - Phase 3.1
 * Real-time validation status tracking using new computed fields
 */

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

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

      const { data, error: fetchError } = await supabase
        .from('validation_detail')
        .select('*')
        .eq('id', validationId)
        .single();

      if (fetchError) {
        throw new Error(`Failed to fetch validation status: ${fetchError.message}`);
      }

      setStatus(data);
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
          // Clear status and show error
          setStatus(null);
          setError('This validation has been deleted');
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[useValidationStatus] Subscribed to validation ${validationId}`);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[useValidationStatus] Subscription error, attempting to reconnect...');
          fetchStatus();
        }
      });

    return () => {
      console.log(`[useValidationStatus] Unsubscribing from validation ${validationId}`);
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

/**
 * Hook to track multiple validations with real-time updates
 */
export function useValidationStatusList(rtoCode: string | null): {
  validations: ValidationStatusWithDetails[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const [validations, setValidations] = useState<ValidationStatusWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchValidations = useCallback(async () => {
    if (!rtoCode) {
      setValidations([]);
      setIsLoading(false);
      return;
    }

    try {
      // Don't set loading during background refreshes triggered by subscriptions
      // Only set loading on initial fetch or manual refresh
      const isInitialLoad = validations.length === 0;
      if (isInitialLoad) {
        setIsLoading(true);
      }
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('validation_detail_with_stats')
        .select('*')
        .eq('rtoCode', rtoCode)
        .order('last_updated_at', { ascending: false });

      if (fetchError) {
        // Log error but don't throw - prevents breaking the refresh cycle
        console.error('[useValidationStatusList] Fetch error:', fetchError);
        
        // Only throw on initial load, otherwise just log and keep existing data
        if (isInitialLoad) {
          throw new Error(`Failed to fetch validations: ${fetchError.message}`);
        }
        return;
      }

      setValidations(data || []);
      console.log(`[useValidationStatusList] Fetched ${data?.length || 0} validations`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch validations';
      setError(errorMsg);
      console.error('[useValidationStatusList] Error:', errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [rtoCode, validations.length]);

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
          // Refresh the entire list to get computed fields from view
          fetchValidations().catch(err => {
            console.error('[useValidationStatusList] Failed to refresh after INSERT:', err);
          });
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
          // Refresh the entire list to get computed fields from view
          fetchValidations().catch(err => {
            console.error('[useValidationStatusList] Failed to refresh after UPDATE:', err);
          });
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
          // Remove deleted item from local state immediately for responsiveness
          setValidations(prev => prev.filter(v => v.id !== payload.old.id));
          // Also refresh to ensure consistency
          fetchValidations().catch(err => {
            console.error('[useValidationStatusList] Failed to refresh after DELETE:', err);
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[useValidationStatusList] Subscribed to validation changes');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[useValidationStatusList] Subscription error, attempting to reconnect...');
          // Refresh data on subscription error
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
    };
  }, [rtoCode, fetchValidations]);

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
 * Get status label for display
 */
export function getStatusLabel(status: string): string {
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'partial':
      return 'Partially Met';
    case 'in_progress':
      return 'In Progress';
    case 'failed':
      return 'Failed';
    case 'pending':
    default:
      return 'Pending';
  }
}

/**
 * Get progress color based on percentage
 */
export function getProgressColor(progress: number): string {
  if (progress >= 80) return 'bg-green-500';
  if (progress >= 50) return 'bg-yellow-500';
  if (progress >= 20) return 'bg-orange-500';
  return 'bg-red-500';
}
