"use client";

import { Coins, Zap, Crosshair } from "lucide-react";

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
  return (
    <div className={`flex items-center ${compact ? "gap-1.5" : "gap-2"}`}>
      <div className="flex items-center gap-1 bg-amber-500/15 border border-amber-500/30 px-2 py-1.5 rounded-2xl shadow-sm shadow-amber-500/5">
        <Coins className="w-4 h-4 text-amber-400 shrink-0" />
        <span className="text-sm font-black text-amber-400 tabular-nums">{coins}</span>
      </div>
      <div className="flex items-center gap-1 bg-primary/15 border border-primary/30 px-2 py-1.5 rounded-2xl shadow-sm shadow-primary/5">
        <Zap className="w-4 h-4 text-primary shrink-0 fill-primary/40" />
        <span className="text-sm font-black text-primary tabular-nums">{xp}</span>
      </div>
      {typeof accuracy === "number" && (
        <div className="flex items-center gap-1 bg-success/15 border border-success/30 px-2 py-1.5 rounded-2xl shadow-sm shadow-success/5">
          <Crosshair className="w-4 h-4 text-success shrink-0" />
          <span className="text-sm font-black text-success tabular-nums">{accuracy}%</span>
        </div>
      )}
    </div>
  );
}
