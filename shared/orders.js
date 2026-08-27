import { supabase } from './supabaseClient.js';

export const PLANS = {
  starter:   { label: 'Starter',    price_cents: 45000,  currency: 'eur' },
  standard:  { label: 'Standard',   price_cents: 120000, currency: 'eur' },
  fullbuild: { label: 'Full Build', price_cents: 290000, currency: 'eur' }
};

export function formatMoney(cents, currency) {
  return new Intl.NumberFormat('en', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
}

// Creates the order row, THEN calls the create-checkout-session Edge Function
// to get a Stripe Checkout URL and redirects there. Payment isn't recorded as
// complete until Stripe's webhook confirms it — see supabase/functions/.
export async function startCheckout(userId, planKey, notes) {
  const plan = PLANS[planKey];
  if (!plan) throw new Error('Unknown plan: ' + planKey);

  const { data: order, error } = await supabase.from('orders').insert({
    user_id: userId,
    plan_key: planKey,
    plan_label: plan.label,
    price_cents: plan.price_cents,
    currency: plan.currency,
    notes: notes || null,
    status: 'pending_payment'
  }).select().single();

  if (error) throw error;

  const { data: session } = await supabase.auth.getSession();
  const resp = await fetch(`${supabase.supabaseUrl}/functions/v1/create-checkout-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.session.access_token}`
    },
    body: JSON.stringify({ order_id: order.id })
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error('Could not start checkout: ' + errText);
  }
  const { url } = await resp.json();
  window.location.href = url; // off to Stripe Checkout
}

export async function getMyOrders(userId) {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_files(*), order_comments(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getAllOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('*, profiles(full_name, email), order_files(*), order_comments(*)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function updateOrderStatus(orderId, status) {
  const { error } = await supabase.from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', orderId);
  if (error) throw error;
}

export async function postComment(orderId, authorId, authorRole, body) {
  const { error } = await supabase.from('order_comments').insert({ order_id: orderId, author_id: authorId, author_role: authorRole, body });
  if (error) throw error;
}

export async function uploadDeliverable(orderId, file, uploadedBy) {
  const path = `${orderId}/${Date.now()}-${file.name}`;
  const { error: upErr } = await supabase.storage.from('deliverables').upload(path, file);
  if (upErr) throw upErr;
  const { error: dbErr } = await supabase.from('order_files').insert({
    order_id: orderId, file_path: path, file_name: file.name, uploaded_by: uploadedBy
  });
  if (dbErr) throw dbErr;
}

export async function getDownloadUrl(filePath) {
  const { data, error } = await supabase.storage.from('deliverables').createSignedUrl(filePath, 60 * 10); // 10 min link
  if (error) throw error;
  return data.signedUrl;
}
