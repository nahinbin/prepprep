"use client";

import { useState, useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Sparkles,
  Zap,
  Coins,
  Trash2,
  Eye,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  User as UserIcon,
  Search,
  Filter,
  Layers,
  Clock,
  Broom,
  Check,
  X,
} from "lucide-react";
import {
  deleteAdminSession,
  getAdminSessionDetails,
  cleanUserDuplicateMistakes,
} from "@/app/actions/admin-sessions";

type SessionItem = {
  id: string;
  userId: string;
  username: string;
  profilePicture: string | null;
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  positivePoints: number;
  negativePoints: number;
  netPoints: number;
  coinsEarned: number;
  accuracy: number;
  isPractice: boolean;
  attemptCount: number;
  mistakeCount: number;
  createdAt: string;
};

type UserOption = {
  id: string;
  username: string;
};

type SessionDetail = {
  id: string;
  userId: string;
  username: string;
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  positivePoints: number;
  negativePoints: number;
  netPoints: number;
  isPractice: boolean;
  createdAt: string;
  attempts: Array<{
    id: string;
    question: string;
    selectedAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    pointsGained: number;
    pointsLost: number;
  }>;
  mistakesCount: number;
};

export function AdminSessionsClient({
  initialSessions,
  users,
}: {
  initialSessions: SessionItem[];
  users: UserOption[];
}) {
  const [sessions, setSessions] = useState<SessionItem[]>(initialSessions);
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState<"all" | "real" | "practice">("all");

  // Delete modal state
  const [sessionToDelete, setSessionToDelete] = useState<SessionItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState("");

  // Inspect modal state
  const [viewingSessionId, setViewingSessionId] = useState<string | null>(null);
  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Duplicate mistake cleaner state
  const [isCleaningMistakes, setIsCleaningMistakes] = useState(false);
  const [cleanMsg, setCleanMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Filtered sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (selectedUser !== "all" && s.userId !== selectedUser) return false;
      if (modeFilter === "real" && s.isPractice) return false;
      if (modeFilter === "practice" && !s.isPractice) return false;
      if (search.trim()) {
        const term = search.trim().toLowerCase();
        const matchUser = s.username.toLowerCase().includes(term);
        const matchId = s.id.toLowerCase().includes(term);
        if (!matchUser && !matchId) return false;
      }
      return true;
    });
  }, [sessions, selectedUser, modeFilter, search]);

  // Aggregate stats for filtered list
  const totalQuestions = filteredSessions.reduce((sum, s) => sum + s.totalQuestions, 0);
  const totalCoins = filteredSessions.reduce((sum, s) => sum + s.coinsEarned, 0);
  const totalNetXp = filteredSessions.reduce((sum, s) => sum + s.netPoints, 0);

  const handleOpenInspect = async (s: SessionItem) => {
    setViewingSessionId(s.id);
    setIsLoadingDetail(true);
    const res = await getAdminSessionDetails(s.id);
    setIsLoadingDetail(false);
    if (res.session) {
      setSessionDetail(res.session);
    }
  };

  const handleConfirmDelete = async () => {
    if (!sessionToDelete) return;
    setIsDeleting(true);
    setDeleteMsg("");

    const res = await deleteAdminSession(sessionToDelete.id);
    setIsDeleting(false);

    if (res.error) {
      setDeleteMsg(res.error);
      return;
    }

    // Remove deleted session from state
    setSessions((prev) => prev.filter((s) => s.id !== sessionToDelete.id));
    setSessionToDelete(null);
  };

  const handleCleanDuplicates = async () => {
    setIsCleaningMistakes(true);
    setCleanMsg(null);
    const res = await cleanUserDuplicateMistakes(selectedUser);
    setIsCleaningMistakes(false);

    if (res.error) {
      setCleanMsg({ text: res.error, type: "error" });
    } else {
      setCleanMsg({
        text: `Successfully cleaned ${res.deletedDuplicatesCount} duplicate mistake record(s).`,
        type: "success",
      });
      setTimeout(() => setCleanMsg(null), 5000);
    }
  };

  return (
    <div className="w-full max-w-5xl space-y-6">
      {/* Top Action Bar & Cleaner Alert */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/40 p-4 rounded-2xl border border-border">
        <div>
          <h2 className="text-lg font-bold">Session & Stat Control</h2>
          <p className="text-xs text-muted-foreground">
            Manage user sessions, inspect question attempts, and roll back glitched XP/Coins.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCleanDuplicates}
          isLoading={isCleaningMistakes}
          className="rounded-xl font-bold border-amber-500/30 text-amber-500 hover:bg-amber-500/10 shrink-0"
        >
          <Broom className="w-4 h-4 mr-1.5" />
          Clean Duplicate Mistakes {selectedUser !== "all" ? "for User" : "(Global)"}
        </Button>
      </div>

      {cleanMsg && (
        <div
          className={`p-3 rounded-xl text-sm font-bold flex items-center gap-2 ${
            cleanMsg.type === "success"
              ? "bg-success/15 text-success border border-success/30"
              : "bg-danger/15 text-danger border border-danger/30"
          }`}
        >
          {cleanMsg.type === "success" ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {cleanMsg.text}
        </div>
      )}

      {/* Overview Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4 rounded-2xl text-center border-primary/20">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
            Sessions
          </p>
          <p className="text-2xl font-black text-primary">{filteredSessions.length}</p>
        </Card>
        <Card className="p-4 rounded-2xl text-center">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
            Questions Done
          </p>
          <p className="text-2xl font-black">{totalQuestions}</p>
        </Card>
        <Card className="p-4 rounded-2xl text-center border-amber-500/20">
          <p className="text-[11px] text-amber-500 uppercase tracking-wider font-semibold">
            Coins Awarded
          </p>
          <p className="text-2xl font-black text-amber-500 flex items-center justify-center gap-1">
            <Coins className="w-4 h-4" /> {totalCoins}
          </p>
        </Card>
        <Card className="p-4 rounded-2xl text-center border-success/20">
          <p className="text-[11px] text-success uppercase tracking-wider font-semibold">
            Net XP Awarded
          </p>
          <p className="text-2xl font-black text-success flex items-center justify-center gap-1">
            <Zap className="w-4 h-4" /> {totalNetXp}
          </p>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search username or session ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-11 rounded-xl"
          />
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {/* User Select */}
          <select
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            aria-label="Filter by user"
            className="h-11 px-3 rounded-xl bg-background border border-border text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Users ({users.length})</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.username}
              </option>
            ))}
          </select>

          {/* Mode Switcher */}
          <div className="flex rounded-xl bg-muted p-1 border border-border">
            <button
              onClick={() => setModeFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                modeFilter === "all" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setModeFilter("real")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                modeFilter === "real" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              Real
            </button>
            <button
              onClick={() => setModeFilter("practice")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                modeFilter === "practice" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              Practice
            </button>
          </div>
        </div>
      </div>

      {/* Sessions List */}
      <div className="space-y-3">
        {filteredSessions.length === 0 ? (
          <Card className="p-12 text-center text-muted-foreground rounded-2xl">
            <p className="text-base font-bold">No sessions found matching filters</p>
          </Card>
        ) : (
          filteredSessions.map((s) => (
            <Card key={s.id} className="p-4 sm:p-5 rounded-2xl hover:border-primary/30 transition-all">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Left: User & Date info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-muted border border-border overflow-hidden flex items-center justify-center shrink-0">
                    {s.profilePicture ? (
                      <img src={s.profilePicture} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base truncate">{s.username}</span>
                      {s.isPractice ? (
                        <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-md font-bold">
                          Practice
                        </span>
                      ) : (
                        <span className="text-[10px] bg-success/10 text-success px-2 py-0.5 rounded-md font-bold">
                          Real Session
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {new Date(s.createdAt).toLocaleString()}
                      <span className="opacity-40">·</span>
                      <span className="font-mono text-[10px] opacity-75">{s.id.slice(0, 8)}...</span>
                    </p>
                  </div>
                </div>

                {/* Middle: Badges & Numbers */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="px-2.5 py-1 rounded-xl bg-muted/60 border border-border text-center text-xs font-bold">
                    <span className="text-muted-foreground text-[10px] block">Questions</span>
                    {s.totalQuestions} ({s.correctAnswers}✓ {s.wrongAnswers}✗)
                  </div>

                  <div className="px-2.5 py-1 rounded-xl bg-primary/10 border border-primary/20 text-center text-xs font-black text-primary">
                    <span className="text-muted-foreground text-[10px] block">Accuracy</span>
                    {s.accuracy}%
                  </div>

                  {!s.isPractice && (
                    <>
                      <div className="px-2.5 py-1 rounded-xl bg-success/10 border border-success/20 text-center text-xs font-black text-success">
                        <span className="text-muted-foreground text-[10px] block">XP</span>
                        +{s.positivePoints} / -{s.negativePoints}
                      </div>

                      <div className="px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center text-xs font-black text-amber-500 flex flex-col items-center">
                        <span className="text-muted-foreground text-[10px] block">Coins</span>
                        <span>+{s.coinsEarned}</span>
                      </div>
                    </>
                  )}

                  {s.mistakeCount > 0 && (
                    <div className="px-2.5 py-1 rounded-xl bg-danger/10 border border-danger/20 text-center text-xs font-bold text-danger">
                      <span className="text-muted-foreground text-[10px] block">Mistakes</span>
                      {s.mistakeCount}
                    </div>
                  )}
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenInspect(s)}
                    className="rounded-xl font-bold text-xs h-9"
                  >
                    <Eye className="w-3.5 h-3.5 mr-1" />
                    Inspect
                  </Button>

                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setSessionToDelete(s)}
                    className="rounded-xl font-bold text-xs h-9"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Inspect Session Modal */}
      {viewingSessionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setViewingSessionId(null)} />
          <Card className="relative w-full max-w-2xl p-6 rounded-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div>
                <h3 className="text-lg font-bold">Session Inspection</h3>
                <p className="text-xs text-muted-foreground">ID: {viewingSessionId}</p>
              </div>
              <button
                onClick={() => setViewingSessionId(null)}
                className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-1">
              {isLoadingDetail ? (
                <div className="py-12 text-center text-muted-foreground font-bold">
                  Loading session attempts...
                </div>
              ) : sessionDetail ? (
                sessionDetail.attempts.map((att, idx) => (
                  <div
                    key={att.id || idx}
                    className={`p-3.5 rounded-xl border ${
                      att.isCorrect ? "bg-success/5 border-success/20" : "bg-danger/5 border-danger/20"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <p className="text-sm font-semibold">
                        <span className="text-muted-foreground mr-1.5">#{idx + 1}</span>
                        {att.question}
                      </p>
                      {att.isCorrect ? (
                        <span className="text-xs text-success font-black flex items-center gap-1 shrink-0">
                          <CheckCircle2 className="w-4 h-4" /> Correct
                        </span>
                      ) : (
                        <span className="text-xs text-danger font-black flex items-center gap-1 shrink-0">
                          <XCircle className="w-4 h-4" /> Wrong
                        </span>
                      )}
                    </div>
                    <div className="text-xs space-y-0.5 text-muted-foreground">
                      <p>
                        Selected: <span className="font-bold text-foreground">{att.selectedAnswer}</span>
                      </p>
                      <p>
                        Correct: <span className="font-bold text-success">{att.correctAnswer}</span>
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-muted-foreground">Failed to load details.</div>
              )}
            </div>

            <div className="pt-3 border-t border-border flex justify-end">
              <Button
                variant="outline"
                className="rounded-xl font-bold"
                onClick={() => setViewingSessionId(null)}
              >
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Delete & Rollback Confirmation Modal */}
      {sessionToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSessionToDelete(null)} />
          <Card className="relative w-full max-w-md p-6 rounded-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-danger/15 text-danger flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-xl font-black text-danger">Delete Session & Roll Back?</h3>
              <p className="text-xs text-muted-foreground mt-1">
                User: <span className="font-bold text-foreground">{sessionToDelete.username}</span> · ID:{" "}
                {sessionToDelete.id.slice(0, 8)}...
              </p>
            </div>

            <div className="bg-muted/60 p-4 rounded-xl text-left text-xs space-y-2 border border-border">
              <p className="font-bold text-foreground">The following will be permanently rolled back:</p>
              {!sessionToDelete.isPractice ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">XP Deducted:</span>
                    <span className="font-bold text-danger">-{sessionToDelete.positivePoints} XP</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Negative XP Restored:</span>
                    <span className="font-bold text-success">+{sessionToDelete.negativePoints} XP</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Coins Deducted:</span>
                    <span className="font-bold text-danger">-{sessionToDelete.coinsEarned} Coins</span>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">Practice session: No XP or Coins were awarded.</p>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mistakes & Attempts:</span>
                <span className="font-bold text-foreground">Deleted</span>
              </div>
            </div>

            {deleteMsg && <p className="text-xs text-danger font-bold">{deleteMsg}</p>}

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 rounded-xl font-bold"
                onClick={() => setSessionToDelete(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                className="flex-1 rounded-xl font-bold"
                onClick={handleConfirmDelete}
                isLoading={isDeleting}
              >
                Confirm Delete
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
