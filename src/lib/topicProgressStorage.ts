"use client";

export interface TopicMastery {
  subjectName: string;
  topicName: string;
  percentage: number; // 0 to 100
  isCompleted: boolean;
  updatedAt: number;
}

const STORAGE_KEY = "mcq_topic_mastery_v1";

export function getMasteryKey(subjectName: string, topicName: string): string {
  return `${subjectName.trim().toLowerCase()}:::${topicName.trim().toLowerCase()}`;
}

let cachedRawMastery: string | null = "__init__";
let cachedMasterySnapshot: Record<string, TopicMastery> = {};

export function getAllTopicMastery(): Record<string, TopicMastery> {
  if (typeof window === "undefined") return cachedMasterySnapshot;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      if (cachedRawMastery !== null) {
        cachedRawMastery = null;
        cachedMasterySnapshot = {};
      }
      return cachedMasterySnapshot;
    }
    if (raw === cachedRawMastery) {
      return cachedMasterySnapshot;
    }
    cachedRawMastery = raw;
    cachedMasterySnapshot = JSON.parse(raw);
    return cachedMasterySnapshot;
  } catch (e) {
    console.error("Failed to parse topic mastery from localStorage:", e);
    return cachedMasterySnapshot;
  }
}

function saveAllTopicMastery(records: Record<string, TopicMastery>) {
  if (typeof window === "undefined") return;
  try {
    const raw = JSON.stringify(records);
    cachedRawMastery = raw;
    cachedMasterySnapshot = { ...records };
    localStorage.setItem(STORAGE_KEY, raw);
    window.dispatchEvent(new CustomEvent("topic-mastery-updated"));
  } catch (e) {
    console.error("Failed to save topic mastery to localStorage:", e);
  }
}

export function subscribeToTopicMastery(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("topic-mastery-updated", callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener("topic-mastery-updated", callback);
    window.removeEventListener("storage", callback);
  };
}

export function getTopicMastery(
  subjectName: string,
  topicName: string
): TopicMastery {
  const all = getAllTopicMastery();
  const key = getMasteryKey(subjectName, topicName);
  return (
    all[key] || {
      subjectName,
      topicName,
      percentage: 0,
      isCompleted: false,
      updatedAt: 0,
    }
  );
}

export function setTopicMastery(
  subjectName: string,
  topicName: string,
  percentage: number
): TopicMastery {
  const clamped = Math.max(0, Math.min(100, Math.round(percentage)));
  const all = { ...getAllTopicMastery() };
  const key = getMasteryKey(subjectName, topicName);

  const updated: TopicMastery = {
    subjectName: subjectName.trim(),
    topicName: topicName.trim(),
    percentage: clamped,
    isCompleted: clamped >= 100,
    updatedAt: Date.now(),
  };

  all[key] = updated;
  saveAllTopicMastery(all);
  return updated;
}

