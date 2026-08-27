import { supabase } from './supabaseClient.js';

/* ============================================================
   ICON LIBRARY — same set used on the homepage, so icon choice
   feels consistent across the whole site.
   ============================================================ */
export const ICONS = {
  palette: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2a10 10 0 1 0 0 20c1.5 0 2-1 2-2s-.5-1.5-1-2 .5-2 2-2h1a4 4 0 0 0 4-4 8 8 0 0 0-8-10z"/><circle cx="7.5" cy="10.5" r="1.2" fill="currentColor" stroke="none"/><circle cx="11" cy="7" r="1.2" fill="currentColor" stroke="none"/><circle cx="16" cy="9" r="1.2" fill="currentColor" stroke="none"/></svg>',
  wrench: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14.7 6.3a4 4 0 0 1-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 1 5.4-5.4L21 6l-3-3-3.3 3.3z"/></svg>',
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 4 6 4 9s-1.5 6.4-4 9c-2.5-2.6-4-6-4-9s1.5-6.4 4-9z"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20V10M12 20V4M20 20v-7"/></svg>',
  tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12.6 2H4v8.6L14 20.6a2 2 0 0 0 2.8 0l5.8-5.8a2 2 0 0 0 0-2.8L12.6 2z"/><circle cx="8" cy="7" r="1.3" fill="currentColor" stroke="none"/></svg>',
  clipboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="4" width="14" height="17" rx="2"/><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M8.5 12h7M8.5 16h5"/></svg>',
  rocket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14.5 3.5c2 0 6 1.5 6 6.5s-6 10-6 10-2-.5-4-2.5-2.5-4-2.5-4 5.5-4 6.5-10z"/><path d="M9 16l-4 1 1-4M15 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/></svg>',
  layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2 2 8l10 6 10-6-10-6zM2 14l10 6 10-6M2 11l10 6 10-6"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5l-8-3z"/><path d="M9 12l2 2 4-4"/></svg>',
  code: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 8 3 12l5 4M16 8l5 4-5 4M14 5l-4 14"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M7 10V7a5 5 0 0 1 10 0v3"/></svg>',
  cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="20" r="1.4" fill="currentColor" stroke="none"/><circle cx="17" cy="20" r="1.4" fill="currentColor" stroke="none"/><path d="M2 3h3l2.5 12h10L20 7H6"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6"/><circle cx="17.5" cy="9" r="2.6"/><path d="M15.5 20c.2-2.6 1.8-4.6 4-5.4"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21s-7-4.5-9.5-9C.5 8 2 4 6 4c2.3 0 3.7 1.3 4.5 2.5 0 0 .5-.5 1.5-.5C15.5 6 20 8.5 20 12c0 4.5-8 9-8 9z"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/></svg>',
  database: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/></svg>',
};
export function iconSvg(key){ return ICONS[key] || ICONS.layers; }

export const TINT_PRESETS = ['#B85C42','#4C7A52','#3D6690','#9C7A2E','#6C5A94','#B14A6E'];

export function iconBadgeAttrs(item, idx, baseClass){
  if (item.tint === 'none') return `class="${baseClass}" style="background:#EEF0F2;border-color:#D8DCE1;color:#5B6169;"`;
  if (item.tint) return `class="${baseClass}" style="background:color-mix(in srgb, ${item.tint} 18%, white);border-color:color-mix(in srgb, ${item.tint} 35%, white);color:${item.tint};"`;
  const c = TINT_PRESETS[idx % TINT_PRESETS.length];
  return `class="${baseClass}" style="background:color-mix(in srgb, ${c} 18%, white);border-color:color-mix(in srgb, ${c} 35%, white);color:${c};"`;
}

