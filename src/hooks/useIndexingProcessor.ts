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
    // TEMPORARILY DISABLED: process-pending-indexing is timing out (502 errors)
    // Validation is now triggered by DocumentUploadServiceSimplified polling
    console.log('[IndexingProcessor] DISABLED - using manual polling in upload service instead');
    
    // Cleanup function still needed
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);
}
