/* ============================================================
   THEME (dark/light mode) — one shared source of truth so every
   page agrees on the current theme and switching feels instant.
   ============================================================ */
export function getTheme() {
  return localStorage.getItem('fieldnote_theme') || 'light';
}
export function setTheme(theme) {
  localStorage.setItem('fieldnote_theme', theme);
  document.documentElement.setAttribute('data-theme', theme);
}
export function toggleTheme() {
  setTheme(getTheme() === 'dark' ? 'light' : 'dark');
}

const SUN_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>';
const MOON_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/></svg>';

export function themeIcon(theme) {
  // shows the icon for what you'd SWITCH TO, which is the common convention
  return theme === 'dark' ? SUN_ICON : MOON_ICON;
}

export function themeToggleHtml(idPrefix) {
  const theme = getTheme();
  return `<button class="account-btn" id="${idPrefix}ThemeBtn" onclick="window.__toggleTheme_${idPrefix}()" aria-label="Toggle dark mode">${themeIcon(theme)}</button>`;
}