export function tintPickerHtml(item, setterFnName){
  const swatches = TINT_PRESETS.map(p =>
    `<button type="button" onclick="${setterFnName}('${p}')" style="width:24px;height:24px;border-radius:50%;border:2px solid ${item.tint===p?'#1E2126':'transparent'};background:${p};cursor:pointer;padding:0;"></button>`
  ).join('');
  return `
    <div style="display:flex; gap:7px; flex-wrap:wrap; align-items:center; margin-bottom:8px;">
      ${swatches}
      <button type="button" onclick="${setterFnName}('none')" style="width:24px;height:24px;border-radius:50%;border:2px solid ${item.tint==='none'?'#1E2126':'#D8DCE1'};background:#EEF0F2;cursor:pointer;padding:0;" title="No color"></button>
      <input type="color" value="${item.tint&&item.tint!=='none'?item.tint:'#35414F'}" oninput="${setterFnName}(this.value)" style="width:28px;height:24px;padding:0;border:1px solid #D8DCE1;border-radius:6px;cursor:pointer;">
    </div>`;
}

export function iconPickerHtml(currentIcon, setterFnName){
  return `<div class="icon-picker">${Object.keys(ICONS).map(k =>
    `<button type="button" class="${currentIcon===k?'on':''}" onclick="${setterFnName}('${k}')">${ICONS[k]}</button>`
  ).join('')}</div>`;
}

/* ============================================================
   GENERIC FIELD PATH RESOLVER
   Works against ANY root object — e.g. "blocks[b1].cards[c2].title"
   ============================================================ */
function stepInto(obj, seg){
  const m = seg.match(/^(\w+)\[([\w-]+)\]$/);
  if (m) return obj[m[1]].find(x=>x.id===m[2]);
  if (/^\d+$/.test(seg)) return obj[Number(seg)];
  return obj[seg];
}
function resolveFieldPath(root, pathStr){
  const segs = pathStr.split('.');
  let obj = root;
  for (let i=0;i<segs.length-1;i++) obj = stepInto(obj, segs[i]);
  return { parent: obj, key: segs[segs.length-1] };
}
export function getFieldValue(root, pathStr, lang){
  const {parent,key} = resolveFieldPath(root, pathStr);
  const val = parent[key];
  if (val && typeof val === 'object') return val[lang] || val.en || '';
  return val;
}
export function setFieldValue(root, pathStr, lang, newVal){
  const {parent,key} = resolveFieldPath(root, pathStr);
  const val = parent[key];
  if (val && typeof val === 'object') val[lang] = newVal;
  else parent[key] = newVal;
}
export function getByPath(root, pathStr){
  return pathStr.split('.').reduce((o,k)=>o[k], root);
}

/* ============================================================
   INLINE CLICK-TO-EDIT
   Call bindInlineEditing() ONCE per page. It reads canEdit()/getRoot()/
   getLang() fresh on every click, so the host page's state can change
   (e.g. edit mode toggled) without re-binding anything.
   ============================================================ */
export function bindInlineEditing({ canEdit, getRoot, getLang, onChanged }){
  document.addEventListener('click', function(e){
    if (!canEdit()) return;
    if (e.target.closest('.edit-pencil')) return;
    if (e.target.closest('.cms-panel') || e.target.closest('.modal')) return;
    const target = e.target.closest('[data-editpath]');
    if (!target || target.isContentEditable) return;
    if (target.closest('a')) e.preventDefault();
    beginInlineEdit(target, getRoot, getLang, onChanged);
  });
}
function beginInlineEdit(el, getRoot, getLang, onChanged){
  const path = el.dataset.editpath;
  const pencil = el.querySelector('.edit-pencil');
  if (pencil) pencil.remove();
  let cancelled = false;
  el.contentEditable = 'true';
  el.classList.add('inline-editing');
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection();
  sel.removeAllRanges(); sel.addRange(range);

  function finish(){
    el.removeEventListener('blur', finish);
    el.removeEventListener('keydown', onKey);
    el.contentEditable = 'false';
    el.classList.remove('inline-editing');
    if (cancelled) { onChanged(false); return; }
    const text = el.textContent.trim();
    setFieldValue(getRoot(), path, getLang(), text);
    onChanged(true);
  }
  function onKey(ev){
    if (ev.key === 'Enter') { ev.preventDefault(); el.blur(); }
    if (ev.key === 'Escape') { cancelled = true; el.blur(); }
  }
  el.addEventListener('blur', finish);
  el.addEventListener('keydown', onKey);
}

