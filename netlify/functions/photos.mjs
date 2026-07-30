/* POST /api/photos      → upload a job photo (crew only)
   GET  /api/photos/:key → serve it (public)

   Photos go to Netlify Blobs rather than into the content JSON,
   so the content payload stays small and images can be cached
   hard by the CDN. */
import { getStore } from '@netlify/blobs';
import { authed, json, unauthorized } from '../lib/auth.mjs';
import { randomBytes } from 'node:crypto';

const MAX_BYTES = 6 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

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
    if (!authed(req)) return unauthorized();

    const type = req.headers.get('content-type') || '';
    if (!ALLOWED.has(type.split(';')[0].trim())) {
      return json({ error: 'Only JPEG, PNG or WebP images are accepted.' }, 415);
    }
    const buf = await req.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) return json({ error: 'That image is too large.' }, 413);
    if (!buf.byteLength) return json({ error: 'Empty upload.' }, 400);

    const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
    const name = `${Date.now().toString(36)}-${randomBytes(4).toString('hex')}.${ext}`;
    await store.set(name, buf, { metadata: { contentType: type.split(';')[0].trim() } });

    return json({ ok: true, url: `/api/photos/${name}` }, 201);
  }

  return json({ error: 'Method not allowed' }, 405);
};

export const config = { path: ['/api/photos', '/api/photos/:key'] };
