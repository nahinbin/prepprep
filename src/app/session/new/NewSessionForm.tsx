"use client";

import { useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import {
  Play,
  Coins,
  Upload,
  ChevronRight,
  Sparkles,
  Shuffle,
  Plus,
  Check,
  FileJson,
  Database,
  Layers,
} from "lucide-react";
import { NavMenu, AppShell } from "@/components/NavMenu";
import { BackButton } from "@/components/BackButton";
import { GameHUD } from "@/components/GameHUD";
import { sessionCostForCount, type EconomySettings } from "@/lib/constants";
import { startImportedSessionCoins, startSessionCoins } from "@/app/actions/economy";

const PROGRESS_KEY = "mcq_session_progress";

type Subject = {
  id: string;
  name: string;
  topics: Array<{ id: string; name: string; _count?: { questions: number } }>;
  _count?: { questions: number };
};

function NewSessionFormInner({
  user,
  subjects: initialSubjects,
  settings,
}: {
  user: { coins: number; positivePoints: number; negativePoints: number };
  subjects: Subject[];
  settings: EconomySettings;
}) {
  const searchParams = useSearchParams();
  const isPractice = searchParams.get("mode") === "practice";

  // Practice source: "bank" (from saved Question Bank) or "import" (paste/upload JSON)
  const [practiceSource, setPracticeSource] = useState<"bank" | "import">(
    isPractice && initialSubjects.some((s) => (s._count?.questions ?? 0) > 0) ? "bank" : "import"
  );

  // Bank Mode state
  const [bankSubjectId, setBankSubjectId] = useState<string>(
    initialSubjects[0]?.id || ""
  );
  const [bankTopicId, setBankTopicId] = useState<string>("all");
  const [bankCount, setBankCount] = useState<number>(10);

  // Import Mode state
  const [step, setStep] = useState(1);
  const [subjects, setSubjects] = useState(initialSubjects);
  const [subjectName, setSubjectName] = useState("");
  const [topicName, setTopicName] = useState("");
  const [addingSubject, setAddingSubject] = useState(false);
  const [addingTopic, setAddingTopic] = useState(false);
  const [newSubjectInput, setNewSubjectInput] = useState("");
  const [newTopicInput, setNewTopicInput] = useState("");

  const [inputMode, setInputMode] = useState<"upload" | "paste">("paste");
  const [jsonText, setJsonText] = useState("");
  const [parsedQuestions, setParsedQuestions] = useState<any[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [showRandomModal, setShowRandomModal] = useState(false);
  const [randomCount, setRandomCount] = useState(10);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const netXp = user.positivePoints - user.negativePoints;

  const activeSubject = useMemo(
    () => subjects.find((s) => s.name.toLowerCase() === subjectName.trim().toLowerCase()),
    [subjects, subjectName]
  );
  const topicsList = activeSubject ? activeSubject.topics : [];

  // Bank mode helper counts
  const selectedBankSubject = useMemo(
    () => subjects.find((s) => s.id === bankSubjectId),
    [subjects, bankSubjectId]
  );
  const bankTopics = selectedBankSubject ? selectedBankSubject.topics : [];
  const bankAvailableQuestions = useMemo(() => {
    if (!selectedBankSubject) return 0;
    if (bankTopicId === "all") return selectedBankSubject._count?.questions ?? 0;
    const top = bankTopics.find((t) => t.id === bankTopicId);
    return top?._count?.questions ?? 0;
  }, [selectedBankSubject, bankTopicId, bankTopics]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setJsonText(text);
        validateJson(text);
      };
      reader.readAsText(file);
    }
  };

  const validateJson = (text: string) => {
    setError("");
    setDuplicateWarning(null);
    setParsedQuestions([]);
    setSelectedIndices(new Set());
    if (!text.trim()) return;

    try {
      const parsed = JSON.parse(text);
      if (!parsed.questions || !Array.isArray(parsed.questions)) {
        throw new Error("Invalid format: Must contain a 'questions' array.");
      }

      parsed.questions.forEach((q: any, i: number) => {
        if (!q.question || !q.options || !q.answer) {
          throw new Error(
            `Question ${i + 1} is missing required fields (question, options, answer).`
          );
        }
      });

      // Check for duplicate questions in the session
      const uniqueMap = new Map<string, any>();
      let duplicateCount = 0;

      for (const q of parsed.questions) {
        const normalized = q.question.trim().toLowerCase();
        if (uniqueMap.has(normalized)) {
          duplicateCount++;
        } else {
          uniqueMap.set(normalized, q);
        }
      }

      const deduplicated = Array.from(uniqueMap.values());
      if (duplicateCount > 0) {
        setDuplicateWarning(
          `Removed ${duplicateCount} duplicate question(s) from the import to ensure uniqueness.`
        );
      }

      setParsedQuestions(deduplicated);
      setSelectedIndices(new Set(deduplicated.map((_: unknown, i: number) => i)));
    } catch (err: any) {
      setError(err.message || "Invalid JSON format.");
    }
  };

  const toggleSelection = (index: number) => {
    const newSet = new Set(selectedIndices);
    if (newSet.has(index)) newSet.delete(index);
    else newSet.add(index);
    setSelectedIndices(newSet);
  };

  const selectAll = () => setSelectedIndices(new Set(parsedQuestions.map((_, i) => i)));
  const selectNone = () => setSelectedIndices(new Set());

  const applyRandomSelect = () => {
    const n = Math.min(Math.max(1, Math.floor(randomCount)), parsedQuestions.length);
    const indices = parsedQuestions.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    setSelectedIndices(new Set(indices.slice(0, n)));
    setShowRandomModal(false);
  };

  const count = selectedIndices.size;
  const cost = isPractice ? 0 : sessionCostForCount(count, settings.coinsPerQuestionCost);
  const canAfford = isPractice || user.coins >= cost;

  const commitNewSubject = () => {
    const name = newSubjectInput.trim();
    if (!name) return;
    const exists = subjects.find((s) => s.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      setSubjectName(exists.name);
    } else {
      setSubjects((prev) => [...prev, { id: `temp-${name}`, name, topics: [] }]);
      setSubjectName(name);
    }
    setTopicName("");
    setNewSubjectInput("");
    setAddingSubject(false);
  };

  const commitNewTopic = () => {
    const name = newTopicInput.trim();
    if (!name || !subjectName.trim()) return;
    setTopicName(name);
    if (activeSubject) {
      const exists = activeSubject.topics.find(
        (t) => t.name.toLowerCase() === name.toLowerCase()
      );
      if (!exists) {
        setSubjects((prev) =>
          prev.map((s) =>
            s.name.toLowerCase() === subjectName.trim().toLowerCase()
              ? { ...s, topics: [...s.topics, { id: `temp-${name}`, name }] }
              : s
          )
        );
      }
    }
    setNewTopicInput("");
    setAddingTopic(false);
  };

  const handleStep1Next = () => {
    if (!subjectName.trim() || !topicName.trim()) {
      setError("Please select a subject and topic.");
      return;
    }
    setError("");
    setStep(2);
  };

  const handleStartImported = async () => {
    if (count === 0) {
      setError("Please select at least one question.");
      return;
    }
    if (!canAfford) {
      setError("You don't have enough coins to start this session.");
      return;
    }

    setLoading(true);
    setError("");

    const questionsToStart = parsedQuestions.filter((_, i) => selectedIndices.has(i));

    const res = await startImportedSessionCoins({
      subjectName: subjectName.trim(),
      topicName: topicName.trim(),
      questions: questionsToStart,
      isPractice,
    });

    if (res.error) {
      setError(res.error);
      setLoading(false);
      return;
    }

    sessionStorage.removeItem(PROGRESS_KEY);
    sessionStorage.setItem(
      "current_mcq_session",
      JSON.stringify({
        questions: res.questions,
        isPractice,
        settings: res.settings,
      })
    );
    router.push("/session/play");
  };

  const handleStartFromBank = async () => {
    if (!bankSubjectId) {
      setError("Please select a subject.");
      return;
    }
    if (bankAvailableQuestions === 0) {
      setError("No questions available in this subject/topic. Please import or save some questions first.");
      return;
    }

    setLoading(true);
    setError("");

    const res = await startSessionCoins({
      subjectId: bankSubjectId,
      topicId: bankTopicId,
      count: Math.min(bankCount, bankAvailableQuestions),
      cost: 0,
      isPractice: true,
    });

    if (res.error) {
      setError(res.error);
      setLoading(false);
      return;
    }

    sessionStorage.removeItem(PROGRESS_KEY);
    sessionStorage.setItem(
      "current_mcq_session",
      JSON.stringify({
        questions: res.questions,
        isPractice: true,
        settings: res.settings,
      })
    );
    router.push("/session/play");
  };

  return (
    <AppShell>
      <div className="min-h-screen p-4 md:p-8 flex items-start justify-center py-8 md:py-12">
        <Card className="w-full max-w-3xl p-5 md:p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <BackButton />
              <div className="min-w-0">
                <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate flex items-center gap-2">
                  {isPractice ? (
                    <>
                      <Sparkles className="w-5 h-5 text-primary shrink-0" />
                      Free Practice
                    </>
                  ) : (
                    "New Session"
                  )}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!isPractice && <GameHUD coins={user.coins} xp={netXp} compact />}
              <NavMenu />
            </div>
          </div>

          {/* Mode Switcher for Free Practice */}
          {isPractice && (
            <div className="flex rounded-2xl bg-muted/60 p-1 mb-6 border border-border">
              <button
                type="button"
                onClick={() => {
                  setPracticeSource("bank");
                  setError("");
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${
                  practiceSource === "bank"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Database className="w-4 h-4 text-primary" />
                Solve from Question Bank
              </button>
              <button
                type="button"
                onClick={() => {
                  setPracticeSource("import");
                  setError("");
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${
                  practiceSource === "import"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Upload className="w-4 h-4 text-primary" />
                Import Questions (JSON)
              </button>
            </div>
          )}

          {/* Practice from Question Bank Section */}
          {isPractice && practiceSource === "bank" ? (
            <div className="space-y-6">
              <div>
                <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider block mb-3">
                  Select Subject
                </label>
                {subjects.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-3">
                    No subjects with saved questions found. Switch to "Import Questions" to practice!
                  </p>
                ) : (
                  <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 flex-wrap">
                    {subjects.map((s) => {
                      const selected = bankSubjectId === s.id;
                      const qCount = s._count?.questions ?? 0;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setBankSubjectId(s.id);
                            setBankTopicId("all");
                          }}
                          className={`shrink-0 px-4 py-2.5 rounded-xl text-base font-semibold border transition-all ${
                            selected
                              ? "bg-primary text-primary-foreground border-primary shadow-sm"
                              : "bg-muted/40 border-border hover:border-primary/40"
                          }`}
                        >
                          {s.name} ({qCount})
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {selectedBankSubject && bankTopics.length > 0 && (
                <div>
                  <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider block mb-3">
                    Select Topic
                  </label>
                  <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setBankTopicId("all")}
                      className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                        bankTopicId === "all"
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/40 border-border hover:border-primary/40"
                      }`}
                    >
                      All Topics ({selectedBankSubject._count?.questions ?? 0})
                    </button>
                    {bankTopics.map((t) => {
                      const selected = bankTopicId === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setBankTopicId(t.id)}
                          className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
                            selected
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-muted/40 border-border hover:border-primary/40"
                          }`}
                        >
                          {t.name} ({t._count?.questions ?? 0})
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {bankAvailableQuestions > 0 && (
                <div>
                  <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider block mb-3">
                    Number of Questions to Solve
                  </label>
                  <div className="flex gap-2 mb-3">
                    {[5, 10, 20, 50, bankAvailableQuestions]
                      .filter((n, idx, arr) => n <= bankAvailableQuestions && arr.indexOf(n) === idx)
                      .map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setBankCount(n)}
                          className={`flex-1 py-2.5 rounded-xl text-sm font-bold border ${
                            bankCount === n
                              ? "border-primary bg-primary/15 text-primary"
                              : "border-border bg-background/50"
                          }`}
                        >
                          {n === bankAvailableQuestions ? `All (${n})` : n}
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {error && (
                <p className="text-danger text-sm font-medium text-center bg-danger/10 p-3 rounded-xl">
                  {error}
                </p>
              )}

              <Button
                size="lg"
                onClick={handleStartFromBank}
                disabled={bankAvailableQuestions === 0 || loading}
                isLoading={loading}
                className="w-full h-13 text-base font-bold rounded-2xl shadow-lg shadow-primary/20"
              >
                <Play className="w-5 h-5 mr-2 fill-current" />
                Start Free Practice ({Math.min(bankCount, bankAvailableQuestions)} Questions)
              </Button>
            </div>
          ) : (
            /* Import Workflow */
            <div>
              <div className="flex items-center gap-2 mb-6">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className={`flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold transition-colors ${
                    step === 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  1
                </button>
                <div className="h-px flex-1 bg-border" />
                <div
                  className={`flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold ${
                    step === 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  2
                </div>
              </div>

              {step === 1 && (
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                        Subject
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setAddingSubject(true);
                          setAddingTopic(false);
                        }}
                        className="text-sm font-semibold text-primary flex items-center gap-1 hover:underline"
                      >
                        <Plus className="w-4 h-4" /> Add new
                      </button>
                    </div>

                    {addingSubject ? (
                      <div className="flex gap-2">
                        <Input
                          autoFocus
                          placeholder="New subject name"
                          value={newSubjectInput}
                          onChange={(e) => setNewSubjectInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && commitNewSubject()}
                          className="h-12 rounded-xl text-base"
                        />
                        <Button onClick={commitNewSubject} className="rounded-xl h-12 px-4 shrink-0">
                          <Check className="w-5 h-5" />
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => setAddingSubject(false)}
                          className="rounded-xl h-12 px-3 shrink-0"
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 flex-wrap">
                        {subjects.length === 0 && (
                          <p className="text-sm text-muted-foreground py-3">
                            No subjects yet — add one to continue.
                          </p>
                        )}
                        {subjects.map((s) => {
                          const selected = subjectName.toLowerCase() === s.name.toLowerCase();
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                setSubjectName(s.name);
                                setTopicName("");
                              }}
                              className={`shrink-0 px-4 py-2.5 rounded-xl text-base font-semibold border transition-all ${
                                selected
                                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                  : "bg-muted/40 border-border hover:border-primary/40"
                              }`}
                            >
                              {s.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                        Topic
                      </label>
                      {subjectName && (
                        <button
                          type="button"
                          onClick={() => {
                            setAddingTopic(true);
                            setAddingSubject(false);
                          }}
                          className="text-sm font-semibold text-primary flex items-center gap-1 hover:underline"
                        >
                          <Plus className="w-4 h-4" /> Add new
                        </button>
                      )}
                    </div>

                    {!subjectName ? (
                      <p className="text-sm text-muted-foreground py-2">Select a subject first.</p>
                    ) : addingTopic ? (
                      <div className="flex gap-2">
                        <Input
                          autoFocus
                          placeholder="New topic name"
                          value={newTopicInput}
                          onChange={(e) => setNewTopicInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && commitNewTopic()}
                          className="h-12 rounded-xl text-base"
                        />
                        <Button onClick={commitNewTopic} className="rounded-xl h-12 px-4 shrink-0">
                          <Check className="w-5 h-5" />
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => setAddingTopic(false)}
                          className="rounded-xl h-12 px-3 shrink-0"
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 max-h-40 flex-wrap">
                        {topicsList.length === 0 && (
                          <p className="text-sm text-muted-foreground py-2">
                            No topics yet — add one to continue.
                          </p>
                        )}
                        {topicsList.map((t) => {
                          const selected = topicName.toLowerCase() === t.name.toLowerCase();
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => setTopicName(t.name)}
                              className={`shrink-0 px-4 py-2.5 rounded-xl text-base font-semibold border transition-all ${
                                selected
                                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                  : "bg-muted/40 border-border hover:border-primary/40"
                              }`}
                            >
                              {t.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {error && (
                    <p className="text-danger text-sm font-medium text-center bg-danger/10 p-3 rounded-xl">
                      {error}
                    </p>
                  )}

                  <div className="pt-2 flex justify-end">
                    <Button
                      size="lg"
                      onClick={handleStep1Next}
                      disabled={!subjectName.trim() || !topicName.trim()}
                      className="w-full md:w-auto px-8 h-12 text-base rounded-xl font-bold"
                    >
                      Next
                      <ChevronRight className="w-5 h-5 ml-1" />
                    </Button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setInputMode("paste")}
                      className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl border text-base font-bold transition-all ${
                        inputMode === "paste"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <FileJson className="w-5 h-5" />
                      Paste
                    </button>
                    <button
                      type="button"
                      onClick={() => setInputMode("upload")}
                      className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl border text-base font-bold transition-all ${
                        inputMode === "upload"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <Upload className="w-5 h-5" />
                      Upload
                    </button>
                  </div>

                  {inputMode === "upload" ? (
                    <div className="border border-dashed border-border hover:border-primary/50 transition-colors rounded-xl p-4 text-center bg-muted/20">
                      <input
                        type="file"
                        id="file-upload"
                        className="hidden"
                        accept=".json"
                        onChange={handleFileUpload}
                      />
                      <label
                        htmlFor="file-upload"
                        className="cursor-pointer inline-flex items-center gap-2 font-semibold text-primary"
                      >
                        <Upload className="w-5 h-5" />
                        Choose JSON file
                      </label>
                      {jsonText && parsedQuestions.length > 0 && (
                        <p className="text-xs text-success mt-2">
                          {parsedQuestions.length} unique questions loaded
                        </p>
                      )}
                    </div>
                  ) : (
                    <textarea
                      className="w-full h-28 rounded-xl border border-border bg-background/50 p-3 font-mono text-sm shadow-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary placeholder:text-muted-foreground"
                      placeholder='{"questions":[{"question":"...","options":{"A":"..."},"answer":"A"}]}'
                      value={jsonText}
                      onChange={(e) => {
                        setJsonText(e.target.value);
                        validateJson(e.target.value);
                      }}
                    />
                  )}

                  {duplicateWarning && (
                    <div className="p-3 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-xl text-xs font-semibold">
                      {duplicateWarning}
                    </div>
                  )}

                  {parsedQuestions.length > 0 && (
                    <div className="border border-border rounded-xl bg-background/50 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 border-b border-border pb-3">
                        <span className="font-semibold text-sm">
                          {selectedIndices.size}/{parsedQuestions.length} selected
                        </span>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={selectAll}
                            className="rounded-xl h-9"
                          >
                            Select All
                          </Button>
                          {selectedIndices.size > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={selectNone}
                              className="rounded-xl h-9"
                            >
                              Select None
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setRandomCount(Math.min(10, parsedQuestions.length));
                              setShowRandomModal(true);
                            }}
                            className="rounded-xl h-9"
                          >
                            <Shuffle className="w-3.5 h-3.5 mr-1" />
                            Random
                          </Button>
                        </div>
                      </div>
                      <div className="max-h-52 overflow-y-auto space-y-1.5">
                        {parsedQuestions.map((q, i) => (
                          <label
                            key={i}
                            className="flex items-start p-2.5 rounded-xl hover:bg-muted cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              className="mt-1 mr-3 w-4 h-4 text-primary"
                              checked={selectedIndices.has(i)}
                              onChange={() => toggleSelection(i)}
                            />
                            <p className="font-medium text-sm leading-snug">{q.question}</p>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {count > 0 && !isPractice && (
                    <div className="bg-muted/20 border border-border rounded-xl p-4 space-y-2">
                      <div className="flex justify-between text-base">
                        <span className="text-muted-foreground">Selected</span>
                        <span className="font-bold">{count}</span>
                      </div>
                      <div className="flex justify-between text-base">
                        <span className="text-muted-foreground">Cost</span>
                        <span className="font-bold flex items-center text-danger">
                          <Coins className="w-4 h-4 mr-1" /> -{cost}
                        </span>
                      </div>
                      {!canAfford && (
                        <p className="text-danger text-sm text-center font-medium pt-1">
                          Not enough coins.
                        </p>
                      )}
                    </div>
                  )}

                  {count > 0 && isPractice && (
                    <p className="text-center text-sm text-muted-foreground">
                      {count} question{count !== 1 ? "s" : ""} · free practice
                    </p>
                  )}

                  {error && (
                    <p className="text-danger text-sm font-medium text-center bg-danger/10 p-3 rounded-xl">
                      {error}
                    </p>
                  )}

                  <Button
                    size="lg"
                    onClick={handleStartImported}
                    disabled={count === 0 || !canAfford || loading}
                    isLoading={loading}
                    className="w-full h-12 text-base rounded-xl font-bold"
                  >
                    {isPractice ? (
                      <>
                        Start Practice
                        <Sparkles className="w-5 h-5 ml-2" />
                      </>
                    ) : (
                      <>
                        Pay & Start
                        <Play className="w-5 h-5 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {showRandomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowRandomModal(false)}
          />
          <Card className="relative w-full max-w-sm p-6 rounded-2xl">
            <h2 className="text-lg font-bold mb-1">Random select</h2>
            <p className="text-sm text-muted-foreground mb-5">
              How many from {parsedQuestions.length} questions?
            </p>
            <Input
              type="number"
              min={1}
              max={parsedQuestions.length}
              value={randomCount}
              onChange={(e) => setRandomCount(Number(e.target.value))}
              className="h-12 rounded-xl text-lg mb-3"
            />
            <div className="flex gap-2 mb-5">
              {[5, 10, 20, 30]
                .filter((n) => n <= parsedQuestions.length)
                .map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRandomCount(n)}
                    className={`flex-1 py-2 rounded-xl text-sm font-bold border ${
                      randomCount === n
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border"
                    }`}
                  >
                    {n}
                  </button>
                ))}
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 rounded-xl h-11"
                onClick={() => setShowRandomModal(false)}
              >
                Cancel
              </Button>
              <Button className="flex-1 rounded-xl h-11" onClick={applyRandomSelect}>
                Select
              </Button>
            </div>
          </Card>
        </div>
      )}
    </AppShell>
  );
}

export function NewSessionForm(props: {
  user: { coins: number; positivePoints: number; negativePoints: number };
  subjects: Subject[];
  settings: EconomySettings;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          Loading...
        </div>
      }
    >
      <NewSessionFormInner {...props} />
    </Suspense>
  );
}
