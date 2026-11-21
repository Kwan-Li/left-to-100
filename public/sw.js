// Offline support: network first for pages and data (so updates show up), cache first for hashed assets and fonts.
const CACHE = 'left-to-100-v2';
const scope = self.registration.scope;
const FONTS = ['michroma', 'barlow-500', 'barlow-600', 'barlow-700', 'martian-mono'].map((f) => `fonts/${f}.woff2`);
const PRECACHE = ['', 'card-sets/', 'missables/', 'data/', 'gta6.json', ...FONTS].map((p) => new URL(p, scope).toString());

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || !req.url.startsWith(scope)) return;
  const path = new URL(req.url).pathname;
  const isAsset = path.includes('/_astro/') || path.includes('/fonts/');
  if (isAsset) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
            return res;
          }),
      ),
    );
    return;
  }
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match(scope))),
  );
});
