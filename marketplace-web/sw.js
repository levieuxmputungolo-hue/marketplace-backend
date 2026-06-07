const CACHE = 'easy-market-v2';
const STATIC_ASSETS = [
  './',
  './index.html',
  './navigate.html',
  './assets/style.css',
  './assets/app.js',
  './assets/cart-icon.svg',
  './assets/firebase-config.js',
  './assets/manifest.json',
  './assets/icon-192.svg',
  './assets/icon-512.svg',
  './assets/screenshot.svg',
];
const API_DOMAIN = 'localhost:8000';

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => {
      cache.addAll(STATIC_ASSETS);
      return cache;
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Ignorer Firebase et API calls
  if (url.hostname.includes('firebase') || url.hostname.includes(API_DOMAIN) || url.hostname.includes('localhost')) {
    return;
  }

  // Stratégie cache-first pour les assets statiques
  if (STATIC_ASSETS.some(a => url.pathname.endsWith(a.replace('./', '')))) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetchAndCache(e.request))
    );
    return;
  }

  // Stratégie network-first pour le reste (fonts, leaflet, images)
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

function fetchAndCache(request) {
  return fetch(request).then(res => {
    const clone = res.clone();
    caches.open(CACHE).then(cache => cache.put(request, clone));
    return res;
  });
}
