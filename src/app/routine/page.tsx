"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Settings as SettingsIcon,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  BookOpen,
  Sparkles,
  CheckCircle2,
  X,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import { AppShell, NavMenu } from "@/components/NavMenu";
import { RoutineBlock, BlockType } from "@/lib/routineTypes";
import {
  formatDateKey,
  formatHumanDate,
  getAllBlocks,
  upsertBlock,
  toggleBlockCompletion,
  toggleSubtask,
  deleteBlock,
} from "@/lib/routineStorage";
import { getUserSubjectsAndTopics } from "@/app/actions/subjects";
import { getTopicMastery } from "@/lib/topicProgressStorage";
import { BlockCard } from "@/components/routine/BlockCard";
import { BlockEditorModal } from "@/components/routine/BlockEditorModal";
import { RoutineCalendarModal } from "@/components/routine/RoutineCalendarModal";
import { AiScheduleGeneratorModal } from "@/components/routine/AiScheduleGeneratorModal";
import { TopicCompletionModal } from "@/components/routine/TopicCompletionModal";
import { TopicMasteryModal } from "@/components/routine/TopicMasteryModal";

/** Lightweight event-driven store for routine blocks (avoids useSyncExternalStore snapshot equality issues) */
function useRoutineBlocks(): RoutineBlock[] {
  const [blocks, setBlocks] = useState<RoutineBlock[]>(() =>
    typeof window !== "undefined" ? getAllBlocks() : []
  );

  useEffect(() => {
    // Subscribe to external localStorage changes only
    const refresh = () => setBlocks(getAllBlocks());
    // Dispatch once at mount so we always reflect the current localStorage value
    window.dispatchEvent(new CustomEvent("routine-blocks-updated"));
    window.addEventListener("routine-blocks-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("routine-blocks-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return blocks;
}

export default function RoutinePage() {
  // Selected date state (defaults to today)
  const [selectedDate, setSelectedDate] = useState<string>(() =>
    formatDateKey(new Date())
  );

  // Subscribe to routine blocks via lightweight event-driven hook
  const allBlocks = useRoutineBlocks();

  // Modals state
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<RoutineBlock | null>(null);
  const [editorInitialType, setEditorInitialType] = useState<BlockType>("study");

  // AI & Mastery modals
  const [isAiGeneratorOpen, setIsAiGeneratorOpen] = useState(false);
  const [isTopicMasteryOpen, setIsTopicMasteryOpen] = useState(false);
  const [completingStudyBlock, setCompletingStudyBlock] = useState<{
    id: string;
    subject: string;
    topic: string;
  } | null>(null);
  const [aiToast, setAiToast] = useState<{ summary: string } | null>(null);

  // Subjects from DB or defaults
  const [subjects, setSubjects] = useState<Array<{ name: string; topics: string[] }>>([
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

  useEffect(() => {
    getUserSubjectsAndTopics().then((res) => {
      if (res && res.length > 0) {
        setSubjects(res);
      }
    });
  }, []);

  // Filter & sort blocks for the selected date
  const blocks = useMemo(() => {
    const list = allBlocks.filter((b) => b.date === selectedDate);
    return list.sort((a, b) => {
      if (a.startTime && !b.startTime) return -1;
      if (!a.startTime && b.startTime) return 1;
      if (a.startTime && b.startTime) {
        if (a.startTime !== b.startTime) {
          return a.startTime.localeCompare(b.startTime);
        }
      }
      return a.order - b.order;
    });
  }, [allBlocks, selectedDate]);

  // Calendar dot map for days with blocks
  const dateMap = useMemo(() => {
    const map: Record<
      string,
      { total: number; completed: number; hasStudy: boolean; hasNormal: boolean }
    > = {};
    for (const block of allBlocks) {
      if (!map[block.date]) {
        map[block.date] = { total: 0, completed: 0, hasStudy: false, hasNormal: false };
      }
      map[block.date].total += 1;
      if (block.isCompleted) {
        map[block.date].completed += 1;
      }
      if (block.type === "study") {
        map[block.date].hasStudy = true;
      } else {
        map[block.date].hasNormal = true;
      }
    }
    return map;
  }, [allBlocks]);

  // Navigate between days
  const handlePrevDay = () => {
    const [y, m, d] = selectedDate.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() - 1);
    setSelectedDate(formatDateKey(date));
  };

  const handleNextDay = () => {
    const [y, m, d] = selectedDate.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + 1);
    setSelectedDate(formatDateKey(date));
  };

  const handleJumpToday = () => {
    setSelectedDate(formatDateKey(new Date()));
  };

  // Block actions
  const handleToggleComplete = (id: string) => {
    const target = blocks.find((b) => b.id === id);
    // If it's a study block and not yet completed, ask about topic completion
    if (target && target.type === "study" && !target.isCompleted && target.topic) {
      setCompletingStudyBlock({
        id: target.id,
        subject: target.subject || "General",
        topic: target.topic,
      });
      return;
    }
    toggleBlockCompletion(id);
  };

  const handleTopicCompletionConfirmed = () => {
    if (completingStudyBlock) {
      toggleBlockCompletion(completingStudyBlock.id);
      setCompletingStudyBlock(null);
    }
  };

  const handleToggleSubtask = (blockId: string, subtaskId: string) => {
    toggleSubtask(blockId, subtaskId);
  };

  const handleSaveBlock = (block: RoutineBlock) => {
    upsertBlock(block);
  };

  const handleDeleteBlock = (id: string) => {
    deleteBlock(id);
  };

  const handleEditBlock = (block: RoutineBlock) => {
    setEditingBlock(block);
    setEditorInitialType(block.type);
    setIsEditorOpen(true);
  };

  const handleAddNew = (type: BlockType = "study") => {
    setEditingBlock(null);
    setEditorInitialType(type);
    setIsEditorOpen(true);
  };

  const handleScheduleGeneratedByAi = (summary: string) => {
    setAiToast({ summary });
  };

  // Date metadata
  const { dayName, formattedDate, isToday } = useMemo(
    () => formatHumanDate(selectedDate),
    [selectedDate]
  );

  const completedCount = blocks.filter((b) => b.isCompleted).length;
  const totalCount = blocks.length;
  const progressPercent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <AppShell showBottomBar={false}>
      <div className="w-full max-w-3xl mx-auto px-4 pt-4 pb-28 md:pt-8 md:pb-16 space-y-6">
        {/* ================================================================= */}
        {/*  TOP APP HEADER: Date, Day Switcher, Calendar, Settings (Icon Only)*/}
        {/* ================================================================= */}
        <header className="flex items-center justify-between gap-3">
          {/* Left: Date Display & Day Jump */}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                {dayName}
              </span>
              {isToday ? (
                <button
                  type="button"
                  onClick={handleJumpToday}
                  className="text-[10px] font-black uppercase tracking-wider bg-primary/20 text-primary border border-primary/30 px-2 py-0.5 rounded-full"
                >
                  Today
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleJumpToday}
                  className="text-[10px] font-black uppercase tracking-wider bg-white/10 hover:bg-primary/20 text-muted-foreground hover:text-primary border border-white/10 px-2 py-0.5 rounded-full transition-colors"
                >
                  Jump to Today
                </button>
              )}
            </div>

            <button
              onClick={() => setIsCalendarOpen(true)}
              className="group flex items-center gap-2 mt-0.5 text-left active:scale-[0.98] transition-all"
            >
              <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight group-hover:text-primary transition-colors">
                {formattedDate}
              </h1>
              <div className="w-6 h-6 rounded-lg bg-white/5 group-hover:bg-primary/20 flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
                <CalendarIcon className="w-3.5 h-3.5" />
              </div>
            </button>
          </div>

          {/* Right: Quick Controls + Settings Icon Only */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Quick AI Generator Button */}
            <button
              onClick={() => setIsAiGeneratorOpen(true)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-gradient-to-r from-violet-600 to-primary text-white text-xs font-black shadow-md shadow-violet-600/30 hover:brightness-110 active:scale-95 transition-all"
            >
              <Sparkles className="w-4 h-4" />
              <span>AI Schedule</span>
            </button>

            {/* Day Nav Chevrons */}
            <div className="flex items-center p-1 rounded-2xl bg-card border border-white/10 shadow-sm">
              <button
                onClick={handlePrevDay}
                className="w-9 h-9 rounded-xl hover:bg-white/10 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors active:scale-90"
                aria-label="Previous day"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={handleNextDay}
                className="w-9 h-9 rounded-xl hover:bg-white/10 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors active:scale-90"
                aria-label="Next day"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Calendar Icon Button */}
            <button
              onClick={() => setIsCalendarOpen(true)}
              className="w-11 h-11 rounded-2xl bg-card hover:bg-white/10 border border-white/10 text-muted-foreground hover:text-foreground flex items-center justify-center transition-all active:scale-95 shadow-sm"
              aria-label="Calendar"
            >
              <CalendarIcon className="w-5 h-5" />
            </button>

            {/* Settings Button: Dedicated Settings Page */}
            <Link
              href="/routine/settings"
              className="w-11 h-11 rounded-2xl bg-card hover:bg-white/10 border border-white/10 text-muted-foreground hover:text-foreground flex items-center justify-center transition-all active:scale-95 shadow-sm"
              aria-label="Routine Settings"
            >
              <SettingsIcon className="w-5 h-5" />
            </Link>

            {/* Mobile Navigation Menu */}
            <NavMenu />
          </div>
        </header>

        {/* ================================================================= */}
        {/*  DAY PROGRESS BANNER (Shown when user has blocks)                 */}
        {/* ================================================================= */}
        {totalCount > 0 && (
          <div className="p-4 sm:p-5 rounded-3xl bg-card border border-white/10 shadow-sm flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-xs font-bold">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-foreground">
                  {completedCount} of {totalCount} completed
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  href="/subjects/progress"
                  className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Topic Progress</span>
                </Link>
                <span className="text-primary font-black tabular-nums">
                  {progressPercent}%
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-primary rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/*  BLOCKS LIST OR INITIAL EMPTY STATE (Minimal Notion aesthetic)   */}
        {/* ================================================================= */}
        {totalCount === 0 ? (
          /* Clean Minimal Empty State */
          <div className="py-16 px-4 rounded-3xl bg-card/40 border border-white/10 text-center space-y-5 flex flex-col items-center justify-center animate-in fade-in duration-200">
            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                No blocks for this day
              </h2>
              <p className="text-xs text-muted-foreground font-medium">
                Add blocks or let AI build your schedule for {formattedDate}
              </p>
            </div>

            {/* Clean Action Buttons */}
            <div className="flex flex-col gap-2.5 w-full max-w-xs">
              <button
                onClick={() => setIsAiGeneratorOpen(true)}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-violet-600 to-primary hover:brightness-110 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-violet-600/30 transition-all active:scale-95"
              >
                <Sparkles className="w-4 h-4" />
                <span>Build with AI</span>
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() => handleAddNew("study")}
                  className="flex-1 py-3 px-3 rounded-2xl bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95"
                >
                  <BookOpen className="w-4 h-4 text-violet-400" />
                  <span>+ Study Block</span>
                </button>

                <button
                  onClick={() => handleAddNew("normal")}
                  className="flex-1 py-3 px-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-foreground font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Add Block</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Render Routine Blocks */
          <div className="space-y-3">
            {blocks.map((block) => (
              <BlockCard
                key={block.id}
                block={block}
                onToggleComplete={handleToggleComplete}
                onToggleSubtask={handleToggleSubtask}
                onEdit={handleEditBlock}
                onDelete={handleDeleteBlock}
              />
            ))}
          </div>
        )}

        {/* Quick Add Bar */}
        {totalCount > 0 && (
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={() => setIsAiGeneratorOpen(true)}
              className="flex-1 py-3 px-3 rounded-2xl bg-gradient-to-r from-violet-600/20 to-primary/20 hover:from-violet-600/30 hover:to-primary/30 border border-violet-500/30 text-violet-300 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all active:scale-98"
            >
              <Sparkles className="w-4 h-4 text-violet-400" />
              <span>Build with AI</span>
            </button>

            <button
              onClick={() => handleAddNew("study")}
              className="flex-1 py-3 px-3 rounded-2xl bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-violet-300 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all active:scale-98"
            >
              <BookOpen className="w-4 h-4 text-violet-400" />
              <span>+ Study</span>
            </button>

            <button
              onClick={() => handleAddNew("normal")}
              className="flex-1 py-3 px-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-foreground font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all active:scale-98"
            >
              <Plus className="w-4 h-4" />
              <span>+ Block</span>
            </button>
          </div>
        )}
      </div>

      {/* Floating Action Button for Mobile */}
      <div className="fixed bottom-20 right-5 z-40 sm:hidden flex flex-col gap-2 items-center">
        <button
          onClick={() => setIsAiGeneratorOpen(true)}
          className="w-12 h-12 rounded-full bg-card border border-violet-500/40 text-violet-400 shadow-xl shadow-black/40 flex items-center justify-center transition-all active:scale-90"
          aria-label="AI Schedule"
        >
          <Sparkles className="w-5 h-5" />
        </button>

        <button
          onClick={() => handleAddNew("study")}
          className="w-14 h-14 rounded-full bg-gradient-to-r from-violet-600 to-primary text-white shadow-xl shadow-violet-600/40 flex items-center justify-center transition-all active:scale-90"
          aria-label="Add block"
        >
          <Plus className="w-7 h-7 stroke-[2.5]" />
        </button>
      </div>

      {/* =================================================================== */}
      {/*  FLOATING POST-GENERATION BANNER / TOAST (As requested by user)     */}
      {/* =================================================================== */}
      {aiToast && (
        <div className="fixed bottom-24 sm:bottom-6 left-4 right-4 sm:left-auto sm:right-6 z-40 sm:max-w-md animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="p-4 rounded-3xl bg-card border-2 border-violet-500/40 shadow-2xl shadow-black/60 flex items-center justify-between gap-3 backdrop-blur-xl">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-9 h-9 rounded-xl bg-violet-600 text-white flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-black uppercase text-violet-400 tracking-wide">
                  Schedule Built by AI
                </h4>
                <p className="text-xs text-foreground font-semibold truncate">
                  {aiToast.summary}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <Link
                href="/routine/settings"
                onClick={() => setAiToast(null)}
                className="py-1.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-black text-foreground transition-colors"
              >
                Settings
              </Link>
              <button
                type="button"
                onClick={() => setAiToast(null)}
                className="w-8 h-8 rounded-xl hover:bg-white/10 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/*  MODALS                                                             */}
      {/* =================================================================== */}
      {/* AI Schedule Generator Modal */}
      <AiScheduleGeneratorModal
        isOpen={isAiGeneratorOpen}
        onClose={() => setIsAiGeneratorOpen(false)}
        dateKey={selectedDate}
        dayOfWeek={dayName}
        formattedDate={formattedDate}
        onScheduleGenerated={handleScheduleGeneratedByAi}
      />

      {/* Topic Completion Prompt Modal (Opens when user ticks a study block) */}
      <TopicCompletionModal
        isOpen={completingStudyBlock !== null}
        onClose={() => setCompletingStudyBlock(null)}
        subjectName={completingStudyBlock?.subject || ""}
        topicName={completingStudyBlock?.topic || ""}
        currentPercentage={
          completingStudyBlock
            ? getTopicMastery(completingStudyBlock.subject, completingStudyBlock.topic).percentage
            : 0
        }
        onConfirm={handleTopicCompletionConfirmed}
      />

      {/* Topic Mastery & Percentage Breakdown Modal */}
      <TopicMasteryModal
        isOpen={isTopicMasteryOpen}
        onClose={() => setIsTopicMasteryOpen(false)}
        subjects={subjects}
      />

      {/* Calendar Modal */}
      <RoutineCalendarModal
        isOpen={isCalendarOpen}
        onClose={() => setIsCalendarOpen(false)}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        dateMap={dateMap}
      />

      {/* Block Editor / Creator Modal */}
      <BlockEditorModal
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false);
          setEditingBlock(null);
        }}
        onSave={handleSaveBlock}
        dateKey={selectedDate}
        initialBlock={editingBlock}
        initialType={editorInitialType}
      />
    </AppShell>
  );
}
