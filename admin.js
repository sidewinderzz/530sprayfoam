/* ── 530 Spray Foam — admin PWA ────────────────────────── */
(() => {
'use strict';
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const STORE     = 'sf-submissions';
const SEEN_KEY  = 'sf-seen-ids';
const AUTH_KEY  = 'sf-admin-auth';
/* Auth now goes through SFDB. With Supabase configured the passcode is
   checked by the crew-login edge function and the browser gets a real
   session; without it, SFDB falls back to the old local check so the
   site still runs. */
const DB = window.SFDB;
const STATUSES  = ['new', 'contacted', 'quoted', 'won', 'lost'];

/* Storage can throw outright — Safari private browsing, blocked site data,
   quota exceeded. An unguarded read at load time used to abort this whole
   script, which left the Unlock button with no handler at all. */
const store = {
  ok: true,
  get(k) { try { return localStorage.getItem(k); } catch { this.ok = false; return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch { this.ok = false; return false; } },
  del(k) { try { localStorage.removeItem(k); } catch {} },
  sGet(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  sSet(k, v) { try { sessionStorage.setItem(k, v); return true; } catch { return false; } },
  sDel(k) { try { sessionStorage.removeItem(k); } catch {} }
};

const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/* `cache` mirrors what the server returned so render() can stay
   synchronous; refresh() repopulates it. */
let cache = [];
const load = () => cache;
const save = list => { cache = list; return store.set(STORE, JSON.stringify(list)); };
async function refresh() {
  try { cache = await DB.listLeads(); }
  catch (e) { console.error('could not load leads:', e.message); }
  render();
}
const money = n => Math.round(n).toLocaleString('en-US');

function ago(iso) {
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  if (s < 604800) return Math.floor(s / 86400) + 'd ago';
  return new Date(iso).toLocaleDateString();
}

let toastTimer;
window.sfToast = msg => toast(msg);
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ── service worker / PWA ──────────────────────────────── */
let swReg = null;
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js')
    .then(r => { swReg = r; })
    .catch(() => { /* file:// or unsupported — notifications fall back to page-level */ });
}
let installEvt = null;
addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); installEvt = e; $('#installBtn').hidden = false;
});
$('#installBtn').addEventListener('click', async () => {
  if (!installEvt) return;
  installEvt.prompt();
  await installEvt.userChoice;
  installEvt = null; $('#installBtn').hidden = true;
});
addEventListener('appinstalled', () => toast('Installed — open it from your home screen'));

/* ── notifications ─────────────────────────────────────── */
const notifBtn = $('#notifBtn');
function syncNotifUi() {
  const p = 'Notification' in window ? Notification.permission : 'unsupported';
  notifBtn.classList.toggle('on', p === 'granted');
  notifBtn.title = p === 'granted' ? 'Notifications on'
    : p === 'denied' ? 'Notifications blocked in browser settings'
    : 'Enable notifications';
  const dismissed = store.sGet('sf-notif-dismiss') === '1';
  $('#notifBanner').hidden = p === 'granted' || p === 'unsupported' || dismissed;
  if (p === 'denied') $('#notifMsg').textContent =
    'Notifications are blocked for this site. Re-enable them in your browser or OS settings.';
}
async function askNotify() {
  if (!('Notification' in window)) return toast('This browser has no notification support');
  if (Notification.permission === 'denied') return toast('Blocked — re-enable in browser settings');
  const p = await Notification.requestPermission();
  syncNotifUi();
  if (p === 'granted') { toast('Notifications on'); notify('Notifications enabled', 'You’ll be alerted the moment a lead comes in.'); }
  else toast('Notifications not enabled');
}
notifBtn.addEventListener('click', askNotify);
$('#notifEnable').addEventListener('click', askNotify);
$('#notifDismiss').addEventListener('click', () => {
  store.sSet('sf-notif-dismiss', '1'); $('#notifBanner').hidden = true;
});

