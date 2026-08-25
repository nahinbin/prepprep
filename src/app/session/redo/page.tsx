"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CheckCircle2, XCircle, Zap, ArrowLeft, ArrowRight } from "lucide-react";
import { fetchMistakeQuestions, saveRedoSessionData } from "@/app/actions/redo";

const AUTO_NEXT_MS = 900;

type Question = {
  mistakeId: string;
  id: string;
  question: string;
  options: Record<string, string>;
  answer: string;
  correctCount: number;
  fromPractice?: boolean;
};

type RedoAttempt = {
  mistakeId: string;
  selectedAnswer: string;
  isCorrect: boolean;
};

function RedoSessionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const subjectId = searchParams.get("subjectId") ?? undefined;
  const topicId = searchParams.get("topicId") ?? undefined;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [attempts, setAttempts] = useState<RedoAttempt[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<{
    pointsRecovered: number;
    fullyCorrected: number;
    progressMade: number;
  } | null>(null);
  const attemptsRef = useRef(attempts);
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
    async function load() {
      const res = await fetchMistakeQuestions({ subjectId, topicId });
      if (res.error || !res.questions || res.questions.length === 0) {
        router.replace("/mistakes");
      } else {
        setQuestions(res.questions);
      }
      setLoading(false);
    }
    load();
  }, [router, subjectId, topicId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        Loading mistakes...
      </div>
    );
  }
  if (questions.length === 0 && !summary) return null;

  if (summary) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <div className="w-full max-w-md space-y-5 text-center">
          <h1 className="text-2xl font-black">Redo Complete</h1>
          <Card className="p-5 rounded-2xl space-y-3 text-left">
            {summary.fullyCorrected > 0 && (
              <div className="flex justify-between">
                <span className="text-success font-semibold">Cleared</span>
                <span className="font-black text-success">{summary.fullyCorrected}</span>
              </div>
            )}
            {summary.progressMade > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground font-semibold">Need one more</span>
                <span className="font-black">{summary.progressMade}</span>
              </div>
            )}
            {summary.pointsRecovered > 0 && (
              <div className="flex justify-between">
                <span className="flex items-center gap-1 text-primary font-semibold">
                  <Zap className="w-4 h-4" /> XP recovered
                </span>
                <span className="font-black text-primary">+{summary.pointsRecovered}</span>
              </div>
            )}
            {summary.fullyCorrected === 0 &&
              summary.progressMade === 0 &&
              summary.pointsRecovered === 0 && (
                <p className="text-muted-foreground text-sm text-center">Keep practicing!</p>
              )}
          </Card>
          <Button
            size="lg"
            className="w-full h-12 rounded-2xl font-bold"
            onClick={() => router.push("/mistakes")}
          >
            Back to Mistakes
          </Button>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const hasAnswered = selectedOption !== null || attempts[currentIndex] !== undefined;
  const isCorrectCurrent = selectedOption === currentQuestion.answer;
  const progressPct = ((currentIndex + (hasAnswered ? 1 : 0)) / questions.length) * 100;

  const finishRedo = async (finalAttempts: RedoAttempt[]) => {
    setIsSaving(true);
    const res = await saveRedoSessionData({ attempts: finalAttempts });
    if (res.success) {
      setSummary({
        pointsRecovered: res.pointsRecovered || 0,
        fullyCorrected: res.fullyCorrected || 0,
        progressMade: res.progressMade || 0,
      });
    } else {
      alert("Failed to save redo session.");
      setIsSaving(false);
    }
  };

  const goNext = (nextAttempts: RedoAttempt[]) => {
    if (currentIndex < questions.length - 1) {
      setSelectedOption(null);
      setCurrentIndex((prev) => prev + 1);
    } else {
      finishRedo(nextAttempts);
    }
  };

  const handleBack = () => {
    if (autoNextTimer.current) clearTimeout(autoNextTimer.current);
    if (currentIndex === 0) return;
    const prevIndex = currentIndex - 1;
    setCurrentIndex(prevIndex);
    const prevAtt = attempts[prevIndex];
    setSelectedOption(prevAtt ? prevAtt.selectedAnswer : null);
  };

  const handleForward = () => {
    if (autoNextTimer.current) clearTimeout(autoNextTimer.current);
    if (currentIndex < questions.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      const nextAtt = attempts[nextIndex];
      setSelectedOption(nextAtt ? nextAtt.selectedAnswer : null);
    } else {
      finishRedo(attempts);
    }
  };

  const handleOptionSelect = (key: string) => {
    if (hasAnswered || isSaving) return;

    setSelectedOption(key);
    const isCorrect = key === currentQuestion.answer;
    const nextAttempts = [
      ...attemptsRef.current,
      { mistakeId: currentQuestion.mistakeId, selectedAnswer: key, isCorrect },
    ];
    setAttempts(nextAttempts);

    if (autoNextTimer.current) clearTimeout(autoNextTimer.current);
    autoNextTimer.current = setTimeout(() => goNext(nextAttempts), AUTO_NEXT_MS);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 flex items-center justify-center">
      <Card className="w-full max-w-3xl p-5 md:p-8 relative overflow-hidden border-primary/20">
        <div className="absolute top-0 left-0 h-1 bg-primary/30 w-full">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Top Header with Back / Forward navigation */}
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
            <span className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-lg font-semibold">
              Redo
            </span>
          </div>

          {hasAnswered ? (
            <div>
              {isCorrectCurrent ? (
                currentQuestion.correctCount >= 1 && !currentQuestion.fromPractice ? (
                  <div className="bg-success/20 text-success px-2.5 py-1 rounded-xl font-bold text-xs border border-success/30 flex items-center gap-1">
                    <Zap className="w-3 h-3" /> XP recovered
                  </div>
                ) : isCorrectCurrent && currentQuestion.correctCount >= 1 ? (
                  <div className="bg-success/20 text-success px-2.5 py-1 rounded-xl font-bold text-xs border border-success/30">
                    Cleared
                  </div>
                ) : (
                  <div className="bg-success/20 text-success px-2.5 py-1 rounded-xl font-bold text-xs border border-success/30">
                    Correct — 1 more
                  </div>
                )
              ) : (
                <div className="bg-muted text-muted-foreground px-2.5 py-1 rounded-xl font-bold text-xs border border-border">
                  Still incorrect
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

        {hasAnswered && (
          <div className="mt-8 flex justify-end">
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
                "Finish Redo"
              )}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

export default function RedoSessionPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          Loading mistakes...
        </div>
      }
    >
      <RedoSessionContent />
    </Suspense>
  );
}
