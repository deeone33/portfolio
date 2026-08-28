import { supabase } from './supabaseClient.js';

function getSessionId() {
  let sid = sessionStorage.getItem('fieldnote_session');
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem('fieldnote_session', sid);
  }
  return sid;
}

function throttle(fn, ms) {
  let last = 0;
  return (...args) => {
    const now = Date.now();
    if (now - last >= ms) { last = now; fn(...args); }
  };
}

async function logEvent(fields) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('analytics_events').insert({
      session_id: getSessionId(),
      user_id: user?.id || null,
      ...fields
    });
  } catch (err) {
    // Analytics should never break the page it's running on.
    console.warn('analytics event failed silently:', err);
  }
}

export function trackPageview(pagePath) {
  logEvent({ event_type: 'pageview', page_path: pagePath, referrer: document.referrer || null });
}

// Fires once per 25% scroll milestone reached (25/50/75/100), rather than
// trying to capture a single "final" value on page exit — exit-time events
// are unreliable (the page can be gone before the request completes), so
// logging each milestone as it's crossed is the more robust approach.
export function trackScrollDepth(pagePath) {
  const thresholds = [25, 50, 75, 100];
  const sent = new Set();
  function check() {
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const percent = docHeight > 0 ? Math.min(100, Math.round((window.scrollY / docHeight) * 100)) : 100;
    thresholds.forEach(t => {
      if (percent >= t && !sent.has(t)) {
        sent.add(t);
        logEvent({ event_type: 'scroll_depth', page_path: pagePath, scroll_percent: t });
      }
    });
  }
  window.addEventListener('scroll', throttle(check, 600), { passive: true });
  check(); // covers short pages that are already "100% visible" with no scrolling
}

// Hooks Supabase's own sign-in event rather than trying to detect login
// success from each individual login method (email, Google, signup) —
// this fires uniformly regardless of how the session started, including
// completing an OAuth redirect. A sessionStorage flag prevents double-
// counting if this ever fires more than once in the same browser session.
export function initLoginTracking() {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      if (sessionStorage.getItem('fieldnote_login_tracked') === 'true') return;
      sessionStorage.setItem('fieldnote_login_tracked', 'true');
      logEvent({ event_type: 'login', page_path: window.location.pathname });
    }
  });
}

/* ============================================================
   ADMIN QUERIES — aggregated client-side from recent raw events.
   Fine for the traffic volumes this site will see; if that ever changes,
   swap this for a proper SQL view/RPC without touching the callers.
   ============================================================ */
export async function getAnalyticsSummary(daysBack = 30) {
  const since = new Date(Date.now() - daysBack * 86400000).toISOString();
  const { data, error } = await supabase
    .from('analytics_events')
    .select('*')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(5000);
  if (error) throw error;

  const pageviews = data.filter(e => e.event_type === 'pageview');
  const scrolls = data.filter(e => e.event_type === 'scroll_depth');
  const logins = data.filter(e => e.event_type === 'login');

  const uniqueSessions = new Set(data.map(e => e.session_id)).size;

  const pageCounts = {};
  pageviews.forEach(e => { pageCounts[e.page_path] = (pageCounts[e.page_path] || 0) + 1; });
  const topPages = Object.entries(pageCounts).sort((a,b) => b[1]-a[1]).slice(0, 8);

  const scrollByPage = {};
  scrolls.forEach(e => {
    if (!scrollByPage[e.page_path]) scrollByPage[e.page_path] = { 25:0, 50:0, 75:0, 100:0, sessions: new Set() };
    scrollByPage[e.page_path][e.scroll_percent]++;
    scrollByPage[e.page_path].sessions.add(e.session_id);
  });

  return {
    totalPageviews: pageviews.length,
    uniqueSessions,
    totalLogins: logins.length,
    recentLogins: logins.slice(0, 10),
    topPages,
    scrollByPage,
    daysBack,
  };
}
