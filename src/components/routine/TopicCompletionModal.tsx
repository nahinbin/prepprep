"use client";

import { useState } from "react";
import { CheckCircle2, X, BookOpen } from "lucide-react";
import { setTopicMastery } from "@/lib/topicProgressStorage";
import { playCorrectSound, playTapSound } from "@/lib/gameSounds";
import WakeSlider from "@/components/ui/WakeSlider";

interface TopicCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjectName: string;
  topicName: string;
  currentPercentage?: number;
  onConfirm: (newPercentage: number, isFullyCompleted: boolean) => void;
}

export function TopicCompletionModal({
  isOpen,
  onClose,
  subjectName,
  topicName,
  currentPercentage = 0,
  onConfirm,
}: TopicCompletionModalProps) {
  const [selectedPercentage, setSelectedPercentage] = useState<number>(currentPercentage);

  if (!isOpen) return null;

  const handleFullCompletion = () => {
    try {
      playCorrectSound();
    } catch {}
    setTopicMastery(subjectName, topicName, 100);
    onConfirm(100, true);
    onClose();
  };

  const handlePartialCompletion = (pct: number) => {
    try {
      playTapSound();
    } catch {}
    setTopicMastery(subjectName, topicName, pct);
    onConfirm(pct, false);
    onClose();
  };

  const handleJustSessionDone = () => {
    try {
      playTapSound();
    } catch {}
    onConfirm(currentPercentage, currentPercentage >= 100);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full sm:max-w-md rounded-t-[2rem] sm:rounded-3xl bg-card border border-white/10 shadow-2xl p-6 overflow-hidden animate-in fade-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200">
        {/* Mobile handle */}
        <div className="sm:hidden w-12 h-1.5 rounded-full bg-white/20 mx-auto -mt-1 mb-4" />

        {/* Header with Close X Button */}
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-violet-500/20 text-violet-400 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-lg text-foreground">Topic Progress</h3>
              <p className="text-xs text-muted-foreground font-semibold">
                {subjectName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl hover:bg-white/10 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Topic Highlight */}
        <div className="my-4 p-3.5 rounded-2xl bg-violet-950/20 border border-violet-500/30">
          <span className="text-[10px] font-black uppercase tracking-wider text-violet-400 block mb-0.5">
            Topic Finished in Block
          </span>
          <h4 className="text-base sm:text-lg font-black text-foreground">
            {topicName}
          </h4>
        </div>

        <p className="text-sm font-bold text-foreground mb-3 pl-1">
          Did you totally complete this topic?
        </p>

        {/* Options */}
        <div className="space-y-2">
          {/* 100% Completed Button */}
          <button
            type="button"
            onClick={handleFullCompletion}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-emerald-500/15 border-2 border-emerald-500/40 hover:bg-emerald-500/25 hover:border-emerald-500 text-left transition-all active:scale-[0.99] group shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/30 group-hover:scale-105 transition-transform">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <span className="text-sm font-black text-emerald-400 block">
                  Yes, 100% Completed!
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  AI will mark it done and won&apos;t schedule it again
                </span>
              </div>
            </div>
            <span className="text-xs font-black text-emerald-400 bg-emerald-500/20 px-2.5 py-1 rounded-lg">
              100%
            </span>
          </button>

          {/* Interactive WakeSlider for Completion % */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground uppercase">
                Adjust Topic Progress
              </span>
              <span className={`text-sm font-black tabular-nums ${selectedPercentage >= 100 ? "text-emerald-400" : "text-primary"}`}>
                {selectedPercentage}%
              </span>
            </div>

            <div className="py-1">
              <WakeSlider
                value={selectedPercentage}
                min={0}
                max={100}
                step={5}
                bars={28}
                height={38}
                restHeight={10}
                gap={3}
                fillColor={selectedPercentage >= 100 ? "#10b981" : "#8b5cf6"}
                trackColor="#27272a"
                crestColor={selectedPercentage >= 100 ? "#34d399" : "#c4b5fd"}
                onChange={(pct) => setSelectedPercentage(pct)}
              />
            </div>

            {/* Quick Snap Chips */}
            <div className="flex items-center gap-1.5 pt-1">
              {[25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setSelectedPercentage(pct)}
                  className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all ${
                    selectedPercentage === pct
                      ? pct === 100
                        ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30"
                        : "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                      : "bg-white/5 border border-white/10 text-foreground hover:bg-white/10"
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>

            {/* Commit Progress Button */}
            <button
              type="button"
              onClick={() => handlePartialCompletion(selectedPercentage)}
              className="w-full py-2.5 px-3 rounded-xl bg-primary hover:brightness-110 text-primary-foreground text-xs font-black transition-all shadow-md active:scale-95"
            >
              Save {selectedPercentage}% Progress
            </button>
          </div>

          {/* Just Session Done Button */}
          <button
            type="button"
            onClick={handleJustSessionDone}
            className="w-full py-3 px-4 rounded-xl hover:bg-white/5 text-xs font-bold text-muted-foreground hover:text-foreground text-center transition-colors"
          >
            Just complete today&apos;s block (keep current topic progress)
          </button>
        </div>
      </div>
    </div>
  );
}

