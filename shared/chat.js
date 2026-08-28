import { supabase } from './supabaseClient.js';

const SESSION_KEY = 'fieldnote_chat_session_id';

/* ============================================================
   SESSION — every visitor (logged in or anonymous) needs a real
   auth.uid() for RLS to keep chats private between visitors. Logged-in
   customers use their real account; anonymous visitors get a lightweight
   Supabase Anonymous Sign-In identity the first time they open the widget.
   ============================================================ */
export async function getOrCreateSession(visitorName, visitorEmail) {
  let { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      throw new Error(
        "Couldn't start a chat session — this usually means Anonymous Sign-In " +
        "isn't enabled yet in Supabase (Authentication > Sign In / Providers)."
      );
    }
    user = data.user;
  }

  const existingId = sessionStorage.getItem(SESSION_KEY);
  if (existingId) {
    const { data: existing } = await supabase.from('chat_sessions').select('*').eq('id', existingId).maybeSingle();
    if (existing && existing.status === 'open') return existing;
  }

  const { data: created, error: createErr } = await supabase.from('chat_sessions').insert({
    visitor_id: user.id,
    visitor_name: visitorName || user.user_metadata?.full_name || null,
    visitor_email: visitorEmail || user.email || null,
  }).select().single();
  if (createErr) throw createErr;

  sessionStorage.setItem(SESSION_KEY, created.id);
  return created;
}

export async function getMessages(sessionId) {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function sendMessage(sessionId, senderRole, body) {
  const { error } = await supabase.from('chat_messages').insert({ session_id: sessionId, sender_role: senderRole, body });
  if (error) throw error;
  await supabase.from('chat_sessions').update({ last_message_at: new Date().toISOString() }).eq('id', sessionId);

  // Broadcast for instant delivery to whoever's watching this session live.
  // The DB insert above is the real source of truth — this is purely a
  // UX nicety so an open chat window updates without polling or waiting
  // on a page refresh.
  supabase.channel(`chat:${sessionId}`).send({
    type: 'broadcast', event: 'message', payload: { sender_role: senderRole, body, created_at: new Date().toISOString() }
  });
}

export function subscribeToMessages(sessionId, onMessage) {
  const channel = supabase.channel(`chat:${sessionId}`)
    .on('broadcast', { event: 'message' }, (msg) => onMessage(msg.payload))
    .subscribe();
  return () => supabase.removeChannel(channel);
}

/* ============================================================
   LIVE TYPING PREVIEW — broadcasts the current (uncommitted) input value
   on every keystroke, throttled. Never touches the database; if nobody's
   watching, it simply goes nowhere.
   ============================================================ */
export function broadcastTyping(sessionId, text) {
  supabase.channel(`chat:${sessionId}`).send({
    type: 'broadcast', event: 'typing', payload: { text }
  });
}
export function subscribeToTyping(sessionId, onTyping) {
  const channel = supabase.channel(`chat:${sessionId}`)
    .on('broadcast', { event: 'typing' }, (msg) => onTyping(msg.payload.text))
    .subscribe();
  return () => supabase.removeChannel(channel);
}

/* ============================================================
   ADMIN PRESENCE — lets the public widget know whether to offer live
   chat or fall back to "leave a message." An admin's open Chat tab
   tracks itself as present; everyone else just listens.
   ============================================================ */
let presenceChannel = null;
export function announceAdminPresence() {
  presenceChannel = supabase.channel('admin-presence', { config: { presence: { key: crypto.randomUUID() } } });
  presenceChannel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') await presenceChannel.track({ online_at: new Date().toISOString() });
  });
  window.addEventListener('beforeunload', () => { if (presenceChannel) supabase.removeChannel(presenceChannel); });
}
export function subscribeAdminOnlineStatus(onChange) {
  const channel = supabase.channel('admin-presence', { config: { presence: { key: crypto.randomUUID() } } });
  channel
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      onChange(Object.keys(state).length > 0);
    })
    .subscribe();
  return () => supabase.removeChannel(channel);
}

/* ============================================================
   ADMIN — session list across all visitors
   ============================================================ */
