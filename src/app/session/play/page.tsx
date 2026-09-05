"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DEFAULT_ECONOMY } from "@/lib/constants";
import { saveSessionData } from "@/app/actions/session";
import { isAnswerCorrect } from "@/lib/answerMatcher";
import {
  playAnswerSound,
  playSessionEndSound,
  playWrongSound,
  stashPendingLevelUp,
  useGameSounds,
} from "@/lib/gameSounds";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Coins,
  Zap,
  Timer,
  AlertCircle,
} from "lucide-react";

const SESSION_KEY = "current_mcq_session";
const PROGRESS_KEY = "mcq_session_progress";
const AUTO_NEXT_MS = 900;

type Question = {
  id: string;
  question: string;
  options: Record<string, string>;
  answer: string;
  subjectName?: string;
  topicName?: string;
};

type Attempt = {
  questionId: string;
  question: string;
  options: string;
  correctAnswer: string;
  selectedAnswer: string;
  isCorrect: boolean;
  pointsGained: number;
  pointsLost: number;
};

type SessionSettings = {
  xpPerCorrect: number;
  xpPerWrong: number;
  coinsPerCorrect: number;
  timerSeconds?: number;
};

type SavedProgress = {
  currentIndex: number;
  attempts: Attempt[];
  skippedIds: string[];
};

