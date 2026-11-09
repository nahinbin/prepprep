"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  CheckCircle2,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Search,
  Sparkles,
  Calendar,
} from "lucide-react";
import { AppShell } from "@/components/NavMenu";
import { getUserSubjectsAndTopics } from "@/app/actions/subjects";
import {
  getUserTopicMasteries,
  saveDbTopicMastery,
} from "@/app/actions/topic-mastery";
import {
  getAllTopicMastery,
  setTopicMastery,
  getMasteryKey,
  TopicMastery,
} from "@/lib/topicProgressStorage";
import { playCorrectSound, playTapSound } from "@/lib/gameSounds";
import WakeSlider from "@/components/ui/WakeSlider";

interface SubjectWithTopics {
  id?: string;
  name: string;
  topics: string[];
}

export default function TopicProgressPage() {
  const router = useRouter();
  const [subjects, setSubjects] = useState<SubjectWithTopics[]>([
    {
      name: "Physics",
      topics: ["Kinematics & Dynamics", "Thermodynamics", "Wave Optics", "Electromagnetism"],
    },
    {
      name: "Chemistry",
      topics: ["Organic Reaction Mechanisms", "Chemical Kinetics", "Coordination Compounds", "Periodic Trends"],
    },
    {
      name: "Mathematics",
      topics: ["Calculus & Integrals", "Differential Equations", "Vectors & 3D Geometry", "Probability"],
    },
    {
      name: "Biology",
      topics: ["Genetics & Heredity", "Human Physiology", "Cell Biology", "Ecology & Evolution"],
    },
  ]);

  const [search, setSearch] = useState("");
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({});
  const [allMastery, setAllMastery] = useState<Record<string, TopicMastery>>(() =>
    getAllTopicMastery()
  );

  useEffect(() => {
    // 1. Fetch user subjects from DB
    getUserSubjectsAndTopics().then((res) => {
      if (res && res.length > 0) {
        setSubjects(res);
      }
    });

    // 2. Fetch user topic mastery from PostgreSQL
    getUserTopicMasteries().then((dbMastery) => {
      if (dbMastery) {
        for (const [key, val] of Object.entries(dbMastery)) {
          const [sub, top] = key.split(":::");
          if (sub && top) {
            setTopicMastery(sub, top, val.percentage);
          }
        }
        setAllMastery(getAllTopicMastery());
      }
    }).catch(console.warn);

    // 3. Listen to updates
    const sync = () => setAllMastery(getAllTopicMastery());
    window.addEventListener("topic-mastery-updated", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("topic-mastery-updated", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggleSubject = (subName: string) => {
    setExpandedSubjects((prev) => ({
      ...prev,
      [subName]: !prev[subName],
    }));
  };

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

  const totalTopicsCount = subjectSummaries.reduce((acc, s) => acc + s.totalTopics, 0);
  const totalCompletedCount = subjectSummaries.reduce((acc, s) => acc + s.completedCount, 0);
  const overallAvgPercent =
    totalTopicsCount > 0
      ? Math.round(
          subjectSummaries.reduce((acc, s) => acc + s.averagePercentage * s.totalTopics, 0) /
            totalTopicsCount
        )
      : 0;

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

  const handleToggle100 = (subName: string, topName: string, currentlyDone: boolean) => {
    const newPct = currentlyDone ? 0 : 100;
    try {
      if (newPct === 100) playCorrectSound();
      else playTapSound();
    } catch {}
    setTopicMastery(subName, topName, newPct);
    saveDbTopicMastery(subName, topName, newPct).catch(console.warn);
  };

  const handleSetPercentage = (subName: string, topName: string, pct: number) => {
    try {
      if (pct === 100) playCorrectSound();
      else playTapSound();
    } catch {}
    setTopicMastery(subName, topName, pct);
    saveDbTopicMastery(subName, topName, pct).catch(console.warn);
  };

  return (
    <AppShell showBottomBar={false}>
      <div className="w-full max-w-3xl mx-auto px-4 pt-4 pb-20 md:pt-8 md:pb-16 space-y-6 animate-in fade-in duration-150">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/subjects")}
              className="w-10 h-10 rounded-2xl bg-card hover:bg-white/10 border border-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all active:scale-95"
              aria-label="Back to Subjects"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-black text-foreground tracking-tight">
                Topic Mastery
              </h1>
              <p className="text-xs text-muted-foreground font-semibold">
                Track completion across your subjects
              </p>
            </div>
          </div>

          <Link
            href="/routine"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-xs font-bold text-violet-300 transition-colors"
          >
            <Calendar className="w-4 h-4 text-violet-400" />
            <span className="hidden sm:inline">Daily Routine</span>
          </Link>
        </div>

        {/* Overview Stats Card */}
        <div className="p-5 rounded-3xl bg-card border border-white/10 grid grid-cols-3 gap-4 text-center">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
              Overall Mastery
            </span>
            <span className="text-2xl sm:text-3xl font-black text-primary tabular-nums">
              {overallAvgPercent}%
            </span>
          </div>

          <div className="border-x border-white/5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
              Completed (100%)
            </span>
            <span className="text-2xl sm:text-3xl font-black text-emerald-400 tabular-nums">
              {totalCompletedCount}
            </span>
          </div>

          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
              Total Topics
            </span>
            <span className="text-2xl sm:text-3xl font-black text-foreground tabular-nums">
              {totalTopicsCount}
            </span>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search any subject or topic (e.g. Vocabulary, Kinematics)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-2xl bg-card border border-white/10 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-all"
          />
        </div>

        {/* Subjects & Topics Accordion */}
        <div className="space-y-4">
          {filteredSummaries.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm border-2 border-dashed border-white/5 rounded-3xl">
              No subjects or topics match your search.
            </div>
          ) : (
            filteredSummaries.map((sub) => {
              const isExpanded = expandedSubjects[sub.name] ?? true;

              return (
                <div
                  key={sub.name}
                  className="rounded-3xl bg-card border border-white/10 overflow-hidden shadow-sm"
                >
                  {/* Subject Header */}
                  <div
                    onClick={() => toggleSubject(sub.name)}
                    className="p-4 sm:p-5 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors select-none"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-9 h-9 rounded-2xl bg-violet-500/20 text-violet-400 flex items-center justify-center shrink-0 border border-violet-500/30">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-base sm:text-lg font-black text-foreground truncate">
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
                        <div className="w-20 h-1.5 rounded-full bg-white/10 overflow-hidden mt-1">
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
                        <p className="text-xs text-muted-foreground italic py-2 pl-2">
                          No topics added under this subject yet.
                        </p>
                      ) : (
                        sub.topics.map((top) => (
                          <div
                            key={top.name}
                            className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                              top.isCompleted
                                ? "bg-emerald-950/20 border-emerald-500/30"
                                : "bg-white/5 border-white/5"
                            }`}
                          >
                            {/* Tick mark & Title */}
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <button
                                type="button"
                                onClick={() =>
                                  handleToggle100(sub.name, top.name, top.isCompleted)
                                }
                                className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all shrink-0 active:scale-90 ${
                                  top.isCompleted
                                    ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30"
                                    : "border-2 border-white/20 hover:border-violet-400 bg-white/5 text-transparent"
                                }`}
                                aria-label="Toggle completed"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                              <div className="min-w-0 flex-1">
                                <span
                                  className={`text-sm font-bold block truncate ${
                                    top.isCompleted
                                      ? "line-through text-muted-foreground"
                                      : "text-foreground"
                                  }`}
                                >
                                  {top.name}
                                </span>
                                {top.isCompleted && (
                                  <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                                    <Sparkles className="w-3 h-3" />
                                    Mastered
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Interactive WakeSlider & Percentage Controls */}
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pl-10 sm:pl-0 w-full sm:w-auto">
                              {/* React Bits WakeSlider */}
                              <div className="w-full sm:w-52">
                                <WakeSlider
                                  value={top.percentage}
                                  min={0}
                                  max={100}
                                  step={5}
                                  bars={22}
                                  height={32}
                                  restHeight={9}
                                  gap={2.5}
                                  fillColor={top.isCompleted ? "#10b981" : "#8b5cf6"}
                                  trackColor="#27272a"
                                  crestColor={top.isCompleted ? "#34d399" : "#c4b5fd"}
                                  showValue
                                  formatValue={(v) => `${v}%`}
                                  onChange={(newVal) =>
                                    handleSetPercentage(sub.name, top.name, newVal)
                                  }
                                />
                              </div>

                              {/* Quick Snap Pills */}
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleSetPercentage(sub.name, top.name, 0)}
                                  className={`text-[10px] font-bold px-2 py-1 rounded-lg transition-all ${
                                    top.percentage === 0
                                      ? "bg-white/20 text-white"
                                      : "bg-white/5 hover:bg-white/10 text-muted-foreground"
                                  }`}
                                  title="Reset to 0%"
                                >
                                  0%
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSetPercentage(sub.name, top.name, 50)}
                                  className={`text-[10px] font-bold px-2 py-1 rounded-lg transition-all ${
                                    top.percentage === 50
                                      ? "bg-primary text-white"
                                      : "bg-white/5 hover:bg-white/10 text-muted-foreground"
                                  }`}
                                  title="Halfway 50%"
                                >
                                  50%
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSetPercentage(sub.name, top.name, 100)}
                                  className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all ${
                                    top.isCompleted
                                      ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30"
                                      : "bg-white/5 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                  }`}
                                  title="Mark 100% Mastered"
                                >
                                  100%
                                </button>
                              </div>
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
    </AppShell>
  );
}
