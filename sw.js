const CACHE = 'gracious-delights-admin-shell-v1';
const FILES = [
  './', './index.html', './styles.css', './orders.css', './app.js', './domain.js', './orders-ui.js', './manifest.webmanifest',
  './assets/icon-192.png', './assets/icon-512.png', './assets/icon-maskable.png', './assets/placeholder.svg',
  './assets/facebook/a00aff175be206dd.jpg', './assets/facebook/a354c03220336924.jpg',
  './assets/facebook/d48aa4ba35954fb9.jpg', './assets/facebook/f86ca2cd7d4f8442.jpg',
  './assets/facebook/b511fbfde20f8301.jpg', './assets/facebook/d63443ed617e749b.jpg',
  './assets/facebook/14989151db935458.jpg'
];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('gracious-delights-admin-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  if (new URL(event.request.url).pathname.startsWith('/api/')) return;
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(event.request);
      if (response.ok) await cache.put(event.request, response.clone());
      return response;
    } catch {
      return await cache.match(event.request) || (event.request.mode === 'navigate' ? await cache.match('./index.html') : new Response('Offline asset unavailable', {status: 503}));
    }
  })());
});
