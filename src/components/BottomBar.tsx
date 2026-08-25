"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Gamepad2, Target, BookOpen } from "lucide-react";
import { Suspense } from "react";

function BottomBarInner({ mistakeCount = 0 }: { mistakeCount?: number }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode");

  const playActive = pathname === "/session/new" && mode !== "practice";
  const practiceActive = pathname === "/session/new" && mode === "practice";
  const mistakesActive = pathname === "/mistakes" || pathname.startsWith("/session/redo");

  // Hide on all session flow pages (play, redo, result, review, new configuration) and auth/admin
  if (
    pathname.startsWith("/session") ||
    pathname.startsWith("/admin") ||
    pathname === "/login" ||
    pathname === "/register"
  ) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 md:left-[17.5rem] pointer-events-none">
      <div className="mx-auto max-w-lg px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 pointer-events-auto">
        <nav className="relative flex items-end justify-between gap-2 rounded-[1.75rem] border border-white/10 bg-card/90 backdrop-blur-xl px-3 py-2 shadow-2xl shadow-black/40">
          <Link
            href="/session/new?mode=practice"
            className={`flex flex-col items-center justify-center flex-1 py-2 rounded-2xl transition-all active:scale-95 ${
              practiceActive ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Target className={`w-6 h-6 mb-0.5 ${practiceActive ? "scale-110" : ""}`} />
            <span className="text-xs font-bold tracking-wide">Practice</span>
          </Link>

          <Link
            href="/session/new"
            className="relative -mt-8 flex flex-col items-center"
            aria-label="New Session"
          >
            <span
              className={`flex items-center justify-center w-16 h-16 rounded-full border-4 border-background shadow-lg shadow-primary/40 transition-transform active:scale-95 ${
                playActive
                  ? "bg-primary scale-105"
                  : "bg-primary hover:brightness-110"
              }`}
            >
              <Gamepad2 className="w-7 h-7 text-primary-foreground" />
            </span>
          </Link>

          <Link
            href="/mistakes"
            className={`relative flex flex-col items-center justify-center flex-1 py-2 rounded-2xl transition-all active:scale-95 ${
              mistakesActive ? "text-danger bg-danger/10" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="relative">
              <BookOpen className={`w-6 h-6 mb-0.5 ${mistakesActive ? "scale-110" : ""}`} />
              {mistakeCount > 0 && (
                <span className="absolute -top-1.5 -right-2 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-danger text-[10px] font-black text-white flex items-center justify-center">
                  {mistakeCount > 99 ? "99+" : mistakeCount}
                </span>
              )}
            </span>
            <span className="text-xs font-bold tracking-wide">Mistakes</span>
          </Link>
        </nav>
      </div>
    </div>
  );
}

export function BottomBar({ mistakeCount = 0 }: { mistakeCount?: number }) {
  return (
    <Suspense fallback={null}>
      <BottomBarInner mistakeCount={mistakeCount} />
    </Suspense>
  );
}
