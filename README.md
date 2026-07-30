# 530 Spray Foam

Marketing site plus a password-gated crew inbox, built from the Claude Design handoff
(`Sprayfoam website mockup`). No build step, no dependencies — plain HTML, CSS and JS.

```bash
python3 -m http.server 8000     # http://localhost:8000
```

Serve over `http://` or `https://`, not `file://` — the service worker and notifications need an
origin.

## What was implemented

The handoff contained four mockups. Mockup **2A** is labelled *"desktop build of 1b"*, so
savings-led is the chosen direction, and this repo implements **1B (390px) and 2A (1440px) as one
responsive page**:

| Mockup | Status |
| --- | --- |
| **2A** — savings-led, desktop 1440 | Built (≥1025px) |
| **1B** — savings-led, mobile 390 | Built (≤1024px) |
| **1A** — quote-first, mobile | Turn-1 alternate, superseded. Its `sc-if` extras were folded in: trust bar, 40% band, before/after, reviews, financing, sticky call bar |
| **1C** — trade / industrial, dark | Turn-1 alternate, superseded. Its spec-sheet table appears under "See the full spec sheet" |

`support.js` in the handoff is the Claude Design prototype runtime (a React template compiler for
`<x-dc>` and `sc-if`) — there is nothing to port from it. The `sc-if` blocks are optional-section
toggles, which is why the 1A extras are included rather than dropped.

Tokens are lifted directly from the mockup source: navy `#1E3160`, deep navy `#16234A`, amber
`#E9A13B`, ink `#0E1116`, wash `#F4F6F9`; Barlow Condensed over Barlow; 8px controls, 14px cards,
16px estimator.

## Files

| File | What it is |
| --- | --- |
| `index.html` / `styles.css` / `app.js` | Public site |
| `admin.html` / `admin.css` / `admin.js` | Crew inbox (password gated) |
| `sw.js` / `manifest.webmanifest` | PWA shell, offline cache, notifications |
| `content.json` | Every editable word and photo on the site |
| `content.js` | Loads content and binds it over the HTML |
| `editor.js` | The admin content editor |
| `assets/logo-530*.png` | Logos from the handoff (resized to 900px, ~300KB each) |
| `assets/icon-*.png` | PWA icons generated from `logo-530-tight.png` |

## Public site

- Utility strip, sticky header with scrollspy, drawer below 1025px
- **Savings estimator** — sq ft slider, current-insulation radios, area checkboxes; live monthly
  and annual figures. Calibrated so the mockup's defaults (2,150 sq ft, no insulation, attic) land
  on **$148/month**, exactly as drawn. "Get exact quote" carries the numbers into the form.
- Open vs closed cards, with 1C's spec sheet behind a disclosure
- 40% band with a count-up
- **Interactive service-area map** — seven towns as SVG pins, hover/click/keyboard, synced to the
  town list and a detail card
- Process (three cards on desktop, connected timeline on mobile, per 1B)
- Job gallery with a keyboard-navigable lightbox, plus a drag/touch/arrow-key before-after slider
- Review carousel (swipeable, autoplaying, pausable), financing disclosure
- Quote form with per-field validation, phone masking and estimator prefill
- Sticky call bar, back-to-top, scroll reveals, `prefers-reduced-motion` and `:focus-visible` support

## Crew inbox (`/admin.html`)

Password: **`marc`**

- Lock screen with optional "stay signed in"
- Stat tiles, status filters, search, four sort orders, CSV export
- Expandable lead cards with call/text/email, status pipeline (new → contacted → quoted → won →
  lost), read/unread, delete
- Manual entry for phone-in leads
- Installable PWA with notifications and an app-icon badge count

### Notifications

Tap the bell (or the banner) to grant permission. New submissions raise a notification via the
service worker; the page also picks up leads from another tab through the `storage` event and a
5-second poll. `sw.js` already handles real `push` events, so adding a backend with VAPID keys
lights up true push without client changes.

## Verified

Headless Chromium, at 320 / 360 / 390 / 430 / 768 / 1024 / 1440: **no JS errors**, no horizontal
page scroll at any width. Exercised the estimator (including the $148 calibration), spec and
financing disclosures, map pins and town list, lightbox open/next/escape, before-after keyboard
control, review carousel, form validation and submit, mobile drawer, and the admin flow
(wrong-then-correct password, seed, expand, status change, filter, search, manual entry, sign out).
Manifest icons all return 200.

