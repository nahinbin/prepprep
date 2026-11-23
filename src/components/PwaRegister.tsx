"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const ROUTES_TO_PREFETCH = [
  "/session/new",
  "/session/new?mode=practice",
  "/session/play",
  "/session/redo",
  "/mistakes",
  "/questions",
  "/rewards",
  "/history",
  "/friends",
  "/subjects",
  "/settings",
];

export function PwaRegister() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Unregister any active or legacy service workers immediately
    // to prevent cross-account page caching, stale previews, and offline data bleeding.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister().catch(() => { });
        }
      }).catch(() => { });
    }

    // Completely purge CacheStorage
    if ("caches" in window) {
      caches.keys().then((keys) => {
        for (const key of keys) {
          caches.delete(key).catch(() => { });
        }
      }).catch(() => { });
    }

    // Warm client route cache in background for smooth instant navigations
    const idleTimer = setTimeout(() => {
      if (navigator.onLine) {
        ROUTES_TO_PREFETCH.forEach((route) => {
          try {
            router.prefetch(route);
          } catch { }
        });
      }
    }, 1200);

    return () => clearTimeout(idleTimer);
  }, [router]);

  return null;
}
