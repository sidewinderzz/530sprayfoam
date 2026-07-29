/* ── 530 Spray Foam — interactions ─────────────────────── */
(() => {
'use strict';
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const money = n => Math.round(n).toLocaleString('en-US');

/* ── theme ─────────────────────────────────────────────── */
const themeBtn = $('#theme');
const savedTheme = localStorage.getItem('sf-theme');
if (savedTheme) document.documentElement.dataset.theme = savedTheme;
themeBtn.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('sf-theme', next);
});

/* ── header: shadow, scroll progress, nav highlight ────── */
const hdr = $('#hdr'), sbar = $('#scrollbar'), totop = $('#totop'), bar = $('#bar');
const navLinks = $$('.nav > a[href^="#"]');
let lastY = 0;

function onScroll() {
  const y = window.scrollY;
  const max = document.documentElement.scrollHeight - innerHeight;
  hdr.classList.toggle('stuck', y > 8);
  sbar.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';
  totop.classList.toggle('show', y > 700);
  bar.classList.toggle('show', y > 380 && (y < lastY || y + innerHeight > max - 40 || y > 380));
  lastY = y;

  let active = '';
  for (const l of navLinks) {
    const sec = document.querySelector(l.getAttribute('href'));
    if (sec && sec.getBoundingClientRect().top <= 140) active = l.getAttribute('href');
  }
  navLinks.forEach(l => l.classList.toggle('active', l.getAttribute('href') === active));
}
addEventListener('scroll', onScroll, { passive: true });
onScroll();
totop.addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));

/* ── mobile menu ───────────────────────────────────────── */
const burger = $('#burger'), nav = $('#nav'), scrim = $('#scrim');
const setMenu = open => {
  nav.classList.toggle('open', open);
  burger.setAttribute('aria-expanded', String(open));
  scrim.hidden = !open;
  document.body.style.overflow = open ? 'hidden' : '';
};
burger.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
scrim.addEventListener('click', () => setMenu(false));
nav.addEventListener('click', e => { if (e.target.tagName === 'A') setMenu(false); });
addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

/* ── reveal on scroll ──────────────────────────────────── */
const io = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
}, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
$$('.reveal').forEach(el => io.observe(el));

/* ── hero gauge ────────────────────────────────────────── */
const gauge = $('#gauge'), gnum = $('#gnum'), gfill = $('#gfill');
const gio = new IntersectionObserver(es => {
  if (!es[0].isIntersecting) return;
  gio.disconnect();
  const target = 40, dur = 1400, t0 = performance.now();
  gfill.style.strokeDashoffset = String(252 - 252 * (target / 100) * 1.9);
  (function tick(t) {
    const p = Math.min(1, (t - t0) / dur);
    gnum.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(tick);
  })(t0);
}, { threshold: 0.4 });
gio.observe(gauge);

/* ── services ──────────────────────────────────────────── */
const SERVICES = [
  { ico: '🏠', name: 'Closed-cell spray foam', r: 'R-6.5 to R-7.0 per inch',
    blurb: 'Rigid, dense foam that air-seals, adds structural rigidity and doubles as a vapor barrier.',
    points: ['Best for crawlspaces, rim joists and below grade', 'Blocks bulk water and vapor drive',
             'Adds racking strength to walls', 'Highest R-value per inch available'] },
  { ico: '🌬️', name: 'Open-cell spray foam', r: 'R-3.6 to R-3.8 per inch',
    blurb: 'Light, expanding foam that fills every cavity and void — the cost-effective attic solution.',
    points: ['Great for attics and interior walls', 'Excellent sound dampening',
             'Expands 100× to seal odd framing', 'Lower cost per board foot'] },
  { ico: '🏗️', name: 'New construction', r: 'Full-envelope air sealing',
    blurb: 'We schedule around your framers and rough-in trades so the envelope is right the first time.',
    points: ['Coordinated with your build schedule', 'Code-compliant air-barrier documentation',
             'Blower-door ready assemblies', 'Hybrid foam + batt systems available'] },
  { ico: '🚜', name: 'Barns & pole buildings', r: 'Condensation control',
    blurb: 'Stop dripping metal roofs and keep livestock, hay and equipment out of the weather swings.',
    points: ['Sprayed directly to metal panels', 'Eliminates underside condensation',
             'No vapor barrier or purlin strapping needed', 'Rodent and bird resistant'] },
  { ico: '🔧', name: 'Metal buildings & shops', r: 'R-13 to R-30 assemblies',
    blurb: 'Turn an uninsulated steel shell into a space you can actually heat and cool.',
    points: ['Sprayed to ribbed panels and framing', 'Cuts radiant heat gain dramatically',
             'Thermal-break detailing at purlins', 'Optional intumescent coating'] },
  { ico: '🧱', name: 'Crawlspaces & rim joists',
    r: 'Biggest bang per dollar',
    blurb: 'The cheapest square footage to fix, and usually where the most air is leaking.',
    points: ['Encapsulation and vapor control', 'Warmer floors in winter',
             'Reduces musty air and pests', 'Often a one-day job'] }
];
$('#svcGrid').innerHTML = SERVICES.map((s, i) => `
  <button class="card reveal" data-delay="${i % 3}" aria-expanded="false">
    <span class="card-ico" aria-hidden="true">${s.ico}</span>
    <h3>${s.name}</h3>
    <p>${s.blurb}</p>
    <span class="card-r">${s.r}</span>
    <div class="card-more"><ul>${s.points.map(p => `<li>${p}</li>`).join('')}</ul></div>
    <p class="card-hint">Details ↓</p>
  </button>`).join('');
