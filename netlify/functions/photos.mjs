/* POST /api/photos            → upload a job photo (crew only)
   POST /api/photos?from=quote  → a customer attaching photos to their own
                                  quote request (public, rate limited)
   GET  /api/photos/:key        → serve it (public)

   Photos go to Netlify Blobs rather than into the content JSON,
   so the content payload stays small and images can be cached
   hard by the CDN.

   The public path is open on purpose: photos of the attic hatch and the
   crawlspace are what let a job be priced without a second drive out, and
   putting them behind a login would mean nobody sends any. It is bounded
   instead — smaller size cap, and a per-IP hourly limit, so it cannot be
   turned into free image hosting. */
import { getStore } from '@netlify/blobs';
import { getDatabase } from '@netlify/database';
import { authed, json, unauthorized } from '../lib/auth.mjs';
import { randomBytes } from 'node:crypto';

const MAX_BYTES = 6 * 1024 * 1024;
const PUBLIC_MAX_BYTES = 3 * 1024 * 1024;   // the browser resizes to ~1600px first
const PUBLIC_PER_HOUR = 12;                 // three photos, a few attempts, and no more
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

const clientIp = req => (req.headers.get('x-nf-client-connection-ip')
  || req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';

export default async (req, context) => {
  const store = getStore('photos');
  const key = context?.params?.key;

  if (req.method === 'GET') {
    if (!key) return json({ error: 'Missing key' }, 400);
    const blob = await store.get(key, { type: 'arrayBuffer' });
    if (!blob) return json({ error: 'Not found' }, 404);
    const meta = await store.getMetadata(key).catch(() => null);
    return new Response(blob, {
      headers: {
        'Content-Type': meta?.metadata?.contentType || 'image/jpeg',
        /* content-addressed name, so it can be cached forever */
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    });
  }

  if (req.method === 'POST') {
    const fromQuote = new URL(req.url).searchParams.get('from') === 'quote';
    const crew = authed(req);
    if (!crew && !fromQuote) return unauthorized();

    let db = null;
    if (!crew) {
      db = getDatabase();
      const ip = clientIp(req);
      const [{ count }] = await db.sql`
        select count(*)::int as count from upload_attempts
        where ip = ${ip} and at > now() - interval '1 hour'`;
      if (count >= PUBLIC_PER_HOUR) {
        return json({ error: 'Too many uploads from this connection. Try again later.' }, 429);
      }
      await db.sql`insert into upload_attempts (ip) values (${ip})`;
    }

    const type = req.headers.get('content-type') || '';
    if (!ALLOWED.has(type.split(';')[0].trim())) {
      return json({ error: 'Only JPEG, PNG or WebP images are accepted.' }, 415);
    }
    const buf = await req.arrayBuffer();
    const cap = crew ? MAX_BYTES : PUBLIC_MAX_BYTES;
    if (buf.byteLength > cap) return json({ error: 'That image is too large.' }, 413);
    if (!buf.byteLength) return json({ error: 'Empty upload.' }, 400);

    const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
    const name = `${Date.now().toString(36)}-${randomBytes(4).toString('hex')}.${ext}`;
    await store.set(name, buf, { metadata: { contentType: type.split(';')[0].trim() } });

    return json({ ok: true, url: `/api/photos/${name}` }, 201);
  }

  return json({ error: 'Method not allowed' }, 405);
};

export const config = { path: ['/api/photos', '/api/photos/:key'] };
