// ─────────────────────────────────────────────
//  Busywork Service Worker  v2
//
//  Strategy:
//    index.html  → Network-first (always get latest app code)
//    Other assets → Cache-first  (icons, manifest)
//    Offline fallback → cached index.html
// ─────────────────────────────────────────────

const CACHE   = 'busywork-v2';
const OFFLINE = './index.html';

const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// ── Install: pre-cache core assets ──────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(PRECACHE))
      // Do NOT call skipWaiting() — wait for existing tabs to close
      // so we never hijack a live session mid-use.
  );
});

// ── Activate: purge old caches ──────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
    // Do NOT call clients.claim() — let current tabs finish naturally.
  );
});

// ── Fetch ────────────────────────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  const url = new URL(event.request.url);
  const isHTML = url.pathname.endsWith('.html') || url.pathname.endsWith('/');

  if (isHTML) {
    // Network-first for HTML: always try to get the freshest app code.
    // Fall back to cache only when offline.
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE).then(c => c.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(OFFLINE))
    );
  } else {
    // Cache-first for static assets (icons, manifest).
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request)
          .then(response => {
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE).then(c => c.put(event.request, clone));
            }
            return response;
          })
          .catch(() => caches.match(OFFLINE));
      })
    );
  }
});

// ── Notification click ───────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(list => {
        const existing = list.find(c => c.url.includes('busywork') || c.url.endsWith('/'));
        if (existing) return existing.focus();
        return clients.openWindow('./');
      })
  );
});
