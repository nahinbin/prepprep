"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { AppShell } from "@/components/NavMenu";
import {
  Database,
  Search,
  Trash2,
  Play,
  CheckCircle2,
  Sparkles,
  Layers,
  CheckSquare,
  Square,
  Filter,
  Plus,
} from "lucide-react";
import { deleteQuestionFromBank, deleteMultipleQuestions } from "@/app/actions/questions";

type SubjectItem = {
  id: string;
  name: string;
  topics: Array<{ id: string; name: string; _count: { questions: number } }>;
  _count: { questions: number };
};

type QuestionItem = {
  id: string;
  question: string;
  options: Record<string, string>;
  answer: string;
  subjectId: string;
  subjectName: string;
  topicId: string;
  topicName: string;
  createdAt: string;
};

export function QuestionsClient({
  initialSubjects,
  initialQuestions,
  totalCount,
}: {
  initialSubjects: SubjectItem[];
  initialQuestions: QuestionItem[];
  totalCount: number;
}) {
  const router = useRouter();
  const [questions, setQuestions] = useState<QuestionItem[]>(initialQuestions);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("all");
  const [selectedTopicId, setSelectedTopicId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndices, setSelectedIndices] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const activeSubject = useMemo(
    () => initialSubjects.find((s) => s.id === selectedSubjectId),
    [initialSubjects, selectedSubjectId]
  );

  const availableTopics = activeSubject ? activeSubject.topics : [];

  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      if (selectedSubjectId !== "all" && q.subjectId !== selectedSubjectId) return false;
      if (selectedTopicId !== "all" && q.topicId !== selectedTopicId) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesText = q.question.toLowerCase().includes(query);
        const matchesOptions = Object.values(q.options).some((v) =>
          v.toLowerCase().includes(query)
        );
        if (!matchesText && !matchesOptions) return false;
      }
      return true;
    });
  }, [questions, selectedSubjectId, selectedTopicId, searchQuery]);

  const toggleSelect = (id: string) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIndices.size === filteredQuestions.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(filteredQuestions.map((q) => q.id)));
    }
  };

  const handleDeleteSingle = async (id: string) => {
    if (!confirm("Are you sure you want to remove this question from your Question Bank?")) return;
    setIsDeleting(true);
    const res = await deleteQuestionFromBank(id);
    setIsDeleting(false);
    if (res.success) {
      setQuestions((prev) => prev.filter((q) => q.id !== id));
      setSelectedIndices((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setStatusMessage("Question removed.");
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIndices.size === 0) return;
    if (!confirm(`Delete ${selectedIndices.size} selected question(s)?`)) return;

    setIsDeleting(true);
    const ids = Array.from(selectedIndices);
    const res = await deleteMultipleQuestions(ids);
    setIsDeleting(false);
    if (res.success) {
      setQuestions((prev) => prev.filter((q) => !selectedIndices.has(q.id)));
      setSelectedIndices(new Set());
      setStatusMessage(`Deleted ${res.count} question(s).`);
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  const handleStartPractice = (customQuestions?: QuestionItem[]) => {
    const pool = customQuestions || (selectedIndices.size > 0
      ? filteredQuestions.filter((q) => selectedIndices.has(q.id))
      : filteredQuestions);

    if (pool.length === 0) return;

    const formatted = pool.map((q) => ({
      id: q.id,
      question: q.question,
      options: q.options,
      answer: q.answer,
    }));

    sessionStorage.removeItem("mcq_session_progress");
    sessionStorage.setItem(
      "current_mcq_session",
      JSON.stringify({
        questions: formatted,
        isPractice: true,
        settings: {
          xpPerCorrect: 0,
          xpPerWrong: 0,
          coinsPerCorrect: 0,
        },
      })
    );
    router.push("/session/play");
  };

  return (
    <AppShell>
      <div className="min-h-screen p-4 md:p-8 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2.5">
              <Database className="w-7 h-7 text-primary" />
              Question Bank
            </h1>
            <p className="text-sm text-muted-foreground">
              Your personal repository of saved questions across all subjects
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/session/new?mode=practice">
              <Button variant="outline" size="sm" className="rounded-xl font-bold gap-1.5">
                <Sparkles className="w-4 h-4 text-primary" />
                Free Practice
              </Button>
            </Link>
            <Button
              size="sm"
              onClick={() => handleStartPractice()}
              disabled={filteredQuestions.length === 0}
              className="rounded-xl font-bold gap-1.5 shadow-md shadow-primary/20"
            >
              <Play className="w-4 h-4 fill-current" />
              {selectedIndices.size > 0
                ? `Practice Selected (${selectedIndices.size})`
                : `Practice All (${filteredQuestions.length})`}
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Card className="p-4 rounded-2xl text-center">
            <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-1">
              Total Saved Questions
            </p>
            <p className="text-3xl font-black text-primary">{totalCount}</p>
          </Card>
          <Card className="p-4 rounded-2xl text-center">
            <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-1">
              My Subjects
            </p>
            <p className="text-3xl font-black">{initialSubjects.length}</p>
          </Card>
          <Card className="p-4 rounded-2xl text-center col-span-2 sm:col-span-1">
            <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-1">
              Matching Search
            </p>
            <p className="text-3xl font-black">{filteredQuestions.length}</p>
          </Card>
        </div>

        {/* Filters & Search */}
        <Card className="p-4 md:p-5 rounded-2xl space-y-4 bg-card/60 backdrop-blur">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search question text or options..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 rounded-xl bg-background/50"
              />
            </div>

            {/* Subject Select */}
            <div>
              <select
                value={selectedSubjectId}
                onChange={(e) => {
                  setSelectedSubjectId(e.target.value);
                  setSelectedTopicId("all");
                }}
                className="w-full h-11 px-3.5 rounded-xl border border-border bg-background/50 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="all">All Subjects ({initialSubjects.length})</option>
                {initialSubjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s._count.questions} questions)
                  </option>
                ))}
              </select>
            </div>

            {/* Topic Select */}
            <div>
              <select
                value={selectedTopicId}
                onChange={(e) => setSelectedTopicId(e.target.value)}
                disabled={selectedSubjectId === "all"}
                className="w-full h-11 px-3.5 rounded-xl border border-border bg-background/50 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
              >
                <option value="all">All Topics</option>
                {availableTopics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t._count.questions})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Bulk Selection and Actions Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/50">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={selectAll}
                className="rounded-xl text-xs font-bold gap-1.5"
              >
                {selectedIndices.size === filteredQuestions.length && filteredQuestions.length > 0 ? (
                  <>
                    <Square className="w-3.5 h-3.5" /> Deselect All
                  </>
                ) : (
                  <>
                    <CheckSquare className="w-3.5 h-3.5" /> Select All ({filteredQuestions.length})
                  </>
                )}
              </Button>

              {selectedIndices.size > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDeleteSelected}
                  disabled={isDeleting}
                  className="rounded-xl text-xs font-bold gap-1.5 text-danger hover:bg-danger/10 border-danger/30"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Selected ({selectedIndices.size})
                </Button>
              )}
            </div>

            <span className="text-xs font-semibold text-muted-foreground">
              Showing {filteredQuestions.length} of {totalCount} questions
            </span>
          </div>
        </Card>

        {/* Status alert */}
        {statusMessage && (
          <div className="p-3.5 bg-primary/10 text-primary border border-primary/20 rounded-2xl text-sm font-semibold animate-fade-in flex justify-between items-center">
            <span>{statusMessage}</span>
            <button onClick={() => setStatusMessage(null)} className="text-xs underline">
              Dismiss
            </button>
          </div>
        )}

        {/* Question Cards List */}
        <div className="space-y-4">
          {filteredQuestions.length === 0 ? (
            <Card className="p-12 text-center rounded-2xl space-y-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-muted text-muted-foreground mx-auto">
                <Database className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold">No questions found</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  {totalCount === 0
                    ? "You haven't saved any questions to your Question Bank yet. Complete a session and click 'Save Questions' on the review screen to add questions here!"
                    : "No questions match your current search and filters."}
                </p>
              </div>
              {totalCount === 0 && (
                <Link href="/session/new">
                  <Button className="rounded-xl font-bold">Start a Quiz</Button>
                </Link>
              )}
            </Card>
          ) : (
            filteredQuestions.map((q, idx) => {
              const isSelected = selectedIndices.has(q.id);

              return (
                <Card
                  key={q.id}
                  className={`p-5 md:p-6 rounded-2xl transition-all border-2 ${
                    isSelected ? "border-primary/60 bg-primary/5 shadow-md" : "border-border/60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleSelect(q.id)}
                        className="p-1 text-muted-foreground hover:text-primary transition-colors"
                        aria-label="Select question"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-primary" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          #{idx + 1}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                          {q.subjectName}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-muted text-muted-foreground border border-border">
                          {q.topicName}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleStartPractice([q])}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 transition-colors"
                        title="Practice only this question"
                      >
                        <Play className="w-3 h-3 fill-current" /> Practice
                      </button>
                      <button
                        onClick={() => handleDeleteSingle(q.id)}
                        disabled={isDeleting}
                        className="p-1.5 text-muted-foreground hover:text-danger rounded-lg transition-colors"
                        title="Delete question"
                        aria-label="Delete question"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-lg font-bold mb-4 leading-snug">{q.question}</h3>

                  {/* Options List */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {Object.entries(q.options).map(([key, value]) => {
                      const isCorrect = key === q.answer;
                      return (
                        <div
                          key={key}
                          className={`p-3 rounded-xl border flex items-center justify-between gap-2 text-sm ${
                            isCorrect
                              ? "border-success bg-success/15 text-success font-semibold shadow-sm shadow-success/10"
                              : "border-border/60 bg-background/40 opacity-80"
                          }`}
                        >
                          <div className="flex items-center min-w-0">
                            <span className="font-bold mr-2 opacity-80 shrink-0">{key}.</span>
                            <span className="truncate">{value}</span>
                          </div>
                          {isCorrect && <CheckCircle2 className="w-4 h-4 shrink-0 text-success" />}
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