export default function PlaySessionPage() {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [isPractice, setIsPractice] = useState(false);
  const [settings, setSettings] = useState<SessionSettings>({
    xpPerCorrect: DEFAULT_ECONOMY.xpPerCorrect,
    xpPerWrong: DEFAULT_ECONOMY.xpPerWrong,
    coinsPerCorrect: DEFAULT_ECONOMY.coinsPerCorrect,
    timerSeconds: 0,
  });

  // Timer states
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isTimedOut, setIsTimedOut] = useState<boolean>(false);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const attemptsRef = useRef<Attempt[]>([]);
  const autoNextTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFinishingRef = useRef<boolean>(false);
  const sessionTokenRef = useRef<string>("");

  useGameSounds();

  useEffect(() => {
    attemptsRef.current = attempts;
  }, [attempts]);

  const clearTimers = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (autoNextTimer.current) {
      clearTimeout(autoNextTimer.current);
      autoNextTimer.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  const [subjectInfo, setSubjectInfo] = useState<{
    subjectName?: string;
    topicName?: string;
    subjectId?: string;
    topicId?: string;
  }>({});

  useEffect(() => {
    const data = sessionStorage.getItem(SESSION_KEY);
    if (!data) {
      router.replace("/session/new");
      return;
    }
    try {
      const parsed = JSON.parse(data);
      const qs: Question[] = parsed.questions;
      setQuestions(qs);
      setIsPractice(!!parsed.isPractice);
      sessionTokenRef.current =
        parsed.clientSessionToken ||
        `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      setSubjectInfo({
        subjectName: parsed.subjectName || parsed.settings?.subjectName || qs[0]?.subjectName,
        topicName: parsed.topicName || parsed.settings?.topicName || qs[0]?.topicName,
        subjectId: parsed.subjectId || parsed.settings?.subjectId,
        topicId: parsed.topicId || parsed.settings?.topicId,
      });
      if (parsed.settings) {
        setSettings({
          xpPerCorrect: parsed.settings.xpPerCorrect ?? DEFAULT_ECONOMY.xpPerCorrect,
          xpPerWrong: parsed.settings.xpPerWrong ?? DEFAULT_ECONOMY.xpPerWrong,
          coinsPerCorrect: parsed.settings.coinsPerCorrect ?? DEFAULT_ECONOMY.coinsPerCorrect,
          timerSeconds: parsed.settings.timerSeconds ?? 0,
        });
      }

      const progressRaw = sessionStorage.getItem(PROGRESS_KEY);
      if (progressRaw) {
        const progress: SavedProgress = JSON.parse(progressRaw);
        const validIndex = Math.min(Math.max(0, progress.currentIndex), qs.length - 1);
        setCurrentIndex(validIndex);
        setAttempts(progress.attempts || []);
        setSkippedIds(new Set(progress.skippedIds || []));
      }
      setLoaded(true);
    } catch {
      router.replace("/session/new");
    }
  }, [router]);

  const saveProgress = useCallback(
    (index: number, att: Attempt[], skipped: Set<string>) => {
      if (questions.length === 0) return;
      sessionStorage.setItem(
        PROGRESS_KEY,
        JSON.stringify({
          currentIndex: index,
          attempts: att,
          skippedIds: Array.from(skipped),
        })
      );
    },
    [questions.length]
  );

  useEffect(() => {
    if (!loaded || questions.length === 0) return;
    saveProgress(currentIndex, attempts, skippedIds);
  }, [loaded, currentIndex, attempts, skippedIds, questions.length, saveProgress]);

  const currentQuestion = questions[currentIndex];
  const hasAnswered = selectedOption !== null || attempts[currentIndex] !== undefined || isTimedOut;

  const finishSession = async (finalAttempts: Attempt[]) => {
    if (isFinishingRef.current) return;
    isFinishingRef.current = true;
    clearTimers();
    setIsSaving(true);

    const correctAnswers = finalAttempts.filter((a) => a.isCorrect).length;
    const wrongAnswers = finalAttempts.filter((a) => !a.isCorrect).length;
    const positivePoints = isPractice ? 0 : correctAnswers * settings.xpPerCorrect;
    const negativePoints = isPractice ? 0 : wrongAnswers * settings.xpPerWrong;
    const netPoints = positivePoints - negativePoints;

    try {
      const res = await saveSessionData({
        clientSessionToken: sessionTokenRef.current,
        totalQuestions: questions.length,
        correctAnswers,
        wrongAnswers,
        positivePoints,
        negativePoints,
        netPoints,
        isPractice,
        subjectName: subjectInfo.subjectName,
        topicName: subjectInfo.topicName,
        subjectId: subjectInfo.subjectId,
        topicId: subjectInfo.topicId,
        attempts: finalAttempts,
      });

      if ("sessionId" in res && res.sessionId) {
        sessionStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem(PROGRESS_KEY);
        if (res.toLevel && res.fromLevel && res.toLevel > res.fromLevel) {
          stashPendingLevelUp({
            fromLevel: res.fromLevel,
            toLevel: res.toLevel,
            title: res.title ?? "",
          });
        }
        playSessionEndSound();
        router.push(`/session/result/${res.sessionId}`);
      } else {
        alert(("error" in res && res.error) || "Failed to save session.");
        isFinishingRef.current = false;
        setIsSaving(false);
        setShowFinishConfirm(false);
      }
    } catch {
      alert("An unexpected error occurred while saving your session.");
      isFinishingRef.current = false;
      setIsSaving(false);
      setShowFinishConfirm(false);
    }
  };

  const tryComplete = (finalAttempts: Attempt[]) => {
    if (isFinishingRef.current) return;
    const skipped = questions.length - finalAttempts.length;
    if (skipped > 0) {
      setShowFinishConfirm(true);
      return;
    }
    finishSession(finalAttempts);
  };

  const goNextOrFinish = useCallback((nextAttempts: Attempt[]) => {
    if (currentIndex < questions.length - 1) {
      setSelectedOption(null);
      setIsTimedOut(false);
      setCurrentIndex((prev) => prev + 1);
    } else {
      tryComplete(nextAttempts);
    }
  }, [currentIndex, questions.length]);

  // Handle timeout expiration on the current question
  const handleTimeExpired = useCallback(() => {
    if (isSaving || isFinishingRef.current || hasAnswered) return;
    setIsTimedOut(true);
    playWrongSound();

    const newAttempt: Attempt = {
      questionId: currentQuestion.id,
      question: currentQuestion.question,
      options: JSON.stringify(currentQuestion.options),
      correctAnswer: currentQuestion.answer,
      selectedAnswer: "__TIMED_OUT__",
      isCorrect: false,
      pointsGained: 0,
      pointsLost: isPractice ? 0 : settings.xpPerWrong,
    };

    const nextAttempts = [...attemptsRef.current, newAttempt];
    setAttempts(nextAttempts);

    if (autoNextTimer.current) clearTimeout(autoNextTimer.current);
    autoNextTimer.current = setTimeout(() => {
      goNextOrFinish(nextAttempts);
    }, AUTO_NEXT_MS);
  }, [currentQuestion, hasAnswered, isPractice, isSaving, settings.xpPerWrong, goNextOrFinish]);

  // Start / stop timer whenever question or answered state changes
  useEffect(() => {
    if (!loaded || questions.length === 0 || !currentQuestion) return;

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    const currentAttempt = attempts[currentIndex];
    if (currentAttempt) {
      // Question was already answered (read-only mode)
      setSelectedOption(currentAttempt.selectedAnswer);
      setIsTimedOut(currentAttempt.selectedAnswer === "__TIMED_OUT__");
      setTimeLeft(0);
      return;
    }

    setSelectedOption(null);
    setIsTimedOut(false);

    if (settings.timerSeconds && settings.timerSeconds > 0) {
      setTimeLeft(settings.timerSeconds);
      const startTime = Date.now();
      const totalMs = settings.timerSeconds * 1000;

      timerIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, Math.ceil((totalMs - elapsed) / 1000));
        setTimeLeft(remaining);

        if (remaining <= 0) {
          if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
          }
          handleTimeExpired();
        }
      }, 250);
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [loaded, currentIndex, questions.length, settings.timerSeconds, attempts, handleTimeExpired]);

  const handleBack = () => {
    if (isSaving || isFinishingRef.current) return;
    clearTimers();
    if (currentIndex === 0) return;
    const prevIndex = currentIndex - 1;
    setCurrentIndex(prevIndex);
    const prevAttempt = attempts[prevIndex];
    setSelectedOption(prevAttempt ? prevAttempt.selectedAnswer : null);
    setIsTimedOut(prevAttempt?.selectedAnswer === "__TIMED_OUT__");
  };

  const handleForward = () => {
    if (isSaving || isFinishingRef.current) return;
    clearTimers();
    if (currentIndex < questions.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      const nextAttempt = attempts[nextIndex];
      setSelectedOption(nextAttempt ? nextAttempt.selectedAnswer : null);
      setIsTimedOut(nextAttempt?.selectedAnswer === "__TIMED_OUT__");
    } else {
      tryComplete(attempts);
    }
  };

  const handleOptionSelect = (key: string) => {
    if (hasAnswered || isSaving || isFinishingRef.current) return;
    clearTimers();

    setSelectedOption(key);

    const isCorrect = isAnswerCorrect(key, currentQuestion.answer, currentQuestion.options);
    playAnswerSound(isCorrect);
    const newAttempt: Attempt = {
      questionId: currentQuestion.id,
      question: currentQuestion.question,
      options: JSON.stringify(currentQuestion.options),
      correctAnswer: currentQuestion.answer,
      selectedAnswer: key,
      isCorrect,
      pointsGained: isPractice ? 0 : isCorrect ? settings.xpPerCorrect : 0,
      pointsLost: isPractice ? 0 : !isCorrect ? settings.xpPerWrong : 0,
    };

    const nextAttempts = [...attemptsRef.current, newAttempt];
    setAttempts(nextAttempts);

    if (autoNextTimer.current) clearTimeout(autoNextTimer.current);
    autoNextTimer.current = setTimeout(() => {
      goNextOrFinish(nextAttempts);
    }, AUTO_NEXT_MS);
  };

  const handleSkip = () => {
    if (hasAnswered || isSaving || isFinishingRef.current) return;
    clearTimers();
    const nextSkipped = new Set(skippedIds);
    nextSkipped.add(currentQuestion.id);
    setSkippedIds(nextSkipped);
    goNextOrFinish(attempts);
  };

  if (!loaded || questions.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center font-bold">
        Loading session...
      </div>
    );
  }

  const isCorrectCurrent = selectedOption === currentQuestion.answer;
  const skippedTotal = questions.length - attempts.length;
  const progressPct = ((currentIndex + (hasAnswered ? 1 : 0)) / questions.length) * 100;
  const timerEnabled = (settings.timerSeconds ?? 0) > 0;

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4 md:p-8 flex items-center justify-center">
      <Card className="w-full max-w-3xl p-4 sm:p-6 md:p-8 relative overflow-hidden">
        {/* Top Progress Bar */}
        <div className="absolute top-0 left-0 h-1.5 bg-primary/25 w-full">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Top Controls: Back/Forward, Timer, Question Counter, Score */}
        <div className="flex items-center justify-between mt-2 mb-4 gap-2">
          {/* Navigation Arrows */}
          <div className="flex items-center gap-1">
            {currentIndex > 0 && (
              <button
                onClick={handleBack}
                disabled={isSaving}
                className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-muted transition-colors active:scale-95 text-muted-foreground hover:text-foreground disabled:opacity-50"
                aria-label="Previous question"
                title="Previous question"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            {currentIndex < questions.length - 1 && hasAnswered && (
              <button
                onClick={handleForward}
                disabled={isSaving}
                className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-muted transition-colors active:scale-95 text-muted-foreground hover:text-foreground disabled:opacity-50"
                aria-label="Next question"
                title="Next question"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Middle: Question Counter & Timer */}
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-bold text-muted-foreground uppercase tracking-wider">
              {currentIndex + 1} / {questions.length}
            </span>
            {isPractice && (
              <span className="text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-lg font-bold">
                Practice
              </span>
            )}
            {timerEnabled && (
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-black transition-colors ${
                  isTimedOut
                    ? "bg-danger text-white animate-pulse shadow-lg shadow-danger/20"
                    : timeLeft <= 3 && !hasAnswered
                    ? "bg-danger/15 text-danger animate-pulse"
                    : "bg-amber-500/15 text-amber-500"
                }`}
              >
                <Timer className="w-4 h-4" />
                <span className="text-sm">{isTimedOut ? "Time's Up!" : `${timeLeft}s`}</span>
              </div>
            )}
          </div>

          {/* Right Status Badge */}
          {hasAnswered ? (
            <div className="flex items-center gap-1.5">
              {isTimedOut ? (
                <div className="bg-danger/20 text-danger px-2.5 py-1 rounded-xl font-bold text-xs flex items-center border border-danger/30">
                  <AlertCircle className="w-3.5 h-3.5 mr-1" /> Time Out
                </div>
              ) : isPractice ? (
                <div
                  className={`px-2.5 py-1 rounded-xl font-bold text-xs border ${
                    isCorrectCurrent
                      ? "bg-success/20 text-success border-success/30"
                      : "bg-danger/20 text-danger border-danger/30"
                  }`}
                >
                  {isCorrectCurrent ? "Correct" : "Wrong"}
                </div>
              ) : isCorrectCurrent ? (
                <>
                  <div className="bg-success/20 text-success px-2 py-1 rounded-xl font-bold text-xs flex items-center border border-success/30">
                    <Zap className="w-3 h-3 mr-1" /> +{settings.xpPerCorrect}
                  </div>
                  <div className="bg-amber-500/20 text-amber-500 px-2 py-1 rounded-xl font-bold text-xs flex items-center border border-amber-500/30">
                    <Coins className="w-3 h-3 mr-1" /> +{settings.coinsPerCorrect}
                  </div>
                </>
              ) : (
                <div className="bg-danger/20 text-danger px-2 py-1 rounded-xl font-bold text-xs flex items-center border border-danger/30">
                  <Zap className="w-3 h-3 mr-1" /> -{settings.xpPerWrong}
                </div>
              )}
            </div>
          ) : (
            <div className="w-12" />
          )}
        </div>

        {/* Gamified Timer Bar */}
        {timerEnabled && !hasAnswered && !isTimedOut && (
          <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden mb-5 border border-border/50 shadow-inner">
            <div
              className={`h-full transition-all duration-250 ease-linear rounded-full ${
                timeLeft <= 3 ? "bg-danger shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-pulse" : "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.6)]"
              }`}
              style={{ width: `${(timeLeft / (settings.timerSeconds || 1)) * 100}%` }}
            />
          </div>
        )}

        {/* Question Text */}
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold mb-5 leading-snug">
          {currentQuestion.question}
        </h2>

        {/* Options */}
        <div className="space-y-2.5">
          {Object.entries(currentQuestion.options).map(([key, value]) => {
            const isSelected = selectedOption === key;
            const isCorrectAnswer = key === currentQuestion.answer;

            let buttonStyle = "border-border hover:border-primary/50 bg-background/50";
            let Icon = null;

            if (hasAnswered) {
              if (isCorrectAnswer) {
                buttonStyle =
                  "border-success bg-success/15 text-success-foreground shadow-sm shadow-success/20 font-semibold";
                Icon = <CheckCircle2 className="w-5 h-5 text-success shrink-0" />;
              } else if (isSelected && !isCorrectAnswer) {
                buttonStyle =
                  "border-danger bg-danger/15 text-danger-foreground shadow-sm shadow-danger/20 font-semibold";
                Icon = <XCircle className="w-5 h-5 text-danger shrink-0" />;
              } else {
                buttonStyle = "border-border opacity-50 bg-background/20";
              }
            }

            return (
              <button
                key={key}
                onClick={() => handleOptionSelect(key)}
                data-sfx="none"
                disabled={hasAnswered || isSaving}
                className={`w-full text-left p-3.5 sm:p-4 rounded-xl border-2 transition-all duration-150 flex justify-between items-center gap-3 ${buttonStyle}`}
              >
                <div className="flex items-center min-w-0">
                  <span className="font-black text-sm sm:text-base mr-3 opacity-75 w-5 shrink-0">
                    {key}.
                  </span>
                  <span className="text-sm sm:text-base leading-snug">{value}</span>
                </div>
                {Icon}
              </button>
            );
          })}
        </div>

        {/* Bottom Actions */}
        <div className="mt-7 flex justify-between items-center">
          {!hasAnswered ? (
            <Button
              size="lg"
              variant="outline"
              onClick={handleSkip}
              disabled={isSaving}
              className="px-6 h-11 text-sm rounded-xl font-bold"
            >
              Skip
            </Button>
          ) : (
            <div />
          )}

          {hasAnswered && (
            <Button
              size="lg"
              onClick={handleForward}
              disabled={isSaving}
              isLoading={isSaving}
              className="px-6 h-11 text-sm rounded-xl font-bold gap-2"
            >
              {currentIndex < questions.length - 1 ? (
                <>
                  Next <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                "Finish Session"
              )}
            </Button>
          )}
        </div>
      </Card>

      {/* Skip Confirmation Modal */}
      {showFinishConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <Card className="relative w-full max-w-md p-6 rounded-2xl text-center">
            <h2 className="text-xl font-bold mb-2">Finish session?</h2>
            <p className="text-muted-foreground mb-6 text-sm">
              You skipped {skippedTotal} question{skippedTotal !== 1 ? "s" : ""}.
              {!isPractice && " Skipped questions won't affect XP."}
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 rounded-xl h-11 font-bold"
                onClick={() => setShowFinishConfirm(false)}
                disabled={isSaving}
              >
                Go Back
              </Button>
              <Button
                className="flex-1 rounded-xl h-11 font-bold"
                onClick={() => finishSession(attempts)}
                isLoading={isSaving}
                disabled={isSaving}
              >
                Finish
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Full-screen Loading Overlay during saving */}
      {isSaving && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70 backdrop-blur-md text-white p-4 text-center select-none animate-in fade-in duration-200">
          <div className="w-14 h-14 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
          <h2 className="text-xl sm:text-2xl font-black mb-1">Completing Session...</h2>
          <p className="text-muted-foreground text-sm">Calculating rewards and stats instantly</p>
        </div>
      )}
    </div>
  );
}