$$('#svcGrid .card').forEach(c => {
  io.observe(c);
  c.addEventListener('click', () => {
    const open = c.classList.toggle('open');
    c.setAttribute('aria-expanded', String(open));
    $('.card-hint', c).textContent = open ? 'Close ↑' : 'Details ↓';
  });
});

/* ── comparison tabs ───────────────────────────────────── */
const CMP = {
  foam: { stats: [['R per inch', '3.8 – 7.0'], ['Air sealing', 'Yes'], ['Lifespan', '80+ yrs'], ['Settles', 'Never']],
    pro: ['Air barrier and insulation in one application', 'Highest R-value per inch',
          'Will not sag, settle or absorb moisture', 'Closed-cell adds structural strength'],
    con: ['Higher up-front cost per square foot', 'Professional install only',
          '24-hour re-entry window while it cures'] },
  batt: { stats: [['R per inch', '3.1 – 3.4'], ['Air sealing', 'No'], ['Lifespan', '15 – 25 yrs'], ['Settles', 'Yes']],
    pro: ['Lowest material cost', 'DIY friendly in open framing', 'Widely available'],
    con: ['Zero air sealing — leaks continue', 'Loses R-value when compressed or damp',
          'Gaps at wiring, plumbing and odd framing', 'Sags and settles over time'] },
  blown: { stats: [['R per inch', '3.2 – 3.8'], ['Air sealing', 'Partial'], ['Lifespan', '20 – 30 yrs'], ['Settles', 'Yes']],
    pro: ['Good coverage in flat attics', 'Recycled content', 'Moderate cost'],
    con: ['Settles up to 20%, losing R-value', 'Absorbs and holds moisture',
          'Not an air barrier on its own', 'Cannot be used on vertical or sloped surfaces'] }
};
const cmpBody = $('#cmpBody');
function renderCmp(key) {
  const d = CMP[key];
  cmpBody.innerHTML = `
    <div class="cmp-grid">${d.stats.map(([k, v]) =>
      `<div class="cmp-stat"><span>${k}</span><b>${v}</b></div>`).join('')}</div>
    <div class="cmp-lists">
      <div class="pro"><h4>Strengths</h4><ul>${d.pro.map(x => `<li>${x}</li>`).join('')}</ul></div>
      <div class="con"><h4>Trade-offs</h4><ul>${d.con.map(x => `<li>${x}</li>`).join('')}</ul></div>
    </div>`;
}
$$('.cmp-tabs button').forEach(b => b.addEventListener('click', () => {
  $$('.cmp-tabs button').forEach(o => { o.classList.remove('on'); o.setAttribute('aria-selected', 'false'); });
  b.classList.add('on'); b.setAttribute('aria-selected', 'true');
  renderCmp(b.dataset.cmp);
}));
renderCmp('foam');

/* ── savings calculator ────────────────────────────────── */
const AGES = ['2010s or newer', '2000s', '1990s', '1970s–80s', 'Pre-1970'];
const LEAK = [0.10, 0.16, 0.22, 0.30, 0.38];   // recoverable share of bill by age
const SCOPE_W = { attic: 0.45, walls: 0.32, crawl: 0.15, metal: 0.08 };
const SCOPE_COST = { attic: 1.85, walls: 2.60, crawl: 2.15, metal: 2.40 }; // $/sq ft of sprayed area
const SCOPE_AREA = { attic: 1.0, walls: 0.85, crawl: 0.9, metal: 1.15 };  // sprayed area ÷ floor area

