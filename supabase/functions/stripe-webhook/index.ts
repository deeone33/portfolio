// Supabase Edge Function: stripe-webhook
// Deploy with: supabase functions deploy stripe-webhook --no-verify-jwt
// (--no-verify-jwt is required — Stripe calls this directly, with no user session)
//
// After deploying, copy the function's URL into Stripe Dashboard > Developers
// > Webhooks > Add endpoint, listening for: checkout.session.completed
// Stripe will give you a signing secret (whsec_...) — set it as STRIPE_WEBHOOK_SECRET.
//
// Requires these function secrets:
//   STRIPE_SECRET_KEY
//   STRIPE_WEBHOOK_SECRET
//   SUPABASE_URL              — auto-provided
//   SUPABASE_SERVICE_ROLE_KEY — from Project Settings > API (NOT the anon key —
//                                this bypasses RLS, which is required here since
//                                Stripe's webhook has no user session to authenticate as)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' });
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  const signature = req.headers.get('Stripe-Signature');
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature!, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return new Response('Invalid signature', { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.order_id;
    if (orderId) {
      const { error } = await supabaseAdmin.from('orders').update({
        status: 'paid',
        stripe_payment_intent_id: session.payment_intent as string,
        updated_at: new Date().toISOString(),
      }).eq('id', orderId);
      if (error) console.error('Failed to mark order paid:', error);
    }
  }

  return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } });
});
