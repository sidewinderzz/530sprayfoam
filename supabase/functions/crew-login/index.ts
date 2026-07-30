/* ═══════════════════════════════════════════════════════════
   crew-login — exchange the short crew passcode for a real
   Supabase session.

   Why this exists: the crew wants to type "marc". Supabase Auth
   requires 6+ characters, and short passwords are weak anyway.
   So the passcode never IS the account password — it is only a
   token this function checks. The real account password is a
   long random secret that lives in the function's environment
   and never reaches the browser.

   The browser gets back a genuine Supabase session, so every
   query afterwards is governed by Row Level Security rather
   than by a client-side `if` statement.

   Environment (set with `supabase secrets set`):
     CREW_PASSCODE        the short code the crew types  (marc)
     CREW_EMAIL           the auth account               (crew@530sprayfoam.com)
     CREW_PASSWORD        long random real password
     SUPABASE_URL         provided automatically
     SUPABASE_ANON_KEY    provided automatically
     SUPABASE_SERVICE_ROLE_KEY provided automatically
   ═══════════════════════════════════════════════════════════ */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const MAX_ATTEMPTS = 8;          // per IP
const WINDOW_MIN   = 15;         // rolling window

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

/* length-independent comparison, so response time leaks nothing */
function constantTimeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a), y = enc.encode(b);
  let diff = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const PASSCODE = Deno.env.get('CREW_PASSCODE');
  const EMAIL    = Deno.env.get('CREW_EMAIL');
  const PASSWORD = Deno.env.get('CREW_PASSWORD');
  const URL      = Deno.env.get('SUPABASE_URL');
  const ANON     = Deno.env.get('SUPABASE_ANON_KEY');
  const SERVICE  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!PASSCODE || !EMAIL || !PASSWORD || !URL || !ANON || !SERVICE) {
    console.error('crew-login is missing environment configuration');
    return json({ error: 'Login is not configured yet.' }, 500);
  }

  let passcode = '';
  try {
    const body = await req.json();
    passcode = String(body?.passcode ?? '');
  } catch {
    return json({ error: 'Bad request' }, 400);
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

  /* ── throttle: too many wrong guesses from one address ── */
  const since = new Date(Date.now() - WINDOW_MIN * 60_000).toISOString();
  const { count } = await admin
    .from('login_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('ip', ip).eq('ok', false).gte('at', since);

  if ((count ?? 0) >= MAX_ATTEMPTS) {
    return json({ error: `Too many attempts. Try again in ${WINDOW_MIN} minutes.` }, 429);
  }

  /* ── check the passcode ── */
  const ok = constantTimeEqual(passcode.trim().toLowerCase(), PASSCODE.trim().toLowerCase());
  await admin.from('login_attempts').insert({ ip, ok });

  if (!ok) {
    await new Promise(r => setTimeout(r, 400));   // blunt the guessing rate
    return json({ error: 'Wrong password.' }, 401);
  }

  /* ── mint a real session ── */
  const pub = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data, error } = await pub.auth.signInWithPassword({
    email: EMAIL, password: PASSWORD
  });

  if (error || !data.session) {
    console.error('crew account sign-in failed:', error?.message);
    return json({ error: 'Login is not configured yet.' }, 500);
  }

  return json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at
  });
});
