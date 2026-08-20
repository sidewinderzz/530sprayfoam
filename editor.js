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


/* ── icons: small inline SVGs, no emoji ──────────────────── */
const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ` +
  `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  contact:  svg('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .3 1.9.6 2.8a2 2 0 0 1-.4 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.5 2.8.6a2 2 0 0 1 1.8 2z"/>'),
  hero:     svg('<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>'),
  numbers:  svg('<path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/>'),
  photos:   svg('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.6"/><path d="M21 15l-5-5L5 21"/>'),
  reviews:  svg('<path d="M12 2l3 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8 5.9 21l1.2-6.9-5-4.9 6.9-1z"/>'),
  services: svg('<path d="M12 2l7 6v8l-7 6-7-6V8z"/><path d="M12 8v8"/><path d="M8.5 10.5h7"/>'),
  area:     svg('<path d="M21 10c0 6-9 12-9 12S3 16 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>'),
  process:  svg('<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1.5"/><circle cx="3.5" cy="12" r="1.5"/><circle cx="3.5" cy="18" r="1.5"/>'),
  financing:svg('<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M6 15h4"/>'),
  form:     svg('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2.5 6.5l9.5 7 9.5-7"/>'),
  seo:      svg('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>'),
  map:      svg('<path d="M9 3L3 6v15l6-3 6 3 6-3V3l-6 3z"/><path d="M9 3v15M15 6v15"/>'),
  pricing:  svg('<path d="M12 1v22"/><path d="M17 5.5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'),
  about:    svg('<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>')
};

/* ── schema: what is editable, and how ───────────────────────
   Adding a field here is all it takes to expose it in the UI. */
