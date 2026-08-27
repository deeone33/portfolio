// Supabase Edge Function: create-checkout-session
// Deploy with: supabase functions deploy create-checkout-session
// Requires these function secrets (Dashboard > Edge Functions > Secrets,
// or `supabase secrets set KEY=value`):
//   STRIPE_SECRET_KEY        — your Stripe secret key (sk_...)
//   SUPABASE_URL             — auto-provided by Supabase
//   SUPABASE_ANON_KEY        — auto-provided by Supabase
//   SITE_URL                 — e.g. https://yourdomain.com (for success/cancel redirects)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' });

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization')!;
    // Client scoped to the caller's own JWT, so RLS applies — this order
    // fetch only succeeds if the order actually belongs to this user.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: 'Not authenticated' }, 401);

    const { order_id } = await req.json();
    const { data: order, error } = await supabase.from('orders').select('*').eq('id', order_id).single();
    if (error || !order) return json({ error: 'Order not found' }, 404);
    if (order.user_id !== user.id) return json({ error: 'Not your order' }, 403);

    const siteUrl = Deno.env.get('SITE_URL') || 'http://localhost:8000';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: [{
        price_data: {
          currency: order.currency,
          product_data: { name: `Fieldnote — ${order.plan_label}` },
          unit_amount: order.price_cents,
        },
        quantity: 1,
      }],
      metadata: { order_id: order.id },
      success_url: `${siteUrl}/account.html?paid=1`,
      cancel_url: `${siteUrl}/account.html?cancelled=1`,
    });

    await supabase.from('orders').update({ stripe_checkout_session_id: session.id }).eq('id', order.id);

    return json({ url: session.url });
  } catch (err) {
    console.error(err);
    return json({ error: String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