export async function getOpenSessions() {
  const { data, error } = await supabase
    .from('chat_sessions')
    .select('*, chat_messages(*)')
    .order('last_message_at', { ascending: false });
  if (error) throw error;
  return data;
}
export async function closeSession(sessionId) {
  const { error } = await supabase.from('chat_sessions').update({ status: 'closed' }).eq('id', sessionId);
  if (error) throw error;
}

/* ============================================================
   PUBLIC WIDGET — floating bubble, bottom-right. Call mountChatWidget()
   once per page. Everything (markup, styling via existing theme
   variables, and behavior) is self-contained here.
   ============================================================ */
export function mountChatWidget() {
  const root = document.createElement('div');
  root.id = 'fnchat-root';
  root.innerHTML = `
    <style>
      #fnchat-bubble{ position:fixed; bottom:22px; right:22px; width:54px; height:54px; border-radius:50%; background:var(--coral); color:var(--oncoral); border:none; cursor:pointer; box-shadow:0 10px 26px -8px rgba(0,0,0,.35); display:flex; align-items:center; justify-content:center; z-index:400; }
      #fnchat-bubble svg{ width:24px; height:24px; }
      #fnchat-panel{ position:fixed; bottom:88px; right:22px; width:320px; max-height:460px; background:var(--ink2); border:1px solid var(--hair); border-radius:16px; box-shadow:0 20px 50px -15px rgba(0,0,0,.4); display:none; flex-direction:column; z-index:400; overflow:hidden; }
      #fnchat-panel.open{ display:flex; }
      #fnchat-head{ padding:14px 16px; background:var(--paper); color:var(--ink); font-weight:700; font-size:13.5px; display:flex; justify-content:space-between; align-items:center; flex-shrink:0; }
      #fnchat-head .status{ font-size:11px; font-weight:600; opacity:.75; }
      #fnchat-head button{ background:none; border:none; color:inherit; cursor:pointer; font-size:15px; }
      #fnchat-body{ flex:1; overflow-y:auto; padding:14px; font-size:13px; }
      .fnchat-msg{ margin-bottom:10px; max-width:85%; padding:8px 11px; border-radius:10px; line-height:1.4; }
      .fnchat-msg.visitor{ background:var(--coral); color:var(--oncoral); margin-left:auto; border-bottom-right-radius:2px; }
      .fnchat-msg.admin{ background:#fff; border:1px solid var(--hair); margin-right:auto; border-bottom-left-radius:2px; }
      [data-theme="dark"] .fnchat-msg.admin{ background:var(--ink); }
      .fnchat-msg.pending{ opacity:.55; }
      .fnchat-msg.failed{ background:#FBEDEA; color:#A1352A; border:1px solid #E2A79C; }
      #fnchat-gate{ padding:16px; font-size:13px; }
      #fnchat-gate p{ color:var(--mute); margin-bottom:12px; }
      #fnchat-gate input{ width:100%; padding:9px 10px; border:1px solid var(--hair); border-radius:8px; font-size:13px; font-family:inherit; margin-bottom:8px; background:#fff; color:var(--paper); }
      [data-theme="dark"] #fnchat-gate input{ background:var(--ink); }
      #fnchat-gate button{ width:100%; padding:10px; border-radius:8px; border:none; background:var(--paper); color:var(--ink); font-weight:700; font-size:13px; cursor:pointer; margin-top:4px; }
      #fnchat-gate-error{ color:#A1352A; font-size:12px; margin-top:6px; display:none; }
      #fnchat-inputrow{ display:none; gap:8px; padding:10px; border-top:1px solid var(--hair); flex-shrink:0; }
      #fnchat-inputrow input{ flex:1; padding:8px 10px; border:1px solid var(--hair); border-radius:100px; font-size:13px; font-family:inherit; background:#fff; color:var(--paper); }
      [data-theme="dark"] #fnchat-inputrow input{ background:var(--ink); }
      #fnchat-inputrow button{ width:36px; height:36px; border-radius:50%; border:none; background:var(--coral); color:var(--oncoral); cursor:pointer; flex-shrink:0; }
    </style>
    <button id="fnchat-bubble" aria-label="Chat with us">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
    </button>
    <div id="fnchat-panel">
      <div id="fnchat-head">
        <span>Chat with Fieldnote</span>
        <span style="display:flex; align-items:center; gap:8px;">
          <span class="status" id="fnchat-status">…</span>
          <button id="fnchat-close">✕</button>
        </span>
      </div>
      <div id="fnchat-body" style="display:none;"></div>
      <div id="fnchat-gate">
        <p id="fnchat-gate-msg">Quick intro before we chat:</p>
        <input type="text" id="fnchat-name" placeholder="Your name">
        <input type="email" id="fnchat-email" placeholder="Your email">
        <button id="fnchat-gate-btn">Start chat</button>
        <div id="fnchat-gate-error"></div>
      </div>
      <div id="fnchat-inputrow">
        <input type="text" id="fnchat-input" placeholder="Type a message...">
        <button id="fnchat-send" aria-label="Send">→</button>
      </div>
    </div>
  `;
  document.body.appendChild(root);

  let session = null;
  let adminOnline = false;

  subscribeAdminOnlineStatus((online) => {
    adminOnline = online;
    document.getElementById('fnchat-status').textContent = online ? '🟢 Online' : '⚪ Offline';
    const gateMsg = document.getElementById('fnchat-gate-msg');
    if (!session) gateMsg.textContent = online ? 'Quick intro before we chat:' : "We're offline right now — leave your info and a message and we'll get back to you:";
  });

  document.getElementById('fnchat-bubble').addEventListener('click', () => {
    document.getElementById('fnchat-panel').classList.toggle('open');
  });
  document.getElementById('fnchat-close').addEventListener('click', () => {
    document.getElementById('fnchat-panel').classList.remove('open');
  });

  function renderMessage(msg, opts) {
    const body = document.getElementById('fnchat-body');
    const el = document.createElement('div');
    el.className = `fnchat-msg ${msg.sender_role} ${opts?.pending ? 'pending' : ''} ${opts?.failed ? 'failed' : ''}`;
    el.textContent = opts?.failed ? `${msg.body} — failed to send, try again` : msg.body;
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
    return el;
  }

  // ---- the gate: name + email required exactly once, before anything else ----
  // Calling getOrCreateSession() from a single explicit action here (rather
  // than lazily from both the typing handler AND the send handler, which is
  // what the previous version did) is what actually fixes chat reliability —
  // those two independent lazy-creation paths could race each other and
  // create duplicate, empty, orphaned sessions.
  document.getElementById('fnchat-gate-btn').addEventListener('click', async () => {
    const name = document.getElementById('fnchat-name').value.trim();
    const email = document.getElementById('fnchat-email').value.trim();
    const errEl = document.getElementById('fnchat-gate-error');
    errEl.style.display = 'none';
    if (!name || !email) {
      errEl.textContent = 'Both name and email are required.';
      errEl.style.display = 'block';
      return;
    }
    try {
      session = await getOrCreateSession(name, email);
      document.getElementById('fnchat-gate').style.display = 'none';
      document.getElementById('fnchat-body').style.display = 'block';
      document.getElementById('fnchat-inputrow').style.display = 'flex';
      const existing = await getMessages(session.id);
      existing.forEach(m => renderMessage(m));
      subscribeToMessages(session.id, (msg) => renderMessage(msg));
      document.getElementById('fnchat-input').focus();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
    }
  });

  const input = document.getElementById('fnchat-input');
  input.addEventListener('input', () => {
    if (session) broadcastTyping(session.id, input.value);
  });

  async function doSend() {
    if (!session) return; // gate guarantees this shouldn't happen, but stay safe
    const body = input.value.trim();
    if (!body) return;
    input.value = '';
    broadcastTyping(session.id, '');
    const el = renderMessage({ sender_role: 'visitor', body }, { pending: true });
    try {
      await sendMessage(session.id, 'visitor', body);
      el.classList.remove('pending');
    } catch (err) {
      el.classList.remove('pending');
      el.classList.add('failed');
      console.error('chat send failed:', err);
    }
  }
  document.getElementById('fnchat-send').addEventListener('click', doSend);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSend(); });
}
