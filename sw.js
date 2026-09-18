const CACHE_NAME = 'pixel-survivors-v7';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './game.js',
  './loading-effects.js',
  './settings.html',
  './settings.css',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request).then((networkResponse) => {
      if (networkResponse.ok && new URL(event.request.url).origin === self.location.origin) {
        const responseCopy = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseCopy));
      }
      return networkResponse;
    }).catch(() => caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      if (event.request.mode === 'navigate') return caches.match('./index.html');
      return Response.error();
    })),
  );
});