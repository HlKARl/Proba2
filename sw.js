const CACHE_NAME = 'proba-pwa-v1.0.0';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './assets/favicon.svg',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './css/theme.css',
  './css/layout.css',
  './css/components.css',
  './js/app.js',
  './js/config/defaults.js',
  './js/db/database.js',
  './js/library/fileParsers.js',
  './js/library/questionValidator.js',
  './js/library/libraryManager.js',
  './js/engine/classes.js',
  './js/engine/economyEngine.js',
  './js/engine/sessionEngine.js',
  './js/engine/campaignEngine.js',
  './js/ui/libraryView.js',
  './js/ui/importerModal.js',
  './js/ui/sessionSetupView.js',
  './js/ui/arenaView.js',
  './js/ui/shopView.js',
  './js/ui/statsView.js',
  './js/ui/settingsView.js',
  './tests/verificationSuite.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    // Network first with cache fallback for optional external resources
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for app shell so offline mode works instantaneously
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      });
    })
  );
});