## Content editor

`/admin.html` → **Website** tab. Eleven sections covering what a contractor actually changes:
contact details, headline, numbers and claims, job photos, reviews, service cards, service area,
process steps, financing, quote form, and the Google listing. Layout, colours and structure stay
in code — the editor cannot break the design.

- Photos upload from a phone and are resized in the browser to 1600×1200 JPEG before storage
- Reviews, towns and financing points can be added, reordered and deleted
- **Preview** opens the public site with unpublished edits applied; the draft is never shown to
  real visitors
- **Publish** POSTs to `/api/content`. Until that endpoint exists, the editor says so plainly and
  offers **Download content.json** — commit that file and redeploy to publish.

### How content reaches the page

`index.html` contains the full copy as static markup, so the page is complete and indexable with
JavaScript off. `content.js` loads `content.json` (then `/api/content` if present) and overrides
any `[data-c="path"]` element. Nothing flashes and there is no SEO cost.

**Not built yet:** the `/api/content` endpoint. Publishing straight from the editor needs a
backend — see below.

## Supabase backend

Written and wired, **not yet connected** — Supabase refused to create the project because the
free tier allows 2 active projects per org and `nicfarms` + `farmsync` already fill both slots.
Everything below applies the moment a slot is freed (pause a project or upgrade to Pro).

| File | What it does |
| --- | --- |
| `supabase/migrations/0001_init.sql` | `content` + `leads` tables, RLS policies, `photos` storage bucket |
| `supabase/migrations/0002_login_attempts.sql` | Login throttling table |
| `supabase/functions/crew-login/index.ts` | Turns the short crew passcode into a real session |
| `supabase-config.js` | The two public values to fill in |
| `db.js` | The only module that talks to the database |

### How the `marc` passcode works with real auth

Supabase Auth requires 6+ characters, and short passwords are weak regardless. So `marc` is
**not** the account password. It is a token checked by the `crew-login` edge function, which
holds a long random password in its environment and, on a match, returns a genuine Supabase
session. The crew types four characters; the browser gets real auth.

That matters because every query is then governed by Row Level Security rather than a
client-side `if`. The policies say: anyone may read site content and insert a lead; **only a
signed-in session may read leads or change content**. A visitor cannot enumerate other people's
phone numbers even with the anon key in hand, which is exactly the hole the old client-side
password left open.

### Connecting it

```bash
supabase link --project-ref <ref>
supabase db push                          # applies both migrations
supabase functions deploy crew-login
supabase secrets set CREW_PASSCODE=marc \
  CREW_EMAIL=crew@530sprayfoam.com \
  CREW_PASSWORD="$(openssl rand -base64 32)"
# create that auth user once, with the same CREW_PASSWORD
```
Then put the project URL and anon key into `supabase-config.js` and redeploy. Both values are
public by design; the service role key must never appear in the front end.

### Until then

`db.js` reports `mode: 'local'` and everything falls back to browser storage, exactly as before.
The admin shows a banner saying so rather than implying it is connected. **Form submissions still
do not reach you** in this state.

## Known limits — read before going live

1. **Auth is only as strong as the mode you are in.** Connected to Supabase, the passcode is
   checked server-side and RLS enforces access. In local mode it is still a client-side check.
2. **In local mode, leads and content edits live in `localStorage`.** One browser, one device.
   Export CSV for leads; download `content.json` for content.
3. **Notifications only fire while a browser or the installed app has run the page recently.**
   Background delivery ("a lead arrives at 2am and the phone buzzes") needs a server sending Web
   Push.
4. **Photos are placeholders.** The mockup marks out job photos and a crew shot; those slots use
   CSS-art panels. Replace the `art` values in the `JOBS` array in `app.js` with `<img>` tags.
5. **All copy stats are the mockup's stand-ins** — phone `(530) 555-0182`, `CSLB #1091234`, 900+
   homes, 212 reviews, the 40% figure, and the four review quotes. Replace before publishing.
6. **The estimator is a marketing ballpark**, not an energy audit. Constants are `RATE`, `INS` and
   `ZONE` at the top of the estimator block in `app.js`.

The form `submit` handler in `app.js` and `saveLead()` in `admin.js` are the only two places that
write a lead. Point both at an API and limits 1–3 all go away.
