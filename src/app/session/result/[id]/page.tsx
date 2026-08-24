import { prisma } from "@/lib/prisma";
import { getSession } from "@/app/actions/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { Home, Zap, Coins, CheckCircle2, XCircle, Target, Sparkles } from "lucide-react";
import { getEconomySettings } from "@/app/actions/settings";
import { AppShell } from "@/components/NavMenu";

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) redirect("/login");

  const { id } = await params;

  const [session, settings] = await Promise.all([
    prisma.session.findUnique({ where: { id } }),
    getEconomySettings(),
  ]);

  if (!session || session.userId !== user.id) {
    redirect("/");
  }

  const answered = session.correctAnswers + session.wrongAnswers;
  const accuracy = answered > 0 ? Math.round((session.correctAnswers / answered) * 100) : 0;
  const coinsEarned = session.isPractice
    ? 0
    : session.correctAnswers * settings.coinsPerCorrect;
  const skipped = session.totalQuestions - session.correctAnswers - session.wrongAnswers;

  return (
    <AppShell>
      <div className="min-h-screen p-4 md:p-8 flex items-center justify-center">
        <div className="w-full max-w-lg space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/15 mb-2">
              {session.isPractice ? (
                <Sparkles className="w-7 h-7 text-primary" />
              ) : (
                <Target className="w-7 h-7 text-primary" />
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight">
              {session.isPractice ? "Practice Complete" : "Session Complete"}
            </h1>
            <p className="text-muted-foreground text-sm">
              {session.isPractice
                ? "No coins or XP changed. Mistakes were saved for redo."
                : "Here's how you did."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4 text-center rounded-2xl">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                Questions
              </p>
              <p className="text-3xl font-black">{session.totalQuestions}</p>
            </Card>
            <Card className="p-4 text-center rounded-2xl border-success/20">
              <p className="text-xs text-success uppercase tracking-wider font-semibold mb-1 flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Correct
              </p>
              <p className="text-3xl font-black text-success">{session.correctAnswers}</p>
            </Card>
            <Card className="p-4 text-center rounded-2xl border-danger/20">
              <p className="text-xs text-danger uppercase tracking-wider font-semibold mb-1 flex items-center justify-center gap-1">
                <XCircle className="w-3.5 h-3.5" /> Wrong
              </p>
              <p className="text-3xl font-black text-danger">{session.wrongAnswers}</p>
            </Card>
            <Card className="p-4 text-center rounded-2xl border-primary/20">
              <p className="text-xs text-primary uppercase tracking-wider font-semibold mb-1">
                Accuracy
              </p>
              <p className="text-3xl font-black text-primary">{accuracy}%</p>
            </Card>
          </div>

          {skipped > 0 && (
            <p className="text-center text-sm text-muted-foreground">
              Skipped {skipped}
              {!session.isPractice && " (no XP change)"}
            </p>
          )}

          {!session.isPractice && (
            <Card className="p-5 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-success font-semibold">
                  <Zap className="w-4 h-4" /> XP gained
                </span>
                <span className="font-black text-success text-lg">+{session.positivePoints}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-danger font-semibold">
                  <Zap className="w-4 h-4" /> XP lost
                </span>
                <span className="font-black text-danger text-lg">-{session.negativePoints}</span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-amber-500 font-semibold">
                  <Coins className="w-4 h-4" /> Coins
                </span>
                <span className="font-black text-amber-500 text-lg">+{coinsEarned}</span>
              </div>
              <div className="h-px bg-border" />
              <div className="flex items-center justify-between text-lg font-black">
                <span>Net XP</span>
                <span className={session.netPoints >= 0 ? "text-primary" : "text-danger"}>
                  {session.netPoints > 0 ? "+" : ""}
                  {session.netPoints}
                </span>
              </div>
            </Card>
          )}

          <Link href="/" className="block">
            <Button size="lg" className="w-full h-14 text-lg font-bold rounded-2xl shadow-lg shadow-primary/20">
              <Home className="w-5 h-5 mr-2" />
              Return Home
            </Button>
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