/* ============================================================
   SUPABASE CONTENT STORE — same table the homepage now uses,
   distinguished by page_slug. No new SQL required.
   ============================================================ */
let cachedSiteId = null;
async function getSiteId(){
  if (cachedSiteId) return cachedSiteId;
  const { data, error } = await supabase.from('sites').select('id').eq('slug','fieldnote').maybeSingle();
  if (error) { console.error(error); return null; }
  if (!data) { console.warn("No 'fieldnote' row in sites table — run: insert into sites (slug) values ('fieldnote');"); return null; }
  cachedSiteId = data.id;
  return cachedSiteId;
}
export async function loadPageContent(pageSlug){
  const siteId = await getSiteId();
  if (!siteId) return null;
  const { data, error } = await supabase.from('page_content').select('content').eq('site_id', siteId).eq('page_slug', pageSlug).maybeSingle();
  if (error) { console.error(error); return null; }
  return data ? data.content : null;
}
export async function savePageContent(pageSlug, content){
  const siteId = await getSiteId();
  if (!siteId) throw new Error("Site not found. Run: insert into sites (slug) values ('fieldnote');");
  const { error } = await supabase.from('page_content').upsert(
    { site_id: siteId, page_slug: pageSlug, content, updated_at: new Date().toISOString() },
    { onConflict: 'site_id,page_slug' }
  );
  if (error) throw error;
}

/* ============================================================
   HIDDEN ELEMENTS DRAWER — generic across any page's collections
   ============================================================ */
export function collectHidden(collections){
  const out = [];
  collections.forEach(({ labelFn, items }) => {
    items.forEach(item => {
      if (item.hidden) out.push({ label: labelFn(item), unhide: () => { item.hidden = false; } });
    });
  });
  return out;
}
export function renderHiddenDrawerHtml(hiddenItems){
  if (!hiddenItems.length) return '<p style="color:#666;font-size:13px;padding:10px 0;">Nothing hidden right now.</p>';
  return hiddenItems.map((item, i) =>
    `<div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-top:1px solid var(--hair); font-size:13px;">
      <span>${item.label}</span>
      <button onclick="window.__restoreHidden(${i})" style="font-size:12px; font-weight:700; border:none; background:var(--admin); color:#fff; padding:6px 12px; border-radius:6px; cursor:pointer;">Restore</button>
    </div>`
  ).join('');
}

/* ============================================================
   LIVE-PREVIEW SECTION SPACING — same mechanism as the homepage:
   the slider updates the actual on-screen element directly via its
   id, not just a displayed number, so you see the move before saving.
   ============================================================ */
export function spacingPanelHtml(margin, targetElId, applyFnName){
  return `
    <label>Space above (px)</label>
    <input type="range" min="-40" max="160" value="${margin.mt}" oninput="document.getElementById('mtval').textContent=this.value; document.getElementById('${targetElId}').style.marginTop=this.value+'px';" id="f_mt">
    <div class="sub" id="mtval">${margin.mt}</div>
    <label>Space below (px)</label>
    <input type="range" min="-40" max="160" value="${margin.mb}" oninput="document.getElementById('mbval').textContent=this.value; document.getElementById('${targetElId}').style.marginBottom=this.value+'px';" id="f_mb">
    <div class="sub" id="mbval">${margin.mb}</div>
    <button class="go-btn" onclick="${applyFnName}()">Apply</button>
  `;
}
export function marginStyle(m){ return `margin-top:${m.mt}px; margin-bottom:${m.mb}px;`; }
