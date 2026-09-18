/* Detail IC — cache-first service worker. Update version.js to ship an update. */
importScripts("./version.js");
const CACHE = `detail-ic-v${self.APP_VERSION}`;
const ASSETS = ["./","./index.html","./version.js","./styles.css","./app.js","./core.js","./profiles.js","./manifest.webmanifest","./icons/favicon-32.png","./icons/favicon-48.png","./icons/logo-96.png","./icons/icon-192.png","./icons/apple-touch-icon.png"];
self.addEventListener("install", event => event.waitUntil(
  caches.open(CACHE).then(cache => cache.addAll(ASSETS.map(path => new Request(new URL(path, self.location.href), { cache: "reload" }))))
));
// The new worker waits until the page's Update button asks for it.
self.addEventListener("message", event => { if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting(); });
self.addEventListener("activate", event => event.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())
));
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request, { cache: "no-store" })
      .then(response => { if (response && response.ok) { const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(request, copy)); } return response; })
      .catch(() => caches.match(request).then(hit => hit || caches.match("./index.html"))));
    return;
  }
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    const response = await fetch(request);
    if (response && response.ok && response.type === "basic") cache.put(request, response.clone());
    return response;
  }));
});
