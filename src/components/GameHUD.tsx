"use client";

import { useState, useRef, useEffect } from "react";
import { Coins, Zap, Crosshair, Shield } from "lucide-react";
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

  // Close on outside click
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

  return (
    <div className={`flex items-center ${compact ? "gap-1.5" : "gap-2"}`} ref={hudRef}>
      {/* Coins Badge */}
      <div className="flex items-center gap-1 bg-amber-500/15 border border-amber-500/30 px-2.5 py-1.5 rounded-2xl shadow-sm shadow-amber-500/5">
        <Coins className="w-4 h-4 text-amber-400 shrink-0" />
        <span className="text-sm font-black text-amber-400 tabular-nums">{coins}</span>
      </div>

      {/* XP + Level Badge (Clickable on Mobile, Hoverable on Desktop) */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="flex items-center gap-1 bg-primary/15 border border-primary/30 px-2.5 py-1.5 rounded-2xl shadow-sm shadow-primary/5 group cursor-pointer hover:bg-primary/25 transition-all active:scale-95"
          aria-label="View Level Status"
        >
          <Zap className="w-4 h-4 text-primary shrink-0 fill-primary/40" />
          <span className="text-sm font-black text-primary tabular-nums">{xp}</span>
          <span className={`text-[10px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-lg bg-primary/20 ${lvl.color} ml-0.5`}>
            Lv{lvl.level}
          </span>
        </button>

        {/* Popover / Tooltip (visible on hover on desktop OR on click/tap on mobile) */}
        <div
          className={`absolute top-full right-0 mt-2.5 w-60 z-50 pt-1 transition-all ${
            open ? "block" : "hidden md:group-hover:block"
          }`}
        >
          <div className="bg-card border-2 border-border/90 rounded-3xl shadow-2xl p-4 text-left animate-fade-in ring-1 ring-primary/20 backdrop-blur-md">
            <div className="flex items-center justify-between gap-2 mb-2.5">
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
                className="h-full bg-gradient-to-r from-primary to-purple-500 rounded-full xp-bar-glow transition-all duration-500"
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
      </div>

      {/* Accuracy */}
      {typeof accuracy === "number" && (
        <div className="flex items-center gap-1 bg-success/15 border border-success/30 px-2.5 py-1.5 rounded-2xl shadow-sm shadow-success/5">
          <Crosshair className="w-4 h-4 text-success shrink-0" />
          <span className="text-sm font-black text-success tabular-nums">{accuracy}%</span>
        </div>
      )}
    </div>
  );
}
