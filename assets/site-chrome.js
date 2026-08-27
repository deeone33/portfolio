import { supabase } from '../shared/supabaseClient.js';
import { isAdmin as checkIsAdmin } from '../shared/auth.js';

const PERSON_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.5-7 8-7s8 3 8 7"/></svg>';

const NAV_LINKS = [
  { href: 'work.html', label: {en:'Work',et:'Töö',ru:'Работы',sv:'Arbete'} },
  { href: 'services.html', label: {en:'Services',et:'Teenused',ru:'Услуги',sv:'Tjänster'} },
  { href: 'pricing.html', label: {en:'Pricing',et:'Hinnad',ru:'Цены',sv:'Priser'} },
];

const STRINGS = {
  startProject: {en:'Start a project',et:'Alusta projekti',ru:'Начать проект',sv:'Starta ett projekt'},
  admin: {en:'Admin',et:'Admin',ru:'Админ',sv:'Admin'},
  work: {en:'Work',et:'Töö',ru:'Работы',sv:'Arbete'},
  pricing: {en:'Pricing',et:'Hinnad',ru:'Цены',sv:'Priser'},
  contact: {en:'Contact',et:'Kontakt',ru:'Контакты',sv:'Kontakt'},
};

/* ---- shared language state, persisted so it carries across page loads ----
   NOTE: this only translates nav/footer/common UI strings. Each page's own
   body content (headings, paragraphs, forms) is still English-only — full
   per-page translation is a separate, bigger piece of work, not done here. */
export function getLang() {
  return localStorage.getItem('fieldnote_lang') || 'en';
}
export function setLang(lang) {
  localStorage.setItem('fieldnote_lang', lang);
  location.reload();
}
function t(field) {
  const lang = getLang();
  return field[lang] || field.en;
}
function flagSvg(l){
  const flags = {
    et:'<svg viewBox="0 0 20 14" width="18" height="13"><rect width="20" height="14" fill="#0072CE"/><rect width="20" height="4.66" fill="#000"/><rect y="9.33" width="20" height="4.66" fill="#fff"/></svg>',
    en:'<svg viewBox="0 0 20 14" width="18" height="13"><rect width="20" height="14" fill="#00247D"/><rect x="8" width="4" height="14" fill="#fff"/><rect y="5" width="20" height="4" fill="#fff"/><rect x="8.6" width="2.8" height="14" fill="#CF142B"/><rect y="5.6" width="20" height="2.8" fill="#CF142B"/></svg>',
    ru:'<svg viewBox="0 0 20 14" width="18" height="13"><rect width="20" height="4.66" fill="#fff"/><rect y="4.66" width="20" height="4.66" fill="#0039A6"/><rect y="9.33" width="20" height="4.66" fill="#D52B1E"/></svg>',
    sv:'<svg viewBox="0 0 20 14" width="18" height="13"><rect width="20" height="14" fill="#006AA7"/><rect x="6" width="3" height="14" fill="#FECC00"/><rect y="5.5" width="20" height="3" fill="#FECC00"/></svg>'
  };
  return flags[l] || flags.en;
}
function langName(l){ return {et:'Eesti',en:'English',ru:'Русский',sv:'Svenska'}[l]; }

export async function renderHeader(activePath) {
  const el = document.getElementById('site-header');
  if (!el) return;

  const { data: { user } } = await supabase.auth.getUser();
  const admin = user ? await checkIsAdmin(user.id) : false;

  const navHtml = NAV_LINKS.map(l =>
    `<a class="link ${activePath === l.href ? 'current' : ''}" href="${l.href}">${t(l.label)}</a>`
  ).join('');

  const adminLink = admin ? `<a class="link" href="admin-orders.html" style="font-weight:700;">${t(STRINGS.admin)}</a>` : '';

  const accountMenu = user ? `
    <div class="lang" id="chromeAccountSwitch" style="position:relative;">
      <button class="account-btn" onclick="document.getElementById('chromeAccountSwitch').classList.toggle('open')" aria-label="Account">${PERSON_ICON}</button>
      <div class="lang-menu" style="position:absolute; top:calc(100% + 8px); right:0; background:#fff; border:1px solid var(--hair); border-radius:10px; padding:6px; display:none; min-width:160px; box-shadow:0 12px 30px -10px var(--shadow); z-index:50;">
        <a href="account.html" style="display:block; text-decoration:none; color:inherit; padding:9px 10px; border-radius:6px; font-size:13.5px; font-weight:500;">My account</a>
        <a href="account.html" style="display:block; text-decoration:none; color:inherit; padding:9px 10px; border-radius:6px; font-size:13.5px; font-weight:500;">Orders</a>
        <div onclick="window.__accountSignOut()" style="padding:9px 10px; border-radius:6px; font-size:13.5px; font-weight:500; cursor:pointer; color:#A1352A;">Log out</div>
      </div>
    </div>
    <style>#chromeAccountSwitch.open .lang-menu{display:block !important;} #chromeAccountSwitch .lang-menu a:hover, #chromeAccountSwitch .lang-menu div:hover{background:var(--hair);}</style>`
    : `<a class="account-btn" href="login.html" aria-label="Account">${PERSON_ICON}</a>`;

  el.innerHTML = `
    <header class="site">
      <a class="logo" href="index.html">field<span class="dot">·</span>note</a>
      <nav class="site">
        ${navHtml}
        ${adminLink}
        <div class="lang" id="chromeLangSwitch" style="position:relative;">
          <button onclick="document.getElementById('chromeLangSwitch').classList.toggle('open')" style="display:flex; align-items:center; gap:6px; background:none; border:none; cursor:pointer; padding:6px; border-radius:8px;">
            ${flagSvg(getLang())}
          </button>
          <div class="lang-menu" style="position:absolute; top:calc(100% + 8px); right:0; background:#fff; border:1px solid var(--hair); border-radius:10px; padding:6px; display:none; min-width:140px; box-shadow:0 12px 30px -10px var(--shadow); z-index:50;">
            ${['et','en','ru','sv'].map(l => `<div onclick="window.__setChromeLang('${l}')" style="display:flex; align-items:center; gap:10px; padding:9px 10px; border-radius:6px; font-size:13.5px; font-weight:500; cursor:pointer; ${l===getLang()?'color:var(--coral); font-weight:700;':''}">${flagSvg(l)} ${langName(l)}</div>`).join('')}
          </div>
        </div>
        ${accountMenu}
        <a class="cta" href="start-project.html">${t(STRINGS.startProject)}</a>
      </nav>
    </header>
    <style>#chromeLangSwitch.open .lang-menu{display:block !important;}</style>`;

  window.__setChromeLang = setLang;
  window.__accountSignOut = async () => { await supabase.auth.signOut(); window.location.href = 'index.html'; };
}

export function renderFooter() {
  const el = document.getElementById('site-footer');
  if (!el) return;
  el.innerHTML = `
    <footer class="site">
      <span>© Fieldnote Studio</span>
      <div>
        <a href="work.html">${t(STRINGS.work)}</a>
        <a href="pricing.html">${t(STRINGS.pricing)}</a>
        <a href="quote.html">${t(STRINGS.contact)}</a>
      </div>
    </footer>`;
}