const SCHEMA = [
  { id: 'contact', icon: ICON.contact, anchor: 'header', title: 'Contact details',
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

  { id: 'hero', icon: ICON.hero, anchor: '#savings', title: 'Front page headline',
    hint: 'The first thing a visitor reads. Three short lines work best — the third is in blue.',
    fields: [
      ['hero.eyebrow', 'Small line above the headline', 'text'],
      ['hero.line1', 'Headline line 1', 'text'],
      ['hero.line2', 'Headline line 2', 'text'],
      ['hero.line3', 'Headline line 3 (blue)', 'text'],
      ['hero.lede', 'Paragraph under the headline', 'textarea']
    ] },

  { id: 'numbers', icon: ICON.numbers, anchor: '.trust', title: 'Numbers &amp; claims',
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

  { id: 'photos', icon: ICON.photos, anchor: '#work', title: 'Job photos',
    hint: 'Tap a slot to upload from your phone. Photos are resized automatically. These are what sell the job.',
    gallery: true },

  { id: 'about', icon: ICON.about, anchor: '#about', title: 'About us',
    hint: 'The short "who we are" block. A real photo of the crew or a truck does more here ' +
          'than any wording. Leave the Facebook link blank and the Facebook buttons stay hidden.',
    photo: ['about.photo', 'Crew or truck photo'],
    fields: [
      ['about.eyebrow', 'Small line above the heading', 'text'],
      ['about.heading', 'Heading', 'text'],
      ['about.body', 'Paragraph', 'textarea'],
      ['about.cta', 'Button label', 'text'],
      ['social.facebook', 'Facebook page URL', 'text'],
      ['about.facebookLabel', 'Facebook link wording', 'text']
    ],
    list: 'about.points', listLabel: 'Bullet points', max: 6, plain: true },

  { id: 'reviews', icon: ICON.reviews, anchor: '#reviews', title: 'Customer reviews',
    hint: 'The section is hidden until you switch it on AND there is at least one review — ' +
          'an empty carousel looks worse than none. Only publish words a customer actually ' +
          'said, and only a star rating you can point at real reviews for.',
    fields: [
      ['reviews.enabled', 'Show the reviews section (true / false)', 'text'],
      ['reviews.score', 'Rating line', 'text']
    ],
    list: 'reviews.items', listLabel: 'Reviews', max: 12,
    itemFields: [['quote', 'What they said', 'textarea'], ['who', 'Name, town']] },

  { id: 'services', icon: ICON.services, anchor: '#foam', title: 'Open vs closed cell',
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

  { id: 'pricing', icon: ICON.pricing, anchor: '#savings', title: 'Pricing &amp; estimates',
    hint: 'Drives the price range the estimator shows. Rates are dollars per square foot of the ' +
          'area being sprayed, installed. Set "Show prices" to false to hide the range entirely ' +
          'and leave only the savings figure.',
    fields: [
      ['pricing.enabled', 'Show prices (true / false)', 'text'],
      ['pricing.rates.attic.open',   'Attic — open cell, $/sq ft', 'text'],
      ['pricing.rates.attic.closed', 'Attic — closed cell, $/sq ft', 'text'],
      ['pricing.rates.crawl.open',   'Crawlspace / rim — open cell, $/sq ft', 'text'],
      ['pricing.rates.crawl.closed', 'Crawlspace / rim — closed cell, $/sq ft', 'text'],
      ['pricing.rates.walls.open',   'Walls — open cell, $/sq ft', 'text'],
      ['pricing.rates.walls.closed', 'Walls — closed cell, $/sq ft', 'text'],
      ['pricing.removalPerSqft', 'Removing old insulation, $/sq ft', 'text'],
      ['pricing.minimumJob', 'Minimum job price, $', 'text'],
      ['pricing.spreadPct', 'Range width either side of the estimate, %', 'text'],
      ['pricing.heading', 'Label above the price', 'text'],
      ['pricing.note', 'Fine print under the price', 'textarea'],
      ['pricing.foamLabel', 'Foam question label', 'text'],
      ['pricing.openLabel', 'Open cell — label', 'text'],
      ['pricing.closedLabel', 'Closed cell — label', 'text'],
      ['pricing.removalLabel', 'Remove old insulation — label', 'text'],
      ['estimator.payback', 'Payback line wording', 'text']
    ] },

  { id: 'area', icon: ICON.area, anchor: '#area', title: 'Service area',
    hint: 'Towns shown on the map. Drag order is the list order; the first one is home base.',
    fields: [
      ['area.heading', 'Section heading', 'text'],
      ['area.body', 'Section text', 'textarea']
    ],
    list: 'area.towns', listLabel: 'Towns', max: 12,
    itemFields: [['name', 'Town'], ['meta', 'Detail shown when tapped'],
                 ['lat', 'Latitude'], ['lng', 'Longitude']] },

  { id: 'map', icon: ICON.map, anchor: '#area', title: 'Map settings',
    hint: 'The map uses OpenStreetMap data — no account or API key needed. ' +
          'Set "enabled" to false to fall back to the simple drawn map.',
    fields: [
      ['area.map.enabled', 'Show the real map (true / false)', 'text'],
      ['area.map.radiusMiles', 'Service radius (miles)', 'text'],
      ['area.map.lat', 'Centre latitude', 'text'],
      ['area.map.lng', 'Centre longitude', 'text'],
      ['area.map.zoom', 'Starting zoom', 'text']
    ] },

  { id: 'process', icon: ICON.process, anchor: '#process', title: 'How a job goes',
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

  { id: 'financing', icon: ICON.financing, anchor: '#financing', title: 'Financing',
    hint: 'Only promise terms your lender actually offers.',
    fields: [
      ['financing.heading', 'Heading', 'text'],
      ['financing.body', 'Summary line', 'textarea']
    ],
    list: 'financing.points', listLabel: 'Bullet points', max: 8, plain: true },

  { id: 'form', icon: ICON.form, anchor: '#quote', title: 'Quote form',
    hint: 'The photo prompt is worth keeping — photos are what let you price a job without ' +
          'driving out twice.',
    fields: [
      ['quote.heading', 'Heading', 'text'],
      ['quote.body', 'Text above the form', 'textarea'],
      ['quote.cta', 'Button label', 'text'],
      ['quote.consent', 'Consent checkbox wording', 'textarea'],
      ['quote.timelinePlaceholder', 'Timeline question', 'text'],
      ['quote.timelines.0', 'Timeline option 1', 'text'],
      ['quote.timelines.1', 'Timeline option 2', 'text'],
      ['quote.timelines.2', 'Timeline option 3', 'text'],
      ['quote.timelines.3', 'Timeline option 4', 'text'],
      ['quote.photoLabel', 'Photo upload prompt', 'text'],
      ['quote.photoHint', 'Photo upload fine print', 'textarea']
    ] },

  { id: 'seo', icon: ICON.seo, anchor: 'header', title: 'Google listing',
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
  /* Persist either way. Typing a character and deleting it again leaves the
     editor clean but used to leave the draft in storage, so the change came
     back as pending on the next reload. */
  if (dirty) window.SFContent.saveDraft(draft);
  else window.SFContent.clearDraft();
  refreshPreview();
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

/* one photo slot, for sections that are not the job gallery */
function photoBlock(path, label) {
  const v = dig(draft, path);
  return `<div class="cms-grid two"><div class="cms-shot">
    <label class="cms-drop" data-photo="${path}">
      ${v ? `<img src="${esc(v)}" alt="">`
          : `<span class="cms-ph">${esc(label)}<br><i>tap to upload</i></span>`}
      <input type="file" accept="image/*" hidden data-photo-input="${path}">
    </label>
    ${v ? `<button type="button" class="ghost sm" data-clear="${path}">Remove photo</button>` : ''}
  </div></div>`;
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
        ${sec.photo ? photoBlock(sec.photo[0], sec.photo[1]) : ''}
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
      if (open) {
        const def = SCHEMA.find(s => s.id === sec.dataset.sec);
        if (def && def.anchor) scrollPreviewTo(def.anchor);
      }
      return;
    }
    const add = e.target.closest('[data-add]');
    if (add) {
      const path = add.dataset.add;
      const arr = (dig(draft, path) || []).slice();
      arr.push(add.dataset.plain === 'true' ? ''
        : path === 'reviews.items' ? { quote: '', who: '' }
        : path === 'area.towns' ? { name: '', meta: '', lat: '', lng: '', hq: false }
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

/* ── live preview ─────────────────────────────────────────────
   The pane shows index.html?preview=1, which reads the same draft
   this editor writes. Every edit is debounced, then the frame is
   reloaded; the page itself restores its own scroll position so a
   refresh does not throw you back to the top. */
let previewTimer = null;
let SFEditorWatchSettle = null;
const PREVIEW_DELAY = 550;

function previewFrame() { return document.getElementById('cmsFrame'); }

function setPreviewState(text, busy) {
  const el = $('#cmsPreviewState');
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('busy', !!busy);
}

/* Bring the matching part of the page into view when a section opens,
   so the preview is showing whatever you are about to edit. */
function scrollPreviewTo(selector) {
  const frame = previewFrame();
  if (!frame || !selector || $('#cmsSplit').classList.contains('solo')) return;
  const go = () => {
    try {
      const doc = frame.contentDocument;
      if (!doc) return false;
      const el = selector === 'header' ? doc.querySelector('header, .strip') : doc.querySelector(selector);
      if (!el) return false;
      /* Scroll the preview's own window, never scrollIntoView(): that walks
         up every ancestor scrollport, including this page, and drags the
         editor away from the field being typed in. */
      const win = frame.contentWindow;
      const top = el.getBoundingClientRect().top + win.scrollY;
      win.scrollTo({ top: Math.max(0, top - 8), behavior: 'smooth' });
      return true;
    } catch { return false; }
  };
  if (go()) return;
  /* frame may still be loading — retry briefly, then give up quietly */
  let tries = 0;
  const t = setInterval(() => { if (go() || ++tries > 20) clearInterval(t); }, 150);
}

function refreshPreview(immediate) {
  const frame = previewFrame();
  if (!frame || $('#cmsSplit').classList.contains('solo')) return;
  window.SFContent.saveDraft(draft);
  clearTimeout(previewTimer);
  setPreviewState('updating…', true);
  previewTimer = setTimeout(() => {
    try {
      /* same origin, so this is a plain reload of the child document */
      frame.contentWindow.location.reload();
    } catch { frame.src = 'index.html?preview=1&t=' + Date.now(); }
    if (SFEditorWatchSettle) SFEditorWatchSettle();
  }, immediate ? 0 : PREVIEW_DELAY);
}

/* Render the frame at a true device width, then scale it to fill the pane.
   Without this the preview is either a tiny 390px sliver in a wide column
   or a desktop page clipped to a third of itself. */
const DEVICE = { phone: { w: 390, h: 1600 }, desktop: { w: 1280, h: 1500 } };
let device = 'phone';

function fitPreview() {
  const stage = $('#cmsPreviewStage'), shell = $('#cmsPreviewShell'), frame = previewFrame();
  if (!stage || !shell || !frame) return;
  const d = DEVICE[device];
  const availW = Math.max(120, stage.clientWidth - 24);
  const availH = Math.max(120, stage.clientHeight - 24);
  /* never magnify past 1:1 — a blown-up phone view just looks broken */
  const scale = Math.min(1, availW / d.w);
  frame.style.width = d.w + 'px';
  frame.style.height = d.h + 'px';
  frame.style.transform = `scale(${scale})`;
  shell.style.width = Math.round(d.w * scale) + 'px';
  shell.style.height = Math.round(Math.min(d.h * scale, availH)) + 'px';
}

function wirePreview() {
  const split = $('#cmsSplit');
  const stage = $('#cmsPreviewStage');
  const frame = previewFrame();
  if (!frame) return;

  fitPreview();
  addEventListener('resize', fitPreview);
  if (window.ResizeObserver) new ResizeObserver(fitPreview).observe(stage);

  /* `load` waits on every subresource — including a third-party font CDN
     that may be slow. The preview is readable as soon as its DOM is
     parsed, so key the label to that instead of leaving it stuck. */
  let settleTimer = null;
  const watchSettle = () => {
    clearInterval(settleTimer);
    let waited = 0;
    settleTimer = setInterval(() => {
      waited += 120;
      let state = null;
      try { state = frame.contentDocument && frame.contentDocument.readyState; } catch {}
      if (state === 'interactive' || state === 'complete' || waited > 10000) {
        clearInterval(settleTimer);
        setPreviewState(waited > 10000 ? 'preview slow to load' : 'up to date', false);
      }
    }, 120);
  };
  frame.addEventListener('load', () => setPreviewState('up to date', false));
  SFEditorWatchSettle = watchSettle;

  $('#cmsPreviewToggle').addEventListener('click', e => {
    const hidden = split.classList.toggle('solo');
    e.target.textContent = hidden ? 'Show preview' : 'Hide preview';
    e.target.setAttribute('aria-pressed', String(!hidden));
    if (!hidden) { fitPreview(); refreshPreview(true); }
  });

  $('#cmsPreviewReload').addEventListener('click', () => refreshPreview(true));

  /* keep the preview parked on whatever section is open after a reload */
  frame.addEventListener('load', () => {
    const openSec = $('.cms-sec.open');
    if (!openSec) return;
    const def = SCHEMA.find(s => s.id === openSec.dataset.sec);
    if (def && def.anchor) setTimeout(() => scrollPreviewTo(def.anchor), 120);
  });

  $$('.cms-devices button').forEach(b => b.addEventListener('click', () => {
    $$('.cms-devices button').forEach(o => o.classList.remove('on'));
    b.classList.add('on');
    device = b.dataset.device === 'desktop' ? 'desktop' : 'phone';
    stage.classList.toggle('desktop', device === 'desktop');
    fitPreview();
  }));
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

  let ok = false, noApi = false;
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
    noApi = !ok;
  }
  btn.textContent = 'Publish changes';

  if (ok) {
    base = clone(draft);
    window.SFContent.clearDraft();
    markDirty();
    refreshPreview(true);
    /* a previous failure may have raised this; the site clearly has a
       backend now, so stop telling the user it does not */
    $('#cmsNoApi').hidden = true;
    window.sfToast && window.sfToast('Published — the site is updated');
  } else if (noApi) {
    /* No backend at all. The edits are real and saved locally; this is the
       manual publish path until the API is deployed. */
    $('#cmsNoApi').hidden = false;
    btn.disabled = false;
    window.sfToast && window.sfToast('No publish server yet — download the file instead');
  } else {
    /* There is a server, it just did not accept this — a retry usually works,
       and telling the user to hand-edit a JSON file would be wrong. */
    btn.disabled = false;
    window.sfToast && window.sfToast('Publish failed — check your connection and try again');
  }
}

/* ── boot ────────────────────────────────────────────────── */
async function boot() {
  base = (await window.SFContent.load()) || {};
  const d = window.SFContent.draft();
  draft = d ? window.SFContent.merge(clone(base), d) : clone(base);
  render();
  wire();
  wirePreview();

  $('#cmsSave').addEventListener('click', publish);
  $('#cmsDownload').addEventListener('click', () => { draft.updated = new Date().toISOString(); download(draft); });
  $('#cmsRevert').addEventListener('click', () => {
    if (!confirm('Discard all unpublished changes and go back to what is live?')) return;
    draft = clone(base);
    render();
    markDirty();
    refreshPreview(true);
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
