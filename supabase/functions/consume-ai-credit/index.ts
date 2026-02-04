import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { handleCors, createErrorResponse, createSuccessResponse } from '../_shared/cors.ts';

interface ConsumeAICreditRequest {
  userId?: string;
  rtoCode?: string;
  reason?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const requestData: ConsumeAICreditRequest = await req.json();
    const { userId, rtoCode, reason } = requestData;

    const supabase = createSupabaseClient(req);

    // User-based credit consumption (new flow)
    if (userId) {
      console.log('[consume-ai-credit] Consuming credit for user:', userId);

      const { data, error } = await supabase.rpc('consume_user_ai_credit', {
        p_user_id: userId,
      });

      if (error) {
        console.error('[consume-ai-credit] RPC Error:', error);
        throw new Error(`Failed to consume credit: ${error.message}`);
      }

      console.log('[consume-ai-credit] RPC Result:', data);

      const result = Array.isArray(data) ? data[0] : data;
      
      if (!result?.success) {
        const message = result?.message || 'Failed to consume credit';
        console.error('[consume-ai-credit] Failed:', message);
        
        if (message.includes('Insufficient')) {
          return createErrorResponse(message, 402);
        }
        
        return createErrorResponse(message, 400);
      }

      console.log('[consume-ai-credit] Credit consumed successfully, new balance:', result.new_balance);

      return createSuccessResponse({
        success: true,
        remainingCredits: result.new_balance,
      });
    }

    // Legacy RTO-based consumption (fallback)
    if (!rtoCode) {
      return createErrorResponse('Missing required field: userId or rtoCode');
    }

    console.log('[consume-ai-credit] Consuming credit for RTO:', rtoCode);

    // Call the RPC function to consume an AI credit
    const { data, error } = await supabase.rpc('add_ai_credits', {
      rto_code: rtoCode,
      amount: -1, // Consume 1 credit
      reason: reason || 'AI credit consumed',
    });

    if (error) {
      console.error('[consume-ai-credit] Error:', error);
      
      // Check if insufficient credits
      if (error.message?.includes('Insufficient') || error.message?.includes('not enough')) {
        return createErrorResponse('Insufficient AI credits', 402);
      }
      
      throw new Error(`Failed to consume credit: ${error.message}`);
    }

    console.log('[consume-ai-credit] Credit consumed successfully');

    // Get updated credits
    const { data: rto, error: rtoError } = await supabase
      .from('RTO')
      .select('id')
      .eq('code', rtoCode)
      .single();

    if (!rtoError && rto) {
      const { data: credits } = await supabase
        .from('ai_credits')
        .select('current_credits')
        .eq('rto_id', rto.id)
        .single();

      return createSuccessResponse({
        success: true,
        remainingCredits: credits?.current_credits || 0,
      });
    }

    return createSuccessResponse({
      success: true,
    });
  } catch (error) {
    console.error('[consume-ai-credit] Error:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    );
  }
});
