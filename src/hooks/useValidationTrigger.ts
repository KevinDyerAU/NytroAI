/**
 * useValidationTrigger Hook
 * 
 * Hook for triggering document processing (and validation) via n8n webhook
 * This starts the Gemini upload process, which then automatically triggers validation
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { triggerDocumentProcessing } from '../lib/n8nApi';

interface UseValidationTriggerReturn {
  trigger: (validationDetailId: number) => Promise<void>;
  isTriggering: boolean;
  error: string | null;
}

export function useValidationTrigger(): UseValidationTriggerReturn {
  const [isTriggering, setIsTriggering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trigger = async (validationDetailId: number) => {
    setIsTriggering(true);
    setError(null);

    try {
      console.log('[useValidationTrigger] Triggering document processing:', validationDetailId);
      
      const result = await triggerDocumentProcessing(validationDetailId);

      if (result.success) {
        toast.success('Validation started!', {
          description: 'Files are being uploaded to AI. Processing in the background.',
        });
      } else {
        throw new Error(result.error || 'Failed to start document processing');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to start document processing';
      setError(errorMsg);
      console.error('[useValidationTrigger] Error:', errorMsg);
      
      toast.error('Failed to start validation', {
        description: errorMsg,
      });
    } finally {
      setIsTriggering(false);
    }
  };

  return {
    trigger,
    isTriggering,
    error,
  };
}
