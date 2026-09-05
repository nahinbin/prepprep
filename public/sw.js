/* MCQ Arena PWA Service Worker — Offline-First & Instant App Navigation */
const CACHE_VERSION = "mcq-arena-v3";
const STATIC_CACHE = "mcq-arena-static-v3";
const PAGES_CACHE = "mcq-arena-pages-v3";

const CORE_APP_ROUTES = [
  "/",
  "/session/new",
  "/session/play",
  "/session/redo",
  "/mistakes",
  "/questions",
  "/rewards",
  "/history",
  "/friends",
  "/subjects",
  "/settings",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/game_sounds/correct_answer.mp3",
  "/game_sounds/wrong_answers.mp3",
  "/game_sounds/tap.mp3",
  "/game_sounds/start_session.mp3",
  "/game_sounds/sessionend.mp3",
  "/game_sounds/level_up.mp3",
  "/game_sounds/coin_spend.mp3",
];

// Install: Pre-cache the entire app shell and primary pages
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGES_CACHE)
      .then((cache) =>
        Promise.allSettled(
          CORE_APP_ROUTES.map((url) =>
            fetch(url, { credentials: "same-origin" })
              .then((res) => {
                if (res.ok) return cache.put(url, res);
              })
              .catch(() => {})
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

// Activate: Clean up old cache versions immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_VERSION && k !== STATIC_CACHE && k !== PAGES_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: Instant Stale-While-Revalidate & Bulletproof Offline Fallback
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept Server Actions or sensitive internal APIs
  if (url.pathname.startsWith("/api") || request.headers.get("Next-Action")) {
    return;
  }

  // 1. Immutable static JS/CSS bundles and sound effects: Cache-First
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/game_sounds/") ||
    url.pathname.startsWith("/icons/")
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(request, copy));
          }
          return res;
        });
      })
    );
    return;
  }

  // 2. Next.js App Router RSC data payloads (_rsc query or RSC header)
  const isRsc = url.searchParams.has("_rsc") || request.headers.get("RSC") === "1";
  if (isRsc) {
    event.respondWith(
      caches.match(request).then((cached) => {
        // Stale-While-Revalidate: if cached, return immediately for instant native app feel
        const fetchPromise = fetch(request)
          .then((networkRes) => {
            if (networkRes.ok) {
              const copy = networkRes.clone();
              caches.open(PAGES_CACHE).then((c) => c.put(request, copy));
            }
            return networkRes;
          })
          .catch(async () => {
            // Offline fallback for RSC
            if (cached) return cached;
            // Try matching without search params
            const cleanUrl = new URL(request.url);
            cleanUrl.search = "";
            const fallback = await caches.match(cleanUrl.pathname);
            if (fallback) return fallback;
            // Root shell fallback
            return caches.match("/");
          });

        return cached || fetchPromise;
      })
    );
    return;
  }

  // 3. HTML Page Navigations: Stale-While-Revalidate with offline fallback
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(PAGES_CACHE).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(async () => {
          if (cached) return cached;
          // Try matching pathname directly
          const pathMatch = await caches.match(url.pathname);
          if (pathMatch) return pathMatch;
          // Fallback to cached home shell
          const shell = await caches.match("/");
          if (shell) return shell;
          return new Response("Offline", { status: 200, headers: { "Content-Type": "text/html" } });
        });

      // If we have cached version, return instantly while updating in background
      return cached || fetchPromise;
    })
  );
});
