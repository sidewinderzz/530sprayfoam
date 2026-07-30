/* ═══════════════════════════════════════════════════════════
   530 Spray Foam — public site behaviour
   Implements mockups 1B (390px) / 2A (1440px) from the
   Claude Design handoff.
   ═══════════════════════════════════════════════════════════ */
(() => {
'use strict';
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const num = n => Math.round(n).toLocaleString('en-US');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

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
const setNav = open => {
  nav.classList.toggle('open', open);
  burger.setAttribute('aria-expanded', String(open));
  scrim.hidden = !open;
  document.body.style.overflow = open ? 'hidden' : '';
};
burger.addEventListener('click', () => setNav(!nav.classList.contains('open')));
scrim.addEventListener('click', () => setNav(false));
nav.addEventListener('click', e => { if (e.target.closest('a')) setNav(false); });
addEventListener('keydown', e => { if (e.key === 'Escape') setNav(false); });

/* ═══ savings estimator ═════════════════════════════════════
   Calibrated so the mockup's defaults — 2,150 sq ft, no
   existing insulation, attic only — land on $148/month.
   ═══════════════════════════════════════════════════════════ */
const RATE = 0.0688;                                     // $/mo per sq ft, attic, uninsulated
const INS  = { none: 1.00, batts: 0.62, blown: 0.70 };   // existing insulation discount
const ZONE = { attic: 1.00, crawl: 0.45, walls: 0.55 };  // additive by area sprayed
const ZONE_LABEL = { attic: 'Attic / roofline', crawl: 'Crawlspace', walls: 'Walls / new build' };

const sqft = $('#sqft'), sqftOut = $('#sqftOut'), saveOut = $('#save'), estFine = $('#estFine');
let estimate = null;

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
    ? `Roughly $${num(annual)} a year. Ballpark from metered north-valley retrofits — your ` +
      `walkthrough gives the real number.`
    : 'Pick at least one area to foam.';

  estimate = { sqft: ft, ins, zones, monthly: Math.round(monthly), annual: Math.round(annual) };
}
paintSlider();
sqft.addEventListener('input', () => { paintSlider(); estimator(); });
$$('input[name=ins],input[name=zone]').forEach(i => i.addEventListener('change', estimator));
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
    $('#qnotes').value =
      `From the estimator: ${num(estimate.sqft)} sq ft, currently ${insTxt}, ` +
      `foaming ${estimate.zones.map(z => ZONE_LABEL[z].toLowerCase()).join(' + ') || 'TBD'}. ` +
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
const pio = new IntersectionObserver(es => {
  if (!es[0].isIntersecting) return;
  pio.disconnect();
  if (reduced) return;
  const t0 = performance.now(), dur = 1100;
  (function tick(t) {
    const p = Math.min(1, (t - t0) / dur);
    pct.textContent = Math.round(40 * (1 - Math.pow(1 - p, 3))) + '%';
    if (p < 1) requestAnimationFrame(tick);
  })(t0);
}, { threshold: .5 });
pio.observe(pct);

/* ═══ service-area map ══════════════════════════════════════ */
const TOWNS = [
  { name: 'Redding',    x: 258, y: 104, hq: true, meta: 'Home base · 2 crews · same-week walkthroughs' },
  { name: 'Anderson',   x: 236, y: 158, meta: '18 min out · 60+ crawlspaces sealed' },
  { name: 'Palo Cedro', x: 316, y: 128, meta: '15 min out · ranch retrofits, wide lots' },
  { name: 'Cottonwood', x: 214, y: 200, meta: '25 min out · shops and pole barns' },
  { name: 'Red Bluff',  x: 246, y: 262, meta: '40 min out · weekly route' },
  { name: 'Chico',      x: 292, y: 330, meta: '75 min out · new construction and multi-family' },
  { name: 'Orland',     x: 196, y: 316, meta: '70 min out · ag buildings and cold storage' }
];
const pins = $('#pins'), townWrap = $('#towns');
pins.innerHTML = TOWNS.map((t, i) => `
  <g class="pin ${t.hq ? 'hq' : ''}${i === 0 ? ' on' : ''}" data-i="${i}" tabindex="0" role="button"
     aria-label="${t.name}">
    <circle class="halo" cx="${t.x}" cy="${t.y}" r="14"></circle>
    <circle class="dot" cx="${t.x}" cy="${t.y}" r="${t.hq ? 8 : 6.5}"></circle>
    <text x="${t.x + 13}" y="${t.y + 5}">${t.name}</text>
  </g>`).join('');
townWrap.innerHTML = TOWNS.map((t, i) =>
  `<button type="button" data-i="${i}"${i === 0 ? ' class="on"' : ''}>${t.name}</button>`).join('') +
  `<button type="button" class="ask" disabled>Anywhere in the 530 — ask</button>`;

function pickTown(i) {
  const t = TOWNS[i];
  $('#mapTown').textContent = t.name;
  $('#mapMeta').textContent = t.meta;
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

/* ═══ job gallery ═══════════════════════════════════════════
   Placeholder art stands in for the job photos the design
   marks out. Swap `art` for `<img src="...">` per job.
   ═══════════════════════════════════════════════════════════ */
const JOBS = [
  { title: 'Attic', place: 'Redding', meta: '1996 two-story · 2,400 sq ft · open cell R-49 · one day',
    art: ['#2c3446', '#5b6a86', '#efece2'] },
  { title: 'Crawlspace', place: 'Anderson', meta: '1978 ranch · 1,650 sq ft · closed cell · one day',
    art: ['#1d2430', '#41505f', '#e6e9ee'] },
  { title: 'Shop', place: 'Cottonwood', meta: '40×60 steel · closed cell to the panels · two days',
    art: ['#26374a', '#4d6a83', '#f2efe6'] },
  { title: 'New build', place: 'Chico', meta: 'Framing stage · walls + roofline · scheduled to the framer',
    art: ['#3a3226', '#6d5c44', '#f7f4ec'] }
];
const artCss = ([a, b, c]) =>
  `background:linear-gradient(150deg,${a} 0%,${b} 52%,${c} 100%);`;
const artFoam = c =>
  `background-image:radial-gradient(circle at 22% 78%,${c}cc 0 8px,transparent 9px),` +
  `radial-gradient(circle at 38% 88%,${c}aa 0 12px,transparent 13px),` +
  `radial-gradient(circle at 58% 74%,${c}bb 0 10px,transparent 11px),` +
  `radial-gradient(circle at 76% 86%,${c}99 0 14px,transparent 15px),` +
  `radial-gradient(circle at 88% 70%,${c}cc 0 9px,transparent 10px);`;

$('#shots').innerHTML = JOBS.map((j, i) => `
  <button class="shot" data-i="${i}" type="button">
    <span class="shot-art" style="${artCss(j.art)}${artFoam(j.art[2])}"></span>
    <span class="shot-cap"><b>${j.title}</b>${j.place}</span>
  </button>`).join('');

/* lightbox */
const lb = $('#lb');
let lbi = 0, lbOpen = false, lbTimer;
function openLb(i) {
  lbi = (i + JOBS.length) % JOBS.length;
  const j = JOBS[lbi];
  $('#lbArt').style.cssText = artCss(j.art) + artFoam(j.art[2]);
  $('#lbTitle').textContent = `${j.title} — ${j.place}`;
  $('#lbMeta').textContent = j.meta;
  if (lbOpen) return;                    // already up: just swap the contents
  lbOpen = true;
  clearTimeout(lbTimer);
  lb.hidden = false;
  requestAnimationFrame(() => { if (lbOpen) lb.classList.add('on'); });
  $('#lbX').focus();
  document.body.style.overflow = 'hidden';
}
function closeLb() {
  if (!lbOpen) return;
  lbOpen = false;
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
});

/* ═══ before / after ════════════════════════════════════════ */
const ba = $('#ba'), baBar = $('#baBar');
$('#baB').style.cssText += 'background:linear-gradient(150deg,#2a3140,#59667f 60%,#8b98ad);';
$('#baA').style.cssText += 'background:linear-gradient(150deg,#e8e5db,#f7f5f0 55%,#fffdf8);' +
  artFoam('#dcd7c8');
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
const REVIEWS = [
  ['Crew masked everything, sprayed the whole crawlspace in a day, and my floors aren’t freezing anymore. Bill dropped $90 the first month.', 'Dana R., Anderson CA'],
  ['Upstairs used to run ten degrees hotter than down. They foamed the roof deck and the AC finally shuts off in the afternoon.', 'Marcus T., Redding CA'],
  ['Sprayed our 40×60 shop in two days, masked the whole slab, and the condensation drip off the metal is completely gone.', 'Loretta M., Cottonwood CA'],
  ['Fixed price, showed up when they said, and filed the rebate paperwork without me chasing it. Framers had zero delay.', 'Kyle D., general contractor, Chico CA']
];
const rt = $('#revTrack'), rd = $('#revDots');
rt.innerHTML = REVIEWS.map(([q, who]) =>
  `<li><blockquote>“${q}”</blockquote><p class="rev-who">— ${who}</p></li>`).join('');
rd.innerHTML = REVIEWS.map((_, i) =>
  `<button type="button" role="tab" aria-label="Review ${i + 1}"${i ? '' : ' class="on"'}></button>`).join('');
let ri = 0, rtimer;
function goRev(i) {
  ri = (i + REVIEWS.length) % REVIEWS.length;
  rt.style.transform = `translateX(-${ri * 100}%)`;
  $$('#revDots button').forEach((d, n) => d.classList.toggle('on', n === ri));
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
  $(`.msg[data-for="${id}"]`).textContent = msg;
  return !msg;
}
Object.keys(RULES).forEach(id => {
  const el = $('#' + id);
  el.addEventListener('blur', () => check(id));
  el.addEventListener('input', () => { if (el.closest('.fld').classList.contains('bad')) check(id); });
});
$('#qzone').addEventListener('change', e => e.target.classList.toggle('set', !!e.target.value));
$('#qphone').addEventListener('input', e => {
  const d = e.target.value.replace(/\D/g, '').slice(0, 10);
  e.target.value = d.length > 6 ? `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`
                 : d.length > 3 ? `(${d.slice(0,3)}) ${d.slice(3)}`
                 : d.length     ? `(${d}` : '';
});

const STORE = 'sf-submissions';
form.addEventListener('submit', e => {
  e.preventDefault();
  const ok = Object.keys(RULES).map(check).every(Boolean);
  if (!ok) { $('.fld.bad input, .fld.bad select')?.focus(); return; }

  const zoneSel = $('#qzone');
  const rec = {
    id: 'SF-' + Date.now().toString(36).toUpperCase(),
    at: new Date().toISOString(), read: false, status: 'new',
    name: $('#qname').value.trim(),
    phone: $('#qphone').value.trim(),
    zip: $('#qzip').value.trim(),
    city: '', email: '',
    sqft: +$('#qsqft').value,
    buildingType: zoneSel.value || zoneSel.options[0].text,
    areas: [zoneSel.value || zoneSel.options[0].text],
    timeline: '', notes: $('#qnotes').value.trim(),
    consent: $('#qconsent').checked,
    estimate: estimate ? { monthly: estimate.monthly, annual: estimate.annual } : null
  };
  let saved = true;
  try {
    const all = JSON.parse(localStorage.getItem(STORE) || '[]');
    all.unshift(rec);
    localStorage.setItem(STORE, JSON.stringify(all));
  } catch { saved = false; }

  const btn = $('#qsend');
  btn.disabled = true; btn.textContent = 'Sending…';
  setTimeout(() => {
    form.hidden = true; sent.hidden = false; sent.classList.add('in');
    $('#sentMsg').textContent = saved
      ? `Thanks ${rec.name.split(' ')[0]} — request ${rec.id} is in. We'll call ${rec.phone} to set ` +
        `the walkthrough, usually same day.`
      : `Thanks ${rec.name.split(' ')[0]} — we could not store your request in this browser. ` +
        `Please call us at (530) 555-0182 so we don't miss you.`;
  }, 650);
});
$('#again').addEventListener('click', () => {
  form.reset();
  $$('.fld.bad').forEach(f => f.classList.remove('bad'));
  $$('.msg').forEach(m => m.textContent = '');
  $('#qzone').classList.remove('set');
  const btn = $('#qsend');
  btn.disabled = false; btn.textContent = 'Send it';
  sent.hidden = true; form.hidden = false;
  $('#qname').focus();
});

$('#yr').textContent = new Date().getFullYear();
})();
