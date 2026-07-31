/* ═══════════════════════════════════════════════════════════
   Session handling for the crew login.

   The crew types a short passcode. That passcode is
   never a password hash and never grants access on its own —
   it is checked server-side, and on a match this issues a
   signed session token.

   The token lives in an HttpOnly cookie, so JavaScript on the
   page cannot read it. That is deliberately stronger than
   keeping a token in localStorage: an XSS bug on the site
   cannot steal the session.
   ═══════════════════════════════════════════════════════════ */
import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';

export const COOKIE = 'sf_session';
const TTL_HOURS = 12;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET is not set');
  return s;
}

const b64url = (buf) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s) =>
  Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

/** Sign a payload into `<body>.<signature>`. */
export function sign(payload) {
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(createHmac('sha256', secret()).update(body).digest());
  return `${body}.${sig}`;
}

/** Verify a token; returns the payload or null. */
export function verify(token) {
  if (!token || typeof token !== 'string') return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;

  const expected = createHmac('sha256', secret()).update(body).digest();
  const given = unb64url(sig);
  if (given.length !== expected.length) return null;
  if (!timingSafeEqual(given, expected)) return null;

  try {
    const payload = JSON.parse(unb64url(body).toString('utf8'));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}

export function newSession() {
  return sign({ sub: 'crew', jti: randomBytes(8).toString('hex'), exp: Date.now() + TTL_HOURS * 3600_000 });
}

export function cookieHeader(token, { clear = false } = {}) {
  const parts = [
    `${COOKIE}=${clear ? '' : token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    'Secure',
    clear ? 'Max-Age=0' : `Max-Age=${TTL_HOURS * 3600}`
  ];
  return parts.join('; ');
}

export function readCookie(req, name = COOKIE) {
  const raw = req.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

/** True when the request carries a valid crew session. */
export function authed(req) {
  return !!verify(readCookie(req));
}

export const json = (body, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, extraHeaders)
  });

export const unauthorized = () => json({ error: 'Not signed in.' }, 401);
