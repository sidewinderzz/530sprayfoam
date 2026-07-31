/* ═══════════════════════════════════════════════════════════
   530 Spray Foam — public site behaviour
   Implements mockups 1B (390px) / 2A (1440px) from the
   Claude Design handoff.
   ═══════════════════════════════════════════════════════════ */
(async () => {
'use strict';
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const num = n => Math.round(n).toLocaleString('en-US');
const esc = v => String(v ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Everything below is wired after an await, so for a few hundred
   milliseconds a form can be submitted before its handler exists —
   #quoteForm has no action, so that is a GET navigation that puts the
   customer's details in the URL bar and loses the lead. Swallow submits
   until wiring finishes. Capture phase, so it covers every form. */
let booted = false;
document.addEventListener('submit', e => { if (!booted) e.preventDefault(); }, true);

/* Content comes from content.json (or the API once deployed). The page
   already contains the same copy as static markup, so if this fails the
   site simply keeps what is in the HTML. */
const previewing = new URLSearchParams(location.search).has('preview');
const C = (window.SFContent
  ? await window.SFContent.load({ preferDraft: previewing }).catch(() => null) : null) || {};
if (window.SFContent) window.SFContent.bind(C);
if (previewing) {
  const tag = document.createElement('div');
  tag.textContent = 'Preview — unpublished changes';
  tag.style.cssText = 'position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:300;' +
    'background:#E9A13B;color:#0E1116;font:700 13px Barlow,sans-serif;padding:9px 18px;' +
    'border-radius:999px;box-shadow:0 8px 22px rgba(14,17,22,.3)';
  addEventListener('DOMContentLoaded', () => document.body.appendChild(tag));
  if (document.readyState !== 'loading') document.body.appendChild(tag);

  /* The editor reloads this frame on every edit. Without this the view
     would snap back to the top mid-sentence, which makes editing the
     lower half of the page miserable. */
  const SCROLL_KEY = 'sf-preview-scroll';
  try {
    const y = parseInt(sessionStorage.getItem(SCROLL_KEY) || '0', 10);
    if (y > 0) addEventListener('load', () => scrollTo(0, y));
    addEventListener('scroll', () => {
      sessionStorage.setItem(SCROLL_KEY, String(Math.round(scrollY)));
    }, { passive: true });
  } catch {}
}
const pick = (v, fallback) => (v === undefined || v === null ? fallback : v);

/* ── reveal on scroll ───────────────────────────────────── */
const io = new IntersectionObserver(es => {
  es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
}, { threshold: .1, rootMargin: '0px 0px -6% 0px' });
const watch = el => io.observe(el);
$$('.rv').forEach(watch);

/* ── header: stuck state, scrollspy, call bar, to-top ───── */
const hdr = $('#hdr'), callbar = $('#callbar'), totop = $('#totop');
const links = $$('.nav a[href^="#"]');
function onScroll() {
  const y = scrollY;
  hdr.classList.toggle('stuck', y > 6);
  callbar.classList.toggle('show', y > 320);
  totop.classList.toggle('show', y > 900);

  let cur = '';
  for (const l of links) {
    const sec = document.querySelector(l.getAttribute('href'));
    if (sec && sec.getBoundingClientRect().top <= 180) cur = l.getAttribute('href');
  }
  links.forEach(l => l.classList.toggle('on', l.getAttribute('href') === cur));
}
addEventListener('scroll', onScroll, { passive: true });
onScroll();
totop.addEventListener('click', () => scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }));

/* ── mobile drawer ──────────────────────────────────────── */
const burger = $('#burger'), nav = $('#nav'), scrim = $('#scrim');
const navFocusable = () => $$('a[href], button:not([disabled])', nav);
const setNav = open => {
  const was = nav.classList.contains('open');
  if (open === was) return;
  nav.classList.toggle('open', open);
  burger.setAttribute('aria-expanded', String(open));
  scrim.hidden = !open;
  document.body.style.overflow = open ? 'hidden' : '';
  /* The drawer sits before the burger in the DOM, so Tab would otherwise
     walk straight past it into the page behind an opaque scrim. Move focus
     in on open and hand it back to the burger on close. */
  /* preventScroll: focusing the first link would otherwise scroll the page
     underneath the open drawer */
  if (open) { const f = navFocusable()[0]; if (f) f.focus({ preventScroll: true }); }
  else if (nav.contains(document.activeElement)) burger.focus();
};
burger.addEventListener('click', () => setNav(!nav.classList.contains('open')));
scrim.addEventListener('click', () => setNav(false));
nav.addEventListener('click', e => { if (e.target.closest('a')) setNav(false); });
nav.addEventListener('keydown', e => {
  if (e.key !== 'Tab' || !nav.classList.contains('open')) return;
  const f = navFocusable();
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});
addEventListener('keydown', e => { if (e.key === 'Escape') setNav(false); });

/* ═══ savings estimator ═════════════════════════════════════
   Calibrated so the mockup's defaults — 2,150 sq ft, no
   existing insulation, attic only — land on $148/month.
   ═══════════════════════════════════════════════════════════ */
const EST  = C.estimator || {};
const RATE = pick(EST.rate, 0.0688);                                  // $/mo per sq ft, attic, uninsulated
const INS  = pick(EST.insulation, { none: 1.00, batts: 0.62, blown: 0.70 });
const ZONE = pick(EST.zones, { attic: 1.00, crawl: 0.45, walls: 0.55 });
const ZONE_LABEL = { attic: 'Attic / roofline', crawl: 'Crawlspace', walls: 'Walls / new build' };

/* ── pricing ─────────────────────────────────────────────────
   Every number here is CMS-editable, so `num()` coerces: the editor
   stores fields as strings and "2.10" * x would be fine but "2.10" + x
   would silently concatenate. */
const n = (v, fallback) => { const x = parseFloat(v); return Number.isFinite(x) ? x : fallback; };
const P = C.pricing || {};
const PRICING_ON = P.enabled !== false && P.enabled !== 'false';
const RATES = P.rates || {
  attic: { open: 1.85, closed: 3.10 },
  crawl: { open: 2.10, closed: 3.40 },
  walls: { open: 2.00, closed: 3.25 }
};
const AREA_F = P.areaFactor || { attic: 1.0, crawl: 0.9, walls: 0.85 };
const SPREAD  = n(P.spreadPct, 15) / 100;
const MINIMUM = n(P.minimumJob, 950);
const REMOVAL = n(P.removalPerSqft, 0.85);

const sqft = $('#sqft'), sqftOut = $('#sqftOut'), saveOut = $('#save'), estFine = $('#estFine');
const priceOut = $('#priceOut'), paybackOut = $('#paybackOut'), pricePanel = $('#estPrice');
const foamGrp = $('#foamGrp'), removalBox = $('#removal');
let estimate = null;

/* the client can switch prices off entirely without touching code */
if (!PRICING_ON) {
  if (pricePanel) pricePanel.hidden = true;
  if (foamGrp) foamGrp.hidden = true;
}

function paintSlider() {
  sqft.style.setProperty('--p', ((sqft.value - sqft.min) / (sqft.max - sqft.min)) * 100 + '%');
}
function estimator() {
  const ft = +sqft.value;
  const ins = $('input[name=ins]:checked').value;
  const zones = $$('input[name=zone]:checked').map(i => i.value);
  const cover = zones.reduce((a, z) => a + ZONE[z], 0);

  const monthly = ft * RATE * INS[ins] * cover;
  const annual = monthly * 12;

  sqftOut.textContent = num(ft) + ' sq ft';
  saveOut.textContent = num(monthly);
  estFine.textContent = zones.length
    ? `Roughly $${num(annual)} a year in savings. ` +
      pick(P.note, 'Ballpark only — your walkthrough gives the fixed price.')
    : 'Pick at least one area to foam.';

  /* ── project cost ── */
  const foamEl = $('input[name=foam]:checked');
  const foam = foamEl ? foamEl.value : 'open';
  const stripOld = !!(removalBox && removalBox.checked);

  let mid = zones.reduce((sum, z) => {
    const area = ft * n(AREA_F[z], 1);
    const rate = n((RATES[z] || {})[foam], 2);
    return sum + area * rate + (stripOld ? area * REMOVAL : 0);
  }, 0);
  if (mid > 0) mid = Math.max(mid, MINIMUM);

  /* never quote below the configured minimum — the spread is applied after
     the clamp, so without this a small job advertises a floor the business
     has already said it will not accept */
  const lo = mid > 0 ? Math.max(MINIMUM, Math.round(mid * (1 - SPREAD) / 50) * 50) : 0;
  const hi = mid > 0 ? Math.max(lo, Math.round(mid * (1 + SPREAD) / 50) * 50) : 0;
  const payYears = (monthly > 0 && mid > 0) ? (mid / (monthly * 12)) : 0;

  if (PRICING_ON && priceOut) {
    priceOut.textContent = zones.length ? `$${num(lo)} – $${num(hi)}` : 'Pick an area';
    paybackOut.textContent = (zones.length && payYears > 0)
      ? `${pick(C.estimator && C.estimator.payback, 'Pays for itself in')} ` +
        `about ${payYears < 1 ? 'a year' : payYears.toFixed(payYears < 10 ? 1 : 0) + ' years'}`
      : '';
  }

  estimate = {
    sqft: ft, ins, zones, foam, removal: stripOld,
    monthly: Math.round(monthly), annual: Math.round(annual),
    priceLo: lo, priceHi: hi, payback: payYears
  };
}
paintSlider();
sqft.addEventListener('input', () => { paintSlider(); estimator(); });
$$('input[name=ins],input[name=zone],input[name=foam]').forEach(i => i.addEventListener('change', estimator));
if (removalBox) removalBox.addEventListener('change', estimator);
$('#est').addEventListener('submit', e => e.preventDefault());
estimator();

/* hand the estimate to the quote form */
$('#estGo').addEventListener('click', () => {
  if (estimate) {
    $('#qsqft').value = estimate.sqft;
    const first = estimate.zones[0];
    if (first) {
      const opt = [...$('#qzone').options].find(o => o.text === ZONE_LABEL[first]);
      if (opt) { $('#qzone').value = opt.value || opt.text; $('#qzone').classList.add('set'); }
    }
    const insTxt = { none: 'no insulation', batts: 'fiberglass batts', blown: 'blown-in' }[estimate.ins];
    const foamTxt = estimate.foam === 'closed' ? 'closed cell' : 'open cell';
    $('#qnotes').value =
      `From the estimator: ${num(estimate.sqft)} sq ft, currently ${insTxt}, ` +
      `foaming ${estimate.zones.map(z => ZONE_LABEL[z].toLowerCase()).join(' + ') || 'TBD'} ` +
      `with ${foamTxt}${estimate.removal ? ', removing old insulation' : ''}. ` +
      (PRICING_ON && estimate.priceHi
        ? `Quoted range $${num(estimate.priceLo)}–$${num(estimate.priceHi)}. ` : '') +
      `Shown $${num(estimate.monthly)}/mo ($${num(estimate.annual)}/yr) estimated savings.`;
  }
  $('#quote').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  setTimeout(() => $('#qname').focus({ preventScroll: true }), reduced ? 0 : 600);
});

/* ── spec sheet + financing disclosure ──────────────────── */
function disclose(btn, panel) {
  btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', String(open));
    panel.classList.toggle('open', open);
  });
}
disclose($('#specBtn'), $('#specWrap'));
disclose($('#finBtn'), $('#finMore'));

