"use client";

import { RoutineBlock } from "./routineTypes";

const STORAGE_KEY = "mcq_arena_routine_blocks_v1";
const AI_PERMANENT_NOTES_KEY = "mcq_routine_ai_permanent_notes_v1";

export const DEFAULT_PERMANENT_NOTES = `Coaching: Monday, Wednesday, and Friday from 2:30 PM to 5:00 PM
School / Classes: 8:00 AM to 1:30 PM on weekdays
Target: Preparing for upcoming exams, maximize MCQ practice and high-yield topics
Sleep: Aim for 11:00 PM to stay energized`;

export function getAiPermanentNotes(): string {
  if (typeof window === "undefined") return DEFAULT_PERMANENT_NOTES;
  try {
    const raw = localStorage.getItem(AI_PERMANENT_NOTES_KEY);
    return raw !== null ? raw : DEFAULT_PERMANENT_NOTES;
  } catch {
    return DEFAULT_PERMANENT_NOTES;
  }
}

export function setAiPermanentNotes(notes: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(AI_PERMANENT_NOTES_KEY, notes);
  } catch (e) {
    console.error("Failed to save AI permanent notes:", e);
  }
}

/**
 * Format a Date object to YYYY-MM-DD string
 */
export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Format 24h time ("07:00") into 12-hour format ("7:00 AM")
 */
