import { supabase } from './supabaseClient.js';

// Full absolute URL of "wherever this site is currently deployed", including
// any GitHub Pages subpath — window.location.origin alone would drop that
// subpath, which would break redirectTo on a project-pages deployment.
function siteBase() {
  return window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
}

// -------------------- SESSION --------------------
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function isAdmin(userId) {
  if (!userId) return false;
  const { data, error } = await supabase.from('admin_users').select('user_id').eq('user_id', userId).maybeSingle();
  if (error) { console.error(error); return false; }
  return !!data;
}

export function onAuthChange(callback) {
  supabase.auth.onAuthStateChange((_event, session) => callback(session?.user || null));
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.href = 'index.html';
}

// -------------------- EMAIL / PASSWORD --------------------
export async function signUpWithEmail(email, password, fullName) {
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { full_name: fullName } }
  });
  return { data, error };
}

export async function signInWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { data, error };
}

export async function sendPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: siteBase() + 'login.html?mode=reset'
  });
  return { error };
}

export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return { error };
}

// -------------------- GOOGLE --------------------
export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: siteBase() + 'account.html' }
  });
  return { error };
}

// -------------------- ROUTE GUARDS --------------------
// Call at the top of any page that requires a logged-in user.
// Redirects to login.html (with a return path) if not signed in.
export async function requireLogin() {
  const user = await getCurrentUser();
  if (!user) {
    const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `login.html?returnTo=${returnTo}`;
    return null;
  }
  return user;
}

// Call at the top of any admin page. Redirects non-admins to the homepage.
export async function requireAdmin() {
  const user = await requireLogin();
  if (!user) return null;
  const admin = await isAdmin(user.id);
  if (!admin) {
    alert("This area is for staff only.");
    window.location.href = 'index.html';
    return null;
  }
  return user;
}
