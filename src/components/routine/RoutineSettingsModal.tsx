"use client";

import { useState } from "react";
import {
  X,
  Calendar,
  Sparkles,
  CheckCheck,
  Trash2,
  BookOpen,
  Coffee,
  Clock,
  FileText,
  Save,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { getAiPermanentNotes, setAiPermanentNotes } from "@/lib/routineStorage";

interface RoutineSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCalendar: () => void;
  onOpenTopicMastery: () => void;
  onAddNewBlock: (initialType?: "study" | "normal") => void;
  onApplyPreset: (preset: "exam_day" | "daily_balanced") => void;
  onClearCompleted: () => void;
  onClearAll: () => void;
  formattedDate: string;
  totalBlocks: number;
  completedBlocks: number;
}

export function RoutineSettingsModal({
  isOpen,
  onClose,
  onOpenCalendar,
  onOpenTopicMastery,
  onAddNewBlock,
  onApplyPreset,
  onClearCompleted,
  onClearAll,
  formattedDate,
  totalBlocks,
  completedBlocks,
}: RoutineSettingsModalProps) {
  const [permanentNotes, setNotes] = useState(() => getAiPermanentNotes());
  const [showNotepad, setShowNotepad] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  if (!isOpen) return null;

  const handleSaveNotes = () => {
    setAiPermanentNotes(permanentNotes);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Sheet / Modal */}
      <div className="relative w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-[2rem] sm:rounded-3xl bg-card border border-white/10 shadow-2xl p-6 animate-in fade-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200">
        {/* Drag handle for mobile */}
        <div className="sm:hidden w-12 h-1.5 rounded-full bg-white/20 mx-auto -mt-1 mb-4" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <div>
            <h3 className="font-black text-xl text-foreground">Routine Settings</h3>
            <p className="text-xs text-muted-foreground font-semibold mt-0.5">
              Managing schedule for <span className="text-primary">{formattedDate}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl hover:bg-white/10 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Options List */}
        <div className="mt-4 space-y-2.5">
          {/* Calendar Option (prominently featured as instructed) */}
          <button
            onClick={() => {
              onClose();
              onOpenCalendar();
            }}
            className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl bg-primary/10 border border-primary/30 hover:bg-primary/20 hover:border-primary text-left transition-all active:scale-[0.99] group"
          >
            <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shrink-0 shadow-md shadow-primary/25 group-hover:scale-105 transition-transform">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-black text-foreground">Calendar View</h4>
              <p className="text-xs text-muted-foreground font-medium">
                Browse any date, plan ahead, and manage blocks
              </p>
            </div>
          </button>

          {/* Topic Mastery & Completed Checklist */}
          <button
            onClick={() => {
              onClose();
              onOpenTopicMastery();
            }}
            className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-emerald-500/30 text-left transition-all active:scale-[0.99] group"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <CheckCheck className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-black text-foreground">Topic Progress & Mastery</h4>
              <p className="text-xs text-muted-foreground font-medium">
                Mark completed topics & percentages for AI to track
              </p>
            </div>
          </button>

          {/* Permanent AI Rules Notepad (Crucial user request) */}
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-2">
            <button
              type="button"
              onClick={() => setShowNotepad(!showNotepad)}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-2.5">
                <FileText className="w-4 h-4 text-violet-400" />
                <span className="text-xs font-black uppercase tracking-wide text-foreground">
                  Permanent AI Notepad & Habits
                </span>
              </div>
              {showNotepad ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </button>

            <p className="text-xs text-muted-foreground">
              Write fixed routines (e.g. coaching days, school timings) in normal English. AI remembers this for every schedule.
            </p>

            {showNotepad && (
              <div className="pt-2 space-y-2 animate-in fade-in duration-150">
                <textarea
                  rows={4}
                  value={permanentNotes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Coaching on Monday, Wednesday, and Friday from 2:30 PM to 5:00 PM. Target sleep by 11:00 PM..."
                  className="w-full px-3 py-2.5 rounded-xl bg-black/30 border border-white/10 text-foreground text-xs font-medium focus:outline-none focus:border-primary resize-none leading-relaxed"
                />

                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">
                    Auto-used whenever AI generates your day
                  </span>
                  <button
                    type="button"
                    onClick={handleSaveNotes}
                    className="py-1.5 px-3 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors"
                  >
                    {isSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                    <span>{isSaved ? "Saved!" : "Save Notes"}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Add Study Block */}
          <button
            onClick={() => {
              onClose();
              onAddNewBlock("study");
            }}
            className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-violet-500/30 text-left transition-all active:scale-[0.99] group"
          >
            <div className="w-10 h-10 rounded-xl bg-violet-500/20 text-violet-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-black text-foreground">Add Study Block</h4>
              <p className="text-xs text-muted-foreground font-medium">
                Set Subject, Topic, objectives & focus timing
              </p>
            </div>
          </button>

          {/* Add Normal Block */}
          <button
            onClick={() => {
              onClose();
              onAddNewBlock("normal");
            }}
            className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 text-left transition-all active:scale-[0.99] group"
          >
            <div className="w-10 h-10 rounded-xl bg-zinc-800 text-zinc-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Coffee className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-black text-foreground">Add Normal Block</h4>
              <p className="text-xs text-muted-foreground font-medium">
                Sleep, Eating, Free time, Break, or Workout
              </p>
            </div>
          </button>

          {/* Quick Routine Presets Section */}
          <div className="pt-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground pl-1 mb-1.5 block">
              Quick Templates
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  onClose();
                  onApplyPreset("exam_day");
                }}
                className="flex items-center gap-2 p-3 rounded-xl bg-gradient-to-br from-violet-950/40 to-card border border-violet-500/30 hover:border-violet-400 text-left transition-all text-xs font-bold text-foreground"
              >
                <Sparkles className="w-4 h-4 text-violet-400 shrink-0" />
                <span>Exam Sprint Day</span>
              </button>

              <button
                onClick={() => {
                  onClose();
                  onApplyPreset("daily_balanced");
                }}
                className="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-left transition-all text-xs font-bold text-foreground"
              >
                <Clock className="w-4 h-4 text-primary shrink-0" />
                <span>Daily Balanced</span>
              </button>
            </div>
          </div>

          {/* Cleanup Options */}
          {totalBlocks > 0 && (
            <div className="pt-2 border-t border-white/5 flex gap-2">
              {completedBlocks > 0 && (
                <button
                  onClick={() => {
                    onClearCompleted();
                    onClose();
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
                >
                  <CheckCheck className="w-4 h-4 text-emerald-400" />
                  <span>Clear Completed ({completedBlocks})</span>
                </button>
              )}

              <button
                onClick={() => {
                  if (confirm("Reset and remove all blocks for this day?")) {
                    onClearAll();
                    onClose();
                  }
                }}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-danger/10 hover:bg-danger/20 text-xs font-bold text-danger transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Reset Day</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