const els = {
  sqft: $('#sqft'), bill: $('#bill'), age: $('#age'), closed: $('#closed'),
  sqftOut: $('#sqftOut'), billOut: $('#billOut'), ageOut: $('#ageOut'),
  year: $('#outYear'), month: $('#outMonth'), cost: $('#outCost'),
  pay: $('#outPay'), y20: $('#out20'), bar: $('#coBar')
};
const scopes = () => $$('#scopeChips input:checked').map(i => i.value);
let calcState = null;

function paintRange(el) {
  const p = ((el.value - el.min) / (el.max - el.min)) * 100;
  el.style.setProperty('--p', p + '%');
}

function calc() {
  const sqft = +els.sqft.value, bill = +els.bill.value, age = +els.age.value;
  const picked = scopes();
  const cover = picked.reduce((a, k) => a + (SCOPE_W[k] || 0), 0);
  const cellMult = els.closed.checked ? 1.14 : 1.0;

  const annualBill = bill * 12;
  const annual = annualBill * LEAK[age] * Math.min(1, cover) * cellMult;
  const monthly = annual / 12;

  // cost each selected area on its own rate — no cross-multiplying of areas and rates
  const cellCost = els.closed.checked ? 1.35 : 1;
  const base = picked.reduce((a, k) => a + sqft * SCOPE_AREA[k] * SCOPE_COST[k], 0) * cellCost;
  const lo = base * 0.85, hi = base * 1.2;
  const mid = (lo + hi) / 2;

  els.sqftOut.textContent = (+els.sqft.value).toLocaleString('en-US') + ' sq ft';
  els.billOut.textContent = '$' + bill;
  els.ageOut.textContent = AGES[age];
  els.year.textContent  = money(annual);
  els.month.textContent = money(monthly);
  els.y20.textContent   = money(annual * 20 * 1.03);
  els.cost.textContent  = picked.length ? `$${money(lo)} – $${money(hi)}` : 'Pick an area';
  els.pay.textContent   = annual > 0 && mid > 0 ? (mid / annual).toFixed(1) + ' yrs' : '—';
  els.bar.style.width   = Math.min(100, (annual / (annualBill || 1)) * 100 * 2.2) + '%';

  calcState = {
    sqft, bill, age: AGES[age], areas: picked,
    foam: els.closed.checked ? 'Closed-cell' : 'Open-cell',
    annual: Math.round(annual), range: els.cost.textContent
  };
}
[els.sqft, els.bill, els.age].forEach(el => {
  paintRange(el);
  el.addEventListener('input', () => { paintRange(el); calc(); });
});
$$('#scopeChips input').forEach(i => i.addEventListener('change', calc));
els.closed.addEventListener('change', calc);
calc();

/* ── before / after slider ─────────────────────────────── */
const SHOTS = [
  { label: 'Attic roof deck', b: ['#3a3128', '#5a4a37'], a: ['#dcd6c8', '#f7f5f0'] },
  { label: 'Crawlspace', b: ['#22252b', '#3a3f47'], a: ['#c9cfd8', '#eef2f8'] },
  { label: 'Metal shop', b: ['#2c3a48', '#46596b'], a: ['#e4e0d4', '#faf8f3'] },
  { label: 'New-build walls', b: ['#4a3f30', '#6b5c45'], a: ['#e8e3d6', '#fbf9f4'] }
];
const grad = ([c1, c2], txt) => `linear-gradient(135deg,${c1},${c2})`;
const ba = $('#ba'), baB = $('#baBefore'), baA = $('#baAfter'), baH = $('#baHandle');
let shot = 0;

function loadShot(i) {
  shot = i;
  const s = SHOTS[i];
  baB.style.backgroundImage = grad(s.b);
  baA.style.backgroundImage = grad(s.a);
  baA.style.boxShadow = 'inset 0 0 120px rgba(0,0,0,.08)';
  $$('#baPicker button').forEach((b, n) => b.classList.toggle('on', n === i));
  setX(50);
}
function setX(pct) {
  const v = Math.max(0, Math.min(100, pct));
  ba.style.setProperty('--x', v + '%');
  baH.style.setProperty('--x', v + '%');
  baA.style.setProperty('--x', v + '%');
  ba.setAttribute('aria-valuenow', Math.round(v));
}
$('#baPicker').innerHTML = SHOTS.map((s, i) =>
  `<button type="button">${s.label}</button>`).join('');
