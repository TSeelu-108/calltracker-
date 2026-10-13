// Call Tracker offline support. Only the app's own files are cached here.
// Doctor names and call dates live in this device's local storage and are never sent anywhere.
const SHELL = "calltracker-shell-v3";
const FILES = ["./", "index.html", "manifest.webmanifest", "apple-touch-icon.png", "icon-192.png", "icon-512.png"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("calltracker-shell-") && k !== SHELL).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.includes("/route/")) return; // the Week Router has its own offline files
  e.respondWith((async () => {
    const cache = await caches.open(SHELL);
    const key = req.mode === "navigate" ? "index.html" : req;
    const hit = await cache.match(key, {ignoreSearch: true});
    const net = fetch(req).then(res => { if (res.ok) cache.put(key, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    return (await net) || new Response("Offline", {status: 503});
  })());
});
