"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AppShell } from "@/components/NavMenu";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Bookmark,
  BookmarkCheck,
  CheckSquare,
  Square,
  Zap,
  Filter,
  Sparkles,
  Timer,
} from "lucide-react";
import { saveQuestionsFromSession } from "@/app/actions/session";

type AttemptItem = {
  id: string;
  question: string;
  options: Record<string, string>;
  rawOptions: string;
  correctAnswer: string;
  selectedAnswer: string;
  isCorrect: boolean;
  pointsGained: number;
  pointsLost: number;
};

type ReviewViewProps = {
  session: {
    id: string;
    totalQuestions: number;
    correctAnswers: number;
    wrongAnswers: number;
    isPractice: boolean;
    createdAt: string;
  };
  attempts: AttemptItem[];
};

export function ReviewView({ session, attempts }: ReviewViewProps) {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<"all" | "wrong" | "correct">("all");
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ message: string; type: "success" | "error" } | null>(
    null
  );
  const [savedQuestionTexts, setSavedQuestionTexts] = useState<Set<string>>(new Set());

  const filteredAttempts = attempts.filter((att) => {
    if (filter === "wrong") return !att.isCorrect;
    if (filter === "correct") return att.isCorrect;
    return true;
  });

  const toggleSelect = (index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIndices.size === attempts.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(attempts.map((_, i) => i)));
    }
  };

  const handleSaveSelected = async () => {
    if (selectedIndices.size === 0) return;

    setIsSaving(true);
    setSaveStatus(null);

    const questionsToSave = Array.from(selectedIndices).map((idx) => {
      const att = attempts[idx];
      return {
        question: att.question,
        options: att.rawOptions,
        correctAnswer: att.correctAnswer,
      };
    });

    const res = await saveQuestionsFromSession({
      questionsToSave,
    });

    setIsSaving(false);
    if (res.success) {
      const nextSaved = new Set(savedQuestionTexts);
      questionsToSave.forEach((q) => nextSaved.add(q.question));
      setSavedQuestionTexts(nextSaved);
      setSelectedIndices(new Set());
      const dest = res.subjectName ? `"${res.subjectName}"` : "Question Bank";
      setSaveStatus({
        message: `Successfully saved ${res.savedCount} question(s) to ${dest}!`,
        type: "success",
      });
      setTimeout(() => setSaveStatus(null), 5000);
    } else {
      setSaveStatus({
        message: res.error || "Failed to save questions",
        type: "error",
      });
    }
  };

  const handleSaveSingle = async (att: AttemptItem) => {
    setIsSaving(true);
    setSaveStatus(null);

    const res = await saveQuestionsFromSession({
      questionsToSave: [
        {
          question: att.question,
          options: att.rawOptions,
          correctAnswer: att.correctAnswer,
        },
      ],
    });

    setIsSaving(false);
    if (res.success) {
      setSavedQuestionTexts((prev) => new Set(prev).add(att.question));
      const dest = res.subjectName ? `"${res.subjectName}"` : "Question Bank";
      setSaveStatus({
        message: `Saved to ${dest}!`,
        type: "success",
      });
      setTimeout(() => setSaveStatus(null), 4000);
    } else {
      setSaveStatus({
        message: res.error || "Failed to save question",
        type: "error",
      });
    }
  };

  const answeredCount = session.correctAnswers + session.wrongAnswers;
  const accuracy = answeredCount > 0 ? Math.round((session.correctAnswers / answeredCount) * 100) : 0;

  return (
    <AppShell>
      <div className="min-h-screen p-4 md:p-8 max-w-4xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href={`/session/result/${session.id}`}
              className="inline-flex items-center justify-center w-10 h-10 rounded-xl hover:bg-muted transition-colors active:scale-95 text-muted-foreground hover:text-foreground"
              aria-label="Back to results"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2">
                Session Review
                {session.isPractice && (
                  <span className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-lg font-semibold">
                    Practice
                  </span>
                )}
              </h1>
              <p className="text-sm text-muted-foreground">
                Reflect on your answers and save questions for later revision
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/">
              <Button variant="outline" size="sm" className="rounded-xl font-bold">
                Home
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-3.5 text-center rounded-2xl">
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Total</p>
            <p className="text-2xl font-black">{session.totalQuestions}</p>
          </Card>
          <Card className="p-3.5 text-center rounded-2xl border-success/20">
            <p className="text-xs text-success font-semibold uppercase tracking-wider flex items-center justify-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Correct
            </p>
            <p className="text-2xl font-black text-success">{session.correctAnswers}</p>
          </Card>
          <Card className="p-3.5 text-center rounded-2xl border-danger/20">
            <p className="text-xs text-danger font-semibold uppercase tracking-wider flex items-center justify-center gap-1">
              <XCircle className="w-3 h-3" /> Wrong
            </p>
            <p className="text-2xl font-black text-danger">{session.wrongAnswers}</p>
          </Card>
          <Card className="p-3.5 text-center rounded-2xl border-primary/20">
            <p className="text-xs text-primary font-semibold uppercase tracking-wider">Accuracy</p>
            <p className="text-2xl font-black text-primary">{accuracy}%</p>
          </Card>
        </div>

        {/* Action bar with filter and Save Selected */}
        <Card className="p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 bg-card/60 backdrop-blur">
          {/* Filters */}
          <div className="flex items-center gap-1.5 bg-muted/50 p-1 rounded-xl">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                filter === "all" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All ({attempts.length})
            </button>
            <button
              onClick={() => setFilter("wrong")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                filter === "wrong" ? "bg-background text-danger shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Wrong ({session.wrongAnswers})
            </button>
            <button
              onClick={() => setFilter("correct")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                filter === "correct" ? "bg-background text-success shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Correct ({session.correctAnswers})
            </button>
          </div>

          {/* Select & Save actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={selectAll}
              className="rounded-xl font-bold text-xs gap-1.5"
            >
              {selectedIndices.size === attempts.length ? (
                <>
                  <Square className="w-3.5 h-3.5" /> Deselect All
                </>
              ) : (
                <>
                  <CheckSquare className="w-3.5 h-3.5" /> Select All
                </>
              )}
            </Button>

            <Button
              size="sm"
              onClick={handleSaveSelected}
              disabled={selectedIndices.size === 0 || isSaving}
              isLoading={isSaving}
              className="rounded-xl font-bold text-xs gap-1.5 bg-primary shadow-sm"
            >
              <Bookmark className="w-3.5 h-3.5" />
              Save Selected {selectedIndices.size > 0 ? `(${selectedIndices.size})` : ""}
            </Button>
          </div>
        </Card>

        {/* Save Status Notification */}
        {saveStatus && (
          <div
            className={`p-4 rounded-2xl text-sm font-semibold flex items-center justify-between animate-fade-in ${
              saveStatus.type === "success"
                ? "bg-success/15 text-success border border-success/30"
                : "bg-danger/15 text-danger border border-danger/30"
            }`}
          >
            <span>{saveStatus.message}</span>
            <button
              onClick={() => setSaveStatus(null)}
              className="text-xs underline hover:opacity-80 ml-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Question Cards */}
        <div className="space-y-4">
          {filteredAttempts.length === 0 ? (
            <Card className="p-8 text-center rounded-2xl text-muted-foreground">
              No questions found in this filter.
            </Card>
          ) : (
            filteredAttempts.map((att, idx) => {
              const originalIndex = attempts.findIndex((a) => a.id === att.id);
              const isSelected = selectedIndices.has(originalIndex);
              const isAlreadySaved = savedQuestionTexts.has(att.question);

              return (
                <Card
                  key={att.id || idx}
                  className={`p-5 md:p-6 rounded-2xl transition-all border-2 ${
                    isSelected ? "border-primary/50 shadow-md bg-primary/5" : "border-border/60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleSelect(originalIndex)}
                        className="p-1 text-muted-foreground hover:text-primary transition-colors"
                        aria-label="Select question"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-primary" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Question {originalIndex + 1} of {attempts.length}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {att.isCorrect ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-success bg-success/15 px-2.5 py-1 rounded-xl border border-success/30">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Correct
                        </span>
                      ) : att.selectedAnswer === "__TIMED_OUT__" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-danger bg-danger/15 px-2.5 py-1 rounded-xl border border-danger/30">
                          <Timer className="w-3.5 h-3.5" /> Timed Out
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-danger bg-danger/15 px-2.5 py-1 rounded-xl border border-danger/30">
                          <XCircle className="w-3.5 h-3.5" /> Wrong
                        </span>
                      )}

                      <button
                        onClick={() => handleSaveSingle(att)}
                        disabled={isSaving || isAlreadySaved}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
                          isAlreadySaved
                            ? "bg-primary/20 text-primary border border-primary/30"
                            : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-border"
                        }`}
                        title={isAlreadySaved ? "Saved" : "Save question for practice"}
                      >
                        {isAlreadySaved ? (
                          <>
                            <BookmarkCheck className="w-3.5 h-3.5" /> Saved
                          </>
                        ) : (
                          <>
                            <Bookmark className="w-3.5 h-3.5" /> Save
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <h3 className="text-lg md:text-xl font-bold mb-4 leading-snug">
                    {att.question}
                  </h3>

                  {/* Options */}
                  <div className="space-y-2.5">
                    {Object.entries(att.options).map(([key, value]) => {
                      const isCorrect = key === att.correctAnswer;
                      const isUserPick = key === att.selectedAnswer;

                      let style = "border-border/50 bg-background/30 opacity-60";
                      let badge = null;

                      if (isCorrect && isUserPick) {
                        style = "border-success bg-success/15 text-success-foreground font-semibold";
                        badge = (
                          <span className="flex items-center gap-1 text-xs font-bold text-success">
                            <CheckCircle2 className="w-4 h-4" /> Your answer (Correct)
                          </span>
                        );
                      } else if (isCorrect) {
                        style = "border-success bg-success/10 font-semibold";
                        badge = (
                          <span className="flex items-center gap-1 text-xs font-bold text-success">
                            <CheckCircle2 className="w-4 h-4" /> Correct Answer
                          </span>
                        );
                      } else if (isUserPick && !isCorrect) {
                        style = "border-danger bg-danger/15 text-danger-foreground font-semibold";
                        badge = (
                          <span className="flex items-center gap-1 text-xs font-bold text-danger">
                            <XCircle className="w-4 h-4" /> Your Pick
                          </span>
                        );
                      }

                      return (
                        <div
                          key={key}
                          className={`p-3.5 md:p-4 rounded-xl border-2 flex items-center justify-between gap-3 ${style}`}
                        >
                          <div className="flex items-center min-w-0">
                            <span className="font-bold mr-3 opacity-75 shrink-0">{key}.</span>
                            <span className="text-sm md:text-base">{value}</span>
                          </div>
                          {badge}
                        </div>
                      );
                    })}
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </AppShell>
  );
}
