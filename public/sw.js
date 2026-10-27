// AetherPhone service worker.
//  - App shell: cache on install, network-first for navigations.
//  - Hashed build assets: cache-first.
//  - Catalog manifest: network-first (so updates are seen), cache fallback.
//  - Catalog chunks: cache-first (their names embed a content hash, so they never change).
//  - Background Sync / Periodic Background Sync: prefetch the latest catalog into the cache.
const SHELL_CACHE = 'aetherphone-shell-v2';
const CATALOG_CACHE = 'aetherphone-catalog-v1';
const MODEL_CACHE = 'phoneinfo-models'; // background-removal model + ONNX Runtime wasm
const CUTOUT_CACHE = 'phoneinfo-cutouts'; // processed thumbnail cut-outs
const KEEP = new Set([SHELL_CACHE, CATALOG_CACHE, MODEL_CACHE, CUTOUT_CACHE]);
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg'];

const scopeUrl = (path) => new URL(path, self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL.map(scopeUrl))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !KEEP.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function prefetchCatalog() {
  const manifestUrl = scopeUrl('catalog/manifest.json');
  const res = await fetch(manifestUrl, { cache: 'no-cache' });
  if (!res.ok) return;
  const text = await res.text();
  const manifest = JSON.parse(text);
  const cache = await caches.open(CATALOG_CACHE);
  await cache.put(manifestUrl, new Response(text, { headers: { 'Content-Type': 'application/json' } }));

  const wanted = new Set();
  for (const chunk of manifest.chunks) {
    const url = scopeUrl(`catalog/${chunk.file}`);
    wanted.add(url);
    if (!(await cache.match(url))) {
      const r = await fetch(url);
      if (r.ok) await cache.put(url, r.clone());
    }
  }
  // Evict chunks from superseded catalog versions.
  for (const req of await cache.keys()) {
    if (req.url !== manifestUrl && !wanted.has(req.url)) await cache.delete(req);
  }
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'catalog-sync') event.waitUntil(prefetchCatalog());
});
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'catalog-sync') event.waitUntil(prefetchCatalog());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.endsWith('/catalog/manifest.json')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) caches.open(CATALOG_CACHE).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(() => caches.match(req, { cacheName: CATALOG_CACHE })),
    );
    return;
  }

  if (url.pathname.includes('/catalog/')) {
    event.respondWith(
      caches.match(req).then((cached) =>
        cached ||
        fetch(req).then((res) => {
          if (res.ok) caches.open(CATALOG_CACHE).then((c) => c.put(req, res.clone()));
          return res;
        }),
      ),
    );
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          caches.open(SHELL_CACHE).then((c) => c.put(scopeUrl('index.html'), res.clone()));
          return res;
        })
        .catch(() => caches.match(scopeUrl('index.html'))),
    );
    return;
  }

  // Model and ONNX Runtime files: cache-first, so the cut-out feature works offline.
  if (url.pathname.includes('/models/') || url.pathname.includes('/ort/')) {
    event.respondWith(
      caches.match(req).then((cached) =>
        cached ||
        fetch(req).then((res) => {
          if (res.ok) caches.open(MODEL_CACHE).then((c) => c.put(req, res.clone()));
          return res;
        }),
      ),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) =>
      cached ||
      fetch(req).then((res) => {
        if (res.ok && url.pathname.includes('/assets/')) {
          caches.open(SHELL_CACHE).then((c) => c.put(req, res.clone()));
        }
        return res;
      }),
    ),
  );
});
