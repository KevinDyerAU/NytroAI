import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Hook to poll and process pending indexing operations
 * 
 * This hook runs in the background and calls the process-pending-indexing
 * edge function every 15 seconds to handle document indexing.
 * 
 * Usage: Add to Dashboard or main App component
 */
export function useIndexingProcessor() {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef(false);
  const lastStartTimeRef = useRef<number>(0);

  useEffect(() => {
    const processPendingIndexing = async () => {
      const now = Date.now();
      
      // Force reset if processing for more than 45 seconds (should timeout at 30)
      if (isProcessingRef.current && now - lastStartTimeRef.current > 45000) {
        console.warn('[IndexingProcessor] Force resetting stuck processing flag after 45s');
        isProcessingRef.current = false;
      }
      
      // Skip if already processing
      if (isProcessingRef.current) {
        console.log('[IndexingProcessor] Already processing, skipping...');
        return;
      }
      
      lastStartTimeRef.current = now;

      try {
        isProcessingRef.current = true;

        // Add 30 second timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Indexing processor timeout')), 30000);
        });

        const invokePromise = supabase.functions.invoke('process-pending-indexing', {
          body: {},
        });

        const result = await Promise.race([invokePromise, timeoutPromise]) as any;
        const { data, error } = result;

        if (error) {
          console.error('[IndexingProcessor] Error:', error);
          return;
        }

        if (data?.processed > 0) {
          console.log(`[IndexingProcessor] Processed ${data.processed} operations`);
        }

      } catch (error) {
        if (error instanceof Error && error.message === 'Indexing processor timeout') {
          console.warn('[IndexingProcessor] Timeout after 30 seconds - resetting');
        } else {
          console.error('[IndexingProcessor] Exception:', error);
        }
      } finally {
        isProcessingRef.current = false;
      }
    };

    // Start polling every 15 seconds
    console.log('[IndexingProcessor] Starting background indexing processor...');
    
    // Run immediately on mount
    processPendingIndexing();

    // Then run every 15 seconds
    intervalRef.current = setInterval(processPendingIndexing, 15000);

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        console.log('[IndexingProcessor] Stopping background indexing processor');
        clearInterval(intervalRef.current);
      }
    };
  }, []);
}
