"use client";

import { useState, useRef, useEffect } from "react";
import { Coins, Zap, Shield } from "lucide-react";
import { getLevelInfo } from "@/lib/levels";

export function GameHUD({
  coins,
  xp,
  accuracy,
  compact = false,
}: {
  coins: number;
  xp: number;
  accuracy?: number;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const hudRef = useRef<HTMLDivElement>(null);
  const lvl = getLevelInfo(xp);
  const isDesktop = useRef(false);

  // Track breakpoint
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    isDesktop.current = mq.matches;
    const handler = (e: MediaQueryListEvent) => {
      isDesktop.current = e.matches;
      if (e.matches) setOpen(false); // reset mobile open on resize to desktop
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Close on outside click/tap (used for both mobile click and desktop)
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (hudRef.current && !hudRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [open]);

  // Mouse enter/leave handlers for desktop hover
  const handleMouseEnter = () => {
    if (isDesktop.current) setOpen(true);
  };
  const handleMouseLeave = () => {
    if (isDesktop.current) setOpen(false);
  };

  // Click handler for mobile tap toggle
  const handleClick = () => {
    if (!isDesktop.current) setOpen((prev) => !prev);
  };

  return (
    <div className={`flex items-center ${compact ? "gap-1.5" : "gap-2"}`} ref={hudRef}>
      {/* Coins Badge */}
      <div className="flex items-center gap-1 bg-amber-500/15 border border-amber-500/30 px-2.5 py-1.5 rounded-2xl shadow-sm shadow-amber-500/5">
        <Coins className="w-4 h-4 text-amber-400 shrink-0" />
        <span className="text-sm font-black text-amber-400 tabular-nums">{coins}</span>
      </div>

      {/* XP + Level Badge */}
      <div
        className="relative"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <button
          type="button"
          onClick={handleClick}
          className="flex items-center gap-1 bg-primary/15 border border-primary/30 px-2.5 py-1.5 rounded-2xl shadow-sm shadow-primary/5 cursor-pointer hover:bg-primary/25 transition-all active:scale-95"
          aria-label="View Level Status"
          aria-expanded={open}
        >
          <Zap className="w-4 h-4 text-primary shrink-0 fill-primary/40" />
          <span className="text-sm font-black text-primary tabular-nums">{xp}</span>
          <span className={`text-[10px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-lg bg-primary/20 ${lvl.color} ml-0.5`}>
            Lv{lvl.level}
          </span>
        </button>

        {/* Popover — shown when open (desktop hover or mobile tap) */}
        {open && (
          <div className="absolute top-full right-0 mt-2.5 w-64 z-50">
            <div className="bg-card border-2 border-border/90 rounded-3xl shadow-2xl p-4 text-left ring-1 ring-primary/20 backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-1.5">
                  <Shield className={`w-4 h-4 ${lvl.color}`} />
                  <span className={`text-sm font-black ${lvl.color}`}>{lvl.title}</span>
                </div>
                <span className="text-xs font-black text-primary bg-primary/10 px-2 py-0.5 rounded-lg border border-primary/20">
                  Level {lvl.level}
                </span>
              </div>

              <div className="w-full h-3 bg-muted rounded-full overflow-hidden mb-2 p-0.5 border border-border/60">
                <div
                  className="h-full bg-gradient-to-r from-primary to-purple-500 rounded-full transition-all duration-500"
                  style={{ width: `${lvl.progress}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground">
                <span>{xp} Net XP</span>
                {lvl.xpEnd === Infinity ? (
                  <span className="text-primary font-black">MAX LEVEL</span>
                ) : (
                  <span>{lvl.xpEnd - xp} XP to Lv {lvl.level + 1}</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
