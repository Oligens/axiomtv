/* Axiom TV — Service Worker PWA. Network-first HTML, stale-while-revalidate assets. */
const VERSION = "axiomtv-v2";
const CORE_CACHE = `${VERSION}-core`;
const RUNTIME_CACHE = `${VERSION}-runtime`;
const CORE_ASSETS = ["/", "/index.html", "/manifest.json", "/icons/icon.svg", "/icons/icon-maskable.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CORE_CACHE).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => ![CORE_CACHE, RUNTIME_CACHE].includes(key)).map((key) => caches.delete(key)))).then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) caches.open(CORE_CACHE).then((cache) => cache.put("/index.html", response.clone())).catch(() => {});
          return response;
        })
        .catch(() => caches.match("/index.html").then((cached) => cached || Response.error()))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((response) => {
        if (response.ok || response.type === "opaque") caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, response.clone())).catch(() => {});
        return response;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
