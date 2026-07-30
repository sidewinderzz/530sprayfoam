/* GET  /api/content  → published site content (public)
   PUT  /api/content  → replace it (crew only) */
import { getDatabase } from '@netlify/database';
import { authed, json, unauthorized } from '../lib/auth.mjs';

const MAX_BYTES = 4 * 1024 * 1024;   // generous for text, refuses a runaway payload

export default async (req) => {
  const db = getDatabase();

  if (req.method === 'GET') {
    const rows = await db.sql`select data, updated_at from content where id = 1`;
    return json(rows[0]?.data ?? {}, 200, {
      /* short cache: visitors get fresh copy quickly after a publish */
      'Cache-Control': 'public, max-age=30, stale-while-revalidate=300'
    });
  }

  if (req.method === 'PUT' || req.method === 'POST') {
    if (!authed(req)) return unauthorized();

    const raw = await req.text();
    if (raw.length > MAX_BYTES) return json({ error: 'Content is too large.' }, 413);

    let data;
    try { data = JSON.parse(raw); }
    catch { return json({ error: 'Invalid JSON.' }, 400); }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return json({ error: 'Content must be an object.' }, 400);
    }

    await db.sql`
      insert into content (id, data, updated_at) values (1, ${JSON.stringify(data)}::jsonb, now())
      on conflict (id) do update set data = excluded.data, updated_at = now()`;
    return json({ ok: true, updated_at: new Date().toISOString() });
  }

  return json({ error: 'Method not allowed' }, 405);
};

export const config = { path: '/api/content' };
