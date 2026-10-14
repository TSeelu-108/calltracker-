// Week Router offline support. Caches only the app's own files; your data stays in this device's storage.
const SHELL = "weekrouter-shell-v1";
const FILES = ["./", "index.html", "logic.js", "manifest.webmanifest", "apple-touch-icon.png", "icon-192.png", "icon-512.png"];
self.addEventListener("install", e => e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("weekrouter-shell-") && k !== SHELL).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(SHELL);
    const key = req.mode === "navigate" ? "index.html" : req;
    const hit = await cache.match(key, {ignoreSearch:true});
    const net = fetch(req).then(r => { if (r.ok) cache.put(key, r.clone()); return r; }).catch(() => null);
    if (hit){ e.waitUntil(net); return hit; }
    return (await net) || new Response("Offline", {status:503});
  })());
});
