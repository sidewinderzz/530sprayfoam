/* ═══════════════════════════════════════════════════════════
   Supabase connection.

   Both values below are PUBLIC by design — the anon key is meant
   to ship in the browser, and it is safe because Row Level
   Security decides what it can actually do (read content, insert
   a lead, nothing more). The service role key must NEVER appear
   in this file or anywhere else in the front end.

   While these are placeholders the whole site runs in local
   mode: leads and content edits stay in the browser, exactly as
   they did before.

   To connect: replace the two values, commit, redeploy.
   `url` looks like  https://abcdefghijkl.supabase.co
   `anonKey` is the "anon public" key from
   Project Settings → API.
   ═══════════════════════════════════════════════════════════ */
window.SUPABASE_CONFIG = {
  url: 'YOUR_SUPABASE_URL',
  anonKey: 'YOUR_SUPABASE_ANON_KEY'
};
