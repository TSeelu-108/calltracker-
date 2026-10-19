// Week Router offline support. Only the app's own files are cached here; your data stays in this device's storage.
// Online: always fetch the newest app files (so updates show right away). Offline: use the saved copy.
const SHELL = "weekrouter-shell-v28";
const FILES = ["./", "index.html", "logic.js", "manifest.webmanifest", "apple-touch-icon.png", "icon-192.png", "icon-512.png"];
self.addEventListener("install", e => e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES.map(f => new Request(f, {cache:"reload"})))).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("weekrouter-shell-") && k !== SHELL).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  
  e.respondWith((async () => {
    const cache = await caches.open(SHELL);
    const key = req.mode === "navigate" ? "index.html" : req;
    try {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 4000);
      const res = await fetch(req.mode === "navigate" ? req.url : req, {cache:"no-cache", signal:ctl.signal});
      clearTimeout(t);
      if (res.ok){ cache.put(key, res.clone()); return res; }
      throw new Error("bad response");
    } catch(err){
      const hit = await cache.match(key, {ignoreSearch:true});
      return hit || new Response("Offline", {status:503});
    }
  })());
});