$$('#baPicker button').forEach((b, i) => b.addEventListener('click', () => loadShot(i)));

let dragging = false;
const pctFromEvent = e => {
  const r = ba.getBoundingClientRect();
  const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
  return (x / r.width) * 100;
};
const start = e => { dragging = true; setX(pctFromEvent(e)); };
const move  = e => { if (dragging) setX(pctFromEvent(e)); };
const end   = () => { dragging = false; };
ba.addEventListener('pointerdown', start);
addEventListener('pointermove', move);
addEventListener('pointerup', end);
ba.addEventListener('touchstart', start, { passive: true });
ba.addEventListener('touchmove', move, { passive: true });
ba.addEventListener('touchend', end);
ba.addEventListener('keydown', e => {
  const cur = +ba.getAttribute('aria-valuenow');
  if (e.key === 'ArrowLeft')  { setX(cur - 4); e.preventDefault(); }
  if (e.key === 'ArrowRight') { setX(cur + 4); e.preventDefault(); }
  if (e.key === 'Home')  setX(0);
  if (e.key === 'End')   setX(100);
});
loadShot(0);

/* ── process ───────────────────────────────────────────── */
const STEPS = [
  ['Walkthrough', 'We measure the space, check existing insulation and find where the air is actually moving. Usually 30–45 minutes.'],
  ['Written quote', 'A line-item scope with board-foot thickness, R-value targets and a firm price. No pressure, no expiring discounts.'],
  ['Prep & spray', 'We mask, protect finishes and ventilate. Most residential jobs are a single day on site.'],
  ['Walk & warranty', 'We walk the job with you, clean up completely and leave written warranty and product documentation.']
];
$('#steps').innerHTML = STEPS.map(([h, p], i) =>
  `<li class="reveal" data-delay="${i % 3}"><h3>${h}</h3><p>${p}</p></li>`).join('');
$$('#steps li').forEach(el => io.observe(el));

/* ── testimonials carousel ─────────────────────────────── */
const QUOTES = [
  ['Our upstairs used to be ten degrees hotter than downstairs all summer. After they foamed the roof deck it is even, and the AC actually shuts off.', 'Dana R.', 'Chico, CA'],
  ['They sprayed our 40×60 shop in one day. Crew was on time, masked everything, and the shop holds heat with a single unit heater now.', 'Marcus T.', 'Red Bluff, CA'],
  ['The crawlspace was the fix nobody else suggested. Floors are warm, the musty smell is gone, and the bill dropped about seventy a month.', 'Priya S.', 'Paradise, CA'],
  ['Straight quote, no upsell, showed up when they said. Framers had zero delay. We use them on every build now.', 'Kyle D.', 'General contractor'],
  ['Dripping metal roof in the barn every winter. One pass of closed-cell and it has been completely dry for two seasons.', 'Loretta M.', 'Orland, CA']
];
const track = $('#qTrack'), dots = $('#qDots');
track.innerHTML = QUOTES.map(([q, who, where]) => `
  <li><p class="q-stars" aria-label="5 out of 5 stars">★★★★★</p>
  <blockquote>“${q}”</blockquote>
  <p class="q-who">${who}</p><p class="q-where">${where}</p></li>`).join('');
dots.innerHTML = QUOTES.map((_, i) =>
  `<button role="tab" aria-label="Review ${i + 1}"></button>`).join('');
let qi = 0, qTimer;
function goQ(i) {
  qi = (i + QUOTES.length) % QUOTES.length;
  track.style.transform = `translateX(-${qi * 100}%)`;
  $$('#qDots button').forEach((d, n) => d.classList.toggle('on', n === qi));
}
function autoQ() { clearInterval(qTimer); qTimer = setInterval(() => goQ(qi + 1), 6500); }
$('#qNext').addEventListener('click', () => { goQ(qi + 1); autoQ(); });
$('#qPrev').addEventListener('click', () => { goQ(qi - 1); autoQ(); });
$$('#qDots button').forEach((d, i) => d.addEventListener('click', () => { goQ(i); autoQ(); }));
$('.q-view').addEventListener('mouseenter', () => clearInterval(qTimer));
$('.q-view').addEventListener('mouseleave', autoQ);
// swipe
let sx = null;
$('.q-view').addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
$('.q-view').addEventListener('touchend', e => {
  if (sx === null) return;
  const dx = e.changedTouches[0].clientX - sx;
  if (Math.abs(dx) > 45) { goQ(qi + (dx < 0 ? 1 : -1)); autoQ(); }
  sx = null;
});
goQ(0); autoQ();