function notify(title, body, tag = 'sf-lead') {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (swReg && swReg.active) {
    swReg.active.postMessage({ type: 'notify', title, body, tag, url: './admin.html#new' });
  } else {
    try { new Notification(title, { body, tag, icon: 'assets/logo-530-tight.png' }); } catch {}
  }
  if (navigator.vibrate) navigator.vibrate([90, 40, 90]);
}

/* badge on the installed app icon */
function syncBadge(count) {
  if (!('setAppBadge' in navigator)) return;
  count ? navigator.setAppBadge(count).catch(() => {}) : navigator.clearAppBadge().catch(() => {});
}

/* ── lock screen ───────────────────────────────────────── */
const lock = $('#lock'), app = $('#app');
let editorBooted = false;
function unlock() {
  lock.hidden = true; app.hidden = false;
  try { cache = JSON.parse(store.get(STORE)) || []; } catch { cache = []; }
  render(); refresh(); syncNotifUi(); startWatch();
  if (!DB.online) $('#modeNote').hidden = false;
  if (!editorBooted && window.SFEditor) {
    editorBooted = true;
    window.SFEditor.boot().catch(() => toast('Could not load website content'));
  }
  if (!store.ok) toast('This browser is blocking site storage — leads cannot be saved here');
}
/* A remembered flag only counts if the session behind it is still valid.
   With the API live that means a real cookie, checked server-side. */
DB.ready.then(() => {
  if ((store.get(AUTH_KEY) === '1' || store.sGet(AUTH_KEY) === '1') && DB.signedIn()) unlock();
  if (DB.online) $('#modeNote').hidden = true;
});

function rejectLogin(msg) {
  $('#pwErr').textContent = msg;
  $('.lock-card').classList.remove('shake');
  void $('.lock-card').offsetWidth;
  $('.lock-card').classList.add('shake');
  $('#pw').select();
}

$('#lockForm').addEventListener('submit', async e => {
  e.preventDefault();
  const typed = $('#pw').value;
  if (!typed.trim()) return rejectLogin('Enter the crew password.');

  const btn = $('#lockForm button[type=submit]');
  btn.disabled = true; btn.textContent = 'Checking…';
  let res;
  try { res = await DB.login(typed); }
  catch { res = { ok: false, error: 'Could not reach the server.' }; }
  btn.disabled = false; btn.textContent = 'Unlock';

  if (!res.ok) return rejectLogin(res.error || 'Wrong password.');

  /* unlock FIRST — remembering the session must never gate getting in */
  unlock();
  const remembered = $('#remember').checked ? store.set(AUTH_KEY, '1') : store.sSet(AUTH_KEY, '1');
  if (!remembered) toast('Signed in, but this browser is blocking site storage — you will have to sign in again next visit');
});
$('#lockBtn').addEventListener('click', () => {
  DB.logout();
  store.del(AUTH_KEY); store.sDel(AUTH_KEY);
  app.hidden = true; lock.hidden = false; $('#pw').value = ''; $('#pwErr').textContent = '';
});

/* ── view switcher: leads vs website content ───────────── */
const VIEWS = { viewLeads: 'leadsView', viewContent: 'contentView' };
Object.keys(VIEWS).forEach(btnId => {
  $('#' + btnId).addEventListener('click', () => {
    Object.entries(VIEWS).forEach(([b, v]) => {
      const on = b === btnId;
      $('#' + b).classList.toggle('on', on);
      $('#' + b).setAttribute('aria-selected', String(on));
      $('#' + v).hidden = !on;
    });
    $('#newPill').hidden = btnId !== 'viewLeads' || !load().filter(l => !l.read).length;
  });
});

/* ── new-lead watcher (cross-tab + poll) ───────────────── */
const seen = () => { try { return new Set(JSON.parse(store.get(SEEN_KEY)) || []); } catch { return new Set(); } };
const markSeen = ids => store.set(SEEN_KEY, JSON.stringify([...ids].slice(0, 500)));

