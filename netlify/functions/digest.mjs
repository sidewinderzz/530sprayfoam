/* Daily follow-up digest — a scheduled function.

   A quote nobody chased is the most expensive thing in the inbox, and
   nothing on a phone reminds you about it. Once a day this counts the
   leads that have gone past their chase window and, if there are any,
   raises one notification. It never fires when there is nothing to do,
   because a digest you learn to ignore is worse than no digest.

   Windows match COLD in admin.js — keep the two in step. */
import { getDatabase } from '@netlify/database';
import { pushToAll } from '../lib/notify.mjs';

export default async () => {
  const db = getDatabase();

  let rows;
  try {
    rows = await db.sql`
      select status, count(*)::int as n from leads
       where (status = 'new'       and created_at < now() - interval '2 hours')
          or (status = 'contacted' and created_at < now() - interval '2 days')
          or (status = 'quoted'    and created_at < now() - interval '5 days')
       group by status`;
  } catch (e) {
    console.error('digest query failed:', e.message);
    return new Response('error', { status: 500 });
  }

  const by = Object.fromEntries(rows.map(r => [r.status, r.n]));
  const total = rows.reduce((s, r) => s + r.n, 0);
  if (!total) return new Response('nothing to chase');

  const parts = [
    by.new       ? `${by.new} not called yet` : null,
    by.contacted ? `${by.contacted} with no answer` : null,
    by.quoted    ? `${by.quoted} quote${by.quoted > 1 ? 's' : ''} waiting on an answer` : null
  ].filter(Boolean);

  const res = await pushToAll(db, {
    title: total === 1 ? '1 lead needs a follow-up' : `${total} leads need a follow-up`,
    body: parts.join('\n'),
    /* a fixed tag so today's digest replaces yesterday's rather than stacking */
    tag: 'sf-digest',
    url: '/admin.html#followup'
  });

  console.log('digest sent to', res.sent, 'device(s):', parts.join('; '));
  return new Response('ok');
};

/* 16:00 UTC ≈ 9am Pacific in summer, 8am in winter — the start of the
   day, when there is still time to make the calls. */
export const config = { schedule: '0 16 * * *' };
