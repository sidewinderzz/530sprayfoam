/* 530 Spray Foam — service worker (offline shell + notifications) */
const CACHE = '530sf-v1';
const SHELL = [
  './', './index.html', './admin.html', './styles.css', './app.js', './admin.js',
  './manifest.webmanifest', './assets/logo-530.svg'
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
  e.respondWith(
    caches.match(request).then(hit => hit || fetch(request).then(r => {
      if (r.ok) caches.open(CACHE).then(c => c.put(request, r.clone()));
      return r;
    }))
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
    icon: './assets/logo-530.svg',
    badge: './assets/logo-530.svg',
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
    icon: './assets/logo-530.svg', badge: './assets/logo-530.svg',
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
