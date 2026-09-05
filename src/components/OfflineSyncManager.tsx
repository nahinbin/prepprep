"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { WifiOff, CloudSync, CheckCircle2 } from "lucide-react";
import {
  getPendingSessions,
  removePendingSession,
  type OfflineSessionPayload,
} from "@/lib/offlineStorage";
import { saveSessionData } from "@/app/actions/session";
import { useRouter } from "next/navigation";

export function OfflineSyncManager() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const isSyncingRef = useRef(false);
  const router = useRouter();

  // Update online status and pending count
  const checkStatus = useCallback(() => {
    if (typeof window === "undefined") return;
    setIsOnline(navigator.onLine);
    const sessions = getPendingSessions();
    setPendingCount(sessions.length);
  }, []);

  // Sync queued sessions with server
  const processQueue = useCallback(async () => {
    if (typeof window === "undefined" || !navigator.onLine || isSyncingRef.current) return;
    const pending = getPendingSessions();
    if (pending.length === 0) return;

    isSyncingRef.current = true;
    setSyncing(true);

    let syncedCount = 0;
    let gainedXp = 0;

    for (const session of pending) {
      try {
        const res = await saveSessionData({
          clientSessionToken: session.clientSessionToken,
          totalQuestions: session.totalQuestions,
          correctAnswers: session.correctAnswers,
          wrongAnswers: session.wrongAnswers,
          positivePoints: session.positivePoints,
          negativePoints: session.negativePoints,
          netPoints: session.netPoints,
          isPractice: session.isPractice,
          subjectName: session.subjectName,
          topicName: session.topicName,
          subjectId: session.subjectId,
          topicId: session.topicId,
          attempts: session.attempts,
        });

        if ("sessionId" in res && res.sessionId) {
          removePendingSession(session.clientSessionToken);
          syncedCount++;
          gainedXp += session.positivePoints - session.negativePoints;
        } else if ("error" in res && res.error === "Session is currently being saved") {
          // Token is currently processing, remove to avoid duplicate calls
          removePendingSession(session.clientSessionToken);
        }
      } catch (err) {
        console.warn("Failed to sync session, will retry when connection is stable:", err);
        break;
      }
    }

    setSyncing(false);
    isSyncingRef.current = false;
    checkStatus();

    if (syncedCount > 0) {
      setSyncNotice(`Synced ${syncedCount} offline session${syncedCount > 1 ? "s" : ""}!`);
      router.refresh();
      setTimeout(() => setSyncNotice(null), 4000);
    }
  }, [checkStatus, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    checkStatus();

    const handleOnline = () => {
      setIsOnline(true);
      processQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    const handleQueueChange = () => {
      checkStatus();
      if (navigator.onLine) {
        processQueue();
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("mcq:offline-session-queued", handleQueueChange);
    window.addEventListener("mcq:offline-session-synced", checkStatus);

    // Initial check and periodic sync interval
    processQueue();
    const interval = setInterval(() => {
      if (navigator.onLine) processQueue();
    }, 25000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("mcq:offline-session-queued", handleQueueChange);
      window.removeEventListener("mcq:offline-session-synced", checkStatus);
      clearInterval(interval);
    };
  }, [checkStatus, processQueue]);

  // If online, no sync notice, and no pending items, render nothing
  if (isOnline && !syncNotice && pendingCount === 0 && !syncing) {
    return null;
  }

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 pointer-events-none w-auto max-w-sm px-3 pb-[env(safe-area-inset-bottom)]">
      {/* Offline Status Badge */}
      {!isOnline && (
        <div className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-full bg-card/95 text-foreground backdrop-blur-xl shadow-2xl shadow-black/60 text-xs font-bold animate-fade-in pointer-events-auto mx-auto border border-amber-500/40">
          <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="text-muted-foreground">
            Offline <span className="text-foreground font-extrabold">• Auto-sync enabled</span>
          </span>
          {pendingCount > 0 && (
            <span className="bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-md text-[10px] font-black">
              {pendingCount}
            </span>
          )}
        </div>
      )}

      {/* Syncing Progress Badge */}
      {isOnline && syncing && (
        <div className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-full bg-primary/95 text-white backdrop-blur-xl shadow-2xl shadow-primary/30 text-xs font-black animate-fade-in pointer-events-auto mx-auto border border-primary/50">
          <CloudSync className="w-3.5 h-3.5 shrink-0 animate-spin" />
          <span>Syncing offline sessions...</span>
        </div>
      )}

      {/* Sync Success Badge */}
      {isOnline && syncNotice && !syncing && (
        <div className="flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-full bg-success/95 text-white backdrop-blur-xl shadow-2xl shadow-success/30 text-xs font-black animate-fade-in pointer-events-auto mx-auto border border-success/50">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>{syncNotice}</span>
        </div>
      )}
    </div>
  );
}
