import { getSession } from "@/app/actions/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { AppShell, NavMenu } from "@/components/NavMenu";
import { BackButton } from "@/components/BackButton";
import { Users, Check, X, UserPlus, Sparkles } from "lucide-react";
import { respondToFriendRequest, removeFriend } from "@/app/actions/friends";
import { calcAccuracy } from "@/lib/stats";
import Link from "next/link";
import { FriendSearch } from "./FriendSearch";

export default async function FriendsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    include: {
      friendsInitiated: {
        include: { friend: { include: { sessions: true } } },
      },
      friendsReceived: {
        include: { user: { include: { sessions: true } } },
      },
    },
  });

  if (!user) redirect("/login");

  // Filter requests
  const pendingRequests = user.friendsReceived.filter(f => f.status === "pending");
  const activeFriends = [
    ...user.friendsInitiated.filter(f => f.status === "accepted").map(f => ({ ...f.friend, friendshipId: f.id })),
    ...user.friendsReceived.filter(f => f.status === "accepted").map(f => ({ ...f.user, friendshipId: f.id })),
  ];

  return (
    <AppShell showBottomBar={false}>
      <div className="w-full max-w-2xl mx-auto px-4 py-5 md:py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BackButton />
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground flex items-center gap-2.5">
              <Users className="w-7 h-7 text-primary" />
              Friends
            </h1>
          </div>
          <NavMenu />
        </div>

        {/* Dynamic Friend Search */}
        <FriendSearch />

        {/* Pending Requests */}
        {pendingRequests.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-sm font-black uppercase tracking-wider text-muted-foreground pl-2">Pending Requests</h2>
            <div className="space-y-3">
              {pendingRequests.map((req) => (
                <div key={req.id} className="flex items-center justify-between p-4 rounded-3xl bg-muted/30 border-2 border-border/50 shadow-sm">
                  <Link href={`/profile/${req.user.username}`} className="flex items-center gap-3 flex-1 min-w-0 group">
                    <div className="w-12 h-12 rounded-2xl bg-muted overflow-hidden shrink-0 group-hover:ring-2 group-hover:ring-primary/40 transition-all">
                      {req.user.profilePicture ? (
                        <img src={req.user.profilePicture} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-bold text-lg">
                          {req.user.username[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-foreground group-hover:text-primary transition-colors truncate">{req.user.username}</p>
                      <p className="text-xs text-muted-foreground font-medium">Wants to be your friend · tap to view profile</p>
                    </div>
                  </Link>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <form action={async () => { "use server"; await respondToFriendRequest(req.id, false); }}>
                      <button className="w-10 h-10 rounded-xl bg-danger/10 text-danger flex items-center justify-center hover:bg-danger/20 transition-colors">
                        <X className="w-5 h-5" />
                      </button>
                    </form>
                    <form action={async () => { "use server"; await respondToFriendRequest(req.id, true); }}>
                      <button className="w-10 h-10 rounded-xl bg-success text-white shadow-md shadow-success/20 flex items-center justify-center hover:scale-105 active:scale-95 transition-all">
                        <Check className="w-5 h-5" />
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Friends List */}
        <div className="space-y-4">
          <h2 className="text-sm font-black uppercase tracking-wider text-muted-foreground pl-2">Your Friends</h2>
          {activeFriends.length === 0 ? (
            <div className="p-8 rounded-[2rem] bg-card border-2 border-dashed border-border flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8" />
              </div>
              <p className="font-black text-xl text-foreground">No friends yet</p>
              <p className="text-sm font-medium text-muted-foreground mt-1.5 max-w-sm">
                Use the search bar above to find your friends and start competing together on the leaderboards!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeFriends.map((friend) => {
                const netXp = friend.positivePoints - friend.negativePoints;
                const accuracy = calcAccuracy(friend.sessions || []);
                return (
                  <div
                    key={friend.id}
                    className="p-4 rounded-3xl bg-card border-2 border-border/70 hover:border-primary/50 transition-all shadow-sm flex items-center justify-between gap-3 group"
                  >
                    <Link href={`/profile/${friend.username}`} className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-12 h-12 rounded-2xl bg-muted overflow-hidden shrink-0 group-hover:ring-2 group-hover:ring-primary/40 transition-all">
                        {friend.profilePicture ? (
                          <img src={friend.profilePicture} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-bold">
                            {friend.username[0].toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="truncate">
                        <p className="font-bold text-foreground group-hover:text-primary transition-colors truncate">{friend.username}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-black uppercase bg-primary/10 text-primary px-1.5 py-0.5 rounded-md">
                            {netXp} XP
                          </span>
                          <span className="text-[10px] font-black uppercase bg-success/10 text-success px-1.5 py-0.5 rounded-md">
                            {accuracy}% Acc
                          </span>
                        </div>
                      </div>
                    </Link>

                    <form
                      action={async () => {
                        "use server";
                        await removeFriend(friend.friendshipId);
                      }}
                      className="shrink-0"
                    >
                      <button
                        type="submit"
                        title="Remove Friend"
                        aria-label="Remove Friend"
                        className="p-2 rounded-xl text-muted-foreground hover:text-danger hover:bg-danger/10 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </form>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
