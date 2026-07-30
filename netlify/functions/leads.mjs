/* POST   /api/leads      → public quote-form submission
   GET    /api/leads      → list (crew only)
   PATCH  /api/leads/:id  → status / read (crew only)
   DELETE /api/leads/:id  → remove (crew only) */
import { getDatabase } from '@netlify/database';
import { authed, json, unauthorized } from '../lib/auth.mjs';
import { alertNewLead } from '../lib/notify.mjs';
import { randomBytes } from 'node:crypto';

const str = (v, max) => (v === undefined || v === null) ? null : String(v).slice(0, max);
const STATUSES = ['new', 'contacted', 'quoted', 'won', 'lost'];

export default async (req, context) => {
  const db = getDatabase();
  const id = context?.params?.id;

  /* ── public: create ── */
  if (req.method === 'POST') {
    let b;
    try { b = await req.json(); } catch { return json({ error: 'Bad request' }, 400); }

    const name = str(b.name, 120), phone = str(b.phone, 40);
    if (!name || !phone) return json({ error: 'Name and phone are required.' }, 400);

    /* crude bot filter: a real form fills these in a plausible way */
    const digits = String(phone).replace(/\D/g, '');
    if (digits.length < 10) return json({ error: 'A valid phone number is required.' }, 400);
    if (b.website) return json({ ok: true, ref: 'ignored' });   // honeypot

    const ref = 'SF-' + randomBytes(4).toString('hex').toUpperCase();
    const sqft = Number.isFinite(+b.sqft) ? Math.max(0, Math.min(1_000_000, +b.sqft)) : null;

    const [row] = await db.sql`
      insert into leads (ref, name, phone, email, city, zip, sqft, building_type,
                         areas, timeline, notes, consent, estimate)
      values (${ref}, ${name}, ${phone}, ${str(b.email, 200)}, ${str(b.city, 80)},
              ${str(b.zip, 12)}, ${sqft}, ${str(b.buildingType, 80)},
              ${JSON.stringify(Array.isArray(b.areas) ? b.areas.slice(0, 20) : [])}::jsonb,
              ${str(b.timeline, 60)}, ${str(b.notes, 4000)}, ${!!b.consent},
              ${b.estimate ? JSON.stringify(b.estimate) : null}::jsonb)
      returning *`;

    /* The lead is saved. Alerts are best-effort from here: a failing
       notification must never turn into a failed submission, so this is
       awaited for its logs but its result cannot change the response. */
    try { await alertNewLead(db, row); }
    catch (e) { console.error('lead alert failed:', e.message); }

    return json({ ok: true, ref }, 201);
  }

  /* ── everything else is crew only ── */
  if (!authed(req)) return unauthorized();

  if (req.method === 'GET') {
    const rows = await db.sql`select * from leads order by created_at desc limit 1000`;
    return json(rows.map(r => ({
      id: String(r.id), ref: r.ref, at: r.created_at, name: r.name, phone: r.phone,
      email: r.email, city: r.city, zip: r.zip, sqft: r.sqft,
      buildingType: r.building_type, areas: r.areas || [], timeline: r.timeline,
      notes: r.notes, consent: r.consent, estimate: r.estimate,
      status: r.status, read: r.read
    })));
  }

  if (req.method === 'PATCH') {
    if (!id) return json({ error: 'Missing id' }, 400);
    let b; try { b = await req.json(); } catch { return json({ error: 'Bad request' }, 400); }

    if (b.status !== undefined) {
      if (!STATUSES.includes(b.status)) return json({ error: 'Unknown status' }, 400);
      await db.sql`update leads set status = ${b.status} where id = ${id}`;
    }
    if (b.read !== undefined) {
      await db.sql`update leads set read = ${!!b.read} where id = ${id}`;
    }
    return json({ ok: true });
  }

  if (req.method === 'DELETE') {
    if (!id) return json({ error: 'Missing id' }, 400);
    await db.sql`delete from leads where id = ${id}`;
    return json({ ok: true });
  }

  return json({ error: 'Method not allowed' }, 405);
};

export const config = { path: ['/api/leads', '/api/leads/:id'] };
