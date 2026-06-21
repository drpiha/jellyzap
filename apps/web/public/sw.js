/* Jellyzap service worker — app-shell cache for instant repeat loads.
   Same-origin only: ads, fonts and analytics always go to the network. */
const CACHE = 'jellyzap-v2';

/* Locale shells precached at install so the app launches offline in any locale
   (and the bare '/' redirect shell works without a network round-trip). */
const PRECACHE = ['/', '/en/', '/tr/', '/de/', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .catch(() => {
        /* a missing entry must not block install */
      })
      .then(() => self.skipWaiting()),
  );
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
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  const accept = req.headers.get('accept') || '';
  if (req.mode === 'navigate' || accept.includes('text/html')) {
    // network-first for pages, with a locale-aware offline fallback that never
    // resolves to undefined (which would make respondWith fail).
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then((r) => {
            if (r) return r;
            const loc = (url.pathname.match(/^\/(en|tr|de)(\/|$)/) || [])[1];
            const shell = loc ? '/' + loc + '/' : '/';
            return caches
              .match(shell)
              .then((a) => a || caches.match('/'))
              .then((b) => b || Response.error());
          }),
        ),
    );
    return;
  }

  if (/\.(js|css|png|svg|webp|jpg|jpeg|woff2?|json)$/.test(url.pathname)) {
    // cache-first for static assets
    event.respondWith(
      caches.match(req).then(
        (r) =>
          r ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
            return res;
          }),
      ),
    );
  }
});
