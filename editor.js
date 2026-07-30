/* ═══════════════════════════════════════════════════════════
   530 Spray Foam — content editor
   The customer-facing half of the admin: edit the words and
   photos on the public site without touching code.

   Scope is deliberately narrow — the things a contractor
   actually changes. Layout, colours and structure stay in code.
   ═══════════════════════════════════════════════════════════ */
(() => {
'use strict';
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ── schema: what is editable, and how ───────────────────────
   Adding a field here is all it takes to expose it in the UI. */
const SCHEMA = [
  { id: 'contact', icon: '📞', title: 'Contact details',
    hint: 'Shown in the header, the call bar, the footer and every "call us" link.',
    fields: [
      ['business.phone',   'Phone number', 'text'],
      ['business.email',   'Email', 'text'],
      ['business.license', 'License number', 'text'],
      ['business.hours',   'Hours', 'text'],
      ['business.city',    'City', 'text'],
      ['strip.a', 'Top bar — left', 'text'],
      ['strip.b', 'Top bar — middle', 'text'],
      ['strip.c', 'Top bar — right', 'text'],
      ['footer.blurb', 'Footer address block', 'textarea']
    ] },

  { id: 'hero', icon: '🏠', title: 'Front page headline',
    hint: 'The first thing a visitor reads. Three short lines work best — the third is in blue.',
    fields: [
      ['hero.eyebrow', 'Small line above the headline', 'text'],
      ['hero.line1', 'Headline line 1', 'text'],
      ['hero.line2', 'Headline line 2', 'text'],
      ['hero.line3', 'Headline line 3 (blue)', 'text'],
      ['hero.lede', 'Paragraph under the headline', 'textarea']
    ] },

  { id: 'numbers', icon: '📊', title: 'Numbers &amp; claims',
    hint: 'Every figure a customer might check. Keep these true — they read as factual claims.',
    list: 'kpis', listLabel: 'Headline stats', max: 3, min: 3,
    itemFields: [['value', 'Figure'], ['label', 'Caption']],
    fields: [
      ['trust.0.value', 'Trust bar 1 — figure', 'text'],
      ['trust.0.label', 'Trust bar 1 — caption', 'text'],
      ['trust.1.value', 'Trust bar 2 — figure', 'text'],
      ['trust.1.label', 'Trust bar 2 — caption', 'text'],
      ['trust.2.value', 'Trust bar 3 — figure', 'text'],
      ['trust.2.label', 'Trust bar 3 — caption', 'text'],
      ['band.figure', 'Big statistic', 'text'],
      ['band.heading', 'Big statistic — heading', 'text'],
      ['band.note', 'Big statistic — source note', 'textarea']
    ] },

  { id: 'photos', icon: '📸', title: 'Job photos',
    hint: 'Tap a slot to upload from your phone. Photos are resized automatically. These are what sell the job.',
    gallery: true },

  { id: 'reviews', icon: '⭐', title: 'Customer reviews',
    hint: 'Add reviews as they come in. Only publish words a customer actually said.',
    fields: [['reviews.score', 'Rating line', 'text']],
    list: 'reviews.items', listLabel: 'Reviews', max: 12,
    itemFields: [['quote', 'What they said', 'textarea'], ['who', 'Name, town']] },

  { id: 'services', icon: '🧴', title: 'Open vs closed cell',
    hint: 'The two service cards and the spec table.',
    fields: [
      ['foam.heading', 'Section heading', 'text'],
      ['foam.sub', 'Section intro', 'textarea'],
      ['foam.cards.0.name', 'Card 1 — name', 'text'],
      ['foam.cards.0.r', 'Card 1 — R-value', 'text'],
      ['foam.cards.0.body', 'Card 1 — description', 'textarea'],
      ['foam.cards.1.name', 'Card 2 — name', 'text'],
      ['foam.cards.1.r', 'Card 2 — R-value', 'text'],
      ['foam.cards.1.body', 'Card 2 — description', 'textarea'],
      ['foam.specNote', 'Note under the spec table', 'textarea']
    ] },

  { id: 'area', icon: '📍', title: 'Service area',
    hint: 'Towns shown on the map. Drag order is the list order; the first one is home base.',
    fields: [
      ['area.heading', 'Section heading', 'text'],
      ['area.body', 'Section text', 'textarea']
    ],
    list: 'area.towns', listLabel: 'Towns', max: 12,
    itemFields: [['name', 'Town'], ['meta', 'Detail shown when tapped']] },

  { id: 'process', icon: '🪜', title: 'How a job goes',
    hint: 'The three steps. Keep them short.',
    fields: [
      ['process.heading', 'Section heading', 'text'],
      ['process.steps.0.title', 'Step 1 — title', 'text'],
      ['process.steps.0.body', 'Step 1 — text', 'textarea'],
      ['process.steps.1.title', 'Step 2 — title', 'text'],
      ['process.steps.1.body', 'Step 2 — text', 'textarea'],
      ['process.steps.2.title', 'Step 3 — title', 'text'],
      ['process.steps.2.body', 'Step 3 — text', 'textarea']
    ] },

  { id: 'financing', icon: '💳', title: 'Financing &amp; rebates',
    hint: 'Only promise terms your lender actually offers.',
    fields: [
      ['financing.heading', 'Heading', 'text'],
      ['financing.body', 'Summary line', 'textarea']
    ],
    list: 'financing.points', listLabel: 'Bullet points', max: 8, plain: true },

  { id: 'form', icon: '✉️', title: 'Quote form',
    fields: [
      ['quote.heading', 'Heading', 'text'],
      ['quote.body', 'Text above the form', 'textarea'],
      ['quote.cta', 'Button label', 'text'],
      ['quote.consent', 'Consent checkbox wording', 'textarea']
    ] },

  { id: 'seo', icon: '🔍', title: 'Google listing',
    hint: 'How the site appears in search results. Title under ~60 characters, description under ~155.',
    fields: [
      ['seo.title', 'Page title', 'text'],
      ['seo.description', 'Search description', 'textarea']
    ] }
];

const GALLERY = [
  { path: 'work.jobs.0', label: 'Job photo 1' },
  { path: 'work.jobs.1', label: 'Job photo 2' },
  { path: 'work.jobs.2', label: 'Job photo 3' },
  { path: 'work.jobs.3', label: 'Job photo 4' }
];

/* ── path helpers ────────────────────────────────────────── */
const dig = (o, p) => p.split('.').reduce((x, k) => (x == null ? undefined : x[k]), o);
function put(obj, path, val) {
  const keys = path.split('.');
  let o = obj;
  keys.slice(0, -1).forEach((k, i) => {
    if (o[k] == null || typeof o[k] !== 'object') o[k] = /^\d+$/.test(keys[i + 1]) ? [] : {};
    o = o[k];
  });
  o[keys[keys.length - 1]] = val;
}

/* ── image handling: resize in the browser before storing ──
   A phone photo is 4-8MB. Unresized it would blow past every
   storage limit and make the page crawl on mobile data. */
const MAX_W = 1600, MAX_H = 1200, QUALITY = 0.82;
function readImage(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('That is not an image file.'));
    if (file.size > 25 * 1024 * 1024) return reject(new Error('That image is over 25MB — too large.'));
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('Could not read that file.'));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That image could not be opened.'));
      img.onload = () => {
        const scale = Math.min(1, MAX_W / img.width, MAX_H / img.height);
        const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve({ dataUrl: cv.toDataURL('image/jpeg', QUALITY), w, h });
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

/* ── state ───────────────────────────────────────────────── */
let base = {};       // last published content
let draft = {};      // working copy
let dirty = false;

const clone = o => JSON.parse(JSON.stringify(o));
const changed = () => JSON.stringify(base) !== JSON.stringify(draft);

function markDirty() {
  dirty = changed();
  $('#cmsSave').disabled = !dirty;
  $('#cmsRevert').disabled = !dirty;
  $('#cmsDirty').hidden = !dirty;
  if (dirty) window.SFContent.saveDraft(draft);
}

/* ── render ──────────────────────────────────────────────── */
function fieldRow(path, label, type) {
  const v = dig(draft, path);
  const val = v === undefined || v === null ? '' : String(v);
  const id = 'f_' + path.replace(/\./g, '_');
  const input = type === 'textarea'
    ? `<textarea id="${id}" data-path="${path}" rows="3">${esc(val)}</textarea>`
    : `<input id="${id}" data-path="${path}" value="${esc(val)}">`;
  return `<label class="cms-f"><span>${esc(label)}</span>${input}</label>`;
}

function listBlock(sec) {
  const items = dig(draft, sec.list) || [];
  const plain = !!sec.plain;
  const rows = items.map((it, i) => {
    const inner = plain
      ? `<label class="cms-f"><span>Point ${i + 1}</span><textarea data-list="${sec.list}" data-i="${i}" data-k="" rows="2">${esc(it)}</textarea></label>`
      : sec.itemFields.map(([k, lbl, t]) => {
          const v = esc(it && it[k] != null ? it[k] : '');
          return `<label class="cms-f"><span>${esc(lbl)}</span>${
            t === 'textarea'
              ? `<textarea data-list="${sec.list}" data-i="${i}" data-k="${k}" rows="3">${v}</textarea>`
              : `<input data-list="${sec.list}" data-i="${i}" data-k="${k}" value="${v}">`}</label>`;
        }).join('');
    return `<div class="cms-item" data-i="${i}">
      <div class="cms-item-hd">
        <b>${esc(sec.listLabel)} ${i + 1}</b>
        <span class="cms-item-btns">
          <button type="button" class="ibtn sm" data-move="up"   data-list="${sec.list}" data-i="${i}" title="Move up" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" class="ibtn sm" data-move="down" data-list="${sec.list}" data-i="${i}" title="Move down" ${i === items.length - 1 ? 'disabled' : ''}>↓</button>
          <button type="button" class="ibtn sm danger" data-del="${sec.list}" data-i="${i}" title="Delete" ${items.length <= (sec.min || 0) ? 'disabled' : ''}>✕</button>
        </span>
      </div>${inner}</div>`;
  }).join('');
  const canAdd = !sec.max || items.length < sec.max;
  return `<div class="cms-list">${rows}
    ${canAdd ? `<button type="button" class="ghost" data-add="${sec.list}" data-plain="${plain}">+ Add ${esc(sec.listLabel.replace(/s$/, '').toLowerCase())}</button>` : ''}
  </div>`;
}

function galleryBlock() {
  const jobs = dig(draft, 'work.jobs') || [];
  const cells = GALLERY.map((g, i) => {
    const j = jobs[i] || {};
    const thumb = j.photo
      ? `<img src="${esc(j.photo)}" alt="">`
      : `<span class="cms-ph">No photo yet<br><i>tap to upload</i></span>`;
    return `<div class="cms-shot">
      <label class="cms-drop" data-photo="work.jobs.${i}.photo">
        ${thumb}
        <input type="file" accept="image/*" hidden data-photo-input="work.jobs.${i}.photo">
      </label>
      <label class="cms-f"><span>Title</span><input data-path="work.jobs.${i}.title" value="${esc(j.title || '')}"></label>
      <label class="cms-f"><span>Town</span><input data-path="work.jobs.${i}.place" value="${esc(j.place || '')}"></label>
      <label class="cms-f"><span>Caption</span><textarea data-path="work.jobs.${i}.meta" rows="2">${esc(j.meta || '')}</textarea></label>
      ${j.photo ? `<button type="button" class="ghost sm" data-clear="work.jobs.${i}.photo">Remove photo</button>` : ''}
    </div>`;
  }).join('');

  const ba = dig(draft, 'work.beforeAfter') || {};
  const baCell = (key, label) => {
    const v = ba[key];
    return `<div class="cms-shot">
      <label class="cms-drop" data-photo="work.beforeAfter.${key}">
        ${v ? `<img src="${esc(v)}" alt="">` : `<span class="cms-ph">${label}<br><i>tap to upload</i></span>`}
        <input type="file" accept="image/*" hidden data-photo-input="work.beforeAfter.${key}">
      </label>
      ${v ? `<button type="button" class="ghost sm" data-clear="work.beforeAfter.${key}">Remove photo</button>` : ''}
    </div>`;
  };

  return `<div class="cms-grid">${cells}</div>
    <h4 class="cms-sub">Before / after slider</h4>
    <p class="cms-hint">Use two photos of the same spot, shot from the same place.</p>
    <div class="cms-grid two">${baCell('beforePhoto', 'Before')}${baCell('afterPhoto', 'After')}</div>
    <label class="cms-f"><span>Caption under the slider</span>
      <input data-path="work.beforeAfter.caption" value="${esc(ba.caption || '')}"></label>`;
}

function render() {
  $('#cmsBody').innerHTML = SCHEMA.map(sec => `
    <section class="cms-sec" data-sec="${sec.id}">
      <button type="button" class="cms-sec-hd" aria-expanded="false">
        <span class="cms-ico">${sec.icon}</span>
        <span class="cms-sec-t">${sec.title}</span>
        <span class="cms-chev">›</span>
      </button>
      <div class="cms-sec-body">
        ${sec.hint ? `<p class="cms-hint">${sec.hint}</p>` : ''}
        ${(sec.fields || []).map(f => fieldRow(f[0], f[1], f[2])).join('')}
        ${sec.gallery ? galleryBlock() : ''}
        ${sec.list ? `<h4 class="cms-sub">${esc(sec.listLabel)}</h4>${listBlock(sec)}` : ''}
      </div>
    </section>`).join('');
  markDirty();
}

/* re-render one section, keeping it open */
function refresh(secId) {
  const open = $$('.cms-sec').filter(s => s.classList.contains('open')).map(s => s.dataset.sec);
  render();
  open.forEach(id => {
    const el = $(`.cms-sec[data-sec="${id}"]`);
    if (el) { el.classList.add('open'); $('.cms-sec-hd', el).setAttribute('aria-expanded', 'true'); }
  });
  if (secId) {
    const el = $(`.cms-sec[data-sec="${secId}"]`);
    if (el) { el.classList.add('open'); $('.cms-sec-hd', el).setAttribute('aria-expanded', 'true'); }
  }
}

/* ── events ──────────────────────────────────────────────── */
function wire() {
  const body = $('#cmsBody');

  body.addEventListener('click', e => {
    const hd = e.target.closest('.cms-sec-hd');
    if (hd) {
      const sec = hd.parentElement;
      const open = !sec.classList.contains('open');
      sec.classList.toggle('open', open);
      hd.setAttribute('aria-expanded', String(open));
      return;
    }
    const add = e.target.closest('[data-add]');
    if (add) {
      const path = add.dataset.add;
      const arr = (dig(draft, path) || []).slice();
      arr.push(add.dataset.plain === 'true' ? ''
        : path === 'reviews.items' ? { quote: '', who: '' }
        : path === 'area.towns' ? { name: '', meta: '', x: 250, y: 200, hq: false }
        : {});
      put(draft, path, arr);
      markDirty(); refresh(add.closest('.cms-sec').dataset.sec);
      return;
    }
    const del = e.target.closest('[data-del]');
    if (del) {
      const path = del.dataset.del, i = +del.dataset.i;
      const arr = (dig(draft, path) || []).slice();
      arr.splice(i, 1);
      put(draft, path, arr);
      markDirty(); refresh(del.closest('.cms-sec').dataset.sec);
      return;
    }
    const mv = e.target.closest('[data-move]');
    if (mv) {
      const path = mv.dataset.list, i = +mv.dataset.i;
      const to = mv.dataset.move === 'up' ? i - 1 : i + 1;
      const arr = (dig(draft, path) || []).slice();
      if (to < 0 || to >= arr.length) return;
      [arr[i], arr[to]] = [arr[to], arr[i]];
      put(draft, path, arr);
      markDirty(); refresh(mv.closest('.cms-sec').dataset.sec);
      return;
    }
    const clr = e.target.closest('[data-clear]');
    if (clr) {
      put(draft, clr.dataset.clear, null);
      markDirty(); refresh(clr.closest('.cms-sec').dataset.sec);
      return;
    }
  });

  /* text edits */
  body.addEventListener('input', e => {
    const el = e.target;
    if (el.dataset.path) { put(draft, el.dataset.path, el.value); markDirty(); return; }
    if (el.dataset.list) {
      const path = el.dataset.list, i = +el.dataset.i, k = el.dataset.k;
      const arr = (dig(draft, path) || []).slice();
      if (k) { arr[i] = Object.assign({}, arr[i]); arr[i][k] = el.value; }
      else arr[i] = el.value;
      put(draft, path, arr);
      markDirty();
    }
  });

  /* photo uploads */
  body.addEventListener('change', async e => {
    const inp = e.target.closest('[data-photo-input]');
    if (!inp || !inp.files || !inp.files[0]) return;
    const path = inp.dataset.photoInput;
    const drop = inp.closest('.cms-drop');
    drop.classList.add('busy');
    try {
      const { dataUrl, w, h } = await readImage(inp.files[0]);
      const DB = window.SFDB;
      const up = DB ? await DB.uploadPhoto(dataUrl, inp.files[0].name) : { url: dataUrl, mode: 'inline' };
      put(draft, path, up.url);
      markDirty();
      refresh(inp.closest('.cms-sec').dataset.sec);
      window.sfToast && window.sfToast(
        `Photo added (${w}×${h})` + (up.mode === 'inline' ? ' — stored in this browser only' : ''));
    } catch (err) {
      window.sfToast && window.sfToast(err.message);
    } finally {
      drop.classList.remove('busy');
    }
  });
}

/* ── save / publish ──────────────────────────────────────── */
function download(c) {
  const blob = new Blob([JSON.stringify(c, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'content.json'; a.click();
  URL.revokeObjectURL(url);
}

async function publish() {
  const btn = $('#cmsSave');
  btn.disabled = true; btn.textContent = 'Publishing…';
  draft.updated = new Date().toISOString();

  let ok = false;
  const DB = window.SFDB;
  if (DB) await DB.ready;
  if (DB && DB.online) {
    const res = await DB.saveContent(draft);
    ok = res.ok;
    if (!ok && res.reason === 'signed-out') {
      btn.disabled = false; btn.textContent = 'Publish changes';
      window.sfToast && window.sfToast('Your session expired — sign in again to publish');
      return;
    }
  } else {
    ok = await window.SFContent.publish(draft);
  }
  btn.textContent = 'Publish changes';

  if (ok) {
    base = clone(draft);
    window.SFContent.clearDraft();
    markDirty();
    window.sfToast && window.sfToast('Published — the site is updated');
  } else {
    /* No backend yet. The edits are real and saved locally; this is the
       manual publish path until the API is deployed. */
    $('#cmsNoApi').hidden = false;
    btn.disabled = false;
    window.sfToast && window.sfToast('No publish server yet — download the file instead');
  }
}

/* ── boot ────────────────────────────────────────────────── */
async function boot() {
  base = (await window.SFContent.load()) || {};
  const d = window.SFContent.draft();
  draft = d ? window.SFContent.merge(clone(base), d) : clone(base);
  render();
  wire();

  $('#cmsSave').addEventListener('click', publish);
  $('#cmsDownload').addEventListener('click', () => { draft.updated = new Date().toISOString(); download(draft); });
  $('#cmsRevert').addEventListener('click', () => {
    if (!confirm('Discard all unpublished changes and go back to what is live?')) return;
    draft = clone(base);
    window.SFContent.clearDraft();
    render();
    window.sfToast && window.sfToast('Changes discarded');
  });
  $('#cmsPreview').addEventListener('click', () => {
    window.SFContent.saveDraft(draft);
    window.open('index.html?preview=1', '_blank', 'noopener');
  });

  addEventListener('beforeunload', e => {
    if (dirty) { e.preventDefault(); e.returnValue = ''; }
  });
}

window.SFEditor = { boot };
})();
