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

  useEffect(() => {
    const processPendingIndexing = async () => {
      // Skip if already processing
      if (isProcessingRef.current) {
        console.log('[IndexingProcessor] Already processing, skipping...');
        return;
      }

      try {
        isProcessingRef.current = true;

        const { data, error } = await supabase.functions.invoke('process-pending-indexing', {
          body: {},
        });

        if (error) {
          console.error('[IndexingProcessor] Error:', error);
          return;
        }

        if (data?.processed > 0) {
          console.log(`[IndexingProcessor] Processed ${data.processed} operations`);
        }

      } catch (error) {
        console.error('[IndexingProcessor] Exception:', error);
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
