import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createSupabaseClient } from '../_shared/supabase.ts';
import { handleCors, createErrorResponse, createSuccessResponse } from '../_shared/cors.ts';

interface ValidatePromoCodeRequest {
    promoCode: string;
}

interface PromoCode {
    id: number;
    code: string;
    discount_percent: number | null;
    discount_amount: number | null;
    valid_from: string | null;
    valid_until: string | null;
    max_uses: number | null;
    current_uses: number;
    is_active: boolean;
}

serve(async (req) => {
    // Handle CORS preflight requests
    const corsResponse = handleCors(req);
    if (corsResponse) return corsResponse;

    try {
        const requestData: ValidatePromoCodeRequest = await req.json();
        const { promoCode } = requestData;

        console.log('[validate-promo-code] Request received:', { promoCode });

        if (!promoCode || typeof promoCode !== 'string') {
            return createErrorResponse('Promo code is required');
        }

        const supabase = createSupabaseClient(req);

        // Look up the promo code
        const { data: promo, error: promoError } = await supabase
            .from('promo_codes')
            .select('*')
            .eq('code', promoCode.trim().toUpperCase())
            .single();

        if (promoError || !promo) {
            console.log('[validate-promo-code] Promo code not found:', promoCode);
            return createSuccessResponse({
                valid: false,
                error: 'Invalid promo code',
            });
        }

        const promoData = promo as PromoCode;

        // Check if promo code is active
        if (!promoData.is_active) {
            return createSuccessResponse({
                valid: false,
                error: 'This promo code is no longer active',
            });
        }

        // Check date validity
        const now = new Date();
        if (promoData.valid_from && new Date(promoData.valid_from) > now) {
            return createSuccessResponse({
                valid: false,
                error: 'This promo code is not yet valid',
            });
        }

        if (promoData.valid_until && new Date(promoData.valid_until) < now) {
            return createSuccessResponse({
                valid: false,
                error: 'This promo code has expired',
            });
        }

        // Check usage limits
        if (promoData.max_uses !== null && promoData.current_uses >= promoData.max_uses) {
            return createSuccessResponse({
                valid: false,
                error: 'This promo code has reached its usage limit',
            });
        }

        // Promo code is valid - return discount info
        const discount: { percent?: number; amount?: number } = {};

        if (promoData.discount_percent) {
            discount.percent = promoData.discount_percent;
        }
        if (promoData.discount_amount) {
            discount.amount = promoData.discount_amount;
        }

        console.log('[validate-promo-code] Valid promo code found:', {
            code: promoData.code,
            discount,
        });

        return createSuccessResponse({
            valid: true,
            discount,
            code: promoData.code,
        });

    } catch (error) {
        console.error('[validate-promo-code] Error:', error);
        return createErrorResponse(
            error instanceof Error ? error.message : 'Internal server error',
            500
        );
    }
});
