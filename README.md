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

### Lead alerts

Tap the bell. With the server configured, that registers the device for **Web Push** — a lead
raises a notification even with the tab closed and the phone locked. The device is stored in
`push_subscriptions` and pruned automatically when the browser discards the subscription.

If push is not available (local mode, or `VAPID_*` unset) the button still grants permission but
the toast says *"only while this page is open"*, because that is the truth.

**iPhone:** Web Push only works once the site is installed to the home screen — Share → Add to
Home Screen. In a plain Safari tab, Apple delivers nothing. Worth pairing with email.

Email alerts go out through Resend when `RESEND_API_KEY` and `ALERT_EMAIL_TO` are set. Both
channels are independent, and **a failing alert never fails the lead** — by the time alerts run
the lead is already saved.

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
- **Publish** writes to the database through `/api/content` and is live at once. Without the API
  the editor says so plainly and offers **Download content.json** instead.

### How content reaches the page

`index.html` contains the full copy as static markup, so the page is complete and indexable with
JavaScript off. `content.js` loads `content.json` (then `/api/content` if present) and overrides
any `[data-c="path"]` element. Nothing flashes and there is no SEO cost.

Publishing writes to `/api/content` and takes effect immediately — see the backend section.

## Backend — Netlify DB + Functions

The site already deploys to **530sprayfoam.netlify.app**. The database provisions itself on
deploy; there is nothing to create by hand and no project limit to run into.

| File | What it does |
| --- | --- |
| `netlify.toml` | Static publish from the repo root, functions dir, security headers |
| `netlify/database/migrations/001_init/` | `content`, `leads`, `login_attempts` tables |
| `netlify/functions/login.mjs` | Passcode → HttpOnly session cookie |
| `netlify/functions/content.mjs` | `GET` public, `PUT` crew-only |
| `netlify/functions/leads.mjs` | `POST` public, list/patch/delete crew-only |
| `netlify/functions/photos.mjs` | Upload to Netlify Blobs, serve back cached |
| `netlify/lib/auth.mjs` | HMAC session signing and verification |
| `db.js` | The only front-end module that talks to storage |
| `tools/mock-api.mjs` | Local stand-in for the API, for development |

### Environment variables

Set in **Site configuration → Environment variables**, then redeploy.

**Required — login does not work without these:**
```
CREW_PASSCODE  = marc
SESSION_SECRET = <openssl rand -base64 32>
```
`SESSION_SECRET` signs the session cookie. Anyone who learns it can forge a login, so never
commit it. Missing either, the login function returns 500 and says it is unconfigured rather
than letting anyone in.

**Push alerts** — generate a key pair with `npx web-push generate-vapid-keys`:
```
VAPID_PUBLIC_KEY  = <public key>
VAPID_PRIVATE_KEY = <private key>
VAPID_SUBJECT     = mailto:you@530sprayfoam.com
```

**Email alerts** — optional, via [Resend](https://resend.com) (free tier covers this easily):
```
RESEND_API_KEY   = re_...
ALERT_EMAIL_TO   = you@example.com          (comma-separate for several)
ALERT_EMAIL_FROM = leads@530sprayfoam.com   (must be a domain verified in Resend)
```

Each group is independent. No VAPID keys means no push, no Resend key means no email, and
neither stops leads being saved.

### How `marc` works without being a weak password

The passcode is checked server-side and never stored as a credential. On a match the function
issues an **HMAC-signed session in an HttpOnly cookie** — which JavaScript on the page cannot
read, so an XSS bug cannot steal the session. Wrong guesses are rate limited to 8 per IP per 15
minutes with a delay on each failure.

The important shift is that the browser no longer decides anything. Reading leads requires a
valid cookie the server verifies; a visitor viewing source learns nothing. Previously the
password was in `admin.js` for anyone to read.

### Local development

```bash
node tools/mock-api.mjs      # serves the site + the same /api contract on :8787
```
In-memory, wiped on restart. Use `netlify dev` instead once the site is linked, to run the real
functions against a real database branch.

### Without the API

Open the site from any plain static server and `db.js` finds no API, reports `mode: 'local'`,
and falls back to browser storage exactly as before. The admin shows a banner saying so.

> An earlier Supabase implementation of the same thing (schema, RLS policies and a passcode edge
> function) is in git history at commit `35bff86` if this ever needs to move there. It was
> abandoned because the free tier caps the org at 2 active projects.

## Known limits — read before going live

1. **Auth is only as strong as the mode you are in.** With the API deployed the passcode is
   checked server-side and the session is a signed HttpOnly cookie. In local mode it is still a
   client-side check.
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