function checkNew({ quiet = false } = {}) {
  const list = load(), known = seen();
  const fresh = list.filter(l => !known.has(l.id));
  if (fresh.length && !quiet) {
    fresh.forEach(l => notify(
      `New lead — ${l.name}`,
      `${l.buildingType || 'Lead'}${l.sqft ? ` · ${l.sqft.toLocaleString()} sq ft` : ''}${l.city ? ` · ${l.city}` : ''}`,
      l.id
    ));
    toast(fresh.length === 1 ? 'New lead received' : `${fresh.length} new leads received`);
  }
  fresh.forEach(l => known.add(l.id));
  markSeen(known);
  render();
}
let watchTimer;
function startWatch() {
  checkNew({ quiet: true });              // don't re-alert on first unlock
  clearInterval(watchTimer);
  watchTimer = setInterval(async () => {
    if (DB.online) { try { cache = await DB.listLeads(); } catch {} }
    checkNew();
  }, DB.online ? 20000 : 5000);
}
addEventListener('storage', e => { if (e.key === STORE) checkNew(); });
addEventListener('visibilitychange', () => { if (!document.hidden && !app.hidden) checkNew(); });

/* ── filtering / sorting ───────────────────────────────── */
const state = { status: 'all', q: '', sort: 'new' };
$$('#statusTabs button').forEach(b => b.addEventListener('click', () => {
  $$('#statusTabs button').forEach(o => o.classList.remove('on'));
  b.classList.add('on'); state.status = b.dataset.status; render();
}));
$('#search').addEventListener('input', e => { state.q = e.target.value.toLowerCase().trim(); render(); });
$('#sort').addEventListener('change', e => { state.sort = e.target.value; render(); });
if (location.hash === '#new') {
  state.status = 'new';
  $$('#statusTabs button').forEach(b => b.classList.toggle('on', b.dataset.status === 'new'));
}

function visible(list) {
  let out = list.filter(l => state.status === 'all' || (l.status || 'new') === state.status);
  if (state.q) out = out.filter(l =>
    [l.name, l.city, l.zip, l.phone, l.email, l.buildingType, l.notes]
      .join(' ').toLowerCase().includes(state.q));
  const by = {
    new:  (a, b) => new Date(b.at) - new Date(a.at),
    old:  (a, b) => new Date(a.at) - new Date(b.at),
    sqft: (a, b) => (b.sqft || 0) - (a.sqft || 0),
    value:(a, b) => ((b.estimate?.annual) || 0) - ((a.estimate?.annual) || 0)
  };
  return out.sort(by[state.sort]);
}

