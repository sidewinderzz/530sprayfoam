/* ═══════════════════════════════════════════════════════════
   Lead alerts.

   Two independent channels, each optional and configured only
   by environment variables:

     push   Web Push to every subscribed device (VAPID_*)
     email  a plain notification email (RESEND_API_KEY)

   Rules this file follows:
   - A failing alert must never fail the lead. The lead is
     already saved by the time we get here; losing the customer
     because an email provider hiccuped would be far worse than
     a missed notification.
   - Dead push subscriptions are pruned. A phone that uninstalled
     the app returns 404/410 forever otherwise.
   ═══════════════════════════════════════════════════════════ */
import webpush from 'web-push';

let vapidReady = false;
function initVapid() {
  if (vapidReady) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:info@530sprayfoam.com',
    pub, priv
  );
  vapidReady = true;
  return true;
}

export const pushConfigured  = () => !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
export const emailConfigured = () => !!(process.env.RESEND_API_KEY && process.env.ALERT_EMAIL_TO);

/** Short human summary used by both channels. */
export function summarise(lead) {
  const bits = [
    lead.building_type || lead.buildingType,
    lead.sqft ? `${Number(lead.sqft).toLocaleString('en-US')} sq ft` : null,
    lead.city || lead.zip
  ].filter(Boolean);
  return bits.join(' · ') || 'New enquiry';
}

/* ── push ────────────────────────────────────────────────── */
/* Send one notification to every registered device. Shared by the
   new-lead alert and the daily follow-up digest, so dead-subscription
   pruning only lives in one place. */
export async function pushToAll(db, note) {
  if (!initVapid()) return { sent: 0, skipped: 'not-configured' };

  let subs = [];
  try { subs = await db.sql`select * from push_subscriptions`; }
  catch (e) { console.error('could not read push subscriptions:', e.message); return { sent: 0 }; }
  if (!subs.length) return { sent: 0 };

  const payload = JSON.stringify(note);

  let sent = 0;
  const dead = [];

  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
        { TTL: 3600, urgency: 'high' }
      );
      sent++;
    } catch (e) {
      const code = e.statusCode || 0;
      /* 404/410 mean the browser threw the subscription away for good */
      if (code === 404 || code === 410) dead.push(s.endpoint);
      else console.error('push failed', code, e.body || e.message);
    }
  }));

  if (dead.length) {
    try {
      await db.sql`delete from push_subscriptions where endpoint = any(${dead})`;
      console.log(`pruned ${dead.length} dead push subscription(s)`);
    } catch (e) { console.error('prune failed:', e.message); }
  }
  return { sent, pruned: dead.length };
}

export function sendPush(db, lead) {
  return pushToAll(db, {
    title: `New lead — ${lead.name}`,
    body: `${summarise(lead)}\n${lead.phone}`,
    tag: `lead-${lead.ref}`,
    url: '/admin.html#new'
  });
}

/* ── email ───────────────────────────────────────────────── */
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export async function sendEmail(lead) {
  if (!emailConfigured()) return { sent: false, skipped: 'not-configured' };

  const to = process.env.ALERT_EMAIL_TO.split(',').map(s => s.trim()).filter(Boolean);
  const from = process.env.ALERT_EMAIL_FROM || 'leads@530sprayfoam.com';
  const tel = String(lead.phone).replace(/\D/g, '');
  const site = (process.env.URL || 'https://530sprayfoam.netlify.app').replace(/\/$/, '');
  const photos = (lead.photos || []).filter(u => /^\/api\/photos\//.test(String(u)));

  const rows = [
    ['Phone', `<a href="tel:${esc(tel)}">${esc(lead.phone)}</a>`],
    ['Email', lead.email ? `<a href="mailto:${esc(lead.email)}">${esc(lead.email)}</a>` : '—'],
    ['Location', esc([lead.city, lead.zip].filter(Boolean).join(' ') || '—')],
    ['Building', esc(lead.building_type || lead.buildingType || '—')],
    ['Size', lead.sqft ? esc(Number(lead.sqft).toLocaleString('en-US')) + ' sq ft' : '—'],
    ['Areas', esc((lead.areas || []).join(', ') || '—')],
    ['Timeline', esc(lead.timeline || '—')],
    ['Photos', photos.length ? String(photos.length) : '—'],
    ['Text OK', lead.consent ? 'Yes' : 'No'],
    ['Ref', esc(lead.ref)]
  ];

  const html = `
<div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:560px;margin:0 auto">
  <div style="background:#16234A;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0">
    <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#9FB0D0">New lead</div>
    <div style="font-size:26px;font-weight:800;margin-top:4px">${esc(lead.name)}</div>
    <div style="font-size:15px;color:#C7D2E6;margin-top:4px">${esc(summarise(lead))}</div>
  </div>
  <div style="border:1px solid #DDE1E8;border-top:0;border-radius:0 0 12px 12px;padding:8px 24px 20px">
    <table style="width:100%;border-collapse:collapse;font-size:15px">
      ${rows.map(([k, v]) => `<tr>
        <td style="padding:10px 0;color:#66748F;border-bottom:1px solid #EEF1F5;width:38%">${k}</td>
        <td style="padding:10px 0;color:#0E1116;border-bottom:1px solid #EEF1F5;font-weight:600">${v}</td>
      </tr>`).join('')}
    </table>
    ${lead.notes ? `<div style="margin-top:16px;background:#F4F6F9;border-radius:8px;padding:14px;
      font-size:14px;line-height:1.55;color:#3A4252;white-space:pre-wrap">${esc(lead.notes)}</div>` : ''}
    ${photos.length ? `<div style="margin-top:16px">
      <div style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#66748F;
        margin-bottom:8px">Photos from the customer</div>
      ${photos.map(u => `<a href="${esc(site + u)}"><img src="${esc(site + u)}" width="150"
        style="width:150px;height:112px;object-fit:cover;border-radius:8px;margin:0 6px 6px 0"
        alt=""></a>`).join('')}
    </div>` : ''}
    <div style="margin-top:20px">
      <a href="tel:${esc(tel)}" style="display:inline-block;background:#E9A13B;color:#0E1116;
        text-decoration:none;font-weight:800;padding:13px 22px;border-radius:8px">Call ${esc(lead.phone)}</a>
    </div>
  </div>
</div>`;

  const text = [
    `New lead — ${lead.name}`,
    summarise(lead),
    ...rows.map(([k, v]) => `${k}: ${String(v).replace(/<[^>]+>/g, '')}`),
    lead.notes ? `\nNotes:\n${lead.notes}` : '',
    photos.length ? `\nPhotos:\n${photos.map(u => site + u).join('\n')}` : ''
  ].join('\n');

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from, to,
        reply_to: lead.email || undefined,
        subject: `New lead — ${lead.name} (${summarise(lead)})`,
        html, text
      })
    });
    if (!r.ok) {
      console.error('email send failed:', r.status, (await r.text()).slice(0, 300));
      return { sent: false };
    }
    return { sent: true };
  } catch (e) {
    console.error('email send threw:', e.message);
    return { sent: false };
  }
}

/** Fire every configured channel. Never throws. */
export async function alertNewLead(db, lead) {
  const results = await Promise.allSettled([sendPush(db, lead), sendEmail(lead)]);
  return {
    push: results[0].status === 'fulfilled' ? results[0].value : { error: String(results[0].reason) },
    email: results[1].status === 'fulfilled' ? results[1].value : { error: String(results[1].reason) }
  };
}
