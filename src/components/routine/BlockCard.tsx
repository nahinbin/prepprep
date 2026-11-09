"use client";

import { useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Pencil,
  Trash2,
  Coffee,
  Moon,
  Utensils,
  Heart,
  Dumbbell,
  Play,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { RoutineBlock } from "@/lib/routineTypes";
import { formatBlockTimeDisplay } from "@/lib/routineStorage";
import { playCorrectSound, playTapSound } from "@/lib/gameSounds";

interface BlockCardProps {
  block: RoutineBlock;
  onToggleComplete: (id: string) => void;
  onToggleSubtask: (blockId: string, subtaskId: string) => void;
  onEdit: (block: RoutineBlock) => void;
  onDelete: (id: string) => void;
}

function getNormalIcon(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("sleep") || lower.includes("nap") || lower.includes("bed")) {
    return <Moon className="w-4 h-4 text-indigo-400" />;
  }
  if (lower.includes("breakfast") || lower.includes("lunch") || lower.includes("dinner") || lower.includes("eat") || lower.includes("food")) {
    return <Utensils className="w-4 h-4 text-amber-400" />;
  }
  if (lower.includes("workout") || lower.includes("gym") || lower.includes("run") || lower.includes("walk")) {
    return <Dumbbell className="w-4 h-4 text-emerald-400" />;
  }
  if (lower.includes("free") || lower.includes("relax") || lower.includes("chill") || lower.includes("friend")) {
    return <Heart className="w-4 h-4 text-rose-400" />;
  }
  return <Coffee className="w-4 h-4 text-zinc-400" />;
}