/* ── render ────────────────────────────────────────────── */
function render() {
  const all = load();
  const unread = all.filter(l => !l.read).length;
  const newCount = all.filter(l => (l.status || 'new') === 'new').length;
  const won = all.filter(l => l.status === 'won').length;
  const week = all.filter(l => Date.now() - new Date(l.at) < 6048e5).length;
  const pipeline = all.filter(l => !['won', 'lost'].includes(l.status))
    .reduce((a, l) => a + ((l.estimate?.annual) || 0), 0);

  $('#newPill').hidden = !unread;
  $('#newPill').textContent = `${unread} new`;
  document.title = unread ? `(${unread}) Crew inbox — 530 Spray Foam` : 'Crew inbox — 530 Spray Foam';
  syncBadge(unread);

  $('#tiles').innerHTML = [
    ['Total leads', all.length], ['New', newCount, 'hot'],
    ['Last 7 days', week], ['Won', won],
    ['Open est. savings/yr', '$' + money(pipeline)]
  ].map(([k, v, cls]) => `<div class="tile ${cls || ''}"><span>${k}</span><b>${v}</b></div>`).join('');

  const list = visible(all);
  $('#empty').hidden = list.length > 0;
  $('#leads').innerHTML = list.map(l => {
    const st = l.status || 'new';
    const est = l.estimate ? `$${money(l.estimate.annual)}/yr · ${esc(l.estimate.range)}` : '—';
    return `
    <article class="lead ${l.read ? '' : 'unread'}" data-id="${esc(l.id)}">
      <div class="lead-hd">
        <div class="lead-who">
          <b>${esc(l.name)}</b>
          <small>${esc(l.buildingType || 'Lead')}${l.city ? ' · ' + esc(l.city) : ''}${l.sqft ? ' · ' + l.sqft.toLocaleString() + ' sq ft' : ''}</small>
        </div>
        <div class="tagr">
          <span class="tag s-${st}">${st}</span>
          ${l.timeline ? `<span class="tag">${esc(l.timeline)}</span>` : ''}
        </div>
        <span class="lead-when">${ago(l.at)}</span>
      </div>
      <div class="lead-body">
        <div class="lead-grid">
          <div><span>Phone</span><b><a href="tel:${esc(l.phone.replace(/\D/g, ''))}">${esc(l.phone)}</a></b></div>
          <div><span>Email</span><b>${l.email ? `<a href="mailto:${esc(l.email)}">${esc(l.email)}</a>` : '—'}</b></div>
          <div><span>Location</span><b>${esc(l.city || '—')} ${esc(l.zip || '')}</b></div>
          <div><span>Areas</span><b>${esc((l.areas || []).join(', ') || '—')}</b></div>
          <div><span>Est. savings</span><b>${est}</b></div>
          <div><span>Text OK</span><b>${l.consent ? 'Yes' : 'No'}</b></div>
          <div><span>Received</span><b>${new Date(l.at).toLocaleString()}</b></div>
          <div><span>Ref</span><b>${esc(l.id)}</b></div>
        </div>
        ${l.notes ? `<div class="lead-notes">${esc(l.notes)}</div>` : ''}
        <div class="lead-acts">
          <a href="tel:${esc(l.phone.replace(/\D/g, ''))}">Call</a>
          <a href="sms:${esc(l.phone.replace(/\D/g, ''))}">Text</a>
          ${l.email ? `<a href="mailto:${esc(l.email)}?subject=${encodeURIComponent('Your 530 Spray Foam estimate')}">Email</a>` : ''}
          <select data-act="status" aria-label="Lead status">
            ${STATUSES.map(s => `<option ${s === st ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
          <button data-act="read">${l.read ? 'Mark unread' : 'Mark read'}</button>
          <button class="danger" data-act="del">Delete</button>
        </div>
      </div>
    </article>`;
  }).join('');
}

/* lead interactions (delegated) */
$('#leads').addEventListener('click', e => {
  const card = e.target.closest('.lead'); if (!card) return;
  const id = card.dataset.id, act = e.target.dataset.act;

  if (act === 'read' || act === 'del') {
    const list = load(), i = list.findIndex(l => l.id === id);
    if (i < 0) return;
    if (act === 'del') {
      if (!confirm(`Delete the lead from ${list[i].name}? This cannot be undone.`)) return;
      const gone = list[i];
      list.splice(i, 1); save(list); render();
      DB.deleteLead(gone.id).catch(e => { toast('Delete failed: ' + e.message); refresh(); });
      toast('Lead deleted');
    } else {
      list[i].read = !list[i].read;
      save(list); render();
      DB.updateLead(list[i].id, { read: list[i].read }).catch(() => refresh());
    }
    return;
  }
  if (e.target.closest('.lead-acts')) return;         // links/selects act normally

  if (e.target.closest('.lead-hd')) {
    const open = card.classList.toggle('open');
    if (open) {
      const list = load(), i = list.findIndex(l => l.id === id);
      if (i >= 0 && !list[i].read) { list[i].read = true; save(list); }
      const wasOpen = card;
      render();
      $(`.lead[data-id="${CSS.escape(id)}"]`)?.classList.add('open');
      void wasOpen;
    }
  }
});
$('#leads').addEventListener('change', e => {
  if (e.target.dataset.act !== 'status') return;
  const id = e.target.closest('.lead').dataset.id;
  const list = load(), i = list.findIndex(l => l.id === id);
  if (i < 0) return;
  list[i].status = e.target.value; list[i].read = true;
  save(list); render(); toast(`Marked ${e.target.value}`);
  DB.updateLead(list[i].id, { status: list[i].status, read: true })
    .catch(e2 => { toast('Could not save status: ' + e2.message); refresh(); });
});

/* ── saveLead: single write path (swap for an API call) ── */
function saveLead(partial) {
  const rec = Object.assign({
    id: 'SF-' + Date.now().toString(36).toUpperCase(),
    at: new Date().toISOString(), read: false, status: 'new',
    areas: [], consent: false, estimate: null
  }, partial);
  const list = load(); list.unshift(rec); save(list);
  const known = seen(); known.add(rec.id); markSeen(known);   // no self-notification
  render();
  DB.createLead(rec).then(r => { if (r.mode === 'api') refresh(); })
    .catch(e => toast('Saved locally only: ' + e.message));
  return rec;
}

/* manual entry */
$('#manualForm').addEventListener('submit', e => {
  e.preventDefault();
  const f = new FormData(e.target);
  saveLead({
    name: (f.get('name') || '').trim(), phone: (f.get('phone') || '').trim(),
    city: (f.get('city') || '').trim(), sqft: +f.get('sqft') || 0,
    notes: (f.get('notes') || '').trim(), buildingType: 'Phone call', timeline: 'ASAP', email: ''
  });
  e.target.reset(); toast('Lead saved');
});

/* sample lead — also exercises the notification path */
const SAMPLE = [
  { name: 'Dana Reyes', phone: '(530) 555-0142', city: 'Chico', zip: '95928', email: 'dana@example.com',
    buildingType: 'Existing home', sqft: 2150, timeline: 'Next 30 days', areas: ['Attic', 'Walls'],
    notes: 'Upstairs runs hot. Existing batt in attic.', consent: true,
    estimate: { annual: 780, range: '$7,900 – $11,200', foam: 'Closed-cell' } },
  { name: 'Marcus Tolliver', phone: '(530) 555-0177', city: 'Red Bluff', zip: '96080', email: 'mt@example.com',
    buildingType: 'Metal building', sqft: 2400, timeline: 'ASAP', areas: ['Roof deck', 'Walls'],
    notes: '40x60 shop, wants to heat with one unit heater.', consent: true,
    estimate: { annual: 1240, range: '$12,400 – $17,600', foam: 'Closed-cell' } }
];
$('#seedBtn').addEventListener('click', () => {
  const s = SAMPLE[load().length % SAMPLE.length];
  const rec = saveLead(structuredClone(s));
  notify(`New lead — ${rec.name}`, `${rec.buildingType} · ${rec.sqft.toLocaleString()} sq ft · ${rec.city}`, rec.id);
  toast('Sample lead added');
});

/* CSV export */
$('#exportBtn').addEventListener('click', () => {
  const list = visible(load());
  if (!list.length) return toast('Nothing to export');
  const cols = ['id', 'at', 'status', 'name', 'phone', 'email', 'city', 'zip',
                'buildingType', 'sqft', 'timeline', 'areas', 'consent', 'notes'];
  const cell = v => `"${String(Array.isArray(v) ? v.join('; ') : v ?? '').replace(/"/g, '""')}"`;
  const csv = [cols.join(','), ...list.map(l => cols.map(c => cell(l[c])).join(','))].join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url; a.download = `530-leads-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  URL.revokeObjectURL(url);
  toast(`Exported ${list.length} lead${list.length > 1 ? 's' : ''}`);
});

syncNotifUi();
})();
