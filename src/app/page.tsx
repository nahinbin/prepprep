import { getSession } from "./actions/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import {
  User as UserIcon,
  Zap,
  Gamepad2,
  Crosshair,
  Sparkles,
  Play,
  RotateCcw,
  Shield,
  ChevronRight,
  Flame,
  Bell,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { NavMenu, AppShell } from "@/components/NavMenu";
import { GameHUD } from "@/components/GameHUD";
import { calcAccuracy } from "@/lib/stats";
import { getLevelInfo } from "@/lib/levels";
import { getEconomySettings } from "@/app/actions/settings";

export default async function Dashboard() {
  const user = await getSession();
  if (!user) redirect("/login");

  const [dbUser, economySettings] = await Promise.all([
    prisma.user.findUnique({
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
    }),
    getEconomySettings(),
  ]);

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
  const recoverableXp = uncorrectedMistakes * (economySettings.redoXpRecovery ?? 5);

  // Fetch the latest unread notification if any
  let latestNotification = null;
  try {
    latestNotification = await prisma.notification.findFirst({
      where: { userId: user.id, isRead: false },
      orderBy: { createdAt: "desc" },
    });
  } catch {
    latestNotification = null;
  }

  return (
    <AppShell mistakeCount={uncorrectedMistakes}>
      <div className="w-full flex flex-col px-4 pt-4 pb-8 md:px-8 md:pt-6 max-w-4xl mx-auto space-y-6">
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
            {/* Top GameHUD: Coins + XP/Level */}
            <GameHUD coins={dbUser.coins} xp={netXp} />
            <NavMenu />
          </div>
        </div>

        {/* Lockscreen-Style Push Notification Preview Banner (Appears only when user has unread notification) */}
        {latestNotification && (
          <Link
            href={latestNotification.link || "/notifications"}
            className="group relative block w-full p-4 rounded-3xl bg-card border-2 border-primary/40 shadow-lg shadow-primary/10 hover:border-primary hover:shadow-primary/20 transition-all active:scale-[0.99]"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shrink-0 group-hover:scale-105 transition-transform">
                <Bell className="w-5 h-5 animate-bounce" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-black uppercase tracking-wider bg-primary/20 text-primary px-2 py-0.5 rounded-md">
                    Notification
                  </span>
                  <span className="text-xs font-bold text-muted-foreground">
                    {new Date(latestNotification.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-sm font-bold text-foreground truncate">
                  {latestNotification.content}
                </p>
              </div>
              <div className="w-8 h-8 rounded-xl bg-muted/60 flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-colors shrink-0">
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </Link>
        )}

        {/* Performance Stats Box */}
        <div>
          <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-2.5 pl-1">
            Performance & Stats
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {/* Accuracy Box */}
            <div className="p-4 sm:p-5 rounded-[1.35rem] bg-card border-2 border-border/80 flex flex-col justify-between gap-1.5 shadow-sm hover:border-primary/40 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase">Accuracy</span>
                <Crosshair className="w-4 h-4 text-success" />
              </div>
              <p className="text-2xl sm:text-3xl font-black text-success tabular-nums">{accuracy}%</p>
            </div>

            {/* Mistakes Pending Box */}
            <Link
              href="/mistakes"
              className="p-4 sm:p-5 rounded-[1.35rem] bg-card border-2 border-border/80 hover:border-amber-500/50 flex flex-col justify-between gap-1.5 shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase">Mistakes</span>
                <Flame className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" />
              </div>
              <div className="flex items-baseline justify-between">
                <p className="text-2xl sm:text-3xl font-black text-amber-500 tabular-nums">{uncorrectedMistakes}</p>
                <span className="text-[10px] font-bold text-amber-500 flex items-center bg-amber-500/10 px-1.5 py-0.5 rounded-md">
                  Review <ChevronRight className="w-3 h-3 ml-0.5" />
                </span>
              </div>
            </Link>

            {/* Recoverable XP Box */}
            <Link
              href="/mistakes"
              className="p-4 sm:p-5 rounded-[1.35rem] bg-card border-2 border-border/80 hover:border-primary/50 flex flex-col justify-between gap-1.5 shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] col-span-2 sm:col-span-1 group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase">Recoverable XP</span>
                <RotateCcw className="w-4 h-4 text-primary group-hover:rotate-45 transition-transform" />
              </div>
              <div className="flex items-baseline justify-between">
                <p className="text-2xl sm:text-3xl font-black text-primary tabular-nums">+{recoverableXp}</p>
                <span className="text-[10px] font-bold text-primary flex items-center bg-primary/10 px-1.5 py-0.5 rounded-md">
                  Fix & Earn <ChevronRight className="w-3 h-3 ml-0.5" />
                </span>
              </div>
            </Link>
          </div>
        </div>

        {/* Game Arena Play Cards */}
        <div>
          <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-2.5 pl-1">
            Game Arena
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Start Ranked Session */}
            <Link
              href="/session/new"
              className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-primary/95 via-primary to-purple-800 text-white shadow-xl shadow-primary/20 border-2 border-primary/40 flex items-center justify-between gap-4 hover:-translate-y-0.5 hover:shadow-2xl transition-all active:scale-[0.98] group"
            >
              <div className="space-y-1">
                <span className="inline-block text-[10px] font-black uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-md text-white">
                  Ranked Match
                </span>
                <h4 className="text-2xl font-black tracking-tight text-white">
                  Enter Arena
                </h4>
                <p className="text-xs font-bold text-white/80">
                  Compete & level up
                </p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform shrink-0 border border-white/20">
                <Play className="w-7 h-7 fill-current text-white ml-0.5" />
              </div>
            </Link>

            {/* Free Practice */}
            <Link
              href="/session/new?mode=practice"
              className="p-5 sm:p-6 rounded-3xl bg-card border-2 border-border/80 hover:border-primary/50 shadow-md flex items-center justify-between gap-4 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98] transition-all group"
            >
              <div className="space-y-1">
                <span className="inline-block text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded-md border border-primary/20">
                  Practice Mode
                </span>
                <h4 className="text-2xl font-black tracking-tight text-foreground">
                  Free Practice
                </h4>
                <p className="text-xs font-bold text-muted-foreground">
                  Zero coin cost
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
