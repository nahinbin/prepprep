import { getSession } from "./actions/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { User as UserIcon, Zap } from "lucide-react";
import Link from "next/link";
import { NavMenu, AppShell } from "@/components/NavMenu";
import { GameHUD } from "@/components/GameHUD";
import { calcAccuracy } from "@/lib/stats";

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

  return (
    <AppShell mistakeCount={uncorrectedMistakes}>
      <div className="min-h-screen flex flex-col px-4 pt-5 md:px-8 md:pt-8">
        <div className="w-full max-w-4xl mx-auto flex items-center justify-between gap-3 mb-6">
          <Link href="/profile" className="shrink-0">
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-full border-2 border-primary/30 overflow-hidden hover:border-primary transition-colors flex items-center justify-center bg-muted shadow-lg shadow-primary/10">
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
          </Link>

          <div className="flex items-center gap-2 shrink-0">
            <GameHUD coins={dbUser.coins} xp={netXp} accuracy={accuracy} />
            <NavMenu />
          </div>
        </div>

        <div className="w-full max-w-4xl mx-auto hidden sm:block mb-8">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight">
            Hello, <span className="text-primary">{dbUser.username}</span>
          </h1>
          <p className="text-muted-foreground mt-1 text-base md:text-lg">Ready to play?</p>
        </div>

        <div className="w-full max-w-4xl mx-auto mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-danger/10 border border-danger/20">
            <Zap className="w-4 h-4 text-danger" />
            <span className="text-sm font-bold text-danger">{dbUser.negativePoints} XP lost</span>
          </div>
        </div>

        {/* Desktop quick play hint — actions live in the bottom dock */}
        <div className="w-full max-w-4xl mx-auto hidden md:flex flex-col items-center justify-center flex-1 min-h-[40vh] text-center">
          <div className="w-24 h-24 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center mb-5 animate-pulse">
            <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center shadow-xl shadow-primary/40">
              <span className="text-3xl font-black text-primary-foreground">▶</span>
            </div>
          </div>
          <p className="text-xl font-bold text-foreground/90">Tap play below to start</p>
          <p className="text-muted-foreground mt-1">Free practice · Paid session · Mistakes</p>
        </div>

        <div className="w-full max-w-4xl mx-auto md:hidden flex-1 flex flex-col items-center justify-center min-h-[45vh] text-center px-4">
          <div className="w-20 h-20 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center mb-4">
            <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/40">
              <span className="text-2xl font-black text-primary-foreground">▶</span>
            </div>
          </div>
          <p className="text-2xl font-black">Let&apos;s go</p>
          <p className="text-muted-foreground mt-1 text-base">Use the dock below</p>
        </div>
      </div>
    </AppShell>
  );
}
