/* POST /api/login   { passcode }  → sets an HttpOnly session cookie
   DELETE /api/login                → clears it */
import { getDatabase } from '@netlify/database';
import { newSession, cookieHeader, json, authed } from '../lib/auth.mjs';
import { timingSafeEqual } from 'node:crypto';

const MAX_ATTEMPTS = 8;
const WINDOW_MIN = 15;

/* compare without leaking length or position through timing */
function sameSecret(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  if (x.length !== y.length) {
    // still burn a comparison so failure timing matches
    timingSafeEqual(x, x);
    return false;
  }
  return timingSafeEqual(x, y);
}

export default async (req) => {
  if (req.method === 'DELETE') {
    return json({ ok: true }, 200, { 'Set-Cookie': cookieHeader('', { clear: true }) });
  }
  if (req.method === 'GET') return json({ signedIn: authed(req) });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const PASSCODE = process.env.CREW_PASSCODE;
  if (!PASSCODE || !process.env.SESSION_SECRET) {
    console.error('login is missing CREW_PASSCODE or SESSION_SECRET');
    return json({ error: 'Login is not configured yet.' }, 500);
  }

  let passcode = '';
  try { passcode = String((await req.json())?.passcode ?? ''); }
  catch { return json({ error: 'Bad request' }, 400); }

  const ip = (req.headers.get('x-nf-client-connection-ip')
    || req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';

  const db = getDatabase();
  const [{ count }] = await db.sql`
    select count(*)::int as count from login_attempts
    where ip = ${ip} and ok = false and at > now() - (${WINDOW_MIN} || ' minutes')::interval`;

  if (count >= MAX_ATTEMPTS) {
    return json({ error: `Too many attempts. Try again in ${WINDOW_MIN} minutes.` }, 429);
  }

  const ok = sameSecret(passcode.trim().toLowerCase(), PASSCODE.trim().toLowerCase());
  await db.sql`insert into login_attempts (ip, ok) values (${ip}, ${ok})`;

  if (!ok) {
    await new Promise(r => setTimeout(r, 400));      // blunt guessing
    return json({ error: 'Wrong password.' }, 401);
  }

  return json({ ok: true }, 200, { 'Set-Cookie': cookieHeader(newSession()) });
};

export const config = { path: '/api/login' };
