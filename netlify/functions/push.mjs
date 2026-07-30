/* GET    /api/push  → { publicKey, configured }  (crew only)
   POST   /api/push  → register this device       (crew only)
   DELETE /api/push  → unregister it              (crew only)

   Subscriptions are crew-only: a lead alert must only ever go to
   the business, never to a visitor who happened to allow
   notifications on the public site. */
import { getDatabase } from '@netlify/database';
import { authed, json, unauthorized } from '../lib/auth.mjs';
import { pushConfigured } from '../lib/notify.mjs';

export default async (req) => {
  if (!authed(req)) return unauthorized();
  const db = getDatabase();

  if (req.method === 'GET') {
    return json({
      configured: pushConfigured(),
      publicKey: process.env.VAPID_PUBLIC_KEY || null
    });
  }

  if (req.method === 'POST') {
    if (!pushConfigured()) return json({ error: 'Push is not configured on the server.' }, 503);

    let b;
    try { b = await req.json(); } catch { return json({ error: 'Bad request' }, 400); }
    const endpoint = b?.subscription?.endpoint;
    const p256dh = b?.subscription?.keys?.p256dh;
    const auth = b?.subscription?.keys?.auth;
    if (!endpoint || !p256dh || !auth) return json({ error: 'Incomplete subscription.' }, 400);

    await db.sql`
      insert into push_subscriptions (endpoint, p256dh, auth, label)
      values (${endpoint}, ${p256dh}, ${auth}, ${String(b.label || '').slice(0, 80) || null})
      on conflict (endpoint) do update
        set p256dh = excluded.p256dh, auth = excluded.auth, failures = 0`;

    return json({ ok: true });
  }

  if (req.method === 'DELETE') {
    let b = {};
    try { b = await req.json(); } catch {}
    if (b.endpoint) await db.sql`delete from push_subscriptions where endpoint = ${b.endpoint}`;
    return json({ ok: true });
  }

  return json({ error: 'Method not allowed' }, 405);
};

export const config = { path: '/api/push' };
