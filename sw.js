// Boermeter service worker: bewaart model, lettertypes en app-bestanden op de gsm.
// De pagina zelf en de API gaan altijd naar de server.
const CACHE = 'boermeter-v14';
const VAST = ['model/model.json', 'model/group1-shard1of4.bin', 'model/group1-shard2of4.bin', 'model/group1-shard3of4.bin', 'model/group1-shard4of4.bin'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(VAST)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (!/^\/(model|fonts|vendor|icons|img)\/|^\/app\.(js|css)$/.test(url.pathname)) return;
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(e.request);
    if (hit) return hit;
    const r = await fetch(e.request);
    if (r.ok) c.put(e.request, r.clone());
    return r;
  }));
});
