export type BlockType = "study" | "normal";
export type TimeMode = "single" | "range" | "anytime";

export interface RoutineSubtask {
  id: string;
  text: string;
  completed: boolean;
}

export interface RoutineBlock {
  id: string;
  date: string; // YYYY-MM-DD
  type: BlockType;
  title: string;
  timeMode: TimeMode;
  startTime?: string; // e.g. "07:00" (24h format for sorting)
  endTime?: string;   // e.g. "08:30"
  isCompleted: boolean;
  
  // Study block specific fields
  subject?: string;
  topic?: string;
  notes?: string;
  subtasks?: RoutineSubtask[];

  // Meta
  order: number;
  createdAt: number;
}

export interface DaySummary {
  total: number;
  completed: number;
  studyCount: number;
  normalCount: number;
}

export interface RoutinePresetBlock {
  type: BlockType;
  title: string;
  timeMode: TimeMode;
  startTime?: string;
  endTime?: string;
  subject?: string;
  topic?: string;
  notes?: string;
  subtasks?: string[];
}

export interface RoutinePreset {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  blocks: RoutinePresetBlock[];
  isCustom?: boolean;
}

