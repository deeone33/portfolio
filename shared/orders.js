import { supabase } from './supabaseClient.js';

export const PLANS = {
  starter:   { label: 'Starter',    price_cents: 45000,  currency: 'eur' },
  standard:  { label: 'Standard',   price_cents: 120000, currency: 'eur' },
  fullbuild: { label: 'Full Build', price_cents: 290000, currency: 'eur' }
};

// Add-on services a customer can attach to an existing project. These are
// real orders under the hood — they go through the exact same Stripe
// Checkout flow as a main package, just with a different plan_key/price.
export const ADDONS = {
  hosting:          { label: 'Hosting Setup (1 year)',       price_cents: 12000, currency: 'eur' },
  domain:           { label: 'Domain Registration (1 year)', price_cents: 3500,  currency: 'eur' },
  extra_page:       { label: 'Additional Page',              price_cents: 15000, currency: 'eur' },
  extra_revision:   { label: 'Extra Revision Round',         price_cents: 8000,  currency: 'eur' },
  priority_support: { label: 'Priority Support (1 month)',   price_cents: 10000, currency: 'eur' },
};

// Maps an order's status to a position in a 4-stage visual progress tracker.
// -1 is used for 'cancelled' so the UI can show a distinct cancelled state
// instead of a stepper.
export function progressStage(status) {
  const map = { pending_payment: 0, paid: 1, in_progress: 2, delivered: 3 };
  return status in map ? map[status] : -1;
}
export const PROGRESS_STAGES = ['Payment', 'Design', 'Build', 'Delivered'];

export function formatMoney(cents, currency) {
  return new Intl.NumberFormat('en', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100);
}

async function createOrderAndCheckout(userId, planKey, planLabel, priceCents, currency, notes) {
  const { data: order, error } = await supabase.from('orders').insert({
    user_id: userId,
    plan_key: planKey,
    plan_label: planLabel,
    price_cents: priceCents,
    currency,
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

// Creates the order row, THEN calls the create-checkout-session Edge Function
// to get a Stripe Checkout URL and redirects there. Payment isn't recorded as
// complete until Stripe's webhook confirms it — see supabase/functions/.
export async function startCheckout(userId, planKey, notes) {
  const plan = PLANS[planKey];
  if (!plan) throw new Error('Unknown plan: ' + planKey);
  return createOrderAndCheckout(userId, planKey, plan.label, plan.price_cents, plan.currency, notes);
}

// Same idea as startCheckout, but for an add-on service rather than a main
// package. Reuses the identical Stripe flow — no Edge Function changes needed.
export async function startAddonCheckout(userId, addonKey, notes) {
  const addon = ADDONS[addonKey];
  if (!addon) throw new Error('Unknown add-on: ' + addonKey);
  return createOrderAndCheckout(userId, 'addon:' + addonKey, addon.label, addon.price_cents, addon.currency, notes);
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
  if (error) {
    console.error('getAllOrders failed:', error);
    throw new Error(`Could not load orders: ${error.message} (code: ${error.code || 'unknown'})`);
  }
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

// Allowlist, not a blocklist — you can't enumerate every dangerous file
// type that might exist, but you CAN enumerate the handful of types a
// small business actually needs to send/receive. SVG is deliberately
// excluded (can embed scripts); archives are excluded too (can hide
// anything inside them, including executables).
const ALLOWED_EXTENSIONS = ['pdf','doc','docx','odt','txt','rtf','xls','xlsx','csv','ods','ppt','pptx','jpg','jpeg','png','gif','webp'];
const ALLOWED_MIME_TYPES = [
  'application/pdf','application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.oasis.opendocument.text','text/plain','application/rtf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv','application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg','image/png','image/gif','image/webp'
];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

function validateFile(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error(`".${ext}" files aren't allowed. Allowed: documents (PDF, Word, text), spreadsheets (Excel, CSV), presentations (PowerPoint), and images (JPG, PNG, GIF, WebP).`);
  }
  // A file's declared MIME type can be empty/generic for some office formats
  // depending on OS, so only reject on a MISMATCH when one is actually
  // present — not just because it's unset.
  if (file.type && !ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error(`This file's type ("${file.type}") doesn't match an allowed file type.`);
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File is too large (${(file.size/1024/1024).toFixed(1)}MB) — 20MB max.`);
  }
}

export async function uploadDeliverable(orderId, file, uploadedBy) {
  validateFile(file);
  const path = `${orderId}/${Date.now()}-${file.name}`;
  const { error: upErr } = await supabase.storage.from('deliverables').upload(path, file);
  if (upErr) throw upErr;
  const { error: dbErr } = await supabase.from('order_files').insert({
    order_id: orderId, file_path: path, file_name: file.name, uploaded_by: uploadedBy, uploaded_by_role: 'staff'
  });
  if (dbErr) throw dbErr;
}

// Customer-side upload — same storage bucket, but tagged as a customer
// upload so the UI can show it separately from staff deliverables, and
// gated by a dedicated RLS policy scoped to the customer's own order.
export async function uploadCustomerFile(orderId, file, userId) {
  validateFile(file);
  const path = `${orderId}/${Date.now()}-${file.name}`;
  const { error: upErr } = await supabase.storage.from('deliverables').upload(path, file);
  if (upErr) throw upErr;
  const { error: dbErr } = await supabase.from('order_files').insert({
    order_id: orderId, file_path: path, file_name: file.name, uploaded_by: userId, uploaded_by_role: 'customer'
  });
  if (dbErr) throw dbErr;
}

export async function getDownloadUrl(filePath) {
  const { data, error } = await supabase.storage.from('deliverables').createSignedUrl(filePath, 60 * 10); // 10 min link
  if (error) throw error;
  return data.signedUrl;
}

