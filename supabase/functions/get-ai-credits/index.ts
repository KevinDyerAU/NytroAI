import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { handleCors, createErrorResponse, createSuccessResponse } from '../_shared/cors.ts';

interface GetAICreditsRequest {
  rtoId?: string;
  rtoCode?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const requestData: GetAICreditsRequest = await req.json();
    const { rtoId, rtoCode } = requestData;

    console.log('[get-ai-credits] Request received:', { rtoId, rtoCode });

    if (!rtoId && !rtoCode) {
      console.error('[get-ai-credits] Missing rtoId and rtoCode');
      return createErrorResponse('Missing required field: rtoId or rtoCode');
    }

    const supabase = createSupabaseClient(req);

    console.log('[get-ai-credits] Supabase client created');

    let rtoDbId: number;

    // If rtoId is provided, use it directly
    if (rtoId) {
      rtoDbId = parseInt(rtoId);
      console.log('[get-ai-credits] Using provided RTO ID:', rtoDbId);
      
      if (isNaN(rtoDbId)) {
        console.error('[get-ai-credits] Invalid rtoId (not a number):', rtoId);
        return createErrorResponse(`Invalid rtoId: ${rtoId}`);
      }
    } else {
      // Otherwise, look up by code
      console.log('[get-ai-credits] Looking up RTO by code:', rtoCode);
      const { data: rto, error: rtoError } = await supabase
        .from('RTO')
        .select('id')
        .eq('code', rtoCode)
        .single();

      if (rtoError) {
        console.error('[get-ai-credits] RTO lookup error:', rtoError);
        return createErrorResponse(`RTO lookup failed: ${rtoError.message}`);
      }
      
      if (!rto) {
        console.error('[get-ai-credits] RTO not found:', rtoCode);
        return createErrorResponse(`RTO not found: ${rtoCode}`);
      }
      
      rtoDbId = rto.id;
      console.log('[get-ai-credits] Found RTO ID:', rtoDbId);
    }

    // Get AI credits for this RTO
    console.log('[get-ai-credits] Querying ai_credits for rto_id:', rtoDbId);
    
    const { data: credits, error: creditsError } = await supabase
      .from('ai_credits')
      .select('current_credits, total_credits, subscription_credits')
      .eq('rto_id', rtoDbId)
      .single();

    if (creditsError) {
      console.error('[get-ai-credits] Credits query error:', {
        code: creditsError.code,
        message: creditsError.message,
        details: creditsError.details,
        hint: creditsError.hint
      });
      
      // If no credits record exists, create one with default values
      if (creditsError.code === 'PGRST116') {
        console.log('[get-ai-credits] No credits found, creating default record');
        
        const { data: newCredits, error: insertError } = await supabase
          .from('ai_credits')
          .insert({
            rto_id: rtoDbId,
            current_credits: 100, // Default starter AI credits
            total_credits: 100,
            subscription_credits: 100,
          })
          .select('current_credits, total_credits, subscription_credits')
          .single();

        if (insertError) {
          throw new Error(`Failed to create credits record: ${insertError.message}`);
        }

        return createSuccessResponse({
          current: newCredits.current_credits || 0,
          total: newCredits.total_credits || 0,
          subscription: newCredits.subscription_credits || 0,
        });
      }
      
      throw new Error(`Failed to fetch credits: ${creditsError.message}`);
    }

    console.log('[get-ai-credits] Credits found:', credits);

    return createSuccessResponse({
      current: credits?.current_credits || 0,
      total: credits?.total_credits || 0,
      subscription: credits?.subscription_credits || 0,
    });
  } catch (error) {
    console.error('[get-ai-credits] Error:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    );
  }
});
