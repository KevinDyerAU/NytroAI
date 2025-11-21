import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.5.0?target=deno';
import { createSupabaseClient, addAICreditsToRTO } from '../_shared/supabase.ts';
import { PaymentMetadata } from '../_shared/types.ts';

serve(async (req) => {
  try {
    // Initialize Stripe
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

    if (!stripeSecretKey || !webhookSecret) {
      console.error('Stripe configuration missing');
      return new Response('Configuration error', { status: 500 });
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Get the signature from headers
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      console.error('No Stripe signature found');
      return new Response('No signature', { status: 400 });
    }

    // Get raw body for signature verification
    const body = await req.text();

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return new Response(`Webhook Error: ${err instanceof Error ? err.message : 'Unknown error'}`, {
        status: 400,
      });
    }

    console.log(`Received webhook event: ${event.type}`);

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutSessionCompleted(session);
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentSucceeded(paymentIntent);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.error('Payment failed:', paymentIntent.id, paymentIntent.last_payment_error);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Webhook handler error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  console.log('Processing checkout session:', session.id);

  // Extract metadata
  const metadata = session.metadata as unknown as PaymentMetadata;
  if (!metadata || !metadata.rtoCode || !metadata.credits) {
    console.error('Missing metadata in checkout session:', session.id);
    return;
  }

  const { rtoCode, credits, packageId } = metadata;

  // Only process if payment was successful
  if (session.payment_status !== 'paid') {
    console.log('Payment not completed yet:', session.payment_status);
    return;
  }

  try {
    // Add credits to RTO
    const supabase = createSupabaseClient(new Request('http://localhost'));
    const creditsNum = parseInt(credits.toString(), 10);
    
    const result = await addAICreditsToRTO(
      supabase,
      rtoCode,
      creditsNum,
      `Stripe payment - ${packageId} package (Session: ${session.id})`
    );

    console.log(`Successfully added ${creditsNum} AI credits to RTO ${rtoCode}`);
    console.log('Credit addition result:', result);

    // Optional: Send confirmation email or notification here
    // await sendPurchaseConfirmationEmail(session);

  } catch (error) {
    console.error('Error adding credits after payment:', error);
    // In production, you might want to:
    // 1. Log to error tracking service
    // 2. Queue for retry
    // 3. Send alert to admin
    throw error;
  }
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  console.log('Payment intent succeeded:', paymentIntent.id);

  // Extract metadata
  const metadata = paymentIntent.metadata as unknown as PaymentMetadata;
  if (!metadata || !metadata.rtoCode || !metadata.credits) {
    console.log('No metadata in payment intent, will be handled by checkout.session.completed');
    return;
  }

  // This is a backup in case checkout.session.completed webhook fails
  // You can implement similar logic here or rely on checkout.session.completed
  console.log('Payment intent metadata:', metadata);
}
