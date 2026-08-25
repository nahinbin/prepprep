/**
 * Leveling system thresholds.
 * Level = the level you're IN when you have that many XP.
 */

export interface LevelInfo {
  level: number;
  title: string;
  color: string;       // tailwind text color
  xpStart: number;     // XP needed to enter this level
  xpEnd: number;       // XP needed to reach NEXT level (Infinity for max)
  progress: number;    // 0–100 percent through current level
  xpIntoLevel: number; // XP accumulated in current level
  xpForLevel: number;  // total XP span of current level (Infinity for max)
}

const THRESHOLDS = [
  { level: 1, title: "Rookie",       color: "text-muted-foreground", xpStart: 0,     xpEnd: 1000  },
  { level: 2, title: "Challenger",   color: "text-sky-400",          xpStart: 1000,  xpEnd: 2500  },
  { level: 3, title: "Expert",       color: "text-primary",          xpStart: 2500,  xpEnd: 5000  },
  { level: 4, title: "Master",       color: "text-amber-400",        xpStart: 5000,  xpEnd: 10000 },
  { level: 5, title: "Grandmaster",  color: "text-rose-400",         xpStart: 10000, xpEnd: Infinity },
] as const;

export function getLevelInfo(netXp: number): LevelInfo {
  const xp = Math.max(0, netXp);

  // Find the current tier
  let tier = THRESHOLDS[THRESHOLDS.length - 1];
  for (const t of THRESHOLDS) {
    if (xp < t.xpEnd) {
      tier = t;
      break;
    }
  }

  const xpIntoLevel = xp - tier.xpStart;
  const xpForLevel = tier.xpEnd === Infinity ? null : tier.xpEnd - tier.xpStart;
  const progress = xpForLevel ? Math.min(100, Math.round((xpIntoLevel / xpForLevel) * 100)) : 100;

  return {
    level: tier.level,
    title: tier.title,
    color: tier.color,
    xpStart: tier.xpStart,
    xpEnd: tier.xpEnd,
    progress,
    xpIntoLevel,
    xpForLevel: xpForLevel ?? Infinity,
  };
}
