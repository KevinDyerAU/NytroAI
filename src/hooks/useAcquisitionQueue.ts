import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface AcquisitionQueueItem {
  id: number;
  unit_code: string;
  status: 'queued' | 'in_progress' | 'completed' | 'partial_success' | 'failed' | 'retry';
  retry_count: number;
  max_retries: number;
  last_error: string | null;
  error_history: Array<{ timestamp: string; error: string; retry_count: number }>;
  sections_captured: {
    ke: boolean;
    pe: boolean;
    fs: boolean;
    epc: boolean;
    ac: boolean;
  };
  requested_by: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  next_retry_at: string | null;
}

interface UseAcquisitionQueueReturn {
  queueItems: AcquisitionQueueItem[];
  isLoading: boolean;
  error: string | null;
  enqueueUnit: (unitCode: string) => Promise<AcquisitionQueueItem | null>;
  retryUnit: (queueId: number) => Promise<boolean>;
  cancelUnit: (queueId: number) => Promise<boolean>;
  getQueueItemForUnit: (unitCode: string) => AcquisitionQueueItem | undefined;
  refreshQueue: () => Promise<void>;
}

export function useAcquisitionQueue(): UseAcquisitionQueueReturn {
  const [queueItems, setQueueItems] = useState<AcquisitionQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch queue items for the current user (exclude completed)
  const fetchQueue = useCallback(async () => {
    try {
      // Get current user to filter by requested_by
      const { data: { user } } = await supabase.auth.getUser();

      let query = supabase
        .from('unit_acquisition_queue')
        .select('*')
        .in('status', ['queued', 'in_progress', 'retry', 'failed', 'partial_success'])
        .order('created_at', { ascending: false });

      // Filter by current user if available
      if (user?.id) {
        query = query.eq('requested_by', user.id);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        console.error('[AcquisitionQueue] Fetch error:', fetchError);
        setError(fetchError.message);
        return;
      }

      setQueueItems(data || []);
      setError(null);
    } catch (err) {
      console.error('[AcquisitionQueue] Exception:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch queue');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Subscribe to realtime changes on the queue table
  useEffect(() => {
    fetchQueue();

    const channel = supabase
      .channel('acquisition_queue_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'unit_acquisition_queue',
        },
        (payload) => {
          console.log('[AcquisitionQueue] Realtime event:', payload.eventType, payload);

          if (payload.eventType === 'INSERT') {
            const newItem = payload.new as AcquisitionQueueItem;
            // Only add if not completed
            if (newItem.status !== 'completed') {
              setQueueItems(prev => [newItem, ...prev]);
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedItem = payload.new as AcquisitionQueueItem;
            if (updatedItem.status === 'completed') {
              // Remove completed items from the list
              setQueueItems(prev => prev.filter(item => item.id !== updatedItem.id));
            } else {
              setQueueItems(prev =>
                prev.map(item =>
                  item.id === updatedItem.id ? updatedItem : item
                )
              );
            }
          } else if (payload.eventType === 'DELETE') {
            setQueueItems(prev =>
              prev.filter(item => item.id !== (payload.old as { id: number }).id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchQueue]);

  // Enqueue a new unit for acquisition
  const enqueueUnit = useCallback(async (unitCode: string): Promise<AcquisitionQueueItem | null> => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error: insertError } = await supabase
        .from('unit_acquisition_queue')
        .insert({
          unit_code: unitCode.toUpperCase().trim(),
          status: 'queued',
          requested_by: user?.id || null,
        })
        .select()
        .single();

      if (insertError) {
        console.error('[AcquisitionQueue] Enqueue error:', insertError);
        throw new Error(insertError.message);
      }

      return data as AcquisitionQueueItem;
    } catch (err) {
      console.error('[AcquisitionQueue] Enqueue exception:', err);
      throw err;
    }
  }, []);

  // Retry a failed unit
  const retryUnit = useCallback(async (queueId: number): Promise<boolean> => {
    try {
      const { error: updateError } = await supabase
        .from('unit_acquisition_queue')
        .update({
          status: 'queued',
          last_error: null,
          next_retry_at: null,
        })
        .eq('id', queueId);

      if (updateError) {
        console.error('[AcquisitionQueue] Retry error:', updateError);
        return false;
      }

      return true;
    } catch (err) {
      console.error('[AcquisitionQueue] Retry exception:', err);
      return false;
    }
  }, []);

  // Cancel/remove a queued unit
  const cancelUnit = useCallback(async (queueId: number): Promise<boolean> => {
    try {
      const { error: deleteError } = await supabase
        .from('unit_acquisition_queue')
        .delete()
        .eq('id', queueId)
        .in('status', ['queued', 'failed']);

      if (deleteError) {
        console.error('[AcquisitionQueue] Cancel error:', deleteError);
        return false;
      }

      return true;
    } catch (err) {
      console.error('[AcquisitionQueue] Cancel exception:', err);
      return false;
    }
  }, []);

  // Get queue item for a specific unit code
  const getQueueItemForUnit = useCallback(
    (unitCode: string): AcquisitionQueueItem | undefined => {
      return queueItems.find(
        item => item.unit_code.toUpperCase() === unitCode.toUpperCase()
      );
    },
    [queueItems]
  );

  return {
    queueItems,
    isLoading,
    error,
    enqueueUnit,
    retryUnit,
    cancelUnit,
    getQueueItemForUnit,
    refreshQueue: fetchQueue,
  };
}
