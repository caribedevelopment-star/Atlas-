const CACHE = 'alkimia-v04';
const CORE = ['/', '/index.html', '/styles.css', '/app.js', '/manifest.webmanifest', '/icon.svg', '/chunks/app.001.txt', '/chunks/app.002.txt', '/chunks/app.003.txt', '/chunks/app.004.txt', '/chunks/app.005.txt', '/chunks/app.006.txt', '/chunks/app.007.txt', '/chunks/app.008.txt'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => { if (e.request.method !== 'GET') return; e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {}); return r; }).catch(() => caches.match(e.request))); });
