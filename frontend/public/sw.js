// Tempora Service Worker — custom implementation
// Used as fallback when @angular/service-worker is unavailable.
// Delete this file if switching to ngsw-worker.js.

const CACHE_VERSION = 'tempora-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;

const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(APP_SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== STATIC_CACHE && k !== DYNAMIC_CACHE)
          .map(k => caches.delete(k)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Navigation requests: network first, fall back to cached index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match('/index.html').then(r => r ?? new Response('Offline', { status: 503 }))),
    );
    return;
  }

  // API calls: network only, no caching (authenticated data)
  if (url.pathname.startsWith('/api') || !url.pathname.startsWith('/')) return;

  // Static assets: cache first, network fallback, then update cache
  event.respondWith(
    caches.match(request).then(cached => {
      const networkFetch = fetch(request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          const cacheName = request.url.includes('/assets/') ? STATIC_CACHE : DYNAMIC_CACHE;
          caches.open(cacheName).then(cache => cache.put(request, clone));
        }
        return response;
      });
      return cached ?? networkFetch;
    }),
  );
});
