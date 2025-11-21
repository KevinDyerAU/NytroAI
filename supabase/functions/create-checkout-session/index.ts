import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.5.0?target=deno';
import { createSupabaseClient, getRTOByCode } from '../_shared/supabase.ts';
import { handleCors, createErrorResponse, createSuccessResponse } from '../_shared/cors.ts';
import { CREDIT_PACKAGES, CheckoutSessionRequest } from '../_shared/types.ts';

serve(async (req) => {
  // Handle CORS preflight requests
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Initialize Stripe
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      return createErrorResponse('Stripe configuration missing', 500);
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Parse request body
    const requestData: CheckoutSessionRequest = await req.json();
    const { packageId, rtoCode, credits, price, successUrl, cancelUrl } = requestData;

    // Validate request
    if (!packageId || !rtoCode || !credits || !price) {
      return createErrorResponse('Missing required fields: packageId, rtoCode, credits, price');
    }

    // Verify package exists and matches
    const pkg = CREDIT_PACKAGES[packageId];
    if (!pkg) {
      return createErrorResponse('Invalid package ID');
    }

    if (pkg.credits !== credits || pkg.price !== price) {
      return createErrorResponse('Package details do not match');
    }

    // Verify RTO exists in database
    const supabase = createSupabaseClient(req);
    let rto;
    try {
      rto = await getRTOByCode(supabase, rtoCode);
    } catch (error) {
      return createErrorResponse(`RTO not found: ${rtoCode}`);
    }

    // Get the origin for redirect URLs
    const origin = req.headers.get('origin') || 'http://localhost:5173';
    const finalSuccessUrl = successUrl || `${origin}/settings?tab=purchase&success=true`;
    const finalCancelUrl = cancelUrl || `${origin}/settings?tab=purchase&canceled=true`;

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'aud',
            product_data: {
              name: pkg.name,
              description: `${pkg.credits.toLocaleString()} AI Credits - ${pkg.description}`,
              images: [], // Add product image URL if available
            },
            unit_amount: Math.round(price * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      metadata: {
        rtoCode: rtoCode,
        rtoId: rto.id.toString(),
        packageId: packageId,
        credits: credits.toString(),
        rtoName: rto.legalname,
      },
      success_url: finalSuccessUrl,
      cancel_url: finalCancelUrl,
      customer_email: undefined, // Optional: pre-fill if you have user email
      billing_address_collection: 'auto',
      payment_intent_data: {
        metadata: {
          rtoCode: rtoCode,
          rtoId: rto.id.toString(),
          packageId: packageId,
          credits: credits.toString(),
        },
      },
    });

    console.log(`Checkout session created: ${session.id} for RTO ${rtoCode}`);

    return createSuccessResponse({
      sessionId: session.id,
      url: session.url,
    });

  } catch (error) {
    console.error('Error creating checkout session:', error);
    return createErrorResponse(
      error instanceof Error ? error.message : 'Internal server error',
      500
    );
  }
});
