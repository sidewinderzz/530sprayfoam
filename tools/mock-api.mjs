#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════
   Local stand-in for the Netlify Functions API.

   `netlify dev` needs a linked site and provisions a real
   database. This serves the same /api contract from memory so
   the front end can be developed and tested without either.

   It is a development tool: data lives in memory and vanishes
   when you stop it. It is never deployed — Netlify serves the
   real functions in netlify/functions/.

     node tools/mock-api.mjs           # http://localhost:8787
   ═══════════════════════════════════════════════════════════ */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const PORT = Number(process.env.PORT || 8787);
const ROOT = process.cwd();
const PASSCODE = process.env.CREW_PASSCODE;
if (!PASSCODE) {
  console.error('CREW_PASSCODE is not set. Run:  CREW_PASSCODE=... node tools/mock-api.mjs');
  process.exit(1);
}
const SECRET = process.env.SESSION_SECRET || 'dev-only-secret';

const db = { content: {}, leads: [], attempts: [], photos: new Map(), subs: [], alerts: [] };
let nextId = 1;

/* ── session cookie, same scheme as netlify/lib/auth.mjs ──── */
const b64url = b => Buffer.from(b).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const unb64url = s => Buffer.from(s.replace(/-/g,'+').replace(/_/g,'/'), 'base64');

function sign(payload) {
  const body = b64url(JSON.stringify(payload));
  return `${body}.${b64url(createHmac('sha256', SECRET).update(body).digest())}`;
}
function verify(token) {
  if (!token) return null;
  const [body, sig] = String(token).split('.');
  if (!body || !sig) return null;
  const expected = createHmac('sha256', SECRET).update(body).digest();
  const given = unb64url(sig);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const p = JSON.parse(unb64url(body).toString());
    return p.exp > Date.now() ? p : null;
  } catch { return null; }
}
const cookieOf = (req, name = 'sf_session') =>
  (req.headers.cookie || '').split(';').map(s => s.trim().split('='))
    .find(([k]) => k === name)?.slice(1).join('=') || null;
const authed = req => !!verify(cookieOf(req));

const send = (res, status, body, headers = {}) => {
  const payload = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, Object.assign(
    { 'Content-Type': Buffer.isBuffer(body) ? 'application/octet-stream' : 'application/json' },
    headers));
  res.end(payload);
};
const readBody = req => new Promise((resolve, reject) => {
  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => resolve(Buffer.concat(chunks)));
  req.on('error', reject);
});

