/* Generated at build time. Only the comparator and its local assets are cached. */
const CACHE = 'literae-comparator-__CACHE_VERSION__';
const ASSETS = __PRECACHE__;
const PAGE = '/scriptorium/comparateur';
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    try { await (await caches.open(CACHE)).addAll(ASSETS); }
    catch (error) { await caches.delete(CACHE); throw error; }
  })());
});
self.addEventListener('message', event => {
  if (event.data === 'ACTIVATE_UPDATE') self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('literae-comparator-') && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  const isPage = event.request.mode === 'navigate' && (url.pathname === PAGE || url.pathname === PAGE + '/');
  if (!isPage && !ASSETS.includes(url.pathname)) return;
  event.respondWith((async () => {
    const cached = await (await caches.open(CACHE)).match(isPage ? PAGE : url.pathname);
    return cached || fetch(event.request);
  })());
});
