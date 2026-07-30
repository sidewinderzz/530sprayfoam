/* ═══════════════════════════════════════════════════════════
   530 Spray Foam — data layer

   One module the rest of the app talks to. It has two backends:

     supabase  real database, real auth, shared across devices
     local     browser localStorage (what the site used before)

   Which one is live depends purely on whether supabase-config.js
   has been filled in. Everything degrades to `local` if the
   project is missing or unreachable, so the site never breaks —
   but `mode` is exposed so the UI can tell the truth about which
   one is in use rather than pretending.
   ═══════════════════════════════════════════════════════════ */
(() => {
'use strict';

const CFG = window.SUPABASE_CONFIG || {};
const configured = !!(CFG.url && CFG.anonKey && !/YOUR_/.test(CFG.url + CFG.anonKey));

const LS_LEADS = 'sf-submissions';
const LS_TOKEN = 'sf-session';

const safe = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch {} }
};

/* ── REST helpers (no SDK — keeps this dependency-free) ──── */
const rest = (path) => `${CFG.url}/rest/v1/${path}`;
let session = null;
try { session = JSON.parse(safe.get(LS_TOKEN) || 'null'); } catch {}

function headers(auth = true) {
  const h = {
    'apikey': CFG.anonKey,
    'Content-Type': 'application/json'
  };
  const token = auth && session && session.access_token;
  h['Authorization'] = 'Bearer ' + (token || CFG.anonKey);
  return h;
}

async function req(url, opts = {}) {
  const r = await fetch(url, opts);
  if (!r.ok) {
    const text = await r.text().catch(() => '');
    const err = new Error(`${r.status} ${text.slice(0, 200)}`);
    err.status = r.status;
    throw err;
  }
  if (r.status === 204) return null;
  const body = await r.text();
  return body ? JSON.parse(body) : null;
}

/* ── local fallback ──────────────────────────────────────── */
const localLeads = {
  list() { try { return JSON.parse(safe.get(LS_LEADS)) || []; } catch { return []; } },
  save(list) { return safe.set(LS_LEADS, JSON.stringify(list)); }
};

