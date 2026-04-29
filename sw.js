const CACHE_NAME = 'zaam-music-v2';
const assets = [
  './',
  './index.html',
  './script.js',
  './manifest.json',
  './image1.jpg',
  './image2.jpg'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(assets)));
});

self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
});
