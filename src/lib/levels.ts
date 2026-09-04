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
  { level: 1, title: "Fresh Start", color: "text-muted-foreground", xpStart: 0, xpEnd: 1500 },
  { level: 2, title: "Tiny Spark", color: "text-slate-300", xpStart: 1500, xpEnd: 3200 },
  { level: 3, title: "Warming Up", color: "text-sky-300", xpStart: 3200, xpEnd: 5100 },
  { level: 4, title: "Getting Cozy", color: "text-sky-400", xpStart: 5100, xpEnd: 9800 },
  { level: 5, title: "On a Roll", color: "text-cyan-400", xpStart: 9800, xpEnd: 12300 },
  { level: 6, title: "Good Stuff", color: "text-teal-400", xpStart: 12300, xpEnd: 14800 },
  { level: 7, title: "Locked In", color: "text-emerald-400", xpStart: 14800, xpEnd: 17600 },
  { level: 8, title: "Brainy Era", color: "text-green-400", xpStart: 17600, xpEnd: 20400 },
  { level: 9, title: "Getting Sharp", color: "text-lime-400", xpStart: 20400, xpEnd: 23200 },
  { level: 10, title: "Little Genius", color: "text-yellow-400", xpStart: 23200, xpEnd: 26000 },

  { level: 11, title: "In the Zone", color: "text-amber-400", xpStart: 26000, xpEnd: 28800 },
  { level: 12, title: "Brain Glow-Up", color: "text-orange-400", xpStart: 28800, xpEnd: 31600 },
  { level: 13, title: "Quite the Brain", color: "text-orange-300", xpStart: 31600, xpEnd: 34400 },
  { level: 14, title: "Smooth Operator", color: "text-rose-300", xpStart: 34400, xpEnd: 37200 },
  { level: 15, title: "Big Brain Energy", color: "text-rose-400", xpStart: 37200, xpEnd: 40000 },
  { level: 16, title: "Brainwave", color: "text-pink-400", xpStart: 40000, xpEnd: 42800 },
  { level: 17, title: "Dialed In", color: "text-fuchsia-400", xpStart: 42800, xpEnd: 45600 },
  { level: 18, title: "No Slacking", color: "text-purple-400", xpStart: 45600, xpEnd: 48400 },
  { level: 19, title: "Question Hunter", color: "text-violet-400", xpStart: 48400, xpEnd: 51200 },
  { level: 20, title: "Dedicated Mind", color: "text-indigo-400", xpStart: 51200, xpEnd: 54000 },

  { level: 21, title: "Strong Foundation", color: "text-blue-400", xpStart: 54000, xpEnd: 56800 },
  { level: 22, title: "Deep Thinker", color: "text-sky-400", xpStart: 56800, xpEnd: 59600 },
  { level: 23, title: "Skilled Learner", color: "text-cyan-400", xpStart: 59600, xpEnd: 62400 },
  { level: 24, title: "Sharp Solver", color: "text-teal-400", xpStart: 62400, xpEnd: 65200 },
  { level: 25, title: "Knowledge Builder", color: "text-emerald-400", xpStart: 65200, xpEnd: 68000 },
  { level: 26, title: "Focused Scholar", color: "text-green-400", xpStart: 68000, xpEnd: 70800 },
  { level: 27, title: "Problem Crusher", color: "text-lime-400", xpStart: 70800, xpEnd: 73600 },
  { level: 28, title: "Fast Thinker", color: "text-yellow-400", xpStart: 73600, xpEnd: 76400 },
  { level: 29, title: "Sharp Cookie", color: "text-amber-400", xpStart: 76400, xpEnd: 79200 },
  { level: 30, title: "Brain Main", color: "text-orange-400", xpStart: 79200, xpEnd: 82000 },

  { level: 31, title: "Study Royalty", color: "text-rose-400", xpStart: 82000, xpEnd: 84800 },
  { level: 32, title: "Mind on Fire", color: "text-pink-400", xpStart: 84800, xpEnd: 87600 },
  { level: 33, title: "Quiz Gremlin", color: "text-fuchsia-400", xpStart: 87600, xpEnd: 90400 },
  { level: 34, title: "Certified Nerd", color: "text-purple-400", xpStart: 90400, xpEnd: 93200 },
  { level: 35, title: "Brain Boss", color: "text-violet-400", xpStart: 93200, xpEnd: 96000 },
  { level: 36, title: "Knowledge Goblin", color: "text-indigo-400", xpStart: 96000, xpEnd: 98800 },
  { level: 37, title: "Study Icon", color: "text-blue-400", xpStart: 98800, xpEnd: 101600 },
  { level: 38, title: "Actually Smart", color: "text-sky-400", xpStart: 101600, xpEnd: 104400 },
  { level: 39, title: "Brain Athlete", color: "text-cyan-400", xpStart: 104400, xpEnd: 107200 },
  { level: 40, title: "Mind Blown", color: "text-teal-400", xpStart: 107200, xpEnd: 110000 },

  { level: 41, title: "Quiz Queen", color: "text-emerald-400", xpStart: 110000, xpEnd: 112800 },
  { level: 42, title: "Brain Supreme", color: "text-green-400", xpStart: 112800, xpEnd: 115600 },
  { level: 43, title: "Study Machine", color: "text-lime-400", xpStart: 115600, xpEnd: 118400 },
  { level: 44, title: "Galaxy Brain", color: "text-yellow-400", xpStart: 118400, xpEnd: 121200 },
  { level: 45, title: "Mind Master", color: "text-amber-400", xpStart: 121200, xpEnd: 124000 },
  { level: 46, title: "Big Brain Club", color: "text-orange-400", xpStart: 124000, xpEnd: 126800 },
  { level: 47, title: "Quiz Royalty", color: "text-rose-400", xpStart: 126800, xpEnd: 129600 },
  { level: 48, title: "Brain Elite", color: "text-pink-400", xpStart: 129600, xpEnd: 132400 },
  { level: 49, title: "Mind Monster", color: "text-fuchsia-400", xpStart: 132400, xpEnd: 135200 },
  { level: 50, title: "Halfway Hero", color: "text-purple-400", xpStart: 135200, xpEnd: 138000 },

  { level: 51, title: "Brain Icon", color: "text-violet-400", xpStart: 138000, xpEnd: 140800 },
  { level: 52, title: "Study Star", color: "text-indigo-400", xpStart: 140800, xpEnd: 143600 },
  { level: 53, title: "Knowledge Beast", color: "text-blue-400", xpStart: 143600, xpEnd: 146400 },
  { level: 54, title: "Mind Runner", color: "text-sky-400", xpStart: 146400, xpEnd: 149200 },
  { level: 55, title: "Brain Royalty", color: "text-cyan-400", xpStart: 149200, xpEnd: 152000 },
  { level: 56, title: "Quiz Legend", color: "text-teal-400", xpStart: 152000, xpEnd: 154800 },
  { level: 57, title: "Mind Bender", color: "text-emerald-400", xpStart: 154800, xpEnd: 157600 },
  { level: 58, title: "Study Superstar", color: "text-green-400", xpStart: 157600, xpEnd: 160400 },
  { level: 59, title: "Brain Titan", color: "text-lime-400", xpStart: 160400, xpEnd: 163200 },
  { level: 60, title: "Learning Legend", color: "text-yellow-400", xpStart: 163200, xpEnd: 166000 },

  { level: 61, title: "Mind Supreme", color: "text-amber-400", xpStart: 166000, xpEnd: 168800 },
  { level: 62, title: "Brain Royal", color: "text-orange-400", xpStart: 168800, xpEnd: 171600 },
  { level: 63, title: "Quiz Mythic", color: "text-rose-400", xpStart: 171600, xpEnd: 174400 },
  { level: 64, title: "Mind Legend", color: "text-pink-400", xpStart: 174400, xpEnd: 177200 },
  { level: 65, title: "Knowledge Titan", color: "text-fuchsia-400", xpStart: 177200, xpEnd: 180000 },
  { level: 66, title: "Brain Royalty+", color: "text-purple-400", xpStart: 180000, xpEnd: 182800 },
  { level: 67, title: "Study Myth", color: "text-violet-400", xpStart: 182800, xpEnd: 185600 },
  { level: 68, title: "Mind Legend+", color: "text-indigo-400", xpStart: 185600, xpEnd: 188400 },
  { level: 69, title: "Brain Icon+", color: "text-blue-400", xpStart: 188400, xpEnd: 191200 },
  { level: 70, title: "Learning Legend+", color: "text-primary", xpStart: 191200, xpEnd: Infinity },
  { level: 71, title: "Brain Mastery", color: "text-orange-500", xpStart: 191200, xpEnd: Infinity },
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

export function didLevelUp(oldXp: number, newXp: number) {
  const from = getLevelInfo(oldXp);
  const to = getLevelInfo(newXp);
  if (to.level <= from.level) return null;
  return { fromLevel: from.level, toLevel: to.level, title: to.title };
}
