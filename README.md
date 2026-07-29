# 530 Spray Foam

Marketing site plus an admin lead inbox. No build step, no dependencies — plain HTML, CSS and
ES modules-free JavaScript. Open `index.html` over HTTP and it runs.

```bash
python3 -m http.server 8000     # then visit http://localhost:8000
```

Serve over `http://` or `https://`, not `file://` — the service worker and notifications need an
origin.

## Files

| File | What it is |
| --- | --- |
| `index.html` / `styles.css` / `app.js` | Public site |
| `admin.html` / `admin.css` / `admin.js` | Lead inbox (password gated) |
| `sw.js` / `manifest.webmanifest` | PWA shell, offline cache, notifications |
| `assets/logo-530.svg` | Fallback logo mark |

## The logo

Every logo slot loads `assets/logo-530.png` first and falls back to `assets/logo-530.svg` if it is
missing. **Drop the real PNG at `assets/logo-530.png`** and it picks up everywhere — header,
footer, admin, lock screen, favicon. Add `assets/icon-192.png` and `assets/icon-512.png` for
proper installed-app icons on Android (iOS uses the SVG apple-touch-icon).

## Public site

Interactive throughout, responsive from 320px to desktop, and keyboard-accessible:

- Sticky header with scroll progress, active-section highlighting and a mobile drawer
- Animated hero gauge and R-value bars that fire on scroll
- Expandable service cards (6 services)
- Insulation comparison tabs — foam vs. fiberglass vs. cellulose
- **Savings calculator** — sliders for square footage, monthly bill and home age, plus scope
  chips and a foam-type toggle. Outputs annual/monthly savings, a project cost range, simple
  payback and 20-year savings, all live
- Before/after slider — drag, touch or arrow keys, four project types
- Process timeline, swipeable testimonial carousel, accordion FAQ
- **Three-step quote form** with per-field validation, phone masking, a review step and a
  "prefill from the calculator" hand-off
- Light/dark theme toggle (persisted), sticky call/quote bar on mobile, back-to-top

## Admin (`/admin.html`)

Password: **`marc`**

- Lock screen with optional "stay signed in"
- Stat tiles: total, new, last 7 days, won, open estimated savings
- Filter by status, full-text search, four sort orders
- Expandable lead cards with call / text / email actions, status pipeline
  (new → contacted → quoted → won → lost), read/unread, delete
- Manual entry for phone-in leads
- CSV export of the current view
- Installable PWA with notifications and an app-icon badge count

### Notifications

Tap the bell (or the banner) to grant permission. New submissions raise a notification through the
service worker; the admin page also picks up leads submitted in another tab via the `storage`
event and a 5-second poll. Clicking a notification focuses the inbox.

`sw.js` already handles real `push` events, so if you add a backend with VAPID keys the push path
works without touching the client.

## Known limits — read before going live

1. **The password is client-side.** `PASSWORD` sits in `admin.js`, so anyone can read it in
   devtools. It keeps casual visitors out; it is not security. Move authentication server-side
   before this holds anything you care about.
2. **Leads live in `localStorage`.** One browser, one device, no sharing, and clearing site data
   wipes them. Export CSV if you need a copy.
3. **Notifications only fire while a browser or the installed app has run the page recently.**
   True background delivery — a lead comes in at 2am and the phone buzzes — needs a server sending
   Web Push. Everything client-side is ready for it.
4. Phone numbers, email and reviews are placeholders. Search for `555-0130` and
   `info@530sprayfoam.com` to replace them.

`saveLead()` in `admin.js` and the `submit` handler in `app.js` are the only two places that
write a lead. Point both at an API and items 1–3 all go away.