export function formatTime12(time24?: string): string {
  if (!time24) return "";
  const [hStr, mStr] = time24.split(":");
  let hour = parseInt(hStr, 10);
  const min = mStr || "00";
  if (isNaN(hour)) return time24;
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${min} ${ampm}`;
}

/**
 * Display string for a block's time based on its timeMode
 */
export function formatBlockTimeDisplay(block: RoutineBlock): string {
  if (block.timeMode === "anytime" || !block.startTime) {
    return "Anytime";
  }
  const start = formatTime12(block.startTime);
  if (block.timeMode === "single" || !block.endTime) {
    return start;
  }
  const end = formatTime12(block.endTime);
  return `${start} – ${end}`;
}

/**
 * Get human readable date (e.g. "Today, Monday, Nov 9")
 */
export function formatHumanDate(dateKey: string): { dayName: string; formattedDate: string; isToday: boolean } {
  const [y, m, d] = dateKey.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  const now = new Date();
  const isToday = formatDateKey(now) === dateKey;

  const dayName = target.toLocaleDateString("en-US", { weekday: "long" });
  const formattedDate = target.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return { dayName, formattedDate, isToday };
}

let cachedRawBlocks: string | null = "__init__";
let cachedBlocksSnapshot: RoutineBlock[] = [];

/**
 * Read all blocks from local storage (reference-cached)
 */
export function getAllBlocks(): RoutineBlock[] {
  if (typeof window === "undefined") return cachedBlocksSnapshot;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      if (cachedRawBlocks !== null) {
        cachedRawBlocks = null;
        cachedBlocksSnapshot = [];
      }
      return cachedBlocksSnapshot;
    }
    if (raw === cachedRawBlocks) {
      return cachedBlocksSnapshot;
    }
    cachedRawBlocks = raw;
    cachedBlocksSnapshot = JSON.parse(raw);
    return cachedBlocksSnapshot;
  } catch (e) {
    console.error("Failed to parse routine blocks from localStorage:", e);
    return cachedBlocksSnapshot;
  }
}

/**
 * Save all blocks to local storage and trigger event
 */
function saveAllBlocks(blocks: RoutineBlock[]) {
  if (typeof window === "undefined") return;
  try {
    const raw = JSON.stringify(blocks);
    cachedRawBlocks = raw;
    cachedBlocksSnapshot = [...blocks];
    localStorage.setItem(STORAGE_KEY, raw);
    window.dispatchEvent(new CustomEvent("routine-blocks-updated"));
  } catch (e) {
    console.error("Failed to save routine blocks to localStorage:", e);
  }
}

/**
 * Subscribe to routine updates (custom event + storage event)
 */
export function subscribeToRoutine(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("routine-blocks-updated", callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener("routine-blocks-updated", callback);
    window.removeEventListener("storage", callback);
  };
}

/**
 * Get blocks for a specific date (YYYY-MM-DD), sorted chronologically
 */
export function getBlocksForDate(dateKey: string): RoutineBlock[] {
  const all = getAllBlocks();
  const filtered = all.filter((b) => b.date === dateKey);

  return filtered.sort((a, b) => {
    // If one has time and the other doesn't, timed comes first
    if (a.startTime && !b.startTime) return -1;
    if (!a.startTime && b.startTime) return 1;
    if (a.startTime && b.startTime) {
      if (a.startTime !== b.startTime) {
        return a.startTime.localeCompare(b.startTime);
      }
    }
    return a.order - b.order;
  });
}

/**
 * Get map of all dates that have blocks (for calendar dots)
 */
export function getCalendarDateMap(): Record<string, { total: number; completed: number; hasStudy: boolean; hasNormal: boolean }> {
  const all = getAllBlocks();
  const map: Record<string, { total: number; completed: number; hasStudy: boolean; hasNormal: boolean }> = {};

  for (const block of all) {
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
}

/**
 * Save or update a single block
 */
export function upsertBlock(block: RoutineBlock): void {
  const all = [...getAllBlocks()];
  const existingIdx = all.findIndex((b) => b.id === block.id);
  if (existingIdx >= 0) {
    all[existingIdx] = block;
  } else {
    all.push(block);
  }
  saveAllBlocks(all);
}

/**
 * Toggle completion of a block
 */
export function toggleBlockCompletion(id: string): boolean {
  const all = [...getAllBlocks()];
  const idx = all.findIndex((b) => b.id === id);
  if (idx < 0) return false;
  const current = all[idx];
  const updated = { ...current, isCompleted: !current.isCompleted };
  all[idx] = updated;
  saveAllBlocks(all);
  return updated.isCompleted;
}

/**
 * Toggle a subtask inside a study block
 */
export function toggleSubtask(blockId: string, subtaskId: string): void {
  const all = [...getAllBlocks()];
  const idx = all.findIndex((b) => b.id === blockId);
  if (idx < 0) return;
  const block = all[idx];
  if (!block.subtasks) return;
  const newSubtasks = block.subtasks.map((s) =>
    s.id === subtaskId ? { ...s, completed: !s.completed } : s
  );
  all[idx] = { ...block, subtasks: newSubtasks };
  saveAllBlocks(all);
}

/**
 * Delete a block
 */
export function deleteBlock(id: string): void {
  const all = getAllBlocks();
  const updated = all.filter((b) => b.id !== id);
  saveAllBlocks(updated);
}

/**
 * Clear all blocks for a given date
 */
export function clearBlocksForDate(dateKey: string): void {
  const all = getAllBlocks();
  const updated = all.filter((b) => b.date !== dateKey);
  saveAllBlocks(updated);
}

/**
 * Clear only completed blocks for a date
 */
export function clearCompletedForDate(dateKey: string): void {
  const all = getAllBlocks();
  const updated = all.filter((b) => !(b.date === dateKey && b.isCompleted));
  saveAllBlocks(updated);
}

/**
 * Generate a clean unique ID
 */
export function generateBlockId(): string {
  return "blk_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 7);
}

/**
 * Apply a preset routine for exam prep or daily schedule
 */
export function applyRoutinePreset(dateKey: string, presetName: "exam_day" | "daily_balanced" | "weekend_sprint"): RoutineBlock[] {
  let newBlocks: Partial<RoutineBlock>[] = [];

  if (presetName === "exam_day") {
    newBlocks = [
      {
        type: "normal",
        title: "Wake up & Morning Refresh",
        timeMode: "single",
        startTime: "06:30",
        isCompleted: false,
      },
      {
        type: "normal",
        title: "High-Protein Breakfast",
        timeMode: "range",
        startTime: "07:00",
        endTime: "07:30",
        isCompleted: false,
      },
      {
        type: "study",
        title: "High-Yield Morning Study",
        subject: "Physics",
        topic: "Core Formula Review & Mechanics",
        timeMode: "range",
        startTime: "08:00",
        endTime: "10:30",
        notes: "Target top 30 frequently tested MCQ concepts",
        subtasks: [
          { id: "1", text: "Kinematics equations recap", completed: false },
          { id: "2", text: "Solve 25 practice questions", completed: false },
          { id: "3", text: "Review mistake notebook", completed: false },
        ],
        isCompleted: false,
      },
      {
        type: "normal",
        title: "Walk & Brain Rest",
        timeMode: "range",
        startTime: "10:30",
        endTime: "11:00",
        isCompleted: false,
      },
      {
        type: "study",
        title: "Mid-Day Focus Block",
        subject: "Chemistry",
        topic: "Organic Reaction Mechanisms",
        timeMode: "range",
        startTime: "11:00",
        endTime: "13:00",
        notes: "Deep focus: no social media, phone on DND",
        subtasks: [
          { id: "1", text: "Named reactions flashcards", completed: false },
          { id: "2", text: "Timed 20-min MCQ quiz", completed: false },
        ],
        isCompleted: false,
      },
      {
        type: "normal",
        title: "Lunch & Power Nap",
        timeMode: "range",
        startTime: "13:00",
        endTime: "14:15",
        isCompleted: false,
      },
      {
        type: "study",
        title: "Evening MCQ Arena Sprint",
        subject: "Biology",
        topic: "Genetics & Cell Biology",
        timeMode: "range",
        startTime: "16:00",
        endTime: "18:00",
        notes: "Score above 85% accuracy in Arena practice",
        subtasks: [
          { id: "1", text: "Pedigree analysis problems", completed: false },
          { id: "2", text: "Complete 2 ranked sessions", completed: false },
        ],
        isCompleted: false,
      },
      {
        type: "normal",
        title: "Free Time & Dinner",
        timeMode: "range",
        startTime: "19:00",
        endTime: "20:30",
        isCompleted: false,
      },
      {
        type: "normal",
        title: "Sleep & Recovery",
        timeMode: "single",
        startTime: "23:00",
        isCompleted: false,
      },
    ];
  } else if (presetName === "daily_balanced") {
    newBlocks = [
      {
        type: "normal",
        title: "Wake up & Water",
        timeMode: "single",
        startTime: "07:00",
        isCompleted: false,
      },
      {
        type: "normal",
        title: "Healthy Breakfast",
        timeMode: "range",
        startTime: "07:30",
        endTime: "08:00",
        isCompleted: false,
      },
      {
        type: "study",
        title: "Study Block 1",
        subject: "Main Subject",
        topic: "Chapter 1 Deep Dive",
        timeMode: "range",
        startTime: "08:30",
        endTime: "11:00",
        notes: "Focus session",
        subtasks: [
          { id: "1", text: "Read notes", completed: false },
          { id: "2", text: "Practice 15 questions", completed: false },
        ],
        isCompleted: false,
      },
      {
        type: "normal",
        title: "Lunch & Break",
        timeMode: "range",
        startTime: "12:30",
        endTime: "13:30",
        isCompleted: false,
      },
      {
        type: "normal",
        title: "Free Time / Workout",
        timeMode: "range",
        startTime: "17:00",
        endTime: "18:30",
        isCompleted: false,
      },
      {
        type: "normal",
        title: "Sleep",
        timeMode: "single",
        startTime: "23:00",
        isCompleted: false,
      },
    ];
  }

  const existing = getAllBlocks().filter((b) => b.date !== dateKey);
  const instantiated: RoutineBlock[] = newBlocks.map((b, idx) => ({
    id: generateBlockId(),
    date: dateKey,
    type: b.type || "normal",
    title: b.title || "Routine Block",
    timeMode: b.timeMode || "single",
    startTime: b.startTime,
    endTime: b.endTime,
    isCompleted: false,
    subject: b.subject,
    topic: b.topic,
    notes: b.notes,
    subtasks: b.subtasks || [],
    order: idx,
    createdAt: Date.now() + idx,
  }));

  saveAllBlocks([...existing, ...instantiated]);
  return instantiated;
}

