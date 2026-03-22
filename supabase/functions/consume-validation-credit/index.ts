import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { handleCors, createErrorResponse, createSuccessResponse } from '../_shared/cors.ts';

interface ConsumeValidationCreditRequest {
  userId?: string;
  rtoCode?: string;
  reason?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const requestData: ConsumeValidationCreditRequest = await req.json();
    const { userId, rtoCode, reason } = requestData;

    const supabase = createSupabaseClient(req);

    // RTO-based credit consumption — check rtoCode FIRST.
    // RTO users also have a userId, but their credits live in the
    // validation_credits table (keyed by rto_id), NOT user_credits.
    if (rtoCode) {
      console.log('[consume-validation-credit] Consuming credit for RTO:', rtoCode);

      const { data, error } = await supabase.rpc('consume_validation_credit', {
        p_rto_code: rtoCode,
      });

      if (error) {
        console.error('[consume-validation-credit] RPC Error:', error);
        throw new Error(`Failed to consume credit: ${error.message}`);
      }

      console.log('[consume-validation-credit] RPC Result:', data);

      const result = Array.isArray(data) ? data[0] : data;

      if (!result?.success) {
        const message = result?.message || 'Failed to consume credit';
        console.error('[consume-validation-credit] Failed:', message);

        if (message.includes('Insufficient')) {
          return createErrorResponse(message, 402);
        }

        return createErrorResponse(message, 400);
      }

      console.log('[consume-validation-credit] Credit consumed successfully, new balance:', result.new_balance);

      return createSuccessResponse({
        success: true,
        remainingCredits: result.new_balance,
      });
    }

    // User-based credit consumption (for $99 individual users without an RTO)
    if (userId) {
      console.log('[consume-validation-credit] Consuming credit for user:', userId);

      const { data, error } = await supabase.rpc('consume_user_validation_credit', {
        p_user_id: userId,
      });

      if (error) {
        console.error('[consume-validation-credit] RPC Error:', error);
        throw new Error(`Failed to consume credit: ${error.message}`);
      }

      console.log('[consume-validation-credit] RPC Result:', data);

      const result = Array.isArray(data) ? data[0] : data;

      if (!result?.success) {
        const message = result?.message || 'Failed to consume credit';
        console.error('[consume-validation-credit] Failed:', message);

        if (message.includes('Insufficient')) {
          return createErrorResponse(message, 402);
        }

        return createErrorResponse(message, 400);
      }

      console.log('[consume-validation-credit] Credit consumed successfully, new balance:', result.new_balance);

      return createSuccessResponse({
        success: true,
        remainingCredits: result.new_balance,
      });
    }

    return createErrorResponse('Missing required field: rtoCode or userId');
  } catch (error) {
    console.error('[consume-validation-credit] Error:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    );
  }
});
