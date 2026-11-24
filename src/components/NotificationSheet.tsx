"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X,
  Bell,
  CheckCheck,
  Users,
  Trophy,
  Calendar,
  Info,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getRecentNotifications,
  markAllNotificationsAsRead,
} from "@/app/actions/notifications";

interface NotifItem {
  id: string;
  type: string;
  content: string;
  isRead: boolean;
  link: string | null;
  createdAt: string;
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function NotifIcon({ type }: { type: string }) {
  if (type === "FRIEND_REQUEST") return <Users className="w-4 h-4 text-blue-400" />;
  if (type === "MILESTONE") return <Trophy className="w-4 h-4 text-amber-400" />;
  if (type === "DEADLINE_REMINDER") return <Calendar className="w-4 h-4 text-orange-400" />;
  if (type === "SYSTEM") return <Info className="w-4 h-4 text-violet-400" />;
  return <Bell className="w-4 h-4 text-neutral-400" />;
}

function notifIconBg(type: string): string {
  if (type === "FRIEND_REQUEST") return "bg-blue-500/15 border-blue-500/20";
  if (type === "MILESTONE") return "bg-amber-500/15 border-amber-500/20";
  if (type === "DEADLINE_REMINDER") return "bg-orange-500/15 border-orange-500/20";
  if (type === "SYSTEM") return "bg-violet-500/15 border-violet-500/20";
  return "bg-neutral-500/10 border-neutral-500/20";
}

export function NotificationSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotifItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchNotifs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRecentNotifications(15);
      setNotifications(res.notifications);
      setUnreadCount(res.unreadCount);
      if (res.unreadCount > 0) {
        await markAllNotificationsAsRead();
        setUnreadCount(0);
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      }
    } catch {
      // silently fail
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) fetchNotifs();
  }, [open, fetchNotifs]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end md:items-end md:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative w-full md:w-96 max-h-[75vh] flex flex-col rounded-t-3xl md:rounded-3xl bg-[#1a1a1a] border border-white/10 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        {/* Handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-3 pb-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-white text-base">Notifications</h3>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-primary text-white text-[11px] font-bold">
                {unreadCount}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl hover:bg-white/10 text-neutral-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-neutral-400">
              <Bell className="w-8 h-8 opacity-30" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <ul className="p-3 space-y-1.5">
              {notifications.map((n) => {
                const content = (
                  <div
                    className={`flex items-start gap-3 px-3.5 py-3 rounded-2xl transition-colors ${
                      !n.isRead
                        ? "bg-white/5 hover:bg-white/8"
                        : "hover:bg-white/5"
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${notifIconBg(n.type)}`}
                    >
                      <NotifIcon type={n.type} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm leading-snug ${
                          !n.isRead ? "text-white" : "text-neutral-300"
                        }`}
                      >
                        {n.content}
                      </p>
                      <span className="text-[11px] text-neutral-500 mt-0.5 block">
                        {relativeTime(n.createdAt)}
                      </span>
                    </div>
                    {!n.isRead && (
                      <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                    )}
                  </div>
                );

                if (n.link) {
                  return (
                    <li key={n.id}>
                      <Link href={n.link} onClick={onClose}>
                        {content}
                      </Link>
                    </li>
                  );
                }
                return <li key={n.id}>{content}</li>;
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-white/5">
          <Link
            href="/notifications"
            onClick={onClose}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-sm font-semibold text-neutral-300 hover:text-white transition-colors"
          >
            See all notifications
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
