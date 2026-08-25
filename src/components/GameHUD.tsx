"use client";

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
  const lvl = getLevelInfo(xp);

  return (
    <div className={`flex items-center ${compact ? "gap-1.5" : "gap-2"}`}>
      {/* Coins */}
      <div className="flex items-center gap-1 bg-amber-500/15 border border-amber-500/30 px-2 py-1.5 rounded-2xl shadow-sm shadow-amber-500/5">
        <Coins className="w-4 h-4 text-amber-400 shrink-0" />
        <span className="text-sm font-black text-amber-400 tabular-nums">{coins}</span>
      </div>

      {/* XP + Level badge combined */}
      <div className="flex items-center gap-1 bg-primary/15 border border-primary/30 px-2 py-1.5 rounded-2xl shadow-sm shadow-primary/5 group relative cursor-default">
        <Zap className="w-4 h-4 text-primary shrink-0 fill-primary/40" />
        <span className="text-sm font-black text-primary tabular-nums">{xp}</span>
        {/* Level badge */}
        <span className={`text-[10px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-lg bg-primary/20 ${lvl.color} ml-0.5`}>
          Lv{lvl.level}
        </span>

        {/* Tooltip on hover — XP bar (positioned downwards to prevent clipping outside top of viewport) */}
        <div className="absolute top-full right-0 mt-2.5 w-52 hidden group-hover:block z-50 pointer-events-none pt-1">
          <div className="bg-card/95 backdrop-blur-md border border-border/90 rounded-2xl shadow-2xl p-3.5 text-left animate-fade-in ring-1 ring-primary/20">
            <div className="flex items-center gap-1.5 mb-2">
              <Shield className={`w-3.5 h-3.5 ${lvl.color}`} />
              <span className={`text-xs font-black ${lvl.color}`}>{lvl.title}</span>
              <span className="text-xs text-muted-foreground ml-auto font-bold">Lv {lvl.level}</span>
            </div>
            <div className="w-full h-2 bg-muted/80 rounded-full overflow-hidden mb-1.5 ring-1 ring-border/50">
              <div
                className="h-full bg-primary rounded-full xp-bar-glow transition-all duration-500"
                style={{ width: `${lvl.progress}%` }}
              />
            </div>
            {lvl.xpEnd === Infinity ? (
              <p className="text-[10px] font-bold text-muted-foreground text-right">MAX LEVEL</p>
            ) : (
              <p className="text-[10px] font-bold text-muted-foreground text-right tabular-nums">
                {lvl.xpIntoLevel} / {lvl.xpForLevel} XP
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Accuracy */}
      {typeof accuracy === "number" && (
        <div className="flex items-center gap-1 bg-success/15 border border-success/30 px-2 py-1.5 rounded-2xl shadow-sm shadow-success/5">
          <Crosshair className="w-4 h-4 text-success shrink-0" />
          <span className="text-sm font-black text-success tabular-nums">{accuracy}%</span>
        </div>
      )}
    </div>
  );
}
