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

    // User-based credit consumption (new flow)
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

    // Legacy RTO-based consumption (fallback)
    if (!rtoCode) {
      return createErrorResponse('Missing required field: userId or rtoCode');
    }

    console.log('[consume-validation-credit] Consuming credit for RTO:', rtoCode);

    // Call the RPC function to consume a validation credit
    const { data, error } = await supabase.rpc('consume_validation_credit', {
      rto_code: rtoCode,
    });

    if (error) {
      console.error('[consume-validation-credit] RPC Error:', error);
      throw new Error(`Failed to consume credit: ${error.message}`);
    }

    console.log('[consume-validation-credit] RPC Result:', data);

    // RPC returns array with {success, message, new_balance}
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
  } catch (error) {
    console.error('[consume-validation-credit] Error:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    );
  }
});
