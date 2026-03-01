import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { handleCors, createErrorResponse, createSuccessResponse } from '../_shared/cors.ts';

interface GetAICreditsRequest {
  userId?: string;
  rtoId?: string;
  rtoCode?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const requestData: GetAICreditsRequest = await req.json();
    const { userId, rtoId, rtoCode } = requestData;

    console.log('[get-ai-credits] Request received:', { userId, rtoId, rtoCode });

    // User-based credits (new flow)
    if (userId) {
      console.log('[get-ai-credits] Using user-based credits for userId:', userId);
      
      const supabase = createSupabaseClient(req);
      
      const { data: userCredits, error: userCreditsError } = await supabase
        .from('user_credits')
        .select('validation_credits, ai_credits')
        .eq('user_id', userId)
        .single();

      if (userCreditsError) {
        // If no record exists, user has 0 credits (new users start with 0)
        if (userCreditsError.code === 'PGRST116') {
          console.log('[get-ai-credits] No user credits found, returning 0');
          return createSuccessResponse({
            current: 0,
            total: 0,
            percentage: 0,
            percentageText: '0 credits available',
          });
        }
        throw new Error(`Failed to fetch user credits: ${userCreditsError.message}`);
      }

      const current = userCredits?.ai_credits || 0;
      
      return createSuccessResponse({
        current,
        total: current,
        percentage: current > 0 ? 100 : 0,
        percentageText: `${current} credits available`,
      });
    }

    // Legacy RTO-based credits (fallback for backward compatibility)
    if (!rtoId && !rtoCode) {
      console.error('[get-ai-credits] Missing userId, rtoId, and rtoCode');
      return createErrorResponse('Missing required field: userId, rtoId, or rtoCode');
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

        const newCurrent = newCredits.current_credits || 0;
        const newTotal = newCredits.total_credits || 0;
        const newPercentage = newTotal > 0 ? Math.round((newCurrent / newTotal) * 100) : 0;
        
        return createSuccessResponse({
          current: newCurrent,
          total: newTotal,
          subscription: newCredits.subscription_credits || 0,
          percentage: newPercentage,
          percentageText: `${newPercentage}% available`,
        });
      }
      
      throw new Error(`Failed to fetch credits: ${creditsError.message}`);
    }

    console.log('[get-ai-credits] Credits found:', credits);

    const current = credits?.current_credits || 0;
    const total = credits?.total_credits || 0;
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

    return createSuccessResponse({
      current,
      total,
      subscription: credits?.subscription_credits || 0,
      percentage,
      percentageText: `${percentage}% available`,
    });
  } catch (error) {
    console.error('[get-ai-credits] Error:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    );
  }
});