/* ── 40% counter ────────────────────────────────────────── */
const pct = $('#pct');
/* count up to whatever figure the content says, keeping any suffix */
/* Split the figure into prefix / number / suffix once, keeping the decimal
   places and thousands grouping the CMS wrote. "40%" counts to 40%, but so
   does "1,200 homes" and "2.5\u00d7" — the old split kept ",200 homes" as the
   suffix and rounded 2.5 to 3. */
const pctRaw = pct.textContent.trim();
const pctM = pctRaw.match(/^([^0-9]*)([0-9][0-9,]*(?:\.[0-9]+)?)([\s\S]*)$/);
const pctPre = pctM ? pctM[1] : '';
const pctNum = pctM ? parseFloat(pctM[2].replace(/,/g, '')) : NaN;
const pctSuffix = pctM ? pctM[3] : '';
const pctDec = pctM && pctM[2].includes('.') ? pctM[2].split('.')[1].length : 0;
const pctGrouped = pctM ? pctM[2].includes(',') : false;
const pctFmt = v => pctGrouped
  ? v.toLocaleString('en-US', { minimumFractionDigits: pctDec, maximumFractionDigits: pctDec })
  : v.toFixed(pctDec);
const pio = new IntersectionObserver(es => {
  if (!es[0].isIntersecting) return;
  pio.disconnect();
  if (reduced || !isFinite(pctNum)) return;
  const t0 = performance.now(), dur = 1100;
  (function tick(t) {
    const p = Math.min(1, (t - t0) / dur);
    pct.textContent = pctPre + pctFmt(pctNum * (1 - Math.pow(1 - p, 3))) + pctSuffix;
    if (p < 1) requestAnimationFrame(tick);
  })(t0);
}, { threshold: .5 });
pio.observe(pct);

