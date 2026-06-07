const CACHE = 'izaho-v2';
const STATIC = [
  '../index.html',
  './style.css',
  './app.js',
  './firebase-config.js',
  './manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(STATIC))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.hostname === 'firestore.googleapis.com' || url.hostname.endsWith('.googleapis.com')) {
    e.respondWith(networkFirst(e.request));
  } else {
    e.respondWith(cacheFirst(e.request));
  }
});

async function cacheFirst(req) {
  const cached = await caches.match(req);
  return cached || fetch(req).then(res => {
    const clone = res.clone();
    caches.open(CACHE).then(cache => cache.put(req, clone));
    return res;
  });
}

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    const clone = res.clone();
    caches.open(CACHE).then(cache => cache.put(req, clone));
    return res;
  } catch {
    return caches.match(req);
  }
}
