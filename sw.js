// Call Tracker offline support. Only the app's own files are cached here; your data stays in this device's storage.
// Opens instantly from the saved copy; the newest files are fetched in the background, and the page is told when an update is ready.
const SHELL = "calltracker-shell-v36";
const FILES = ["./", "index.html", "manifest.webmanifest", "apple-touch-icon.png", "icon-192.png", "icon-512.png"];
const looksWhole = (text, path, mode) => mode === "navigate" || /(^|\/)(index\.html)?$/.test(path) ? /<\/html>\s*$/i.test(text) && text.length > 2000 : /\.js$/.test(path) ? text.trim().length > 200 : true;
// install only when the page itself arrived whole; otherwise the version already on the iPad keeps running
self.addEventListener("install", e => e.waitUntil((async () => {
  const page = await fetch("index.html", {cache:"reload"}); const text = await page.clone().text();
  if (!page.ok || !looksWhole(text, "index.html", "navigate")) throw new Error("incomplete upload");
  const c = await caches.open(SHELL); await c.addAll(FILES.filter(f => f !== "index.html" && f !== "./").map(f => new Request(f, {cache:"reload"})));
  await c.put("index.html", page); await c.put("./", new Response(text, {headers: page.headers}));
  await self.skipWaiting();
})()));
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("calltracker-shell-") && k !== SHELL).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.includes("/geo/")) return; // place data keeps its own cache (geo-places-v1)
  if (url.pathname.includes("/route/")) return; // Plan my week has its own offline files
  const key = req.mode === "navigate" ? "index.html" : req;
  const fresh = async () => {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
    try { const res = await fetch(req.mode === "navigate" ? req.url : req, {cache:"no-cache", signal:ctl.signal}); clearTimeout(t); return res.ok ? res : null; }
    catch(err){ clearTimeout(t); return null; }
  };
  const cached = caches.open(SHELL).then(cache => cache.match(key, {ignoreSearch:true}).then(hit => ({cache, hit, copy: hit && hit.clone()})));
  e.respondWith(cached.then(async ({cache, hit}) => {
    if (hit) return hit;
    const res = await fresh(); if (res){ cache.put(key, res.clone()); return res; } return new Response("Offline", {status:503});
  }));
  // saved copy now; check for a newer one in the background
  e.waitUntil(cached.then(async ({cache, copy}) => {
    if (!copy) return;
    const res = await fresh(); if (!res) return;
    const [a, b] = await Promise.all([copy.text(), res.clone().text()]);
    if (a === b) return;
    // never replace a working copy with a broken upload (an empty or cut-off file)
    if (!looksWhole(b, url.pathname, req.mode)) return;
    await cache.put(key, res);
    if (req.mode === "navigate" || /\.js$/.test(url.pathname)){
      await cache.put("__updated", new Response("1"));
      const cs = await self.clients.matchAll({type:"window"}); cs.forEach(c => c.postMessage({type:"app-updated"}));
    }
  }));
});
// the page asks when it opens (an update found while it was loading can't be announced to it yet)
self.addEventListener("message", e => {
  if (!e.data || e.data.type !== "update?") return;
  e.waitUntil((async () => { const cache = await caches.open(SHELL); if (await cache.match("__updated")){ await cache.delete("__updated"); e.source && e.source.postMessage({type:"app-updated"}); } })());
});