/* ═══ service-area map ══════════════════════════════════════ */
const TOWNS = pick(C.area && C.area.towns, [
  { name: 'Redding',    x: 258, y: 104, hq: true, meta: 'Home base · 2 crews · same-week walkthroughs' },
  { name: 'Anderson',   x: 236, y: 158, meta: '18 min out · 60+ crawlspaces sealed' },
  { name: 'Palo Cedro', x: 316, y: 128, meta: '15 min out · ranch retrofits, wide lots' },
  { name: 'Cottonwood', x: 214, y: 200, meta: '25 min out · shops and pole barns' },
  { name: 'Red Bluff',  x: 246, y: 262, meta: '40 min out · weekly route' },
  { name: 'Chico',      x: 292, y: 330, meta: '75 min out · new construction and multi-family' },
  { name: 'Orland',     x: 196, y: 316, meta: '70 min out · ag buildings and cold storage' }
]);
/* The drawn map is an SVG with a 520x420 viewBox. Rather than storing pixel
   coordinates a crew user could never reason about, project the town's real
   lat/lng into that box, so a town added in the CMS lands in the right place
   with nothing but its coordinates. Stored x/y is the fallback for towns
   that predate this or have no coordinates. */
const projectTowns = list => {
  const geo = list.filter(t => Number.isFinite(+t.lat) && Number.isFinite(+t.lng));
  if (geo.length < 2) return list.map(t => ({ ...t, x: +t.x || 260, y: +t.y || 210 }));
  const lats = geo.map(t => +t.lat), lngs = geo.map(t => +t.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  /* equirectangular, with longitude squeezed by cos(latitude) so the shape
     is not stretched, then one scale for both axes so it stays proportional */
  const kx = Math.cos((minLat + maxLat) / 2 * Math.PI / 180);
  const pad = 62, W = 520 - pad * 2, H = 420 - pad * 2;
  const spanX = ((maxLng - minLng) * kx) || 1e-6, spanY = (maxLat - minLat) || 1e-6;
  const s = Math.min(W / spanX, H / spanY);
  const offX = pad + (W - spanX * s) / 2, offY = pad + (H - spanY * s) / 2;
  return list.map(t => {
    if (!Number.isFinite(+t.lat) || !Number.isFinite(+t.lng)) {
      return { ...t, x: +t.x || 260, y: +t.y || 210 };
    }
    return {
      ...t,
      x: Math.round(offX + (+t.lng - minLng) * kx * s),
      y: Math.round(offY + (maxLat - +t.lat) * s)
    };
  });
};
/* The CMS says the first town is home base, so make that literally true
   when no town carries the flag — hq is not editable in the admin UI. */
const anyHq = TOWNS.some(t => t.hq);
const TOWN_PINS = projectTowns(TOWNS).map((t, i) => ({ ...t, hq: anyHq ? !!t.hq : i === 0 }));
const pins = $('#pins'), townWrap = $('#towns');
pins.innerHTML = TOWN_PINS.map((t, i) => `
  <g class="pin ${t.hq ? 'hq' : ''}${i === 0 ? ' on' : ''}" data-i="${i}" tabindex="0" role="button"
     aria-label="${esc(t.name)}">
    <circle class="halo" cx="${t.x}" cy="${t.y}" r="14"></circle>
    <circle class="dot" cx="${t.x}" cy="${t.y}" r="${t.hq ? 8 : 6.5}"></circle>
    <text x="${t.x + 13}" y="${t.y + 5}">${esc(t.name)}</text>
  </g>`).join('');
townWrap.innerHTML = TOWNS.map((t, i) =>
  `<button type="button" data-i="${i}"${i === 0 ? ' class="on"' : ''}>${esc(t.name)}</button>`).join('') +
  `<button type="button" class="ask" disabled>${pick(C.area && C.area.askLabel, 'Anywhere in the 530 — ask')}</button>`;

function pickTown(i) {
  const t = TOWNS[i];
  $('#mapTown').textContent = t.name;
  $('#mapMeta').textContent = t.meta;
  if (window.SFMap && window.SFMap.ready) window.SFMap.focus(i);
  $$('#pins .pin').forEach(p => p.classList.toggle('on', +p.dataset.i === i));
  $$('#towns button[data-i]').forEach(b => b.classList.toggle('on', +b.dataset.i === i));
}
$$('#pins .pin').forEach(p => {
  p.addEventListener('click', () => pickTown(+p.dataset.i));
  p.addEventListener('mouseenter', () => pickTown(+p.dataset.i));
  p.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickTown(+p.dataset.i); }
  });
});
$$('#towns button[data-i]').forEach(b => {
  b.addEventListener('click', () => pickTown(+b.dataset.i));
  b.addEventListener('mouseenter', () => pickTown(+b.dataset.i));
});

