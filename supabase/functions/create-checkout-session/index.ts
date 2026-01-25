import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import Stripe from 'https://esm.sh/stripe@14.5.0?target=deno';
import { handleCors, createErrorResponse, createSuccessResponse } from '../_shared/cors.ts';

// Types
interface CheckoutRequest {
    productType: 'unit' | 'subscription';
    quantity: number;
    unitPrice: number;
    successUrl: string;
    cancelUrl: string;
    promoCode?: string;
    userId?: string;
    rtoId?: string;
}

interface PromoCode {
    id: number;
    code: string;
    discount_percent: number | null;
    discount_amount: number | null;
    is_active: boolean;
    valid_from: string | null;
    valid_until: string | null;
    max_uses: number | null;
    current_uses: number;
}

serve(async (req: Request) => {
    // Handle CORS preflight
    const corsResponse = handleCors(req);
    if (corsResponse) return corsResponse;

    try {
        // Initialize Stripe
        const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
        if (!stripeSecretKey) {
            console.error('[create-checkout-session] STRIPE_SECRET_KEY not set');
            return createErrorResponse('Stripe configuration missing', 500);
        }

        const stripe = new Stripe(stripeSecretKey, {
            apiVersion: '2023-10-16',
            httpClient: Stripe.createFetchHttpClient(),
        });

        // Parse request body
        const body: CheckoutRequest = await req.json();
        console.log('[create-checkout-session] Request received:', {
            productType: body.productType,
            quantity: body.quantity,
            unitPrice: body.unitPrice,
            hasPromoCode: !!body.promoCode,
        });

        // Validate required fields
        if (!body.productType || !body.quantity || !body.unitPrice) {
            return createErrorResponse('Missing required fields: productType, quantity, unitPrice');
        }

        if (!body.successUrl || !body.cancelUrl) {
            return createErrorResponse('Missing required fields: successUrl, cancelUrl');
        }

        if (body.quantity < 1 || body.quantity > 100) {
            return createErrorResponse('Quantity must be between 1 and 100');
        }

        // Calculate base pricing (in cents for Stripe)
        let unitPriceInCents = Math.round(body.unitPrice * 100);
        let totalAmountInCents = unitPriceInCents * body.quantity;
        let discountAmountInCents = 0;
        let appliedPromoCode: PromoCode | null = null;

        // Validate and apply promo code if provided
        if (body.promoCode) {
            console.log('[create-checkout-session] Validating promo code:', body.promoCode);

            // Initialize Supabase to validate promo code
            const supabaseUrl = Deno.env.get('SUPABASE_URL');
            const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

            if (!supabaseUrl || !supabaseServiceKey) {
                console.error('[create-checkout-session] Supabase configuration missing');
                return createErrorResponse('Server configuration error', 500);
            }

            const supabase = createClient(supabaseUrl, supabaseServiceKey, {
                auth: { autoRefreshToken: false, persistSession: false },
            });

            // Fetch promo code from database
            const { data: promoData, error: promoError } = await supabase
                .from('promo_codes')
                .select('*')
                .eq('code', body.promoCode.trim().toUpperCase())
                .single();

            if (promoError || !promoData) {
                console.log('[create-checkout-session] Promo code not found:', body.promoCode);
                return createErrorResponse('Invalid promo code');
            }

            appliedPromoCode = promoData as PromoCode;

            // Validate promo code is active
            if (!appliedPromoCode.is_active) {
                return createErrorResponse('This promo code is no longer active');
            }

            // Validate date range
            const now = new Date();
            if (appliedPromoCode.valid_from && new Date(appliedPromoCode.valid_from) > now) {
                return createErrorResponse('This promo code is not yet valid');
            }
            if (appliedPromoCode.valid_until && new Date(appliedPromoCode.valid_until) < now) {
                return createErrorResponse('This promo code has expired');
            }

            // Validate usage limit
            if (appliedPromoCode.max_uses !== null && appliedPromoCode.current_uses >= appliedPromoCode.max_uses) {
                return createErrorResponse('This promo code has reached its usage limit');
            }

            // Calculate discount
            if (appliedPromoCode.discount_percent) {
                discountAmountInCents = Math.round(totalAmountInCents * (appliedPromoCode.discount_percent / 100));
            } else if (appliedPromoCode.discount_amount) {
                // Fixed amount discount (in AUD, convert to cents)
                discountAmountInCents = Math.round(appliedPromoCode.discount_amount * 100);
                // Don't exceed total amount
                discountAmountInCents = Math.min(discountAmountInCents, totalAmountInCents);
            }

            console.log('[create-checkout-session] Promo code validated:', {
                code: appliedPromoCode.code,
                discountPercent: appliedPromoCode.discount_percent,
                discountAmount: appliedPromoCode.discount_amount,
                discountAmountInCents,
            });
        }

        // Calculate final amount
        const finalAmountInCents = totalAmountInCents - discountAmountInCents;

        console.log('[create-checkout-session] Creating Stripe session:', {
            totalAmountInCents,
            discountAmountInCents,
            finalAmountInCents,
            quantity: body.quantity,
        });

        // Build line items for Stripe
        const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
            {
                price_data: {
                    currency: 'aud',
                    product_data: {
                        name: body.quantity === 1 ? 'Nytro AI Credit Unit' : `Nytro AI Credit Units (${body.quantity})`,
                        description: `${body.quantity} AI Credit Unit${body.quantity > 1 ? 's' : ''} for document validation and analysis`,
                    },
                    unit_amount: unitPriceInCents,
                },
                quantity: body.quantity,
            },
        ];

        // If there's a discount, add it as a negative line item or use Stripe's discount feature
        if (discountAmountInCents > 0 && appliedPromoCode) {
            lineItems.push({
                price_data: {
                    currency: 'aud',
                    product_data: {
                        name: `Discount (${appliedPromoCode.code})`,
                        description: appliedPromoCode.discount_percent
                            ? `${appliedPromoCode.discount_percent}% off`
                            : `$${appliedPromoCode.discount_amount?.toFixed(2)} off`,
                    },
                    unit_amount: -discountAmountInCents,
                },
                quantity: 1,
            });
        }

        // Create Stripe checkout session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: body.successUrl,
            cancel_url: body.cancelUrl,
            metadata: {
                productType: body.productType,
                quantity: body.quantity.toString(),
                unitPrice: body.unitPrice.toString(),
                promoCode: appliedPromoCode?.code || '',
                discountAmount: discountAmountInCents.toString(),
                userId: body.userId || '',
                rtoId: body.rtoId || '',
            },
            allow_promotion_codes: false, // We handle promo codes ourselves
            billing_address_collection: 'required',
            customer_creation: 'always',
        });

        console.log('[create-checkout-session] Session created:', {
            sessionId: session.id,
            url: session.url,
        });

        // Increment promo code usage if one was applied
        if (appliedPromoCode) {
            const supabaseUrl = Deno.env.get('SUPABASE_URL');
            const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

            if (supabaseUrl && supabaseServiceKey) {
                const supabase = createClient(supabaseUrl, supabaseServiceKey, {
                    auth: { autoRefreshToken: false, persistSession: false },
                });

                // Note: We increment usage when session is created, not when payment succeeds
                // For production, you might want to use a webhook to handle this properly
                await supabase
                    .from('promo_codes')
                    .update({
                        current_uses: appliedPromoCode.current_uses + 1,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', appliedPromoCode.id);

                console.log('[create-checkout-session] Promo code usage incremented:', appliedPromoCode.code);
            }
        }

        return createSuccessResponse({
            sessionId: session.id,
            url: session.url,
            amount: finalAmountInCents / 100, // Return in dollars
            currency: 'AUD',
            promoApplied: !!appliedPromoCode,
            discountAmount: discountAmountInCents / 100,
        });

    } catch (error) {
        console.error('[create-checkout-session] Error:', error);

        if (error instanceof Stripe.errors.StripeError) {
            return createErrorResponse(`Stripe error: ${error.message}`, 400);
        }

        return createErrorResponse(
            error instanceof Error ? error.message : 'Failed to create checkout session',
            500
        );
    }
});