/* ── FAQ ───────────────────────────────────────────────── */
const FAQ = [
  ['How much does spray foam cost?',
   'Most residential jobs land between $2.00 and $5.50 per square foot of sprayed area, depending on foam type and thickness. Attics and crawlspaces are the cheapest; full closed-cell wall assemblies are the most. Your written quote is line-itemed by area and thickness.'],
  ['Open-cell or closed-cell — which do I need?',
   'Closed-cell for anything near moisture or where you need the highest R per inch: crawlspaces, rim joists, metal buildings, below grade. Open-cell for attics and interior walls where you have depth to work with and want sound dampening. Plenty of homes use both.'],
  ['How long until we can be back in the house?',
   'Foam is tack-free in minutes and fully cured in about 24 hours. We ventilate during and after the spray, and standard guidance is to stay out of the sprayed area for 24 hours.'],
  ['Do you remove old insulation first?',
   'Sometimes. Old batts in an attic usually come out so foam can bond to the deck. Loose blown-in over a flat ceiling can often stay if we are foaming the roof line. We will tell you which applies during the walkthrough and price removal separately.'],
  ['Will it help in summer, not just winter?',
   'Often more. Air sealing the attic stops the superheated air that drives afternoon cooling loads. Most customers notice the upstairs-vs-downstairs temperature split disappear first.'],
  ['Is it safe once cured?',
   'Yes. Cured foam is inert and does not off-gas. The precautions are all about the application window, which is why it is a licensed-installer product.'],
  ['Do you offer any warranty?',
   'Written workmanship warranty plus the manufacturer product warranty, both handed over at the final walkthrough with the product data sheets.']
];
$('#faqList').innerHTML = FAQ.map(([q, a], i) => `
  <div class="faq-item">
    <button class="faq-q" aria-expanded="false" aria-controls="fa${i}">${q}</button>
    <div class="faq-a" id="fa${i}"><p>${a}</p></div>
  </div>`).join('');
$$('.faq-q').forEach(btn => btn.addEventListener('click', () => {
  const item = btn.parentElement, panel = btn.nextElementSibling;
  const open = !item.classList.contains('open');
  $$('.faq-item.open').forEach(o => {
    o.classList.remove('open');
    $('.faq-a', o).style.maxHeight = '';
    $('.faq-q', o).setAttribute('aria-expanded', 'false');
  });
  if (open) {
    item.classList.add('open');
    panel.style.maxHeight = panel.scrollHeight + 'px';
    btn.setAttribute('aria-expanded', 'true');
  }
}));

/* ── quote form: 3 steps, validation, local submit ─────── */
const form = $('#quoteForm'), steps = $$('.step'), progBar = $('#progBar');
const btnNext = $('#next'), btnBack = $('#back'), btnSend = $('#send');
let step = 1;

const RULES = {
  ptype:  v => v ? '' : 'Pick a building type.',
  qsqft:  v => (+v >= 50 && +v <= 200000) ? '' : 'Enter a number between 50 and 200,000.',
  fname:  v => v.trim().length >= 2 ? '' : 'Please enter your name.',
  fphone: v => v.replace(/\D/g, '').length >= 10 ? '' : 'Enter a 10-digit phone number.',
  femail: v => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v.trim()) ? '' : 'Enter a valid email address.',
  fcity:  v => v.trim().length >= 2 ? '' : 'Which city is the job in?',
  fzip:   v => /^\d{5}$/.test(v.trim()) ? '' : 'Enter a 5-digit ZIP.'
};
function validate(id) {
  const el = $('#' + id), msg = RULES[id](el.value);
  el.closest('.f').classList.toggle('bad', !!msg);
  const slot = $(`.err[data-for="${id}"]`);
  if (slot) slot.textContent = msg;
  return !msg;
}
Object.keys(RULES).forEach(id => {
  const el = $('#' + id);
  el.addEventListener('blur', () => validate(id));
  el.addEventListener('input', () => { if (el.closest('.f').classList.contains('bad')) validate(id); });
});
const STEP_FIELDS = { 1: ['ptype', 'qsqft'], 2: ['fname', 'fphone', 'femail', 'fcity', 'fzip'], 3: [] };

