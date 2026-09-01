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
  Bell,
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

  let unreadNotifications = 0;
  try {
    unreadNotifications = await prisma.notification.count({
      where: { userId: user.id, isRead: false },
    });
  } catch {
    unreadNotifications = 0;
  }

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
            
            <Link href="/notifications" className="relative p-2 rounded-2xl bg-card border-2 border-border hover:border-primary/50 hover:bg-muted/50 transition-all text-muted-foreground hover:text-foreground shadow-sm">
              <Bell className="w-5 h-5" />
              {unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[1.2rem] h-[1.2rem] px-1 flex items-center justify-center rounded-full bg-danger text-[10px] font-black text-white shadow-sm ring-2 ring-background">
                  {unreadNotifications > 99 ? '99+' : unreadNotifications}
                </span>
              )}
            </Link>
            
            <NavMenu />
          </div>
        </div>



        {/* Performance Stats Box: Accuracy & XP Lost displayed cleanly in the main screen */}
        <div>
          <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-2 pl-1">
            Performance & Stats
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {/* Accuracy Box */}
            <div className="p-4 rounded-[1.25rem] bg-card border-2 border-border/70 flex flex-col justify-between gap-1 shadow-sm hover:border-primary/30 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase">Accuracy</span>
                <Crosshair className="w-4 h-4 text-success" />
              </div>
              <p className="text-2xl sm:text-3xl font-black text-success tabular-nums">{accuracy}%</p>
            </div>

            {/* Mistakes Pending Box */}
            <Link
              href="/mistakes"
              className="p-4 rounded-[1.25rem] bg-card border-2 border-border/70 hover:border-primary/40 flex flex-col justify-between gap-1 shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase">Mistakes</span>
                <Flame className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" />
              </div>
              <div className="flex items-baseline justify-between">
                <p className="text-2xl sm:text-3xl font-black text-amber-500 tabular-nums">{uncorrectedMistakes}</p>
                <span className="text-[10px] font-bold text-primary flex items-center bg-primary/10 px-1.5 py-0.5 rounded-md">
                  Review <ChevronRight className="w-3 h-3 ml-0.5" />
                </span>
              </div>
            </Link>
          </div>
        </div>

        {/* Game Arena Play Cards (Duolingo Game Feel) */}
        <div>
          <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-2 pl-1">
            Game Arena
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Start Ranked Session */}
            <Link
              href="/session/new"
              className="p-5 rounded-[1.5rem] bg-gradient-to-br from-primary/90 to-purple-800 text-white shadow-lg shadow-primary/20 border-2 border-primary/50 flex items-center justify-between gap-4 hover:-translate-y-0.5 hover:shadow-xl transition-all active:scale-[0.98] group"
            >
              <div className="space-y-1">
                <span className="inline-block text-[10px] font-black uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-md text-white">
                  Ranked Match
                </span>
                <h4 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
                  Enter Arena
                </h4>
                <p className="text-xs font-semibold text-white/80">
                  Earn XP, win coins & level up
                </p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform shrink-0">
                <Play className="w-7 h-7 fill-current text-white ml-1" />
              </div>
            </Link>

            {/* Free Practice */}
            <Link
              href="/session/new?mode=practice"
              className="p-5 rounded-[1.5rem] bg-card border-2 border-border/90 shadow-sm flex items-center justify-between gap-4 hover:border-primary/50 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] transition-all group"
            >
              <div className="space-y-1">
                <span className="inline-block text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded-md border border-primary/20">
                  Zero Coin Cost
                </span>
                <h4 className="text-xl sm:text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
                  Free Practice
                </h4>
                <p className="text-xs font-medium text-muted-foreground">
                  Quiz from your saved bank
                </p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:bg-primary/20 transition-colors shrink-0 text-primary group-hover:scale-110">
                <Sparkles className="w-7 h-7" />
              </div>
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
