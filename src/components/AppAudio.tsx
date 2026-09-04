"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sparkles, X } from "lucide-react";
import {
  consumePendingLevelUp,
  handleGlobalTap,
  playLevelUpSound,
  preloadGameSounds,
  setHomeMusicEnabled,
  shouldPlayHomeMusic,
  unlockGameSounds,
  type PendingLevelUp,
} from "@/lib/gameSounds";
import { Button } from "@/components/ui/Button";

function AppAudioInner() {
  const pathname = usePathname() ?? "/";
  const [levelUp, setLevelUp] = useState<PendingLevelUp | null>(null);

  useEffect(() => {
    preloadGameSounds();
    const onGesture = () => unlockGameSounds();
    const onResume = () => {
      if (document.visibilityState === "hidden") return;
      unlockGameSounds();
    };
    window.addEventListener("pointerdown", onGesture);
    window.addEventListener("keydown", onGesture);
    window.addEventListener("focus", onResume);
    document.addEventListener("visibilitychange", onResume);
    document.addEventListener("click", handleGlobalTap, true);
    return () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
      window.removeEventListener("focus", onResume);
      document.removeEventListener("visibilitychange", onResume);
      document.removeEventListener("click", handleGlobalTap, true);
    };
  }, []);

  useEffect(() => {
    setHomeMusicEnabled(shouldPlayHomeMusic(pathname));
  }, [pathname]);

  useEffect(() => {
    if (pathname !== "/") return;
    const pending = consumePendingLevelUp();
    if (!pending) return;
    setLevelUp(pending);
    playLevelUpSound();
  }, [pathname]);

  return (
    <>
      {levelUp && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
          <div className="relative w-full max-w-sm rounded-[1.75rem] border-2 border-primary/40 bg-card p-6 text-center shadow-2xl shadow-primary/20">
            <button
              type="button"
              data-sfx="none"
              onClick={() => setLevelUp(null)}
              className="absolute top-3 right-3 w-10 h-10 rounded-2xl hover:bg-muted flex items-center justify-center"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/15 border border-primary/30">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <p className="text-xs font-black uppercase tracking-widest text-primary mb-1">
              Level up
            </p>
            <h2 className="text-3xl font-black mb-1">Level {levelUp.toLevel}</h2>
            <p className="text-sm font-bold text-muted-foreground mb-6">{levelUp.title}</p>
            <Button
              size="lg"
              className="w-full h-12 rounded-2xl font-black"
              onClick={() => setLevelUp(null)}
            >
              Nice
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

export function AppAudio() {
  return (
    <Suspense fallback={null}>
      <AppAudioInner />
    </Suspense>
  );
}