// phone mask
$('#fphone').addEventListener('input', e => {
  const d = e.target.value.replace(/\D/g, '').slice(0, 10);
  e.target.value = d.length > 6 ? `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`
                 : d.length > 3 ? `(${d.slice(0,3)}) ${d.slice(3)}`
                 : d.length     ? `(${d}` : '';
});

function showStep(n) {
  step = n;
  steps.forEach(s => s.classList.toggle('on', +s.dataset.step === n));
  progBar.style.width = (n / 3) * 100 + '%';
  $('#stepNum').textContent = n;
  btnBack.hidden = n === 1;
  btnNext.hidden = n === 3;
  btnSend.hidden = n !== 3;
  if (n === 3) renderReview();
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function renderReview() {
  const areas = $$('#qAreas input:checked').map(i => i.value);
  const rows = [
    ['Building', $('#ptype').value], ['Square feet', $('#qsqft').value],
    ['Areas', areas.join(', ') || '—'], ['Timeline', $('#timeline').value],
    ['Name', $('#fname').value], ['Phone', $('#fphone').value],
    ['Email', $('#femail').value], ['Location', `${$('#fcity').value} ${$('#fzip').value}`]
  ];
  $('#review').innerHTML = `<h4>Review your request</h4><dl>` +
    rows.map(([k, v]) => `<dt>${k}</dt><dd>${v || '—'}</dd>`).join('') + `</dl>`;
}
btnNext.addEventListener('click', () => {
  const ok = STEP_FIELDS[step].every(validate);
  if (ok) showStep(step + 1);
  else $('.f.bad input, .f.bad select')?.focus();
});
btnBack.addEventListener('click', () => showStep(step - 1));

/* prefill from the calculator */
$$('[data-prefill]').forEach(a => a.addEventListener('click', () => {
  if (!calcState) return;
  $('#qsqft').value = calcState.sqft;
  const map = { attic: 'Attic', walls: 'Walls', crawl: 'Crawlspace', metal: 'Roof deck' };
  $$('#qAreas input').forEach(i => {
    i.checked = calcState.areas.some(a => map[a] === i.value);
  });
  $('#fnotes').value =
    `From the savings calculator: ${calcState.sqft} sq ft, ${calcState.age} build, ` +
    `$${calcState.bill}/mo bill, ${calcState.foam}. Estimated $${money(calcState.annual)}/yr savings, ` +
    `project range ${calcState.range}.`;
  showStep(1);
}));

/* submissions are stored locally and surfaced on /admin.html */
const STORE = 'sf-submissions';
const load = () => { try { return JSON.parse(localStorage.getItem(STORE)) || []; } catch { return []; } };

form.addEventListener('submit', e => {
  e.preventDefault();
  const ok = [...STEP_FIELDS[1], ...STEP_FIELDS[2]].every(validate);
  if (!ok) { showStep(1); return; }

  const rec = {
    id: 'SF-' + Date.now().toString(36).toUpperCase(),
    at: new Date().toISOString(),
    read: false, status: 'new',
    buildingType: $('#ptype').value,
    sqft: +$('#qsqft').value,
    timeline: $('#timeline').value,
    areas: $$('#qAreas input:checked').map(i => i.value),
    name: $('#fname').value.trim(),
    phone: $('#fphone').value.trim(),
    email: $('#femail').value.trim(),
    city: $('#fcity').value.trim(),
    zip: $('#fzip').value.trim(),
    notes: $('#fnotes').value.trim(),
    consent: $('#fcontact').checked,
    estimate: calcState ? { annual: calcState.annual, range: calcState.range, foam: calcState.foam } : null
  };
  const all = load();
  all.unshift(rec);
  localStorage.setItem(STORE, JSON.stringify(all));

  btnSend.disabled = true; btnSend.textContent = 'Sending…';
  setTimeout(() => {
    form.hidden = true;
    $('#thanks').hidden = false;
    $('#thanksMsg').textContent =
      `Thanks ${rec.name.split(' ')[0]} — your request (${rec.id}) is in. We'll call ${rec.phone} within one business day.`;
    $('#thanks').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 700);
});
$('#again').addEventListener('click', () => {
  form.reset();
  $$('.f.bad').forEach(f => f.classList.remove('bad'));
  $$('.err').forEach(e => e.textContent = '');
  btnSend.disabled = false; btnSend.textContent = 'Send request';
  $('#thanks').hidden = true; form.hidden = false;
  showStep(1);
});

$('#yr').textContent = new Date().getFullYear();
showStep(1);
})();
