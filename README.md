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

## Known limits — read before going live

1. **The admin password is client-side.** `PASSWORD` sits in `admin.js`, readable in devtools. It
   keeps casual visitors out; it is not security. Move authentication server-side.
2. **Leads live in `localStorage`.** One browser, one device, no shared inbox; clearing site data
   wipes them. Export CSV for a copy.
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
