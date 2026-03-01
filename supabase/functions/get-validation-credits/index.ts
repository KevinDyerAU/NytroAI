import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { handleCors, createErrorResponse, createSuccessResponse } from '../_shared/cors.ts';

interface GetValidationCreditsRequest {
  userId?: string;
  rtoId?: string;
  rtoCode?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const requestData: GetValidationCreditsRequest = await req.json();
    const { userId, rtoId, rtoCode } = requestData;

    console.log('[get-validation-credits] Request received:', { userId, rtoId, rtoCode });

    // User-based credits (new flow)
    if (userId) {
      console.log('[get-validation-credits] Using user-based credits for userId:', userId);
      
      const supabase = createSupabaseClient(req);
      
      const { data: userCredits, error: userCreditsError } = await supabase
        .from('user_credits')
        .select('validation_credits, ai_credits')
        .eq('user_id', userId)
        .single();

      if (userCreditsError) {
        // If no record exists, user has 0 credits (new users start with 0)
        if (userCreditsError.code === 'PGRST116') {
          console.log('[get-validation-credits] No user credits found, returning 0');
          return createSuccessResponse({
            current: 0,
            total: 0,
            percentage: 0,
            percentageText: '0 credits available',
          });
        }
        throw new Error(`Failed to fetch user credits: ${userCreditsError.message}`);
      }

      const current = userCredits?.validation_credits || 0;
      
      return createSuccessResponse({
        current,
        total: current,
        percentage: current > 0 ? 100 : 0,
        percentageText: `${current} credits available`,
      });
    }

    // Legacy RTO-based credits (fallback for backward compatibility)
    if (!rtoId && !rtoCode) {
      console.error('[get-validation-credits] Missing userId, rtoId, and rtoCode');
      return createErrorResponse('Missing required field: userId, rtoId, or rtoCode');
    }

    const supabase = createSupabaseClient(req);

    console.log('[get-validation-credits] Supabase client created');

    let rtoDbId: number;

    // If rtoId is provided, use it directly
    if (rtoId) {
      rtoDbId = parseInt(rtoId);
      console.log('[get-validation-credits] Using provided RTO ID:', rtoDbId);
      
      if (isNaN(rtoDbId)) {
        console.error('[get-validation-credits] Invalid rtoId (not a number):', rtoId);
        return createErrorResponse(`Invalid rtoId: ${rtoId}`);
      }
    } else {
      // Otherwise, look up by code
      console.log('[get-validation-credits] Looking up RTO by code:', rtoCode);
      const { data: rto, error: rtoError } = await supabase
        .from('RTO')
        .select('id')
        .eq('code', rtoCode)
        .single();

      if (rtoError) {
        console.error('[get-validation-credits] RTO lookup error:', rtoError);
        return createErrorResponse(`RTO lookup failed: ${rtoError.message}`);
      }
      
      if (!rto) {
        console.error('[get-validation-credits] RTO not found:', rtoCode);
        return createErrorResponse(`RTO not found: ${rtoCode}`);
      }
      
      rtoDbId = rto.id;
      console.log('[get-validation-credits] Found RTO ID:', rtoDbId);
    }

    // Get validation credits for this RTO (legacy)
    console.log('[get-validation-credits] Querying validation_credits for rto_id:', rtoDbId);
    
    const { data: credits, error: creditsError } = await supabase
      .from('validation_credits')
      .select('current_credits, total_credits, subscription_credits')
      .eq('rto_id', rtoDbId)
      .single();

    if (creditsError) {
      console.error('[get-validation-credits] Credits query error:', {
        code: creditsError.code,
        message: creditsError.message,
        details: creditsError.details,
        hint: creditsError.hint
      });
      
      // If no credits record exists, return 0
      if (creditsError.code === 'PGRST116') {
        console.log('[get-validation-credits] No credits found, returning 0');
        return createSuccessResponse({
          current: 0,
          total: 0,
          subscription: 0,
          percentage: 0,
          percentageText: '0 credits available',
        });
      }
      
      throw new Error(`Failed to fetch credits: ${creditsError.message}`);
    }

    console.log('[get-validation-credits] Credits found:', credits);

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
    console.error('[get-validation-credits] Error:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    );
  }
});
