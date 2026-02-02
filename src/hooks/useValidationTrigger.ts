/**
 * useValidationTrigger Hook
 * 
 * Hook for triggering validation via Supabase Edge Function (trigger-validation-unified)
 * Supports both Azure OpenAI and Google Gemini based on server-side AI_PROVIDER config
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';

interface UseValidationTriggerReturn {
  trigger: (validationDetailId: number, storagePaths: string[]) => Promise<void>;
  isTriggering: boolean;
  error: string | null;
}

export function useValidationTrigger(): UseValidationTriggerReturn {
  const [isTriggering, setIsTriggering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trigger = async (validationDetailId: number, _storagePaths: string[]) => {
    setIsTriggering(true);
    setError(null);

    try {
      console.log('[useValidationTrigger] Triggering validation via Edge Function:', {
        validationDetailId
      });
      
      // Call n8n-based validation (uses Gemini document storage)
      const { data, error: invokeError } = await supabase.functions.invoke('trigger-validation-n8n', {
        body: { validationDetailId }
      });

      if (invokeError) {
        throw new Error(invokeError.message || 'Failed to invoke validation function');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Validation failed to start');
      }

      console.log('[useValidationTrigger] n8n workflow triggered:', data);

      // Show success immediately - validation is running in background
      toast.success('Validation started!', {
        description: 'Processing requirements in background. Check dashboard for progress.',
      });
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to start validation';
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
