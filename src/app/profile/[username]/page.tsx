import { getSession } from "@/app/actions/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { AppShell, NavMenu } from "@/components/NavMenu";
import { BackButton } from "@/components/BackButton";
import { getLevelInfo } from "@/lib/levels";
import {
  User as UserIcon,
  Shield,
  Zap,
  Lock,
  Trophy,
  Users,
  Check,
  UserPlus
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { calcAccuracy } from "@/lib/stats";
import { sendFriendRequest } from "@/app/actions/friends";

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  // Decode the username from the URL (params is async in Next.js App Router)
  const { username: rawUsername } = await params;
  const username = decodeURIComponent(rawUsername);

  // If visiting own profile, redirect to main profile page
  if (username === session.username) {
    redirect("/profile");
  }

  const targetUser = await prisma.user.findUnique({
    where: { username },
    include: {
      sessions: true,
      friendsReceived: { where: { userId: session.id } },
      friendsInitiated: { where: { friendId: session.id } },
    },
  });

  if (!targetUser) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
          <UserIcon className="w-16 h-16 text-muted-foreground" />
          <h1 className="text-2xl font-black">User Not Found</h1>
          <BackButton />
        </div>
      </AppShell>
    );
  }

  const friendship = targetUser.friendsReceived[0] || targetUser.friendsInitiated[0];
  const isFriend = friendship?.status === "accepted";
  const hasPendingRequest = friendship?.status === "pending";

  const canViewStats = targetUser.isPublic || isFriend;

  const netXp = targetUser.positivePoints - targetUser.negativePoints;
  const lvl = getLevelInfo(netXp);
  const accuracy = calcAccuracy(targetUser.sessions);

  return (
    <AppShell showBottomBar={false}>
      <div className="w-full p-4 md:p-8 flex flex-col items-center max-w-2xl mx-auto space-y-6">
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BackButton />
            <h1 className="text-xl md:text-2xl font-black tracking-tight">Player Profile</h1>
          </div>
          <NavMenu />
        </div>

        <div className="w-full text-center space-y-3">
          <div className="w-28 h-28 sm:w-32 sm:h-32 mx-auto rounded-3xl bg-muted border-4 border-primary/40 overflow-hidden flex items-center justify-center shadow-xl shadow-primary/10">
            {targetUser.profilePicture ? (
              <img src={targetUser.profilePicture} alt={targetUser.username} className="w-full h-full object-cover" />
            ) : (
              <UserIcon className="w-14 h-14 text-muted-foreground" />
            )}
          </div>
          
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-foreground">{targetUser.username}</h2>
            {targetUser.name && (
              <p className="text-sm font-bold text-muted-foreground mt-1">{targetUser.name}</p>
            )}
            
            <div className="inline-flex items-center gap-2 mt-2 px-3.5 py-1 rounded-xl bg-primary/15 border border-primary/30 shadow-xs">
              <Shield className={`w-4 h-4 ${lvl.color}`} />
              <span className={`text-sm font-black ${lvl.color}`}>{lvl.title}</span>
              <span className="text-xs font-bold text-muted-foreground">· Level {lvl.level}</span>
            </div>
          </div>

          {targetUser.bio && (
            <p className="text-sm font-medium text-foreground max-w-sm mx-auto bg-muted/50 p-3 rounded-2xl border border-border/50">
              "{targetUser.bio}"
            </p>
          )}

          <div className="pt-2">
            {isFriend ? (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-success/10 text-success font-black rounded-2xl border-2 border-success/20">
                <Check className="w-5 h-5" />
                Friends
              </div>
            ) : hasPendingRequest ? (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-muted text-muted-foreground font-black rounded-2xl border-2 border-border/50">
                <Users className="w-5 h-5" />
                Request Pending
              </div>
            ) : (
              <form action={async () => {
                "use server";
                await sendFriendRequest(targetUser.username);
              }}>
                <button type="submit" className="inline-flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground font-black rounded-2xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all border-2 border-primary">
                  <UserPlus className="w-5 h-5" />
                  Add Friend
                </button>
              </form>
            )}
          </div>
        </div>

        {canViewStats ? (
          <>
            {/* Level & XP Progress Card */}
            <Card className="w-full p-5 sm:p-6 rounded-3xl border-2 space-y-3 bg-card shadow-md mt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-primary fill-primary/30" />
                  <span className="font-black text-base">XP Progression</span>
                </div>
                <span className="text-base font-black text-primary tabular-nums">{netXp} XP</span>
              </div>
              <div className="w-full h-3.5 bg-muted rounded-full overflow-hidden p-0.5 border border-border/70">
                <div
                  className="h-full bg-gradient-to-r from-primary to-purple-500 rounded-full xp-bar-glow transition-all duration-700"
                  style={{ width: `${lvl.progress}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
                <span>Level {lvl.level} ({lvl.progress}%)</span>
                {lvl.xpEnd !== Infinity ? (
                  <span>{lvl.xpEnd - netXp} XP to go</span>
                ) : (
                  <span className="text-primary font-black">MAX LEVEL</span>
                )}
              </div>
            </Card>

            <div className="w-full grid grid-cols-2 gap-3 mt-4">
              <div className="p-4 rounded-2xl bg-primary/10 border border-primary/25 flex flex-col items-center text-center shadow-sm">
                <Trophy className="w-6 h-6 text-primary mb-1" />
                <span className="text-[11px] font-bold text-muted-foreground uppercase">Net XP</span>
                <span className="text-xl sm:text-2xl font-black text-primary tabular-nums">{netXp}</span>
              </div>
              <div className="p-4 rounded-2xl bg-success/10 border border-success/25 flex flex-col items-center text-center shadow-sm">
                <Zap className="w-6 h-6 text-success mb-1" />
                <span className="text-[11px] font-bold text-muted-foreground uppercase">Accuracy</span>
                <span className="text-xl sm:text-2xl font-black text-success tabular-nums">{accuracy}%</span>
              </div>
            </div>
          </>
        ) : (
          <div className="w-full p-8 rounded-3xl border-2 border-dashed border-border flex flex-col items-center justify-center text-center opacity-70 mt-6 bg-card">
            <Lock className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="font-bold text-lg">Private Profile</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              This account is private. Add them as a friend to see their gaming stats!
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
