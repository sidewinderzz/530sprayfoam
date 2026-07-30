/* ═══════════════════════════════════════════════════════════
   530 Spray Foam — content layer
   Shared by the public site and the admin editor.

   Load order, first hit wins:
     1. /api/content   — the live database, once the Netlify
                         function is deployed
     2. content.json   — the file in the repo
     3. whatever is already written into index.html

   index.html carries the same copy as static markup, so the page
   is complete and indexable before any of this runs. This layer
   only overrides what has actually been edited — there is no
   blank flash and no SEO cost.
   ═══════════════════════════════════════════════════════════ */
(() => {
'use strict';

const DRAFT_KEY = 'sf-content-draft';
const API = '/api/content';

const safe = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch {} }
};

/* dotted path lookup: dig(c, 'hero.lede') */
const dig = (obj, path) =>
  path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

/* deep merge so a partial edit never wipes untouched keys */
function merge(base, over) {
  if (Array.isArray(over)) return over.slice();
  if (over && typeof over === 'object') {
    const out = Object.assign({}, base);
    for (const k of Object.keys(over)) {
      out[k] = (base && typeof base[k] === 'object' && base[k] !== null)
        ? merge(base[k], over[k]) : over[k];
    }
    return out;
  }
  return over === undefined ? base : over;
}

async function fetchJSON(url, opts) {
  const r = await fetch(url, opts);
  if (!r.ok) throw new Error(url + ' → ' + r.status);
  return r.json();
}

const SFContent = {
  api: API,
  source: 'html',          // where the live content came from
  data: null,

  /* draft = unpublished edits, admin-preview only */
  draft() {
    try { return JSON.parse(safe.get(DRAFT_KEY)) || null; } catch { return null; }
  },
  saveDraft(c) { return safe.set(DRAFT_KEY, JSON.stringify(c)); },
  clearDraft() { safe.del(DRAFT_KEY); },

  async load({ preferDraft = false } = {}) {
    let base = null;
    try { base = await fetchJSON('content.json'); this.source = 'file'; } catch {}

    /* the API is optional — absent until the backend is deployed */
    try {
      const live = await fetchJSON(this.api);
      if (live && typeof live === 'object') {
        base = base ? merge(base, live) : live;
        this.source = 'api';
      }
    } catch {}

    if (preferDraft) {
      const d = this.draft();
      if (d) { base = base ? merge(base, d) : d; this.source = 'draft'; }
    }
    this.data = base;
    return base;
  },

  /* POST to the API. Returns false when there is no backend yet,
     so callers can fall back to downloading the file. */
  async publish(c) {
    try {
      await fetchJSON(this.api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(c)
      });
      return true;
    } catch { return false; }
  },

  /* bind every [data-c="path"] element to its value */
  bind(c, root = document) {
    if (!c) return;
    root.querySelectorAll('[data-c]').forEach(el => {
      const v = dig(c, el.dataset.c);
      if (v === undefined || v === null || v === '') return;
      const attr = el.dataset.cAttr;
      if (attr) { el.setAttribute(attr, v); return; }
      /* multi-line values keep their line breaks */
      if (String(v).includes('\n')) {
        el.innerHTML = '';
        String(v).split('\n').forEach((line, i) => {
          if (i) el.appendChild(document.createElement('br'));
          el.appendChild(document.createTextNode(line));
        });
      } else {
        el.textContent = v;
      }
    });

    /* things that are not plain text nodes */
    const b = c.business || {};
    if (b.phone) {
      const href = 'tel:+1' + String(b.phone).replace(/\D/g, '');
      document.querySelectorAll('[data-tel]').forEach(a => {
        a.setAttribute('href', href);
        if (a.dataset.tel === 'text') a.textContent = b.phone;
      });
    }
    if (b.email) {
      document.querySelectorAll('[data-mail]').forEach(a => {
        a.setAttribute('href', 'mailto:' + b.email);
        if (a.dataset.mail === 'text') a.textContent = b.email;
      });
    }
    if (c.seo) {
      if (c.seo.title) document.title = c.seo.title;
      const d = document.querySelector('meta[name=description]');
      if (d && c.seo.description) d.setAttribute('content', c.seo.description);
    }
  },

  dig, merge
};

window.SFContent = SFContent;
})();
