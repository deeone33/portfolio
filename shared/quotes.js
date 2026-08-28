import { supabase } from './supabaseClient.js';

export async function getQuoteRequests() {
  const { data, error } = await supabase
    .from('quote_requests')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function updateQuoteStatus(id, status) {
  const { error } = await supabase.from('quote_requests').update({ status }).eq('id', id);
  if (error) throw error;
}
