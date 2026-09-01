import { getSession } from "@/app/actions/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/NavMenu";
import { Search, UserPlus, Users, Check, X } from "lucide-react";
import { sendFriendRequest, respondToFriendRequest } from "@/app/actions/friends";
import { calcAccuracy } from "@/lib/stats";
import Link from "next/link";

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
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-6 md:py-10 space-y-8">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-primary flex items-center gap-3">
            <Users className="w-8 h-8" />
            Friends
          </h1>
          <p className="text-muted-foreground font-medium mt-1">Connect, compete, and learn together!</p>
        </div>

        {/* Add Friend Form */}
        <div className="p-5 rounded-3xl bg-card border-2 border-border shadow-sm">
          <form action={async (formData) => {
            "use server";
            const targetUsername = formData.get("username") as string;
            await sendFriendRequest(targetUsername);
          }} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                type="text"
                name="username"
                placeholder="Search by username..."
                className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-muted/50 border-2 border-border/50 focus:border-primary focus:bg-background transition-all outline-none font-bold"
                required
              />
            </div>
            <button
              type="submit"
              className="px-6 rounded-2xl bg-primary text-primary-foreground font-black flex items-center justify-center hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-lg shadow-primary/20"
            >
              <UserPlus className="w-5 h-5" />
            </button>
          </form>
        </div>

        {/* Pending Requests */}
        {pendingRequests.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-sm font-black uppercase tracking-wider text-muted-foreground pl-2">Pending Requests</h2>
            <div className="space-y-3">
              {pendingRequests.map((req) => (
                <div key={req.id} className="flex items-center justify-between p-4 rounded-3xl bg-muted/30 border-2 border-border/50 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-muted overflow-hidden">
                      {req.user.profilePicture ? (
                        <img src={req.user.profilePicture} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-bold">
                          {req.user.username[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-foreground">{req.user.username}</p>
                      <p className="text-xs text-muted-foreground font-medium">Wants to be your friend</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
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
            <div className="p-8 rounded-3xl border-2 border-dashed border-border flex flex-col items-center justify-center text-center opacity-70">
              <Users className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="font-bold text-lg">No friends yet</p>
              <p className="text-sm text-muted-foreground mt-1">Search for a username above to start connecting!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeFriends.map((friend) => {
                const netXp = friend.positivePoints - friend.negativePoints;
                const accuracy = calcAccuracy(friend.sessions || []);
                return (
                  <Link href={`/profile/${friend.username}`} key={friend.id} className="block group">
                    <div className="p-4 rounded-3xl bg-card border-2 border-border/70 hover:border-primary/50 transition-all hover:scale-[1.02] shadow-sm flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-muted overflow-hidden shrink-0">
                          {friend.profilePicture ? (
                            <img src={friend.profilePicture} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-bold">
                              {friend.username[0].toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="truncate">
                          <p className="font-bold text-foreground truncate">{friend.username}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-black uppercase bg-primary/10 text-primary px-1.5 py-0.5 rounded-md">
                              {netXp} XP
                            </span>
                            <span className="text-[10px] font-black uppercase bg-success/10 text-success px-1.5 py-0.5 rounded-md">
                              {accuracy}% Acc
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
