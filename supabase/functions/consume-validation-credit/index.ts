import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { handleCors, createErrorResponse, createSuccessResponse } from '../_shared/cors.ts';

interface ConsumeValidationCreditRequest {
  rtoCode: string;
  reason?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const requestData: ConsumeValidationCreditRequest = await req.json();
    const { rtoCode, reason } = requestData;

    if (!rtoCode) {
      return createErrorResponse('Missing required field: rtoCode');
    }

    const supabase = createSupabaseClient(req);

    console.log('[consume-validation-credit] Consuming credit for RTO:', rtoCode);

    // Call the RPC function to consume a validation credit
    const { data, error } = await supabase.rpc('add_validation_credits', {
      rto_code: rtoCode,
      amount: -1, // Consume 1 credit
      reason: reason || 'Validation credit consumed',
    });

    if (error) {
      console.error('[consume-validation-credit] Error:', error);
      
      // Check if insufficient credits
      if (error.message?.includes('Insufficient') || error.message?.includes('not enough')) {
        return createErrorResponse('Insufficient validation credits', 402);
      }
      
      throw new Error(`Failed to consume credit: ${error.message}`);
    }

    console.log('[consume-validation-credit] Credit consumed successfully');

    // Get updated credits
    const { data: rto, error: rtoError } = await supabase
      .from('RTO')
      .select('id')
      .eq('code', rtoCode)
      .single();

    if (!rtoError && rto) {
      const { data: credits } = await supabase
        .from('validation_credits')
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
    console.error('[consume-validation-credit] Error:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    );
  }
});
