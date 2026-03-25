// INMERXIA Service Worker v1.2
const CACHE_NAME = 'inmerxia-v1.2';
const OFFLINE_URL = '/offline.html';

// Recursos que se cachean en el install
const PRECACHE = [
  '/',
  '/index.html',
  '/blog/',
  '/blog/index.html',
  '/ubemex-oaxaca/',
  '/ubemex-oaxaca/index.html',
  '/narrativas/',
  '/narrativas/index.html',
  '/anunciarse/',
  '/anunciarse/index.html',
  '/manifest.json',
  '/robots.txt',
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=DM+Mono:wght@300;400;500&display=swap'
];

// ── INSTALL ────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE.map(url => new Request(url, { cache: 'reload' })))
        .catch(() => cache.addAll(['/index.html'])); // fallback mínimo
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE ───────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── FETCH — Network First para HTML, Cache First para assets ───────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo interceptar mismo origen + Google Fonts
  if (url.origin !== location.origin && !url.hostname.includes('fonts.g')) return;

  // Navegación: Network First con fallback a cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(request, clone));
          }
          return res;
        })
        .catch(() => caches.match(request).then(cached => cached || caches.match('/index.html')))
    );
    return;
  }

  // Fuentes y CSS de Google: Cache First
  if (url.hostname.includes('fonts.g') || url.hostname.includes('fonts.gstatic')) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(res => {
          caches.open(CACHE_NAME).then(c => c.put(request, res.clone()));
          return res;
        });
      })
    );
    return;
  }

  // Assets estáticos (js, css, img): Stale While Revalidate
  if (['script','style','image','font'].includes(request.destination)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache =>
        cache.match(request).then(cached => {
          const fetchPromise = fetch(request).then(res => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          });
          return cached || fetchPromise;
        })
      )
    );
    return;
  }
});

// ── PUSH NOTIFICATIONS (futuro) ────────────────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'INMERXIA', {
      body: data.body || 'Nueva actualización disponible',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      vibrate: [200, 100, 200],
      data: { url: data.url || '/' }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