const MIME = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript',
  '.css':'text/css', '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg',
  '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json' };

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  try {
    /* ── /api/login ── */
    if (path === '/api/login') {
      if (req.method === 'GET') return send(res, 200, { signedIn: authed(req) });
      if (req.method === 'DELETE') {
        return send(res, 200, { ok: true },
          { 'Set-Cookie': 'sf_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0' });
      }
      if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });

      const { passcode = '' } = JSON.parse((await readBody(req)).toString() || '{}');
      const ip = req.socket.remoteAddress || 'unknown';
      const since = Date.now() - 15 * 60_000;
      const fails = db.attempts.filter(a => a.ip === ip && !a.ok && a.at > since).length;
      if (fails >= 8) return send(res, 429, { error: 'Too many attempts. Try again in 15 minutes.' });

      const ok = String(passcode).trim().toLowerCase() === PASSCODE.toLowerCase();
      db.attempts.push({ ip, ok, at: Date.now() });
      if (!ok) {
        await new Promise(r => setTimeout(r, 150));
        return send(res, 401, { error: 'Wrong password.' });
      }
      const token = sign({ sub: 'crew', exp: Date.now() + 12 * 3600_000 });
      return send(res, 200, { ok: true },
        { 'Set-Cookie': `sf_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200` });
    }

    /* ── /api/content ── */
    if (path === '/api/content') {
      if (req.method === 'GET') return send(res, 200, db.content);
      if (req.method === 'PUT' || req.method === 'POST') {
        if (!authed(req)) return send(res, 401, { error: 'Not signed in.' });
        const raw = (await readBody(req)).toString();
        let data; try { data = JSON.parse(raw); } catch { return send(res, 400, { error: 'Invalid JSON.' }); }
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
          return send(res, 400, { error: 'Content must be an object.' });
        }
        db.content = data;
        return send(res, 200, { ok: true, updated_at: new Date().toISOString() });
      }
      return send(res, 405, { error: 'Method not allowed' });
    }

    /* ── /api/leads ── */
    if (path === '/api/leads' || path.startsWith('/api/leads/')) {
      const id = path.startsWith('/api/leads/') ? decodeURIComponent(path.slice(11)) : null;

      if (req.method === 'POST' && !id) {
        const b = JSON.parse((await readBody(req)).toString() || '{}');
        if (!b.name || !b.phone) return send(res, 400, { error: 'Name and phone are required.' });
        if (String(b.phone).replace(/\D/g, '').length < 10) {
          return send(res, 400, { error: 'A valid phone number is required.' });
        }
        if (b.website) return send(res, 200, { ok: true, ref: 'ignored' });   // honeypot
        const ref = 'SF-' + randomBytes(4).toString('hex').toUpperCase();
        db.leads.unshift({
          id: String(nextId++), ref, at: new Date().toISOString(), name: b.name, phone: b.phone,
          email: b.email, city: b.city, zip: b.zip, sqft: b.sqft, buildingType: b.buildingType,
          areas: b.areas || [], timeline: b.timeline, notes: b.notes, consent: !!b.consent,
          estimate: b.estimate, status: 'new', read: false
        });
        /* record what the real functions would have sent */
        db.alerts.push({
          at: new Date().toISOString(),
          ref,
          pushTo: db.subs.length,
          title: `New lead — ${b.name}`,
          body: [b.buildingType, b.sqft ? `${b.sqft} sq ft` : null, b.city || b.zip]
            .filter(Boolean).join(' · ')
        });
        return send(res, 201, { ok: true, ref });
      }

      if (!authed(req)) return send(res, 401, { error: 'Not signed in.' });

      if (req.method === 'GET' && !id) return send(res, 200, db.leads);
      if (req.method === 'PATCH' && id) {
        const b = JSON.parse((await readBody(req)).toString() || '{}');
        const lead = db.leads.find(l => l.id === id);
        if (!lead) return send(res, 404, { error: 'Not found' });
        if (b.status !== undefined) {
          if (!['new','contacted','quoted','won','lost'].includes(b.status)) {
            return send(res, 400, { error: 'Unknown status' });
          }
          lead.status = b.status;
        }
        if (b.read !== undefined) lead.read = !!b.read;
        return send(res, 200, { ok: true });
      }
      if (req.method === 'DELETE' && id) {
        db.leads = db.leads.filter(l => l.id !== id);
        return send(res, 200, { ok: true });
      }
      return send(res, 405, { error: 'Method not allowed' });
    }

    /* ── /api/push ── */
    if (path === '/api/push') {
      if (!authed(req)) return send(res, 401, { error: 'Not signed in.' });
      if (req.method === 'GET') {
        return send(res, 200, {
          configured: !!process.env.VAPID_PUBLIC_KEY,
          publicKey: process.env.VAPID_PUBLIC_KEY || null
        });
      }
      if (req.method === 'POST') {
        if (!process.env.VAPID_PUBLIC_KEY) {
          return send(res, 503, { error: 'Push is not configured on the server.' });
        }
        const b = JSON.parse((await readBody(req)).toString() || '{}');
        const ep = b?.subscription?.endpoint;
        if (!ep || !b?.subscription?.keys?.p256dh || !b?.subscription?.keys?.auth) {
          return send(res, 400, { error: 'Incomplete subscription.' });
        }
        db.subs = db.subs.filter(s => s.endpoint !== ep);
        db.subs.push({ endpoint: ep, label: b.label });
        return send(res, 200, { ok: true });
      }
      if (req.method === 'DELETE') {
        const b = JSON.parse((await readBody(req)).toString() || '{}');
        db.subs = db.subs.filter(s => s.endpoint !== b.endpoint);
        return send(res, 200, { ok: true });
      }
      return send(res, 405, { error: 'Method not allowed' });
    }

    /* test helper: what alerts would have gone out */
    if (path === '/api/_alerts') return send(res, 200, db.alerts);

    /* ── /api/photos ── */
    if (path === '/api/photos' || path.startsWith('/api/photos/')) {
      const key = path.startsWith('/api/photos/') ? decodeURIComponent(path.slice(12)) : null;
      if (req.method === 'GET' && key) {
        const p = db.photos.get(key);
        if (!p) return send(res, 404, { error: 'Not found' });
        return send(res, 200, p.buf, { 'Content-Type': p.type, 'Cache-Control': 'public, max-age=31536000, immutable' });
      }
      if (req.method === 'POST') {
        if (!authed(req)) return send(res, 401, { error: 'Not signed in.' });
        const type = (req.headers['content-type'] || '').split(';')[0].trim();
        if (!['image/jpeg','image/png','image/webp'].includes(type)) {
          return send(res, 415, { error: 'Only JPEG, PNG or WebP images are accepted.' });
        }
        const buf = await readBody(req);
        if (!buf.length) return send(res, 400, { error: 'Empty upload.' });
        const name = `${Date.now().toString(36)}-${randomBytes(4).toString('hex')}.` +
          (type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg');
        db.photos.set(name, { buf, type });
        return send(res, 201, { ok: true, url: `/api/photos/${name}` });
      }
      return send(res, 405, { error: 'Method not allowed' });
    }

    /* ── static files ── */
    let rel = path === '/' ? '/index.html' : path;
    const file = join(ROOT, normalize(rel).replace(/^(\.\.[/\\])+/, ''));
    if (!file.startsWith(ROOT)) return send(res, 403, { error: 'Forbidden' });
    const info = await stat(file).catch(() => null);
    if (!info || !info.isFile()) return send(res, 404, { error: 'Not found' });
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(body);
  } catch (e) {
    console.error(e);
    send(res, 500, { error: String(e && e.message || e) });
  }
});

server.listen(PORT, () => {
  console.log(`mock api + static site → http://localhost:${PORT}`);
  console.log(`passcode: ${PASSCODE}  (in-memory; restart wipes everything)`);
});
