// ============================================================
// Supabase project connection — filled in for the fieldnote project.
// The anon key is safe to expose in browser code — it's the public key
// that row-level security policies constrain, not a secret.
// ============================================================
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://nkiulgfqrkwnumhyqwnh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_dlp8p_YpckPGGz6S3gDMzQ_wuA6FfK7';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
