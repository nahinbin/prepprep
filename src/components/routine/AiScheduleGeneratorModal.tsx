"use client";

import { useState } from "react";
import {
  X,
  Sparkles,
  FileText,
} from "lucide-react";
import { generateAiDailySchedule } from "@/app/actions/ai-schedule";
import { RoutineBlock } from "@/lib/routineTypes";
import {
  generateBlockId,
  getAiPermanentNotes,
  upsertBlock,
} from "@/lib/routineStorage";
import { getAllTopicMastery } from "@/lib/topicProgressStorage";

interface AiScheduleGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateKey: string;
  dayOfWeek: string;
  formattedDate: string;
  onScheduleGenerated: (summary: string) => void;
}

const TEMPORARY_SUGGESTIONS = [
  "Coaching today (2:30 PM - 5:00 PM)",
  "Finals next week, maximum study hours!",
  "Dentist appointment at 3:00 PM",
  "Feeling slightly tired, balanced routine",
  "Focus heavily on Physics & Chemistry",
];

export function AiScheduleGeneratorModal({
  isOpen,
  onClose,
  dateKey,
  dayOfWeek,
  formattedDate,
  onScheduleGenerated,
}: AiScheduleGeneratorModalProps) {
  const [todayNote, setTodayNote] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const permanentNotes = getAiPermanentNotes();

  const handleGenerate = async () => {
    setIsLoading(true);
    setErrorMsg("");

    try {
      const topicMastery = getAllTopicMastery();

      const result = await generateAiDailySchedule({
        dateKey,
        dayOfWeek,
        permanentNotes,
        todayNote: todayNote.trim() || undefined,
        topicMastery,
      });

      if (!result.success || result.blocks.length === 0) {
        throw new Error(result.error || "Failed to generate schedule.");
      }

      // Convert generated DTOs to RoutineBlock and save
      result.blocks.forEach((b, idx) => {
        const routineBlock: RoutineBlock = {
          id: generateBlockId(),
          date: dateKey,
          type: b.type,
          title: b.title,
          timeMode: b.timeMode || "range",
          startTime: b.startTime,
          endTime: b.endTime,
          isCompleted: false,
          subject: b.subject,
          topic: b.topic,
          notes: b.notes,
          subtasks: b.subtasks?.map((st, sIdx) => ({
            id: `st_${Date.now()}_${sIdx}`,
            text: st,
            completed: false,
          })),
          order: idx,
          createdAt: Date.now() + idx,
        };
        upsertBlock(routineBlock);
      });

      onScheduleGenerated(result.summary);
      onClose();
    } catch (err) {
      console.error("AI Schedule generation failed:", err);
      setErrorMsg((err as Error).message || "Generation failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-md transition-opacity"
        onClick={!isLoading ? onClose : undefined}
      />

      {/* Modal Dialog */}
      <div className="relative w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-[2rem] sm:rounded-3xl bg-card border border-white/10 shadow-2xl p-6 animate-in fade-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200">
        {/* Mobile handle */}
        <div className="sm:hidden w-12 h-1.5 rounded-full bg-white/20 mx-auto -mt-1 mb-4" />

        {/* Header with Close X Button */}
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-600 to-primary text-white flex items-center justify-center shadow-lg shadow-violet-600/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-xl text-foreground">
                Generate AI Schedule
              </h3>
              <p className="text-xs text-muted-foreground font-semibold">
                Building routine for <span className="text-primary">{formattedDate}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="w-9 h-9 rounded-xl hover:bg-white/10 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading ? (
          /* Loading Animation */
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
            <div className="relative w-16 h-16 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-violet-500/20 border-t-violet-500 animate-spin" />
              <Sparkles className="w-7 h-7 text-violet-400 animate-pulse" />
            </div>
            <div>
              <h4 className="font-black text-lg text-foreground">
                AI is crafting your day...
              </h4>
              <p className="text-xs text-muted-foreground font-medium mt-1 max-w-xs mx-auto">
                Reviewing your subjects, prioritizing unfinished topics, and scheduling breaks.
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {/* Permanent Notes Preview Badge */}
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 flex items-start gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                <FileText className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-black uppercase tracking-wider text-primary block mb-0.5">
                  Permanent Habits Active (from Settings)
                </span>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {permanentNotes || "Default student schedule rules applied."}
                </p>
              </div>
            </div>

            {/* Temporary Note for Today */}
            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5 pl-1">
                Add note for today <span className="text-muted-foreground font-normal">(Optional)</span>
              </label>
              <textarea
                rows={3}
                placeholder="e.g. I have coaching today, dentist at 3 PM, focus mostly on Physics..."
                value={todayNote}
                onChange={(e) => setTodayNote(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground text-sm font-medium focus:outline-none focus:border-primary transition-all resize-none"
              />

              {/* Fast Suggestions */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {TEMPORARY_SUGGESTIONS.map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => setTodayNote(sug)}
                    className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 text-muted-foreground hover:text-foreground transition-all"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>

            {/* Error Message if any */}
            {errorMsg && (
              <p className="text-xs font-bold text-danger bg-danger/10 p-3 rounded-xl">
                {errorMsg}
              </p>
            )}

            {/* Confirm & Cancel Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={handleGenerate}
                className="flex-1 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-violet-600 to-primary hover:brightness-110 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-violet-600/30 transition-all active:scale-95"
              >
                <Sparkles className="w-4 h-4" />
                <span>Confirm & Generate Schedule</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="py-3 px-4 rounded-2xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground font-bold text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

