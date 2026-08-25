"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DEFAULT_ECONOMY } from "@/lib/constants";
import { saveSessionData } from "@/app/actions/session";
import { ArrowLeft, ArrowRight, CheckCircle2, XCircle, Coins, Zap } from "lucide-react";

const SESSION_KEY = "current_mcq_session";
const PROGRESS_KEY = "mcq_session_progress";
const AUTO_NEXT_MS = 900;

type Question = {
  id: string;
  question: string;
  options: Record<string, string>;
  answer: string;
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
  });
  const attemptsRef = useRef<Attempt[]>([]);
  const autoNextTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    attemptsRef.current = attempts;
  }, [attempts]);

  useEffect(() => {
    return () => {
      if (autoNextTimer.current) clearTimeout(autoNextTimer.current);
    };
  }, []);

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
      if (parsed.settings) {
        setSettings({
          xpPerCorrect: parsed.settings.xpPerCorrect ?? DEFAULT_ECONOMY.xpPerCorrect,
          xpPerWrong: parsed.settings.xpPerWrong ?? DEFAULT_ECONOMY.xpPerWrong,
          coinsPerCorrect: parsed.settings.coinsPerCorrect ?? DEFAULT_ECONOMY.coinsPerCorrect,
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

  if (!loaded || questions.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        Loading session...
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const hasAnswered = selectedOption !== null || attempts[currentIndex] !== undefined;

  const finishSession = async (finalAttempts: Attempt[]) => {
    setIsSaving(true);
    const correctAnswers = finalAttempts.filter((a) => a.isCorrect).length;
    const wrongAnswers = finalAttempts.filter((a) => !a.isCorrect).length;
    const positivePoints = isPractice ? 0 : correctAnswers * settings.xpPerCorrect;
    const negativePoints = isPractice ? 0 : wrongAnswers * settings.xpPerWrong;
    const netPoints = positivePoints - negativePoints;

    const res = await saveSessionData({
      totalQuestions: questions.length,
      correctAnswers,
      wrongAnswers,
      positivePoints,
      negativePoints,
      netPoints,
      isPractice,
      attempts: finalAttempts,
    });

    if (res.sessionId) {
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(PROGRESS_KEY);
      router.push(`/session/result/${res.sessionId}`);
    } else {
      alert("Failed to save session.");
      setIsSaving(false);
      setShowFinishConfirm(false);
    }
  };

  const tryComplete = (finalAttempts: Attempt[]) => {
    const skipped = questions.length - finalAttempts.length;
    if (skipped > 0) {
      setShowFinishConfirm(true);
      return;
    }
    finishSession(finalAttempts);
  };

  const goNextOrFinish = (nextAttempts: Attempt[]) => {
    if (currentIndex < questions.length - 1) {
      setSelectedOption(null);
      setCurrentIndex((prev) => prev + 1);
    } else {
      tryComplete(nextAttempts);
    }
  };

  const handleBack = () => {
    if (autoNextTimer.current) clearTimeout(autoNextTimer.current);
    if (currentIndex === 0) return;
    const prevIndex = currentIndex - 1;
    setCurrentIndex(prevIndex);
    const prevAttempt = attempts[prevIndex];
    setSelectedOption(prevAttempt ? prevAttempt.selectedAnswer : null);
  };

  const handleForward = () => {
    if (autoNextTimer.current) clearTimeout(autoNextTimer.current);
    if (currentIndex < questions.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      const nextAttempt = attempts[nextIndex];
      setSelectedOption(nextAttempt ? nextAttempt.selectedAnswer : null);
    } else {
      tryComplete(attempts);
    }
  };

  const handleOptionSelect = (key: string) => {
    if (hasAnswered || isSaving) return;

    setSelectedOption(key);

    const isCorrect = key === currentQuestion.answer;
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
    if (hasAnswered) return;
    if (autoNextTimer.current) clearTimeout(autoNextTimer.current);
    const nextSkipped = new Set(skippedIds);
    nextSkipped.add(currentQuestion.id);
    setSkippedIds(nextSkipped);
    goNextOrFinish(attempts);
  };

  const isCorrectCurrent = selectedOption === currentQuestion.answer;
  const skippedTotal = questions.length - attempts.length;
  const progressPct = ((currentIndex + (hasAnswered ? 1 : 0)) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 flex items-center justify-center">
      <Card className="w-full max-w-3xl p-5 md:p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 h-1 bg-primary/30 w-full">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="flex items-center justify-between mt-2 mb-4">
          <div className="flex items-center gap-1">
            {currentIndex > 0 && (
              <button
                onClick={handleBack}
                className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-muted transition-colors active:scale-95 text-muted-foreground hover:text-foreground"
                aria-label="Previous question"
                title="Previous question"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            {currentIndex < questions.length - 1 && hasAnswered && (
              <button
                onClick={handleForward}
                className="flex items-center justify-center w-9 h-9 rounded-xl hover:bg-muted transition-colors active:scale-95 text-muted-foreground hover:text-foreground"
                aria-label="Next question"
                title="Next question"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              {currentIndex + 1} / {questions.length}
            </span>
            {isPractice && (
              <span className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-lg font-semibold">
                Practice
              </span>
            )}
          </div>

          {hasAnswered ? (
            <div className="flex items-center gap-2">
              {isPractice ? (
                <div
                  className={`px-3 py-1 rounded-xl font-bold text-xs border ${
                    isCorrectCurrent
                      ? "bg-success/20 text-success border-success/30"
                      : "bg-danger/20 text-danger border-danger/30"
                  }`}
                >
                  {isCorrectCurrent ? "Correct" : "Wrong"}
                </div>
              ) : isCorrectCurrent ? (
                <>
                  <div className="bg-success/20 text-success px-2.5 py-1 rounded-xl font-bold text-xs flex items-center border border-success/30">
                    <Zap className="w-3 h-3 mr-1" /> +{settings.xpPerCorrect}
                  </div>
                  <div className="bg-amber-500/20 text-amber-500 px-2.5 py-1 rounded-xl font-bold text-xs flex items-center border border-amber-500/30">
                    <Coins className="w-3 h-3 mr-1" /> +{settings.coinsPerCorrect}
                  </div>
                </>
              ) : (
                <div className="bg-danger/20 text-danger px-2.5 py-1 rounded-xl font-bold text-xs flex items-center border border-danger/30">
                  <Zap className="w-3 h-3 mr-1" /> -{settings.xpPerWrong}
                </div>
              )}
            </div>
          ) : (
            <div className="w-16" />
          )}
        </div>

        <h2 className="text-xl md:text-2xl font-semibold mb-6 leading-snug">
          {currentQuestion.question}
        </h2>

        <div className="space-y-3">
          {Object.entries(currentQuestion.options).map(([key, value]) => {
            const isSelected = selectedOption === key;
            const isCorrectAnswer = key === currentQuestion.answer;

            let buttonStyle = "border-border hover:border-primary/50 bg-background/50";
            let Icon = null;

            if (hasAnswered) {
              if (isCorrectAnswer) {
                buttonStyle =
                  "border-success bg-success/10 text-success-foreground shadow-sm shadow-success/20";
                Icon = <CheckCircle2 className="w-5 h-5 text-success" />;
              } else if (isSelected && !isCorrectAnswer) {
                buttonStyle =
                  "border-danger bg-danger/10 text-danger-foreground shadow-sm shadow-danger/20";
                Icon = <XCircle className="w-5 h-5 text-danger" />;
              } else {
                buttonStyle = "border-border opacity-50 bg-background/20";
              }
            }

            return (
              <button
                key={key}
                onClick={() => handleOptionSelect(key)}
                disabled={hasAnswered}
                className={`w-full text-left p-4 md:p-5 rounded-xl border-2 transition-all duration-200 flex justify-between items-center ${buttonStyle}`}
              >
                <div className="flex items-center min-w-0">
                  <span className="font-bold text-base md:text-lg mr-3 opacity-70 w-6 shrink-0">
                    {key}.
                  </span>
                  <span className="text-base md:text-lg">{value}</span>
                </div>
                {Icon}
              </button>
            );
          })}
        </div>

        <div className="mt-8 flex justify-between items-center">
          {!hasAnswered ? (
            <Button
              size="lg"
              variant="outline"
              onClick={handleSkip}
              className="px-6 h-11 text-base rounded-xl"
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
              className="px-6 h-11 text-base rounded-xl font-bold gap-2"
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
              >
                Finish
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
