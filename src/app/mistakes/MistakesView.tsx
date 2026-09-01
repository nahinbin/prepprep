"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { NavMenu, AppShell } from "@/components/NavMenu";
import { BackButton } from "@/components/BackButton";
import {
  BookOpen,
  CheckCircle,
  X,
  Play,
  Swords,
  ChevronRight,
  Target,
  Flame,
  Trophy,
} from "lucide-react";
import { unlockGameSounds } from "@/lib/gameSounds";

type TopicStat = {
  id: string;
  name: string;
  count: number;
};

type SubjectStat = {
  id: string;
  name: string;
  count: number;
  topics: TopicStat[];
};

const DANGER_COLORS = [
  "from-red-500/20 to-rose-600/10 border-red-500/30 hover:border-red-500/60",
  "from-orange-500/20 to-red-500/10 border-orange-500/30 hover:border-orange-500/60",
  "from-pink-500/20 to-red-500/10 border-pink-500/30 hover:border-pink-500/60",
];

export function MistakesView({ subjects, xpLost = 0 }: { subjects: SubjectStat[], xpLost?: number }) {
  const router = useRouter();
  const [selectedSubject, setSelectedSubject] = useState<SubjectStat | null>(null);
  const totalMistakes = subjects.reduce((acc, s) => acc + s.count, 0);

  const startRedo = (subjectId?: string, topicId?: string) => {
    const params = new URLSearchParams();
    if (topicId) params.set("topicId", topicId);
    else if (subjectId) params.set("subjectId", subjectId);
    unlockGameSounds();
    router.push(`/session/redo?${params.toString()}`);
  };

  return (
    <AppShell>
      <div className="min-h-screen py-6 px-4 md:px-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <BackButton />
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
                <Swords className="w-7 h-7 text-danger shrink-0" />
                Mistakes
              </h1>
              <p className="text-sm font-semibold text-muted-foreground mt-0.5">
                Revisit & conquer your weak spots
              </p>
            </div>
          </div>
          <NavMenu />
        </div>

        {/* Total mistakes banner */}
        {(totalMistakes > 0 || xpLost > 0) && (
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-danger/20 via-danger/10 to-background border-2 border-danger/30 p-5 mb-8 flex items-center justify-between gap-4">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_50%,hsl(var(--danger)/0.12),transparent_60%)]" />
            <div className="relative z-10 flex gap-6 sm:gap-10">
              {totalMistakes > 0 && (
                <div>
                  <p className="text-sm font-bold text-danger/80 uppercase tracking-widest mb-1">Total Mistakes</p>
                  <p className="text-4xl sm:text-5xl font-black text-danger leading-none">{totalMistakes}</p>
                  <p className="text-xs sm:text-sm font-semibold text-muted-foreground mt-1">across {subjects.length} subject{subjects.length !== 1 ? "s" : ""}</p>
                </div>
              )}
              {xpLost > 0 && (
                <div>
                  <p className="text-sm font-bold text-danger/80 uppercase tracking-widest mb-1">XP Lost</p>
                  <p className="text-4xl sm:text-5xl font-black text-danger leading-none">-{xpLost}</p>
                  <p className="text-xs sm:text-sm font-semibold text-muted-foreground mt-1">recover by fixing mistakes</p>
                </div>
              )}
            </div>
            {totalMistakes > 0 && (
              <div className="relative z-10 flex flex-col items-end gap-2 shrink-0">
                <div className="hidden sm:flex w-16 h-16 rounded-3xl bg-danger/15 border-2 border-danger/30 items-center justify-center">
                  <Flame className="w-8 h-8 text-danger" />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => startRedo()}
                  className="rounded-2xl border-danger/40 text-danger hover:bg-danger/10 font-bold text-xs px-3 gap-1"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Redo All
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Content */}
        {totalMistakes === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="w-24 h-24 rounded-full bg-success/15 border-2 border-success/30 flex items-center justify-center mb-2">
              <Trophy className="w-12 h-12 text-success" />
            </div>
            <h2 className="text-2xl font-black">All Caught Up!</h2>
            <p className="text-muted-foreground font-semibold max-w-xs">
              Zero mistakes on record. You&apos;re on fire! Keep up the great work.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {subjects.map((subject, idx) => (
              <button
                key={subject.id}
                onClick={() => setSelectedSubject(subject)}
                className={`group relative overflow-hidden rounded-3xl bg-gradient-to-br ${DANGER_COLORS[idx % DANGER_COLORS.length]} border-2 p-6 text-left transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-sm`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-danger/15 border border-danger/25 flex items-center justify-center mb-3">
                      <BookOpen className="w-5 h-5 text-danger" />
                    </div>
                    <h3 className="text-lg font-black truncate group-hover:text-danger transition-colors">
                      {subject.name}
                    </h3>
                    <p className="text-sm font-semibold text-muted-foreground mt-1">
                      {subject.topics.length} topic{subject.topics.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-5xl font-black text-danger leading-none block">
                      {subject.count}
                    </span>
                    <span className="text-xs font-bold text-danger/70 uppercase tracking-wide">mistakes</span>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 text-danger/70 text-xs font-bold group-hover:text-danger transition-colors">
                  <Target className="w-3.5 h-3.5" />
                  Tap to practice
                  <ChevronRight className="w-3.5 h-3.5 ml-auto group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Subject Modal */}
      {selectedSubject && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedSubject(null)}
          />
          <div className="relative w-full max-w-md rounded-3xl bg-background border-2 border-border shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200 overflow-hidden">
            {/* Modal header */}
            <div className="relative overflow-hidden bg-gradient-to-br from-danger/15 to-background p-6 pb-5 border-b border-border">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold text-danger/70 uppercase tracking-widest mb-1">Practice Mistakes</p>
                  <h2 className="text-2xl font-black">{selectedSubject.name}</h2>
                  <p className="text-sm text-muted-foreground font-semibold mt-1">
                    <span className="text-danger font-black text-lg">{selectedSubject.count}</span> mistake{selectedSubject.count !== 1 ? "s" : ""} to fix
                  </p>
                </div>
                <button
                  onClick={() => setSelectedSubject(null)}
                  className="w-10 h-10 rounded-2xl hover:bg-muted flex items-center justify-center shrink-0 transition-colors active:scale-95"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Redo all */}
            <div className="p-5 border-b border-border">
              <Button
                size="lg"
                className="w-full h-14 text-base font-black rounded-2xl gap-2 shadow-md shadow-danger/20"
                onClick={() => startRedo(selectedSubject.id)}
              >
                <Play className="w-5 h-5 fill-current" />
                Redo All {selectedSubject.count} Mistakes
              </Button>
            </div>

            {/* By topic */}
            {selectedSubject.topics.length > 0 && (
              <div className="p-5">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">By Topic</p>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {selectedSubject.topics.map((topic) => (
                    <button
                      key={topic.id}
                      onClick={() => startRedo(undefined, topic.id)}
                      className="w-full flex items-center justify-between px-4 py-3.5 border-2 border-border rounded-2xl hover:border-danger/40 hover:bg-danger/5 transition-all text-left active:scale-[0.98] group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-7 h-7 rounded-xl bg-muted flex items-center justify-center shrink-0">
                          <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                        <span className="text-sm font-bold truncate">{topic.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xl font-black text-danger">{topic.count}</span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-danger group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