/* Real map, if a Google Maps key is configured. Returns false and
   leaves the drawn SVG alone when there is no key or the key is
   rejected — the section works either way. */
if (window.SFMap) {
  window.SFMap.init(C, TOWNS, pickTown).catch(() => {});
}

/* ═══ job gallery ═══════════════════════════════════════════
   Placeholder art stands in for the job photos the design
   marks out. Swap `art` for `<img src="...">` per job.
   ═══════════════════════════════════════════════════════════ */
const JOBS = pick(C.work && C.work.jobs, [
  { title: 'Attic', place: 'Redding', meta: '1996 two-story · 2,400 sq ft · open cell R-49 · one day',
    art: ['#2c3446', '#5b6a86', '#efece2'] },
  { title: 'Crawlspace', place: 'Anderson', meta: '1978 ranch · 1,650 sq ft · closed cell · one day',
    art: ['#1d2430', '#41505f', '#e6e9ee'] },
  { title: 'Shop', place: 'Cottonwood', meta: '40×60 steel · closed cell to the panels · two days',
    art: ['#26374a', '#4d6a83', '#f2efe6'] },
  { title: 'New build', place: 'Chico', meta: 'Framing stage · walls + roofline · scheduled to the framer',
    art: ['#3a3226', '#6d5c44', '#f7f4ec'] }
]);
const ART_FALLBACK = ['#2c3446', '#5b6a86', '#efece2'];
const artCss = (art) => {
  const [a, b, c] = (Array.isArray(art) && art.length === 3) ? art : ART_FALLBACK;
  return `background:linear-gradient(150deg,${a} 0%,${b} 52%,${c} 100%);`;
};
/* a job with an uploaded photo uses it; otherwise the placeholder art */
/* Only ever build a CSS url() from something that really is an image URL.
   The value comes from the CMS, and anything containing a quote, a paren or
   a newline could otherwise close the url() and inject further declarations. */
