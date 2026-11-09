"use client";

import { useState, useMemo, useEffect } from "react";
import {
  X,
  CheckCircle2,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Search,
} from "lucide-react";
import {
  getAllTopicMastery,
  setTopicMastery,
  getMasteryKey,
  TopicMastery,
} from "@/lib/topicProgressStorage";
import { playCorrectSound, playTapSound } from "@/lib/gameSounds";

interface SubjectWithTopics {
  id?: string;
  name: string;
  topics: string[];
}

interface TopicMasteryModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: SubjectWithTopics[];
}

export function TopicMasteryModal({
  isOpen,
  onClose,
  subjects,
}: TopicMasteryModalProps) {
  const [search, setSearch] = useState("");
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({});
  const [allMastery, setAllMastery] = useState<Record<string, TopicMastery>>({});

  useEffect(() => {
    if (!isOpen) return;
    setAllMastery(getAllTopicMastery());
    const sync = () => setAllMastery(getAllTopicMastery());
    window.addEventListener("topic-mastery-updated", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("topic-mastery-updated", sync);
      window.removeEventListener("storage", sync);
    };
  }, [isOpen]);

  // Toggle subject accordion
  const toggleSubject = (subName: string) => {
    setExpandedSubjects((prev) => ({
      ...prev,
      [subName]: !prev[subName],
    }));
  };

  // Calculate subject-level summaries
  const subjectSummaries = useMemo(() => {
    return subjects.map((sub) => {
      const topicDetails = sub.topics.map((top) => {
        const key = getMasteryKey(sub.name, top);
        const rec = allMastery[key];
        const pct = rec ? rec.percentage : 0;
        return {
          name: top,
          percentage: pct,
          isCompleted: pct >= 100,
        };
      });

      const totalPct = topicDetails.reduce((acc, t) => acc + t.percentage, 0);
      const avgPct = topicDetails.length > 0 ? Math.round(totalPct / topicDetails.length) : 0;
      const completedCount = topicDetails.filter((t) => t.isCompleted).length;

      return {
        name: sub.name,
        averagePercentage: avgPct,
        completedCount,
        totalTopics: topicDetails.length,
        topics: topicDetails,
      };
    });
  }, [subjects, allMastery]);

  // Filtered by search query
  const filteredSummaries = useMemo(() => {
    if (!search.trim()) return subjectSummaries;
    const q = search.toLowerCase();
    return subjectSummaries
      .map((sub) => {
        const matchesSubject = sub.name.toLowerCase().includes(q);
        const matchedTopics = sub.topics.filter((t) =>
          t.name.toLowerCase().includes(q)
        );
        if (matchesSubject) return sub;
        if (matchedTopics.length > 0) {
          return { ...sub, topics: matchedTopics };
        }
        return null;
      })
      .filter(Boolean) as typeof subjectSummaries;
  }, [subjectSummaries, search]);

  if (!isOpen) return null;

  const handleToggle100 = (subName: string, topName: string, currentlyDone: boolean) => {
    const newPct = currentlyDone ? 0 : 100;
    try {
      if (newPct === 100) playCorrectSound();
      else playTapSound();
    } catch {}
    setTopicMastery(subName, topName, newPct);
  };

  const handleSetPercentage = (subName: string, topName: string, pct: number) => {
    try {
      if (pct === 100) playCorrectSound();
      else playTapSound();
    } catch {}
    setTopicMastery(subName, topName, pct);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full sm:max-w-xl max-h-[90vh] overflow-hidden flex flex-col rounded-t-[2rem] sm:rounded-3xl bg-card border border-white/10 shadow-2xl animate-in fade-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200">
        {/* Mobile handle */}
        <div className="sm:hidden w-12 h-1.5 rounded-full bg-white/20 mx-auto mt-3 mb-1" />

        {/* Header */}
        <div className="p-5 pb-3 border-b border-white/5 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-black text-xl text-foreground">
              Topic Mastery & Progress
            </h3>
            <p className="text-xs text-muted-foreground font-semibold">
              Topics marked 100% are skipped by AI. Partial topics get scheduled!
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl hover:bg-white/10 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input */}
        <div className="px-5 pt-3 pb-2 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search subject or topic..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Subjects & Topics Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {filteredSummaries.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              No subjects or topics match your search.
            </div>
          ) : (
            filteredSummaries.map((sub) => {
              const isExpanded = expandedSubjects[sub.name] ?? true;

              return (
                <div
                  key={sub.name}
                  className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden"
                >
                  {/* Subject Header */}
                  <div
                    onClick={() => toggleSubject(sub.name)}
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors select-none"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-violet-500/20 text-violet-400 flex items-center justify-center shrink-0">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-base font-black text-foreground truncate">
                          {sub.name}
                        </h4>
                        <span className="text-xs text-muted-foreground font-semibold">
                          {sub.completedCount} of {sub.totalTopics} topics finished
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span className="text-sm font-black text-primary tabular-nums">
                          {sub.averagePercentage}%
                        </span>
                        <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden mt-1">
                          <div
                            className="h-full bg-gradient-to-r from-violet-500 to-primary rounded-full transition-all"
                            style={{ width: `${sub.averagePercentage}%` }}
                          />
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Topics List */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t border-white/5 space-y-2">
                      {sub.topics.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic py-1">
                          No topics added under this subject yet.
                        </p>
                      ) : (
                        sub.topics.map((top) => (
                          <div
                            key={top.name}
                            className="p-3 rounded-xl bg-card border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                          >
                            {/* Tick mark & Title */}
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <button
                                type="button"
                                onClick={() =>
                                  handleToggle100(sub.name, top.name, top.isCompleted)
                                }
                                className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all shrink-0 active:scale-90 ${
                                  top.isCompleted
                                    ? "bg-emerald-500 text-white"
                                    : "border border-white/20 hover:border-violet-400 bg-white/5 text-transparent"
                                }`}
                                aria-label="Toggle completed"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                              <span
                                className={`text-xs sm:text-sm font-bold truncate ${
                                  top.isCompleted
                                    ? "line-through text-muted-foreground"
                                    : "text-foreground"
                                }`}
                              >
                                {top.name}
                              </span>
                            </div>

                            {/* Percentage Selector */}
                            <div className="flex items-center gap-1.5 pl-9 sm:pl-0 shrink-0">
                              {[0, 25, 50, 75, 100].map((pct) => (
                                <button
                                  key={pct}
                                  type="button"
                                  onClick={() => handleSetPercentage(sub.name, top.name, pct)}
                                  className={`text-[10px] font-bold px-2 py-1 rounded-md transition-all ${
                                    top.percentage === pct
                                      ? pct === 100
                                        ? "bg-emerald-500 text-white"
                                        : "bg-primary text-white"
                                      : "bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground"
                                  }`}
                                >
                                  {pct}%
                                </button>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