/* ── public API ──────────────────────────────────────────── */
const DB = {
  mode: configured ? 'supabase' : 'local',
  configured,

  /* --- auth ------------------------------------------------ */
  signedIn() {
    if (!configured) return true;                 // local mode has no server auth
    return !!(session && session.expires_at * 1000 > Date.now());
  },

  /* Exchange the short crew passcode for a real session.
     In local mode this falls back to the old client-side check. */
  async login(passcode) {
    if (!configured) {
      const ok = String(passcode).trim().toLowerCase() === 'marc';
      return ok ? { ok: true, mode: 'local' } : { ok: false, error: 'Wrong password.' };
    }
    try {
      const r = await fetch(`${CFG.url}/functions/v1/crew-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': CFG.anonKey },
        body: JSON.stringify({ passcode })
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) return { ok: false, error: body.error || 'Login failed.' };
      session = body;
      safe.set(LS_TOKEN, JSON.stringify(session));
      return { ok: true, mode: 'supabase' };
    } catch {
      return { ok: false, error: 'Could not reach the server. Check your connection.' };
    }
  },

  logout() {
    session = null;
    safe.del(LS_TOKEN);
  },

  /* --- leads ----------------------------------------------- */
  /* Called by the PUBLIC form. Anonymous insert is allowed by
     RLS; reading leads back is not. */
  async createLead(lead) {
    if (configured) {
      try {
        const row = await req(rest('leads'), {
          method: 'POST',
          headers: Object.assign(headers(false), { 'Prefer': 'return=representation' }),
          body: JSON.stringify({
            name: lead.name, phone: lead.phone, email: lead.email || null,
            city: lead.city || null, zip: lead.zip || null,
            sqft: lead.sqft || null, building_type: lead.buildingType || null,
            areas: lead.areas || [], timeline: lead.timeline || null,
            notes: lead.notes || null, consent: !!lead.consent,
            estimate: lead.estimate || null
          })
        });
        return { ok: true, ref: (row && row[0] && row[0].ref) || lead.id, mode: 'supabase' };
      } catch (e) {
        /* fall through to local so a lead is never silently lost */
        console.error('lead insert failed, keeping a local copy:', e.message);
      }
    }
    const all = localLeads.list();
    all.unshift(lead);
    const saved = localLeads.save(all);
    return { ok: saved, ref: lead.id, mode: 'local' };
  },

  async listLeads() {
    if (configured && this.signedIn()) {
      const rows = await req(rest('leads?select=*&order=created_at.desc'), { headers: headers() });
      return (rows || []).map(r => ({
        id: r.id, ref: r.ref, at: r.created_at, name: r.name, phone: r.phone,
        email: r.email, city: r.city, zip: r.zip, sqft: r.sqft,
        buildingType: r.building_type, areas: r.areas || [], timeline: r.timeline,
        notes: r.notes, consent: r.consent, estimate: r.estimate,
        status: r.status, read: r.read
      }));
    }
    return localLeads.list();
  },

  async updateLead(id, patch) {
    if (configured && this.signedIn()) {
      const body = {};
      if ('status' in patch) body.status = patch.status;
      if ('read' in patch) body.read = patch.read;
      await req(rest(`leads?id=eq.${encodeURIComponent(id)}`), {
        method: 'PATCH', headers: headers(), body: JSON.stringify(body)
      });
      return true;
    }
    const all = localLeads.list();
    const i = all.findIndex(l => l.id === id);
    if (i < 0) return false;
    Object.assign(all[i], patch);
    return localLeads.save(all);
  },

  async deleteLead(id) {
    if (configured && this.signedIn()) {
      await req(rest(`leads?id=eq.${encodeURIComponent(id)}`), {
        method: 'DELETE', headers: headers()
      });
      return true;
    }
    const all = localLeads.list().filter(l => l.id !== id);
    return localLeads.save(all);
  },

  /* --- content --------------------------------------------- */
  async getContent() {
    if (!configured) return null;
    try {
      const rows = await req(rest('content?id=eq.1&select=data,updated_at'), { headers: headers(false) });
      return rows && rows[0] ? rows[0].data : null;
    } catch { return null; }
  },

  async saveContent(data) {
    if (!configured) return { ok: false, reason: 'not-configured' };
    if (!this.signedIn()) return { ok: false, reason: 'signed-out' };
    try {
      await req(rest('content?id=eq.1'), {
        method: 'PATCH',
        headers: headers(),
        body: JSON.stringify({ data, updated_at: new Date().toISOString() })
      });
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: e.status === 401 || e.status === 403 ? 'signed-out' : 'error', error: e.message };
    }
  },

  /* --- photos ---------------------------------------------- */
  /* Uploads to Supabase Storage and returns a public URL.
     Falls back to the inline data URL when there is no project. */
  async uploadPhoto(dataUrl, name) {
    if (!configured || !this.signedIn()) return { ok: true, url: dataUrl, mode: 'inline' };
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const path = `jobs/${Date.now()}-${String(name || 'photo').replace(/[^a-z0-9.\-]/gi, '_')}`;
      const r = await fetch(`${CFG.url}/storage/v1/object/photos/${path}`, {
        method: 'POST',
        headers: {
          'apikey': CFG.anonKey,
          'Authorization': 'Bearer ' + session.access_token,
          'Content-Type': blob.type || 'image/jpeg',
          'x-upsert': 'true'
        },
        body: blob
      });
      if (!r.ok) throw new Error(await r.text());
      return { ok: true, url: `${CFG.url}/storage/v1/object/public/photos/${path}`, mode: 'storage' };
    } catch (e) {
      console.error('photo upload failed, embedding inline instead:', e.message);
      return { ok: true, url: dataUrl, mode: 'inline' };
    }
  }
};

window.SFDB = DB;
})();
