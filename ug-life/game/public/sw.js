// Offline shell: the game works on a weak connection after the first visit.
// Bump VERSION on every release so phones pick up the new build.
const VERSION = "ug-life-v3";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(["./", "./index.html", "./manifest.webmanifest", "./icon.svg"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // Never cache the live API or the control room: they must always be fresh.
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/") || url.pathname.includes("admin")) return;
  if (req.mode === "navigate") {
    // network first for the page, so updates arrive; cache when offline
    e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put("./index.html", copy)); return res; }).catch(() => caches.match("./index.html")));
    return;
  }
  // cache first for hashed assets
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); } return res; })));
});
