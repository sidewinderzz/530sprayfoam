/* ═══════════════════════════════════════════════════════════
   530 Spray Foam — data layer

   One module the rest of the app talks to, with two backends:

     api    Netlify Functions + Netlify DB (Postgres) + Blobs
     local  browser localStorage, the original behaviour

   Which one is live is discovered at startup by asking the API
   whether it is there. If it is not — running from a plain file
   server, or before the first deploy — everything falls back to
   local and the UI says so rather than pretending.

   The session is an HttpOnly cookie set by /api/login, so no
   token is ever readable from JavaScript here. That is why you
   will not find one in this file.
   ═══════════════════════════════════════════════════════════ */
(() => {
'use strict';

const LS_LEADS = 'sf-submissions';

const safe = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } }
};
const localLeads = {
  list() { try { return JSON.parse(safe.get(LS_LEADS)) || []; } catch { return []; } },
  save(list) { return safe.set(LS_LEADS, JSON.stringify(list)); }
};

async function req(url, opts = {}) {
  const r = await fetch(url, Object.assign({ credentials: 'same-origin' }, opts));
  if (!r.ok) {
    let msg = '';
    try { msg = (await r.json()).error || ''; } catch {}
    const err = new Error(msg || `${r.status}`);
    err.status = r.status;
    throw err;
  }
  return r.status === 204 ? null : r.json().catch(() => null);
}

const DB = {
  mode: 'local',
  online: false,       // is the API reachable
  authed: false,       // does this browser hold a valid session

  /* Resolve which backend we are on. Everything else awaits this. */
  ready: null,
  async init() {
    try {
      const r = await fetch('/api/login', { credentials: 'same-origin' });
      if (r.ok) {
        const body = await r.json();
        this.online = true;
        this.mode = 'api';
        this.authed = !!body.signedIn;
      }
    } catch { /* no API — stay local */ }
    return this;
  },

  get configured() { return this.online; },

  /* --- auth ------------------------------------------------ */
  signedIn() { return this.online ? this.authed : true; },

  async login(passcode) {
    await this.ready;
    /* Local mode means there is no server: no shared leads, no published
       content, nothing but this browser's own storage. There is nothing to
       protect and nowhere to check a passcode, so never compare one here —
       a literal in this file would be the real crew passcode, readable by
       anyone who opens db.js from the public site. */
    if (!this.online) {
      return String(passcode).trim()
        ? { ok: true, mode: 'local' }
        : { ok: false, error: 'Enter the password.' };
    }
    try {
      await req('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode })
      });
      this.authed = true;
      return { ok: true, mode: 'api' };
    } catch (e) {
      return { ok: false, error: e.message || 'Login failed.' };
    }
  },

  async logout() {
    this.authed = false;
    if (this.online) { try { await req('/api/login', { method: 'DELETE' }); } catch {} }
  },

  /* --- leads ----------------------------------------------- */
  async createLead(lead) {
    await this.ready;
    if (this.online) {
      try {
        const res = await req('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: lead.name, phone: lead.phone, email: lead.email || null,
            city: lead.city || null, zip: lead.zip || null, sqft: lead.sqft || null,
            buildingType: lead.buildingType || null, areas: lead.areas || [],
            timeline: lead.timeline || null, notes: lead.notes || null,
            consent: !!lead.consent, estimate: lead.estimate || null
          })
        });
        return { ok: true, ref: (res && res.ref) || lead.id, mode: 'api' };
      } catch (e) {
        /* keep a copy so the visitor's typing is not thrown away, but the
           caller must treat mode:'local' here as "not delivered" */
        console.error('lead insert failed:', e.message);
      }
    }
    const all = localLeads.list();
    all.unshift(lead);
    return { ok: localLeads.save(all), ref: lead.id, mode: 'local' };
  },

  async listLeads() {
    await this.ready;
    if (this.online && this.authed) return (await req('/api/leads')) || [];
    return localLeads.list();
  },

  async updateLead(id, patch) {
    await this.ready;
    if (this.online && this.authed) {
      await req(`/api/leads/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      });
      return true;
    }
    const all = localLeads.list();
    const i = all.findIndex(l => String(l.id) === String(id));
    if (i < 0) return false;
    Object.assign(all[i], patch);
    return localLeads.save(all);
  },

  async deleteLead(id) {
    await this.ready;
    if (this.online && this.authed) {
      await req(`/api/leads/${encodeURIComponent(id)}`, { method: 'DELETE' });
      return true;
    }
    return localLeads.save(localLeads.list().filter(l => String(l.id) !== String(id)));
  },

  /* --- content --------------------------------------------- */
  async getContent() {
    await this.ready;
    if (!this.online) return null;
    try { return await req('/api/content'); } catch { return null; }
  },

  async saveContent(data) {
    await this.ready;
    if (!this.online) return { ok: false, reason: 'not-configured' };
    try {
      await req('/api/content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return { ok: true };
    } catch (e) {
      if (e.status === 401) { this.authed = false; return { ok: false, reason: 'signed-out' }; }
      return { ok: false, reason: 'error', error: e.message };
    }
  },

  /* --- push alerts ----------------------------------------- */
  async pushInfo() {
    await this.ready;
    if (!this.online || !this.authed) return { configured: false, publicKey: null };
    try { return await req('/api/push'); } catch { return { configured: false, publicKey: null }; }
  },

  async subscribePush(subscription, label) {
    await this.ready;
    if (!this.online) return { ok: false, reason: 'offline' };
    try {
      await req('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription, label })
      });
      return { ok: true };
    } catch (e) { return { ok: false, reason: e.message }; }
  },

  async unsubscribePush(endpoint) {
    await this.ready;
    if (!this.online) return;
    try {
      await req('/api/push', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint })
      });
    } catch {}
  },

  /* --- photos ---------------------------------------------- */
  /* Uploads to Netlify Blobs and returns a URL. Without the API the
     image stays inline as a data URL, which works but only in this
     browser — callers surface that difference. */
  async uploadPhoto(dataUrl) {
    await this.ready;
    if (!this.online || !this.authed) return { ok: true, url: dataUrl, mode: 'inline' };
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const res = await req('/api/photos', {
        method: 'POST',
        headers: { 'Content-Type': blob.type || 'image/jpeg' },
        body: blob
      });
      return { ok: true, url: res.url, mode: 'blob' };
    } catch (e) {
      console.error('photo upload failed, embedding inline instead:', e.message);
      return { ok: true, url: dataUrl, mode: 'inline' };
    }
  }
};

DB.ready = DB.init();
window.SFDB = DB;
})();