const safePhoto = v => {
  const s = String(v || '').trim();
  if (!s || /["'()\s\\]/.test(s)) return '';
  if (/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(s)) return s;
  try {
    const u = new URL(s, location.href);
    return (u.protocol === 'https:' || u.protocol === 'http:') ? u.href : '';
  } catch { return ''; }
};
const jobArt = j => j && safePhoto(j.photo)
  ? `background-image:url("${safePhoto(j.photo)}");background-size:cover;background-position:center;`
  : artCss(j && j.art) + artFoam((j && j.art && j.art[2]) || ART_FALLBACK[2]);
const artFoam = c =>
  `background-image:radial-gradient(circle at 22% 78%,${c}cc 0 8px,transparent 9px),` +
  `radial-gradient(circle at 38% 88%,${c}aa 0 12px,transparent 13px),` +
  `radial-gradient(circle at 58% 74%,${c}bb 0 10px,transparent 11px),` +
  `radial-gradient(circle at 76% 86%,${c}99 0 14px,transparent 15px),` +
  `radial-gradient(circle at 88% 70%,${c}cc 0 9px,transparent 10px);`;

$('#shots').innerHTML = JOBS.map((j, i) => `
  <button class="shot" data-i="${i}" type="button">
    <span class="shot-art" style="${jobArt(j)}"></span>
    <span class="shot-cap"><b>${esc(j.title)}</b>${esc(j.place)}</span>
  </button>`).join('');

/* lightbox */
const lb = $('#lb');
let lbi = 0, lbOpen = false, lbTimer, lbOpener = null;
function openLb(i) {
  lbi = (i + JOBS.length) % JOBS.length;
  const j = JOBS[lbi];
  $('#lbArt').style.cssText = jobArt(j);
  $('#lbTitle').textContent = `${j.title} — ${j.place}`;
  $('#lbMeta').textContent = j.meta;
  if (lbOpen) return;                    // already up: just swap the contents
  lbOpen = true;
  lbOpener = document.activeElement;      // so Escape returns the keyboard here
  clearTimeout(lbTimer);
  lb.hidden = false;
  requestAnimationFrame(() => { if (lbOpen) lb.classList.add('on'); });
  $('#lbX').focus();
  document.body.style.overflow = 'hidden';
}
function closeLb() {
  if (!lbOpen) return;
  lbOpen = false;
  /* restore focus while the dialog is still visible — focusing a hidden
     element silently drops the user at the top of the document */
  if (lbOpener && document.contains(lbOpener)) lbOpener.focus();
  lbOpener = null;
  lb.classList.remove('on');
  document.body.style.overflow = '';
  clearTimeout(lbTimer);
  lbTimer = setTimeout(() => { if (!lbOpen) lb.hidden = true; }, 220);
}
$('#shots').addEventListener('click', e => {
  const b = e.target.closest('.shot'); if (b) openLb(+b.dataset.i);
});
$('#lbX').addEventListener('click', closeLb);
$('#lbP').addEventListener('click', () => openLb(lbi - 1));
$('#lbN').addEventListener('click', () => openLb(lbi + 1));
lb.addEventListener('click', e => { if (e.target === lb) closeLb(); });
addEventListener('keydown', e => {
  if (!lbOpen) return;
  if (e.key === 'Escape') closeLb();
  if (e.key === 'ArrowLeft') openLb(lbi - 1);
  if (e.key === 'ArrowRight') openLb(lbi + 1);
  /* aria-modal claims the page behind is inert, so Tab must not reach it */
  if (e.key === 'Tab') {
    const f = $$('button', lb).filter(b => !b.disabled);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    else if (!lb.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
  }
});

/* ═══ before / after ════════════════════════════════════════ */
const ba = $('#ba'), baBar = $('#baBar');
const BA = pick(C.work && C.work.beforeAfter, {});
$('#baB').style.cssText += BA.beforePhoto
  ? `background-image:url("${String(BA.beforePhoto).replace(/"/g, '&quot;')}");background-size:cover;background-position:center;`
  : 'background:linear-gradient(150deg,#2a3140,#59667f 60%,#8b98ad);';
$('#baA').style.cssText += BA.afterPhoto
  ? `background-image:url("${String(BA.afterPhoto).replace(/"/g, '&quot;')}");background-size:cover;background-position:center;`
  : 'background:linear-gradient(150deg,#e8e5db,#f7f5f0 55%,#fffdf8);' + artFoam('#dcd7c8');
let drag = false;
const setX = v => {
  const x = Math.max(0, Math.min(100, v));
  ba.style.setProperty('--x', x + '%');
  $('#baA').style.setProperty('--x', x + '%');
  baBar.style.setProperty('--x', x + '%');
  ba.setAttribute('aria-valuenow', Math.round(x));
};
const pctOf = e => {
  const r = ba.getBoundingClientRect();
  const cx = e.touches ? e.touches[0].clientX : e.clientX;
  return ((cx - r.left) / r.width) * 100;
};
ba.addEventListener('pointerdown', e => { drag = true; ba.setPointerCapture?.(e.pointerId); setX(pctOf(e)); });
addEventListener('pointermove', e => { if (drag) setX(pctOf(e)); });
addEventListener('pointerup', () => { drag = false; });
ba.addEventListener('touchmove', e => { if (drag) setX(pctOf(e)); }, { passive: true });
ba.addEventListener('keydown', e => {
  const c = +ba.getAttribute('aria-valuenow');
  if (e.key === 'ArrowLeft')  { setX(c - 4); e.preventDefault(); }
  if (e.key === 'ArrowRight') { setX(c + 4); e.preventDefault(); }
  if (e.key === 'Home') setX(0);
  if (e.key === 'End')  setX(100);
});
setX(50);

/* ═══ reviews ═══════════════════════════════════════════════ */
const REVIEWS = (pick(C.reviews && C.reviews.items, [
  { quote: 'Crew masked everything, sprayed the whole crawlspace in a day, and my floors aren\u2019t freezing anymore. Bill dropped $90 the first month.', who: 'Dana R., Anderson CA' },
  { quote: 'Upstairs used to run ten degrees hotter than down. They foamed the roof deck and the AC finally shuts off in the afternoon.', who: 'Marcus T., Redding CA' },
  { quote: 'Sprayed our 40\u00d760 shop in two days, masked the whole slab, and the condensation drip off the metal is completely gone.', who: 'Loretta M., Cottonwood CA' },
  { quote: 'Fixed price, showed up when they said, and filed the rebate paperwork without me chasing it. Framers had zero delay.', who: 'Kyle D., general contractor, Chico CA' }
])).map(r => Array.isArray(r) ? { quote: r[0], who: r[1] } : r);
const rt = $('#revTrack'), rd = $('#revDots');
rt.innerHTML = REVIEWS.map(r =>
  `<li><blockquote>“${esc(r.quote)}”</blockquote><p class="rev-who">— ${esc(r.who)}</p></li>`).join('');
/* aria-pressed, not role=tab: a real tab needs matching tabpanels, roving
   tabindex and arrow keys, and half of that pattern is worse than none. */
rd.innerHTML = REVIEWS.map((_, i) =>
  `<button type="button" aria-label="Review ${i + 1}" aria-pressed="${i ? 'false' : 'true'}"` +
  `${i ? '' : ' class="on"'}></button>`).join('');
let ri = 0, rtimer;
function goRev(i) {
  ri = (i + REVIEWS.length) % REVIEWS.length;
  rt.style.transform = `translateX(-${ri * 100}%)`;
  $$('#revDots button').forEach((d, n) => {
    d.classList.toggle('on', n === ri);
    d.setAttribute('aria-pressed', String(n === ri));
  });
}
const autoRev = () => {
  clearInterval(rtimer);
  if (!reduced) rtimer = setInterval(() => goRev(ri + 1), 7000);
};
$('#revNext').addEventListener('click', () => { goRev(ri + 1); autoRev(); });
$('#revPrev').addEventListener('click', () => { goRev(ri - 1); autoRev(); });
$$('#revDots button').forEach((d, i) => d.addEventListener('click', () => { goRev(i); autoRev(); }));
const rv = $('.rev-view');
rv.addEventListener('mouseenter', () => clearInterval(rtimer));
rv.addEventListener('mouseleave', autoRev);
/* keyboard users need the same reprieve as the mouse gets */
rv.addEventListener('focusin', () => clearInterval(rtimer));
rv.addEventListener('focusout', autoRev);
let swipeX = null;
rv.addEventListener('touchstart', e => { swipeX = e.touches[0].clientX; }, { passive: true });
rv.addEventListener('touchend', e => {
  if (swipeX === null) return;
  const dx = e.changedTouches[0].clientX - swipeX;
  if (Math.abs(dx) > 45) { goRev(ri + (dx < 0 ? 1 : -1)); autoRev(); }
  swipeX = null;
});
autoRev();

/* ═══ quote form ════════════════════════════════════════════ */
const form = $('#quoteForm'), sent = $('#sent');
const RULES = {
  qname:  v => v.trim().length >= 2 ? '' : 'Your name, please.',
  qphone: v => v.replace(/\D/g, '').length >= 10 ? '' : 'A 10-digit phone number.',
  qzip:   v => /^\d{5}$/.test(v.trim()) ? '' : '5-digit ZIP.',
  qsqft:  v => (+v >= 100 && +v <= 200000) ? '' : 'Rough square footage.',
  qzone:  v => v ? '' : 'Pick what we’re foaming.'
};
function check(id) {
  const el = $('#' + id), msg = RULES[id](el.value);
  el.closest('.fld').classList.toggle('bad', !!msg);
  el.setAttribute('aria-invalid', msg ? 'true' : 'false');
  $(`.msg[data-for="${id}"]`).textContent = msg;
  return !msg;
}
Object.keys(RULES).forEach(id => {
  const el = $('#' + id);
  el.addEventListener('blur', () => check(id));
  el.addEventListener('input', () => { if (el.closest('.fld').classList.contains('bad')) check(id); });
});
$('#qzone').addEventListener('change', e => e.target.classList.toggle('set', !!e.target.value));
/* "+1 (530) 555-0182" pasted from a contacts app is 11 digits. Taking the
   first 10 would shift every digit and store a number nobody can call, so
   drop the country code first. */
const tenDigits = v => {
  let d = String(v).replace(/\D/g, '');
  if (d.length > 10 && d[0] === '1') d = d.slice(1);
  return d.slice(0, 10);
};
$('#qphone').addEventListener('input', e => {
  const d = tenDigits(e.target.value);
  e.target.value = d.length > 6 ? `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`
                 : d.length > 3 ? `(${d.slice(0,3)}) ${d.slice(3)}`
                 : d.length     ? `(${d}` : '';
});

const STORE = 'sf-submissions';
let sending = false;
form.addEventListener('submit', async e => {
  e.preventDefault();
  if (sending) return;
  const ok = Object.keys(RULES).map(check).every(Boolean);
  if (!ok) { $('.fld.bad input, .fld.bad select')?.focus(); return; }

  /* Disable before the await, not after: on a slow connection the button
     stays live for the whole round trip and an impatient second click
     files a duplicate lead and a duplicate alert. */
  sending = true;
  const btn = $('#qsend');
  btn.disabled = true; btn.textContent = 'Sending\u2026';

  const zoneSel = $('#qzone');
  const rec = {
    id: 'SF-' + Date.now().toString(36).toUpperCase(),
    at: new Date().toISOString(), read: false, status: 'new',
    name: $('#qname').value.trim(),
    phone: $('#qphone').value.trim(),
    zip: $('#qzip').value.trim(),
    city: '', email: '',
    sqft: +$('#qsqft').value,
    buildingType: zoneSel.value,
    areas: [zoneSel.value],
    timeline: '', notes: $('#qnotes').value.trim(),
    consent: $('#qconsent').checked,
    estimate: estimate ? {
      monthly: estimate.monthly, annual: estimate.annual,
      priceLo: estimate.priceLo, priceHi: estimate.priceHi,
      foam: estimate.foam, removal: estimate.removal
    } : null
  };
  /* "saved" means the business will actually see this lead. A local-only
     copy while a server is configured means the insert failed — the lead
     is sitting in the visitor's browser where nobody will ever read it,
     so we must not tell them it arrived. */
  let saved = true, ref = rec.id;
  try {
    const res = await window.SFDB.createLead(rec);
    saved = res.ok && !(window.SFDB.online && res.mode === 'local');
    if (res.ref) ref = res.ref;
  } catch { saved = false; }

  setTimeout(() => {
    form.hidden = true; sent.hidden = false; sent.classList.add('in');
    $('#sentMsg').textContent = saved
      ? `Thanks ${rec.name.split(' ')[0]} — request ${ref} is in. We'll call ${rec.phone} to set ` +
        `the walkthrough, usually same day.`
      : `Thanks ${rec.name.split(' ')[0]} — we could not get your request through to us just now. ` +
        `Please call ${(C.business && C.business.phone) || '(530) 555-0182'} so we don't miss you.`;
  }, 650);
});
$('#again').addEventListener('click', () => {
  form.reset();
  $$('.fld.bad').forEach(f => f.classList.remove('bad'));
  $$('.msg').forEach(m => m.textContent = '');
  $('#qzone').classList.remove('set');
  const btn = $('#qsend');
  btn.disabled = false; btn.textContent = 'Send it';
  sending = false;
  sent.hidden = true; form.hidden = false;
  $('#qname').focus();
});

$('#yr').textContent = new Date().getFullYear();
booted = true;
})();