export function BlockCard({
  block,
  onToggleComplete,
  onToggleSubtask,
  onEdit,
  onDelete,
}: BlockCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const timeDisplay = formatBlockTimeDisplay(block);
  const isStudy = block.type === "study";

  const handleTick = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (block.isCompleted) {
        playTapSound();
      } else {
        playCorrectSound();
      }
    } catch {}
    onToggleComplete(block.id);
  };

  const handleSubtaskTick = (subtaskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      playTapSound();
    } catch {}
    onToggleSubtask(block.id, subtaskId);
  };

  /* ========================================================================= */
  /*  NORMAL BLOCK (Compact, minimal, small text is more than enough)          */
  /* ========================================================================= */
  if (!isStudy) {
    return (
      <div
        className={`group relative flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border transition-all duration-200 ${
          block.isCompleted
            ? "bg-card/40 border-white/5 opacity-60"
            : "bg-card/80 hover:bg-card border-white/10 hover:border-white/20 shadow-sm"
        }`}
      >
        {/* Left: Tick button + Icon + Title */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button
            type="button"
            onClick={handleTick}
            className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all shrink-0 active:scale-90 ${
              block.isCompleted
                ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30"
                : "border-2 border-white/20 hover:border-primary/60 bg-white/5 text-transparent"
            }`}
            aria-label={block.isCompleted ? "Mark incomplete" : "Mark complete"}
          >
            <Check className="w-4 h-4 stroke-[3]" />
          </button>

          <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
            {getNormalIcon(block.title)}
          </div>

          <div className="min-w-0 flex-1">
            <p
              className={`text-sm sm:text-base font-bold truncate transition-all ${
                block.isCompleted
                  ? "line-through text-muted-foreground"
                  : "text-foreground"
              }`}
            >
              {block.title}
            </p>
          </div>
        </div>

        {/* Right: Time badge + Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-semibold text-muted-foreground bg-white/5 px-2.5 py-1 rounded-lg tabular-nums">
            {timeDisplay}
          </span>

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="w-7 h-7 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
              aria-label="Options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-8 z-30 w-32 rounded-xl bg-card border border-white/10 shadow-xl p-1 animate-in fade-in zoom-in-95 duration-100">
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onEdit(block);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold text-foreground hover:bg-white/10"
                  >
                    <Pencil className="w-3.5 h-3.5 text-primary" /> Edit
                  </button>
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      onDelete(block.id);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold text-danger hover:bg-danger/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ========================================================================= */
  /*  STUDY BLOCK (Focus block: bigger, colored differently, with dropdown)    */
  /* ========================================================================= */
  const completedSubtasks = block.subtasks?.filter((s) => s.completed).length || 0;
  const totalSubtasks = block.subtasks?.length || 0;

  return (
    <div
      className={`relative rounded-3xl border-2 transition-all duration-200 overflow-hidden shadow-lg ${
        block.isCompleted
          ? "bg-card/50 border-violet-500/20 opacity-70"
          : "bg-gradient-to-br from-violet-950/30 via-card to-card border-violet-500/40 hover:border-violet-500/70 shadow-violet-950/20"
      }`}
    >
      {/* Top Main Bar */}
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          {/* Tick Button + Subject & Topic */}
          <div className="flex items-start gap-3.5 min-w-0 flex-1">
            <button
              type="button"
              onClick={handleTick}
              className={`w-8 h-8 rounded-2xl flex items-center justify-center transition-all shrink-0 mt-0.5 active:scale-90 ${
                block.isCompleted
                  ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30"
                  : "border-2 border-violet-500/50 hover:border-violet-400 bg-violet-500/10 text-transparent"
              }`}
              aria-label={block.isCompleted ? "Mark incomplete" : "Mark complete"}
            >
              <Check className="w-5 h-5 stroke-[3]" />
            </button>

            <div className="min-w-0 flex-1">
              {/* Badge + Time Tag */}
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider bg-violet-500/20 text-violet-300 px-2.5 py-0.5 rounded-full border border-violet-500/30">
                  <Sparkles className="w-3 h-3 text-violet-400" />
                  Focus Block
                </span>
                <span className="text-xs font-bold text-violet-300/80 bg-violet-950/50 px-2 py-0.5 rounded-md tabular-nums">
                  {timeDisplay}
                </span>
              </div>

              {/* Subject Title */}
              <h4
                className={`text-lg sm:text-xl font-black tracking-tight transition-all ${
                  block.isCompleted
                    ? "line-through text-muted-foreground"
                    : "text-foreground"
                }`}
              >
                {block.subject || block.title}
              </h4>

              {/* Topic Subtitle */}
              {block.topic && (
                <p className="text-sm sm:text-base font-bold text-violet-400 mt-0.5">
                  {block.topic}
                </p>
              )}
            </div>
          </div>

          {/* Right: Dropdown toggle & More Menu */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Dropdown Accordion Toggle Button */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30 text-violet-300 text-xs font-bold transition-all active:scale-95"
              aria-label="Toggle details dropdown"
            >
              <span>{isExpanded ? "Hide" : "Details"}</span>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {/* Menu */}
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="w-8 h-8 rounded-xl hover:bg-white/10 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
                aria-label="Options"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {showMenu && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setShowMenu(false)}
                  />
                  <div className="absolute right-0 top-9 z-30 w-32 rounded-xl bg-card border border-white/10 shadow-xl p-1 animate-in fade-in zoom-in-95 duration-100">
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onEdit(block);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold text-foreground hover:bg-white/10"
                    >
                      <Pencil className="w-3.5 h-3.5 text-primary" /> Edit
                    </button>
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onDelete(block.id);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold text-danger hover:bg-danger/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Subtask summary pill when collapsed */}
        {!isExpanded && totalSubtasks > 0 && (
          <div className="mt-3 pl-11 flex items-center gap-2">
            <span className="text-[11px] font-bold text-muted-foreground">
              {completedSubtasks} of {totalSubtasks} goals completed
            </span>
            <div className="w-20 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-violet-500 rounded-full transition-all"
                style={{
                  width: `${(completedSubtasks / totalSubtasks) * 100}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Accordion / Dropdown Details (Expands when clicked) */}
      {isExpanded && (
        <div className="px-5 pb-5 pt-1 border-t border-violet-500/20 bg-black/20 space-y-3.5 animate-in fade-in duration-200">
          {/* Notes / Key Concepts */}
          {block.notes && (
            <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
              <span className="text-[10px] font-black uppercase tracking-wider text-violet-400 block mb-1">
                Focus Objectives & Notes
              </span>
              <p className="text-xs sm:text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                {block.notes}
              </p>
            </div>
          )}

          {/* Subtasks / Checklist Items */}
          {block.subtasks && block.subtasks.length > 0 && (
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block mb-2 pl-1">
                Study Checklist ({completedSubtasks}/{totalSubtasks})
              </span>
              <div className="space-y-1.5">
                {block.subtasks.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={(e) => handleSubtaskTick(st.id, e)}
                    className="w-full flex items-center gap-2.5 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-left transition-all active:scale-[0.99] group"
                  >
                    <div
                      className={`w-5 h-5 rounded-lg flex items-center justify-center transition-all shrink-0 ${
                        st.completed
                          ? "bg-emerald-500 text-white"
                          : "border border-white/30 group-hover:border-violet-400"
                      }`}
                    >
                      {st.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                    <span
                      className={`text-xs sm:text-sm font-semibold truncate ${
                        st.completed
                          ? "line-through text-muted-foreground"
                          : "text-foreground"
                      }`}
                    >
                      {st.text}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Focus Timer Launch Action (Prepares for next Focus Page) */}
          <div className="pt-2 flex items-center gap-2">
            <Link
              href={`/session/new?mode=practice&subject=${encodeURIComponent(
                block.subject || ""
              )}`}
              className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-primary hover:brightness-110 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-violet-600/30 transition-all active:scale-95"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Practice Questions for {block.subject || "Topic"}</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

