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

    // Register PWA service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    // Warm client route cache in background for instant native app feel
    const idleTimer = setTimeout(() => {
      if (navigator.onLine) {
        ROUTES_TO_PREFETCH.forEach((route) => {
          try {
            router.prefetch(route);
          } catch {}
        });
      }
    }, 1200);

    return () => clearTimeout(idleTimer);
  }, [router]);

  return null;
}
