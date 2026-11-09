"use client";

import { useState } from "react";
import {
  X,
  BookOpen,
  Coffee,
  Plus,
  Trash2,
  Check,
} from "lucide-react";
import { RoutineBlock, BlockType, TimeMode, RoutineSubtask } from "@/lib/routineTypes";
import { generateBlockId, formatTime12 } from "@/lib/routineStorage";

interface BlockEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (block: RoutineBlock) => void;
  dateKey: string;
  initialBlock?: RoutineBlock | null;
  initialType?: BlockType;
}

const NORMAL_CHIPS = [
  "Wake up",
  "Breakfast",
  "Lunch",
  "Dinner",
  "Free time",
  "Sleep",
  "Workout",
  "Walk & Fresh Air",
  "Power Nap",
  "Break",
];

const SUBJECT_SUGGESTIONS = [
  "Physics",
  "Chemistry",
  "Biology",
  "Mathematics",
  "Medicine",
  "Anatomy",
  "Cardiology",
  "English",
  "General Science",
];

function BlockEditorForm({
  onClose,
  onSave,
  dateKey,
  initialBlock,
  initialType = "study",
}: Omit<BlockEditorModalProps, "isOpen">) {
  const [type, setType] = useState<BlockType>(initialBlock?.type || initialType);
  const [title, setTitle] = useState(
    initialBlock?.title || (initialType === "study" ? "Study Block" : "Routine Task")
  );
  const [subject, setSubject] = useState(initialBlock?.subject || "");
  const [topic, setTopic] = useState(initialBlock?.topic || "");
  const [notes, setNotes] = useState(initialBlock?.notes || "");
  const [timeMode, setTimeMode] = useState<TimeMode>(initialBlock?.timeMode || "range");
  const [startTime, setStartTime] = useState(initialBlock?.startTime || "08:00");
  const [endTime, setEndTime] = useState(initialBlock?.endTime || "09:30");
  const [subtasks, setSubtasks] = useState<RoutineSubtask[]>(initialBlock?.subtasks || []);
  const [newSubtaskText, setNewSubtaskText] = useState("");

  const handleAddSubtask = () => {
    const trimmed = newSubtaskText.trim();
    if (!trimmed) return;
    setSubtasks((prev) => [
      ...prev,
      { id: Date.now().toString(), text: trimmed, completed: false },
    ]);
    setNewSubtaskText("");
  };

  const handleRemoveSubtask = (id: string) => {
    setSubtasks((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let computedTitle = title.trim();
    if (!computedTitle) {
      if (type === "study") {
        computedTitle = subject.trim() ? `${subject.trim()} Session` : "Focus Study Block";
      } else {
        computedTitle = "Routine Task";
      }
    }

    const block: RoutineBlock = {
      id: initialBlock?.id || generateBlockId(),
      date: dateKey,
      type,
      title: computedTitle,
      timeMode,
      startTime: timeMode === "anytime" ? undefined : startTime,
      endTime: timeMode === "range" ? endTime : undefined,
      isCompleted: initialBlock?.isCompleted || false,
      subject: type === "study" ? subject.trim() : undefined,
      topic: type === "study" ? topic.trim() : undefined,
      notes: notes.trim() || undefined,
      subtasks: type === "study" ? subtasks : undefined,
      order: initialBlock?.order ?? Date.now(),
      createdAt: initialBlock?.createdAt || Date.now(),
    };

    onSave(block);
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      {/* Block Type Toggle (Study vs Normal) */}
      <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-muted/60 border border-white/5">
        <button
          type="button"
          onClick={() => setType("study")}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs transition-all ${
            type === "study"
              ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Study Block</span>
        </button>

        <button
          type="button"
          onClick={() => setType("normal")}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs transition-all ${
            type === "normal"
              ? "bg-zinc-800 text-foreground border border-white/10 shadow-md"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Coffee className="w-4 h-4" />
          <span>Normal Block</span>
        </button>
      </div>

      {/* Normal Block Fields */}
      {type === "normal" && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5 pl-1">
              Task / Activity Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Sleep, Breakfast, Free time, Workout"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary text-base font-bold transition-all"
            />
          </div>

          {/* Fast Suggestion Chips */}
          <div>
            <span className="text-[11px] font-bold text-muted-foreground block mb-1.5 pl-1">
              Quick suggestions:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {NORMAL_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setTitle(chip)}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-all ${
                    title === chip
                      ? "bg-white/20 border-white text-white"
                      : "bg-white/5 border-white/5 text-muted-foreground hover:text-foreground hover:bg-white/10"
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Study Block Fields */}
      {type === "study" && (
        <div className="space-y-3.5">
          {/* Subject Input */}
          <div>
            <label className="block text-xs font-bold text-violet-400 uppercase tracking-wide mb-1.5 pl-1">
              Subject *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Physics, Cardiology, Chemistry"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-violet-950/20 border border-violet-500/30 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-violet-500 text-base font-bold transition-all"
            />

            {/* Subject Quick Suggestions */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {SUBJECT_SUGGESTIONS.slice(0, 5).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSubject(s)}
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-md border transition-all ${
                    subject === s
                      ? "bg-violet-600 border-violet-500 text-white"
                      : "bg-white/5 border-white/5 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Topic Input */}
          <div>
            <label className="block text-xs font-bold text-violet-400 uppercase tracking-wide mb-1.5 pl-1">
              Topic *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Thermodynamics, Heart Failure, Organic Reactions"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-violet-950/20 border border-violet-500/30 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-violet-500 text-base font-bold transition-all"
            />
          </div>

          {/* Optional Custom Block Label / Headline */}
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5 pl-1">
              Session Label (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Morning High-Yield Focus Sprint"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground text-sm font-semibold focus:outline-none focus:border-primary transition-all"
            />
          </div>

          {/* Study Notes / Objectives */}
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5 pl-1">
              Notes & Key Concepts
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Review high-yield formulas, solve 20 questions, phone on DND"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-foreground placeholder:text-muted-foreground text-sm font-medium focus:outline-none focus:border-primary transition-all resize-none"
            />
          </div>

          {/* Checklist / Subtasks */}
          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase mb-1.5 pl-1">
              Subtasks / Checklist (Optional)
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                placeholder="Add target item (e.g. Solve 10 MCQs)"
                value={newSubtaskText}
                onChange={(e) => setNewSubtaskText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddSubtask();
                  }
                }}
                className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm font-medium text-foreground focus:outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={handleAddSubtask}
                className="px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs flex items-center gap-1 transition-colors"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>

            {subtasks.length > 0 && (
              <div className="space-y-1.5">
                {subtasks.map((st) => (
                  <div
                    key={st.id}
                    className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 text-xs text-foreground"
                  >
                    <span className="truncate">{st.text}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSubtask(st.id)}
                      className="text-muted-foreground hover:text-danger ml-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Time Configuration */}
      <div className="pt-2 border-t border-white/5 space-y-2.5">
        <label className="block text-xs font-bold text-muted-foreground uppercase pl-1">
          Timing
        </label>

        {/* Time Mode Toggle */}
        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-muted/60 border border-white/5">
          <button
            type="button"
            onClick={() => setTimeMode("range")}
            className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
              timeMode === "range"
                ? "bg-primary text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Time Range
          </button>

          <button
            type="button"
            onClick={() => setTimeMode("single")}
            className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
              timeMode === "single"
                ? "bg-primary text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Singular Time
          </button>

          <button
            type="button"
            onClick={() => setTimeMode("anytime")}
            className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
              timeMode === "anytime"
                ? "bg-primary text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Anytime
          </button>
        </div>

        {/* Inputs based on timeMode */}
        {timeMode !== "anytime" && (
          <div className="grid grid-cols-2 gap-3 items-center">
            <div>
              <span className="text-[11px] font-semibold text-muted-foreground block mb-1">
                {timeMode === "single" ? "At Time" : "From"}
              </span>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-foreground font-bold text-sm focus:outline-none focus:border-primary"
              />
              <span className="text-[10px] text-muted-foreground/80 mt-0.5 block pl-1">
                {formatTime12(startTime)}
              </span>
            </div>

            {timeMode === "range" && (
              <div>
                <span className="text-[11px] font-semibold text-muted-foreground block mb-1">
                  To
                </span>
                <input
                  type="time"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-foreground font-bold text-sm focus:outline-none focus:border-primary"
                />
                <span className="text-[10px] text-muted-foreground/80 mt-0.5 block pl-1">
                  {formatTime12(endTime)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Submit Button */}
      <div className="pt-3">
        <button
          type="submit"
          className="w-full py-3.5 px-4 rounded-2xl bg-primary hover:brightness-110 text-primary-foreground font-black text-base shadow-lg shadow-primary/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <Check className="w-5 h-5" />
          <span>{initialBlock ? "Save Changes" : "Add to Routine"}</span>
        </button>
      </div>
    </form>
  );
}

export function BlockEditorModal({
  isOpen,
  onClose,
  onSave,
  dateKey,
  initialBlock,
  initialType = "study",
}: BlockEditorModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-[2rem] sm:rounded-3xl bg-card border border-white/10 shadow-2xl p-6 animate-in fade-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200">
        {/* Mobile handle */}
        <div className="sm:hidden w-12 h-1.5 rounded-full bg-white/20 mx-auto -mt-1 mb-4" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/5">
          <h3 className="font-black text-xl text-foreground">
            {initialBlock ? "Edit Block" : "Add Block"}
          </h3>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl hover:bg-white/10 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <BlockEditorForm
          key={initialBlock ? initialBlock.id : `new_${initialType}`}
          onClose={onClose}
          onSave={onSave}
          dateKey={dateKey}
          initialBlock={initialBlock}
          initialType={initialType}
        />
      </div>
    </div>
  );
}
