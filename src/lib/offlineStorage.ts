export type OfflineSessionPayload = {
  clientSessionToken: string;
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  positivePoints: number;
  negativePoints: number;
  netPoints: number;
  isPractice?: boolean;
  subjectName?: string;
  topicName?: string;
  subjectId?: string;
  topicId?: string;
  attempts: Array<{
    questionId: string;
    question: string;
    options: string;
    correctAnswer: string;
    selectedAnswer: string;
    isCorrect: boolean;
    pointsGained: number;
    pointsLost: number;
  }>;
  createdAt: number;
};

export type CachedQuestion = {
  id: string;
  question: string;
  options: Record<string, string>;
  answer: string;
  subjectName?: string;
  topicName?: string;
  subjectId?: string;
  topicId?: string;
};

const LS_PENDING_KEY = "mcq_offline_pending_sessions_v1";
const LS_QUESTIONS_KEY = "mcq_offline_cached_questions_v1";

/**
 * Get all pending offline sessions queued in local storage
 */
export function getPendingSessions(): OfflineSessionPayload[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_PENDING_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Save / Enqueue a completed session for background syncing
 */
export function enqueueOfflineSession(payload: OfflineSessionPayload): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getPendingSessions();
    // Prevent duplicate entries for same token
    const filtered = existing.filter((s) => s.clientSessionToken !== payload.clientSessionToken);
    filtered.push(payload);
    localStorage.setItem(LS_PENDING_KEY, JSON.stringify(filtered));
    window.dispatchEvent(new CustomEvent("mcq:offline-session-queued", { detail: payload }));
  } catch (err) {
    console.error("Failed to enqueue offline session:", err);
  }
}

/**
 * Remove a successfully synced session by its token
 */
export function removePendingSession(token: string): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getPendingSessions();
    const updated = existing.filter((s) => s.clientSessionToken !== token);
    localStorage.setItem(LS_PENDING_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("mcq:offline-session-synced", { detail: { token } }));
  } catch (err) {
    console.error("Failed to remove pending session:", err);
  }
}

/**
 * Cache questions pool for offline practice
 */
export function cachePracticeQuestions(questions: CachedQuestion[]): void {
  if (typeof window === "undefined" || !Array.isArray(questions) || questions.length === 0) return;
  try {
    const existing = getCachedPracticeQuestions();
    const map = new Map<string, CachedQuestion>();
    for (const q of existing) map.set(q.id, q);
    for (const q of questions) {
      if (q && q.id && q.question) map.set(q.id, q);
    }
    // Keep max 200 questions to respect storage
    const trimmed = Array.from(map.values()).slice(0, 200);
    localStorage.setItem(LS_QUESTIONS_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.warn("Failed to cache practice questions:", err);
  }
}

/**
 * Retrieve cached questions for offline practice
 */
export function getCachedPracticeQuestions(): CachedQuestion[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_QUESTIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
