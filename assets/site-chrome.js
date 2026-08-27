import { supabase } from '../shared/supabaseClient.js';

const PERSON_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.5-7 8-7s8 3 8 7"/></svg>';

const NAV_LINKS = [
  { href: 'work.html', label: 'Work' },
  { href: 'services.html', label: 'Services' },
  { href: 'pricing.html', label: 'Pricing' },
];

export async function renderHeader(activePath) {
  const el = document.getElementById('site-header');
  if (!el) return;

  const { data: { user } } = await supabase.auth.getUser();
  const accountHref = user ? 'account.html' : 'login.html';

  const navHtml = NAV_LINKS.map(l =>
    `<a class="link ${activePath === l.href ? 'current' : ''}" href="${l.href}">${l.label}</a>`
  ).join('');

  el.innerHTML = `
    <header class="site">
      <a class="logo" href="index.html">field<span class="dot">·</span>note</a>
      <nav class="site">
        ${navHtml}
        <a class="account-btn" href="${accountHref}" aria-label="Account">${PERSON_ICON}</a>
        <a class="cta" href="start-project.html">Start a project</a>
      </nav>
    </header>`;
}

export function renderFooter() {
  const el = document.getElementById('site-footer');
  if (!el) return;
  el.innerHTML = `
    <footer class="site">
      <span>© Fieldnote Studio</span>
      <div>
        <a href="work.html">Work</a>
        <a href="pricing.html">Pricing</a>
        <a href="quote.html">Contact</a>
      </div>
    </footer>`;
}
