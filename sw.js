/* 530 Spray Foam — service worker (offline shell + notifications) */
const CACHE = '530sf-v8';
const SHELL = [
  './', './index.html', './admin.html', './styles.css', './app.js', './admin.js', './admin.css',
  './content.js', './content.json', './editor.js', './db.js', './map.js',
  './manifest.webmanifest', './assets/icon-192.png', './assets/apple-touch-icon.png',
  './assets/favicon-32.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(SHELL.map(u => c.add(new Request(u, { cache: 'reload' })))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* network-first for navigations, cache-first for static assets */
self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;

  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then(r => { caches.open(CACHE).then(c => c.put(request, r.clone())); return r; })
        .catch(() => caches.match(request).then(r => r || caches.match('./admin.html')))
    );
    return;
  }
  /* Images never change under a fixed name — cache-first is fine.
     CSS/JS/JSON change on every deploy, and serving a stale copy of one
     against fresh HTML breaks the page in confusing ways (old editor.js
     next to new admin.html, for instance). So those are network-first:
     the cache is only a fallback for being offline. */
  const immutable = /\.(png|jpg|jpeg|webp|svg|woff2?)$/i.test(new URL(request.url).pathname);

  if (immutable) {
    e.respondWith(caches.match(request).then(hit => hit || fetch(request).then(r => {
      if (r.ok) caches.open(CACHE).then(c => c.put(request, r.clone()));
      return r;
    })));
    return;
  }

  e.respondWith(
    fetch(request)
      .then(r => {
        if (r.ok) caches.open(CACHE).then(c => c.put(request, r.clone()));
        return r;
      })
      .catch(() => caches.match(request))
  );
});

/* the admin page asks the SW to raise a notification (works when installed
   and while the SW is alive; a real backend would use Web Push instead) */
self.addEventListener('message', e => {
  const d = e.data || {};
  if (d.type !== 'notify') return;
  self.registration.showNotification(d.title || 'New lead — 530 Spray Foam', {
    body: d.body || '',
    tag: d.tag || 'sf-lead',
    renotify: true,
    icon: './assets/icon-192.png',
    badge: './assets/icon-192.png',
    data: { url: d.url || './admin.html#new' },
    vibrate: [90, 40, 90],
    requireInteraction: false
  });
});

/* real Web Push, if a backend ever supplies a VAPID subscription */
self.addEventListener('push', e => {
  let p = {};
  try { p = e.data ? e.data.json() : {}; } catch { p = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(p.title || 'New lead — 530 Spray Foam', {
    body: p.body || 'Open the admin inbox to review it.',
    tag: p.tag || 'sf-lead', renotify: true,
    icon: './assets/icon-192.png', badge: './assets/icon-192.png',
    data: { url: p.url || './admin.html#new' }
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './admin.html';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) if (c.url.includes('admin.html')) return c.focus();
      return self.clients.openWindow(url);
    })
  );
});
