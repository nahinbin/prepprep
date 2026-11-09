"use client";

import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import {
  getSoundSettings,
  subscribeSoundSettings,
  toggleMuted,
} from "@/lib/soundSettings";
import { playTapSound } from "@/lib/gameSounds";

interface QuickMuteButtonProps {
  className?: string;
  showLabel?: boolean;
}

export function QuickMuteButton({
  className = "",
  showLabel = false,
}: QuickMuteButtonProps) {
  const [muted, setMuted] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setMuted(getSoundSettings().muted);
    return subscribeSoundSettings(() => {
      setMuted(getSoundSettings().muted);
    });
  }, []);

  if (!mounted) {
    // Avoid hydration mismatch by rendering default volume icon
    return (
      <button
        type="button"
        data-sfx="none"
        aria-label="Sound settings"
        className={`inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-card border border-border/60 text-muted-foreground transition-all ${className}`}
      >
        <Volume2 className="w-5 h-5" />
      </button>
    );
  }

  const handleToggle = () => {
    const next = toggleMuted();
    setMuted(next.muted);
    if (!next.muted) {
      playTapSound();
    }
  };

  return (
    <button
      type="button"
      data-sfx="none"
      onClick={handleToggle}
      aria-label={muted ? "Unmute sound" : "Mute all sound"}
      title={
        muted
          ? "Sound is muted (Saved to device database). Click to unmute."
          : "Sound is active. Click to mute all sound."
      }
      className={`inline-flex items-center justify-center gap-2 rounded-2xl transition-all active:scale-95 ${
        muted
          ? "bg-danger/15 border-2 border-danger/40 text-danger hover:bg-danger/25 shadow-sm shadow-danger/10"
          : "bg-card border-2 border-border/80 text-foreground hover:bg-muted/80 hover:border-primary/40"
      } ${showLabel ? "px-3.5 py-2.5 h-11 text-xs font-bold" : "w-11 h-11"} ${className}`}
    >
      {muted ? (
        <VolumeX className="w-5 h-5 shrink-0" />
      ) : (
        <Volume2 className="w-5 h-5 shrink-0" />
      )}
      {showLabel && (
        <span className="font-bold">
          {muted ? "Muted" : "Mute"}
        </span>
      )}
    </button>
  );
}

