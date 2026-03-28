const CACHE_NAME = 'guaguatime-rd-v9';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './data/manifest.json',
  './data/sectores.json',
  './data/rutas.json',
  './data/condiciones.json',
  './data/i18n-es.json',
  './data/i18n-en.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => cachedResponse || fetch(event.request))
  );
});
