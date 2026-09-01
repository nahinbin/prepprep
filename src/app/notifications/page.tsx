import { getSession } from "@/app/actions/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { AppShell, NavMenu } from "@/components/NavMenu";
import { BackButton } from "@/components/BackButton";
import { Bell, Trophy, UserPlus, Flame, Check, X } from "lucide-react";
import { respondToFriendRequest } from "@/app/actions/friends";
import Link from "next/link";

export default async function NotificationsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // Automatically mark all unread notifications as read when entering the page
  await prisma.notification.updateMany({
    where: { userId: session.id, isRead: false },
    data: { isRead: true },
  });

  const [notifications, pendingFriendships] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.friendship.findMany({
      where: { friendId: session.id, status: "pending" },
      include: { user: true },
    }),
  ]);

  // Create a lookup map for pending friendships by sender username
  const pendingByUsername = new Map(
    pendingFriendships.map((f) => [f.user.username, f.id])
  );

  return (
    <AppShell showBottomBar={false}>
      <div className="w-full max-w-2xl mx-auto px-4 py-5 md:py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BackButton />
            <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2.5 text-foreground">
              <Bell className="w-7 h-7 text-primary" />
              Notifications
            </h1>
          </div>
          <NavMenu />
        </div>

        <div className="space-y-3">
          {notifications.length === 0 ? (
            <div className="p-8 rounded-[2rem] bg-card border-2 border-dashed border-border flex flex-col items-center justify-center text-center mt-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                <Bell className="w-8 h-8" />
              </div>
              <p className="font-black text-xl text-foreground">You're all caught up!</p>
              <p className="text-sm font-medium text-muted-foreground mt-1 max-w-sm">
                No new notifications right now.
              </p>
            </div>
          ) : (
            notifications.map((notif) => {
              let Icon = Bell;
              let iconColor = "text-primary bg-primary/10";
              
              if (notif.type === "FRIEND_REQUEST") {
                Icon = UserPlus;
                iconColor = "text-blue-500 bg-blue-500/10";
              } else if (notif.type === "FRIEND_ACCEPT") {
                Icon = Trophy;
                iconColor = "text-green-500 bg-green-500/10";
              } else if (notif.type === "MILESTONE") {
                Icon = Flame;
                iconColor = "text-amber-500 bg-amber-500/10";
              }

              // Check if there is an active pending friend request associated with this notification
              let friendshipIdForAction: string | undefined;
              if (notif.type === "FRIEND_REQUEST") {
                // Find matching pending friendship
                for (const [uname, fId] of pendingByUsername.entries()) {
                  if (notif.content.includes(uname)) {
                    friendshipIdForAction = fId;
                    break;
                  }
                }
              }

              return (
                <div
                  key={notif.id}
                  className="p-4 rounded-3xl border-2 bg-card border-border/60 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all"
                >
                  <div className="flex items-center gap-3.5 flex-1 min-w-0">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${iconColor}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm sm:text-base font-bold text-foreground leading-snug">
                        {notif.content}
                      </p>
                      <p className="text-xs text-muted-foreground font-medium mt-0.5">
                        {new Date(notif.createdAt).toLocaleDateString()} · {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>

                  {/* Direct Actions if Friend Request is pending */}
                  {friendshipIdForAction ? (
                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0 pt-1 sm:pt-0">
                      <form action={async () => {
                        "use server";
                        await respondToFriendRequest(friendshipIdForAction!, false);
                      }}>
                        <button
                          type="submit"
                          className="px-3 py-1.5 rounded-xl bg-danger/10 text-danger text-xs font-bold flex items-center gap-1 hover:bg-danger/20 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" /> Decline
                        </button>
                      </form>
                      <form action={async () => {
                        "use server";
                        await respondToFriendRequest(friendshipIdForAction!, true);
                      }}>
                        <button
                          type="submit"
                          className="px-3.5 py-1.5 rounded-xl bg-success text-white text-xs font-black shadow-md shadow-success/20 flex items-center gap-1 hover:scale-105 active:scale-95 transition-all"
                        >
                          <Check className="w-3.5 h-3.5" /> Accept
                        </button>
                      </form>
                    </div>
                  ) : notif.link ? (
                    <Link
                      href={notif.link}
                      className="text-xs font-bold text-primary hover:underline self-end sm:self-center shrink-0"
                    >
                      View
                    </Link>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>
    </AppShell>
  );
}
