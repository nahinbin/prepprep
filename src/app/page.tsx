import { getSession } from "./actions/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import {
  User as UserIcon,
  Crosshair,
  Sparkles,
  Play,
  RotateCcw,
  ChevronRight,
  Flame,
  Bell,
  ArrowRight,
  CalendarCheck,
  GraduationCap,
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

  // Fetch today's next incomplete routine block
  const todayKey = new Date().toISOString().split("T")[0];
  let nextRoutineBlock: {
    id: string; type: string; title: string; startTime: string | null;
    subject: string | null; topic: string | null;
  } | null = null;
  try {
    nextRoutineBlock = await prisma.routineBlock.findFirst({
      where: { userId: user.id, date: todayKey, isCompleted: false },
      orderBy: [{ startTime: "asc" }, { order: "asc" }],
      select: { id: true, type: true, title: true, startTime: true, subject: true, topic: true },
    });
  } catch { nextRoutineBlock = null; }

  // Fetch upcoming deadlines (next 7 days, not submitted/marked)
  let upcomingDeadlines: Array<{id:string; name:string; subjectName:string; dueDate:Date; status:string}> = [];
  try {
    const now = new Date();
    const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    upcomingDeadlines = await prisma.assessment.findMany({
      where: {
        userId: user.id,
        dueDate: { gte: now, lte: weekAhead },
        status: { notIn: ["submitted", "marks_received"] }
      },
      orderBy: { dueDate: "asc" },
      take: 2,
      select: { id: true, name: true, subjectName: true, dueDate: true, status: true }
    });
  } catch { upcomingDeadlines = []; }

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

        {/* Today's Plan */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground pl-1">Today</h3>
            <a href="/routine" className="text-xs font-bold text-muted-foreground hover:text-primary flex items-center gap-0.5 transition-colors">
              Open Plan <ChevronRight className="w-3.5 h-3.5" />
            </a>
          </div>
          <a
            href="/routine"
            className="group flex items-center justify-between p-4 rounded-2xl bg-card border-2 border-border/80 hover:border-primary/40 transition-all active:scale-[0.99] shadow-sm"
          >
            {nextRoutineBlock ? (
              <>
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    nextRoutineBlock.type === "study" ? "bg-violet-500/15 text-violet-400" : "bg-primary/10 text-primary"
                  }`}>
                    <CalendarCheck className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    {nextRoutineBlock.startTime && (
                      <p className="text-[11px] font-black uppercase tracking-wide text-muted-foreground">
                        {(() => {
                          const [h, m] = nextRoutineBlock.startTime!.split(":").map(Number);
                          return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
                        })()}
                      </p>
                    )}
                    <p className="font-black text-foreground truncate">
                      {nextRoutineBlock.type === "study"
                        ? (nextRoutineBlock.subject || nextRoutineBlock.title)
                        : nextRoutineBlock.title}
                    </p>
                    {nextRoutineBlock.type === "study" && nextRoutineBlock.topic && (
                      <p className="text-xs font-semibold text-violet-400 truncate">{nextRoutineBlock.topic}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground group-hover:text-primary transition-colors shrink-0">
                  <span className="text-[11px] font-bold uppercase tracking-wide">Up next</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <CalendarCheck className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-black text-foreground">Plan your day</p>
                    <p className="text-xs text-muted-foreground">No schedule yet — tap to build one</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </>
            )}
          </a>
        </div>

        {/* Upcoming Deadlines */}
        {upcomingDeadlines.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground pl-1">Deadlines</h3>
              <Link href="/academics" className="text-xs font-bold text-muted-foreground hover:text-primary flex items-center gap-0.5 transition-colors">
                View all <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="space-y-2">
              {upcomingDeadlines.map(d => {
                const daysLeft = Math.ceil((d.dueDate.getTime() - Date.now()) / 86400000);
                const isToday = daysLeft <= 0;
                const isTomorrow = daysLeft === 1;
                return (
                  <Link key={d.id} href="/academics" className="flex items-center justify-between p-3.5 rounded-2xl bg-card border border-border/60 hover:border-primary/40 transition-all active:scale-[0.99]">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isToday ? 'bg-danger/15 text-danger' : 'bg-amber-500/10 text-amber-400'}`}>
                        <GraduationCap className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-foreground text-sm truncate">{d.name}</p>
                        <p className="text-xs text-muted-foreground">{d.subjectName}</p>
                      </div>
                    </div>
                    <span className={`text-[11px] font-black uppercase px-2 py-0.5 rounded-lg shrink-0 ${isToday ? 'bg-danger/15 text-danger' : isTomorrow ? 'bg-amber-500/15 text-amber-400' : 'bg-white/5 text-muted-foreground'}`}>
                      {isToday ? 'Today' : isTomorrow ? 'Tomorrow' : `${daysLeft}d`}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Stats */}
        <div>
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

        {/* Game Arena */}
        <div>
          <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-2.5 pl-1">Arena</h3>
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
