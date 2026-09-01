import { getSession } from "@/app/actions/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/NavMenu";
import { Bell, CheckCheck, Gift, Trophy, UserPlus, Flame } from "lucide-react";
import { markAllNotificationsAsRead } from "@/app/actions/notifications";
import Link from "next/link";

export default async function NotificationsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const notifications = await prisma.notification.findMany({
    where: { userId: session.id },
    orderBy: { createdAt: "desc" },
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-6 md:py-10 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-primary flex items-center gap-3">
              <Bell className="w-8 h-8" />
              Notifications
            </h1>
            <p className="text-muted-foreground font-medium mt-1">Stay updated with your friends and progress.</p>
          </div>
          {unreadCount > 0 && (
            <form action={async () => {
              "use server";
              await markAllNotificationsAsRead();
            }}>
              <button
                type="submit"
                className="px-4 py-2 bg-muted/50 hover:bg-muted text-sm font-bold text-foreground rounded-xl flex items-center gap-2 transition-colors border border-border/50"
              >
                <CheckCheck className="w-4 h-4" />
                Mark all read
              </button>
            </form>
          )}
        </div>

        <div className="space-y-3">
          {notifications.length === 0 ? (
            <div className="p-8 rounded-3xl border-2 border-dashed border-border flex flex-col items-center justify-center text-center opacity-70">
              <Bell className="w-12 h-12 text-muted-foreground mb-3" />
              <p className="font-bold text-lg">You're all caught up!</p>
              <p className="text-sm text-muted-foreground mt-1">No new notifications right now.</p>
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

              const content = (
                <div className={`p-4 rounded-3xl border-2 transition-all shadow-sm flex items-center gap-4 ${notif.isRead ? "bg-card border-border/40" : "bg-card/90 border-primary/40 shadow-primary/10"}`}>
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${iconColor}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-base ${notif.isRead ? "font-semibold text-foreground/80" : "font-black text-foreground"}`}>
                      {notif.content}
                    </p>
                    <p className="text-xs text-muted-foreground font-medium mt-0.5">
                      {new Date(notif.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  {!notif.isRead && (
                    <div className="w-2.5 h-2.5 rounded-full bg-primary shrink-0 animate-pulse" />
                  )}
                </div>
              );

              return notif.link ? (
                <Link href={notif.link} key={notif.id} className="block active:scale-[0.99] transition-transform">
                  {content}
                </Link>
              ) : (
                <div key={notif.id}>{content}</div>
              );
            })
          )}
        </div>
      </div>
    </AppShell>
  );
}
