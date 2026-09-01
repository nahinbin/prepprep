import { getSession } from "./actions/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import {
  User as UserIcon,
  Zap,
  Gamepad2,
  Crosshair,
  TrendingDown,
  Sparkles,
  Play,
  RotateCcw,
  Shield,
  ChevronRight,
  Flame,
} from "lucide-react";
import Link from "next/link";
import { NavMenu, AppShell } from "@/components/NavMenu";
import { GameHUD } from "@/components/GameHUD";
import { calcAccuracy } from "@/lib/stats";
import { getLevelInfo } from "@/lib/levels";

export default async function Dashboard() {
  const user = await getSession();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      sessions: {
        select: {
          correctAnswers: true,
          wrongAnswers: true,
          isPractice: true,
        },
      },
    },
  });

  if (!dbUser) redirect("/login");

  let uncorrectedMistakes = 0;
  try {
    uncorrectedMistakes = await prisma.mistake.count({
      where: { userId: user.id, isCorrected: false },
    });
  } catch {
    uncorrectedMistakes = 0;
  }

  const netXp = dbUser.positivePoints - dbUser.negativePoints;
  const accuracy = calcAccuracy(dbUser.sessions);
  const lvl = getLevelInfo(netXp);

  return (
    <AppShell mistakeCount={uncorrectedMistakes}>
      <div className="min-h-screen flex flex-col px-4 pt-4 pb-8 md:px-8 md:pt-6 max-w-4xl mx-auto space-y-6">
        {/* Top App Header */}
        <div className="flex items-center justify-between gap-3">
          <Link href="/profile" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl border-2 border-primary/40 overflow-hidden group-hover:border-primary transition-all flex items-center justify-center bg-muted shadow-md shadow-primary/10 group-hover:scale-105">
                {dbUser.profilePicture ? (
                  <img
                    src={dbUser.profilePicture}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <UserIcon className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              <span className={`absolute -bottom-1 -right-1 text-[10px] font-black uppercase px-1.5 py-0.2 rounded-md bg-card border border-border ${lvl.color} shadow-sm`}>
                L{lvl.level}
              </span>
            </div>
            <div className="hidden sm:block">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Player</span>
              <p className="font-black text-base text-foreground leading-none">{dbUser.username}</p>
            </div>
          </Link>

          <div className="flex items-center gap-2 shrink-0">
            {/* Top GameHUD: Coins + XP/Level only (Accuracy moved to stats box below) */}
            <GameHUD coins={dbUser.coins} xp={netXp} />
            <NavMenu />
          </div>
        </div>



        {/* Performance Stats Box: Accuracy & XP Lost displayed cleanly in the main screen */}
        <div>
          <h3 className="text-sm font-black uppercase tracking-wider text-muted-foreground mb-3 pl-1">
            Performance & Stats
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
            {/* Accuracy Box */}
            <div className="p-5 rounded-3xl bg-card border-[3px] border-border flex flex-col justify-between gap-2 shadow-[0_4px_0_0_rgba(var(--border),0.5)] hover:-translate-y-1 hover:shadow-[0_8px_0_0_rgba(var(--border),0.5)] transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase">Accuracy</span>
                <Crosshair className="w-5 h-5 text-success" />
              </div>
              <p className="text-3xl sm:text-4xl font-black text-success tabular-nums">{accuracy}%</p>
            </div>

            {/* XP Lost Box */}
            <div className="p-5 rounded-3xl bg-card border-[3px] border-border flex flex-col justify-between gap-2 shadow-[0_4px_0_0_rgba(var(--border),0.5)] hover:-translate-y-1 hover:shadow-[0_8px_0_0_rgba(var(--border),0.5)] transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase">XP Lost</span>
                <TrendingDown className="w-5 h-5 text-danger" />
              </div>
              <p className="text-3xl sm:text-4xl font-black text-danger tabular-nums">-{dbUser.negativePoints}</p>
            </div>

            {/* Mistakes Pending Box */}
            <Link
              href="/mistakes"
              className="p-5 rounded-3xl bg-card border-[3px] border-border hover:border-primary/50 flex flex-col justify-between gap-2 shadow-[0_4px_0_0_rgba(var(--border),0.5)] hover:-translate-y-1 hover:shadow-[0_8px_0_0_rgba(var(--primary),0.3)] transition-all col-span-2 sm:col-span-1 group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase">Mistakes</span>
                <Flame className="w-5 h-5 text-amber-500 group-hover:scale-110 transition-transform" />
              </div>
              <div className="flex items-baseline justify-between">
                <p className="text-3xl sm:text-4xl font-black text-amber-500 tabular-nums">{uncorrectedMistakes}</p>
                <span className="text-xs font-bold text-primary flex items-center bg-primary/10 px-2 py-1 rounded-lg">
                  Review <ChevronRight className="w-3 h-3 ml-0.5" />
                </span>
              </div>
            </Link>
          </div>
        </div>

        {/* Game Arena Play Cards (Duolingo Game Feel) */}
        <div>
          <h3 className="text-sm font-black uppercase tracking-wider text-muted-foreground mb-3 pl-1">
            Game Arena
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Start Ranked Session */}
            <Link
              href="/session/new"
              className="p-6 rounded-[2rem] bg-gradient-to-br from-primary to-purple-700 text-white shadow-[0_6px_0_0_rgba(107,33,168,0.6)] border-[3px] border-primary/20 flex items-center justify-between gap-4 hover:-translate-y-1.5 hover:shadow-[0_10px_0_0_rgba(107,33,168,0.6)] active:translate-y-1 active:shadow-[0_2px_0_0_rgba(107,33,168,0.6)] transition-all group"
            >
              <div className="space-y-1.5">
                <span className="inline-block text-[11px] font-black uppercase tracking-wider bg-black/20 px-2.5 py-1 rounded-lg text-white">
                  Ranked Match
                </span>
                <h4 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2">
                  Enter Arena
                </h4>
                <p className="text-sm font-bold text-white/80">
                  Earn XP, win coins & level up
                </p>
              </div>
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform shrink-0 border-2 border-white/20">
                <Play className="w-8 h-8 fill-current text-white ml-1" />
              </div>
            </Link>

            {/* Free Practice */}
            <Link
              href="/session/new?mode=practice"
              className="p-6 rounded-[2rem] bg-card border-[3px] border-border shadow-[0_6px_0_0_rgba(var(--border),0.5)] flex items-center justify-between gap-4 hover:-translate-y-1.5 hover:shadow-[0_10px_0_0_rgba(var(--primary),0.3)] hover:border-primary/50 active:translate-y-1 active:shadow-[0_2px_0_0_rgba(var(--border),0.5)] transition-all group"
            >
              <div className="space-y-1.5">
                <span className="inline-block text-[11px] font-black uppercase tracking-wider bg-primary/10 text-primary px-2.5 py-1 rounded-lg border border-primary/20">
                  Zero Coin Cost
                </span>
                <h4 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
                  Free Practice
                </h4>
                <p className="text-sm font-bold text-muted-foreground">
                  Quiz from your saved bank
                </p>
              </div>
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border-2 border-primary/20 flex items-center justify-center group-hover:bg-primary/20 transition-colors shrink-0 text-primary group-hover:scale-110">
                <Sparkles className="w-8 h-8" />
              </div>
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
