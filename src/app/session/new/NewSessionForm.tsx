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
  ChevronLeft,
  Sparkles,
  Shuffle,
  Plus,
  Check,
  FileJson,
  Database,
  Layers,
  Search,
  Timer,
  Clock,
  Gamepad2,
  Copy,
  Info,
  HelpCircle,
} from "lucide-react";
import { NavMenu, AppShell } from "@/components/NavMenu";
import { BackButton } from "@/components/BackButton";
import { GameHUD } from "@/components/GameHUD";
import { sessionCostForCount, type EconomySettings } from "@/lib/constants";
import { startImportedSessionCoins, startSessionCoins } from "@/app/actions/economy";
import { normalizeCanonicalAnswer } from "@/lib/answerMatcher";

const PROGRESS_KEY = "mcq_session_progress";

type Subject = {
  id: string;
  name: string;
  topics: Array<{ id: string; name: string; _count?: { questions: number } }>;
  _count?: { questions: number };
};

const TIMER_PRESETS = [
  { label: "No Timer", seconds: 0 },
  { label: "10s", seconds: 10 },
  { label: "15s", seconds: 15 },
  { label: "30s", seconds: 30 },
  { label: "45s", seconds: 45 },
  { label: "60s", seconds: 60 },
];

const SAMPLE_JSON_FORMAT = JSON.stringify(
  {
    questions: [
      {
        question: "What is the capital of France?",
        options: {
          A: "London",
          B: "Paris",
          C: "Berlin",
          D: "Madrid",
        },
        answer: "B",
      },
    ],
  },
  null,
  2
);

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

  // 3-Step wizard for Import Mode (1: Subject & Topic, 2: Timer, 3: Import JSON)
  const [step, setStep] = useState(1);

  // Timer state (0 = disabled, > 0 = seconds per question)
  const [selectedTimer, setSelectedTimer] = useState<number>(0);
  const [customTimerInput, setCustomTimerInput] = useState<string>("");
  const [isCustomTimer, setIsCustomTimer] = useState(false);

  // Bank Mode state (for Question Bank practice)
  const [bankSubjectId, setBankSubjectId] = useState<string>(
    initialSubjects[0]?.id || ""
  );
  const [bankTopicId, setBankTopicId] = useState<string>("all");
  const [bankCount, setBankCount] = useState<number>(10);
  const [bankSubjectSearch, setBankSubjectSearch] = useState("");

  // Import Mode state
  const [subjects, setSubjects] = useState(initialSubjects);
  const [subjectSearch, setSubjectSearch] = useState("");
  const [topicSearch, setTopicSearch] = useState("");
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
  const [copiedFormat, setCopiedFormat] = useState(false);
  const [showFormatModal, setShowFormatModal] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const netXp = user.positivePoints - user.negativePoints;

  // Filtered subjects for Import Mode
  const filteredSubjects = useMemo(() => {
    if (!subjectSearch.trim()) return subjects;
    return subjects.filter((s) =>
      s.name.toLowerCase().includes(subjectSearch.trim().toLowerCase())
    );
  }, [subjects, subjectSearch]);

  const activeSubject = useMemo(
    () => subjects.find((s) => s.name.toLowerCase() === subjectName.trim().toLowerCase()),
    [subjects, subjectName]
  );
  const topicsList = activeSubject ? activeSubject.topics : [];

  // Filtered topics for Import Mode
  const filteredTopics = useMemo(() => {
    if (!topicSearch.trim()) return topicsList;
    return topicsList.filter((t) =>
      t.name.toLowerCase().includes(topicSearch.trim().toLowerCase())
    );
  }, [topicsList, topicSearch]);

  // Bank mode helper counts
  const filteredBankSubjects = useMemo(() => {
    if (!bankSubjectSearch.trim()) return subjects;
    return subjects.filter((s) =>
      s.name.toLowerCase().includes(bankSubjectSearch.trim().toLowerCase())
    );
  }, [subjects, bankSubjectSearch]);

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

  // Effective Timer Seconds
  const effectiveTimerSeconds = useMemo(() => {
    if (isCustomTimer) {
      const val = parseInt(customTimerInput, 10);
      return !isNaN(val) && val > 0 ? val : 0;
    }
    return selectedTimer;
  }, [isCustomTimer, customTimerInput, selectedTimer]);

  const handleCopyFormat = () => {
    navigator.clipboard.writeText(SAMPLE_JSON_FORMAT);
    setCopiedFormat(true);
    setTimeout(() => setCopiedFormat(false), 2500);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setJsonText(text);
        validateJson(text);
      };
      reader.readAsText(file, "UTF-8");
    }
  };

  const validateJson = (text: string) => {
    setError("");
    setParsedQuestions([]);
    setSelectedIndices(new Set());
    if (!text.trim()) return;

    try {
      const parsed = JSON.parse(text);
      if (!parsed.questions || !Array.isArray(parsed.questions)) {
        throw new Error("Invalid format: Must contain a 'questions' array.");
      }

      const formatted = parsed.questions.map((q: any, i: number) => {
        if (!q.question || !q.options || (q.answer === undefined && q.correctAnswer === undefined)) {
          throw new Error(
            `Question ${i + 1} is missing required fields (question, options, answer).`
          );
        }

        const rawAnswer = String(q.answer !== undefined ? q.answer : q.correctAnswer).trim();
        const canonicalAnswer = normalizeCanonicalAnswer(rawAnswer, q.options);

        return {
          question: String(q.question).trim(),
          options: q.options,
          answer: canonicalAnswer || rawAnswer,
        };
      });

      // Keep 100% of questions exactly as imported without any deduplication removal
      setParsedQuestions(formatted);
      setSelectedIndices(new Set(formatted.map((_: unknown, i: number) => i)));
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
    setNewSubjectInput("");
    setAddingSubject(false);
  };

  const commitNewTopic = () => {
    const name = newTopicInput.trim();
    if (!name || !subjectName) return;

    setSubjects((prev) =>
      prev.map((s) => {
        if (s.name.toLowerCase() === subjectName.toLowerCase()) {
          const exists = s.topics.some((t) => t.name.toLowerCase() === name.toLowerCase());
          if (exists) return s;
          return {
            ...s,
            topics: [...s.topics, { id: `temp-${name}`, name }],
          };
        }
        return s;
      })
    );
    setTopicName(name);
    setNewTopicInput("");
    setAddingTopic(false);
  };

  const handleStep1Next = () => {
    if (!subjectName.trim() || !topicName.trim()) {
      setError("Please select both a Subject and a Topic.");
      return;
    }
    setError("");
    setStep(2);
  };

  const handleStep2Next = () => {
    setError("");
    setStep(3);
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

    const clientSessionToken = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    sessionStorage.removeItem(PROGRESS_KEY);
    sessionStorage.setItem(
      "current_mcq_session",
      JSON.stringify({
        clientSessionToken,
        questions: res.questions,
        isPractice,
        subjectName: subjectName.trim(),
        topicName: topicName.trim(),
        settings: {
          ...res.settings,
          subjectName: subjectName.trim(),
          topicName: topicName.trim(),
          timerSeconds: effectiveTimerSeconds,
        },
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
      setError("No questions available in this subject/topic. Please import some questions first.");
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

    const clientSessionToken = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    sessionStorage.removeItem(PROGRESS_KEY);
    sessionStorage.setItem(
      "current_mcq_session",
      JSON.stringify({
        clientSessionToken,
        questions: res.questions,
        isPractice: true,
        subjectName: selectedBankSubject?.name,
        topicName: bankTopicId === "all" ? "All Topics" : bankTopics.find((t) => t.id === bankTopicId)?.name,
        subjectId: bankSubjectId,
        topicId: bankTopicId,
        settings: {
          ...res.settings,
          subjectName: selectedBankSubject?.name,
          topicName: bankTopicId === "all" ? "All Topics" : bankTopics.find((t) => t.id === bankTopicId)?.name,
          subjectId: bankSubjectId,
          topicId: bankTopicId,
          timerSeconds: effectiveTimerSeconds,
        },
      })
    );
    router.push("/session/play");
  };

  return (
    <AppShell showBottomBar={false}>
      <div className="min-h-screen py-5 px-4 md:py-8 md:px-8 max-w-3xl mx-auto space-y-6">
        <div className="w-full space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <BackButton />
              <div className="min-w-0">
                <h1 className="text-2xl md:text-3xl font-black tracking-tight truncate flex items-center gap-2">
                  {isPractice ? (
                    <>
                      <Sparkles className="w-6 h-6 text-primary shrink-0" />
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
            <div className="grid grid-cols-2 rounded-2xl bg-muted/50 p-1.5 mb-8 border-2 border-border gap-1.5 shadow-inner">
              <button
                type="button"
                onClick={() => {
                  setPracticeSource("bank");
                  setError("");
                  setStep(1);
                }}
                className={`flex items-center justify-center gap-2 py-3 sm:py-3.5 rounded-xl font-black text-sm sm:text-base transition-all ${
                  practiceSource === "bank"
                    ? "bg-background text-foreground shadow-sm border-border"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                }`}
              >
                <Database className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0" />
                <span className="truncate">Question Bank</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPracticeSource("import");
                  setError("");
                  setStep(1);
                }}
                className={`flex items-center justify-center gap-2 py-3 sm:py-3.5 rounded-xl font-black text-sm sm:text-base transition-all ${
                  practiceSource === "import"
                    ? "bg-background text-foreground shadow-sm border-border"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                }`}
              >
                <Upload className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0" />
                <span className="truncate">Import</span>
              </button>
            </div>
          )}

          {/* Practice from Question Bank Workflow */}
          {isPractice && practiceSource === "bank" ? (
            <div className="space-y-6">
              {/* STEP 1: Select Subject & Topic */}
              {step === 1 && (
                <div className="space-y-5 animate-fade-in">
                  {!bankSubjectId ? (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <label className="text-sm font-black text-muted-foreground uppercase tracking-wider">
                          Choose Subject
                        </label>
                        <span className="text-sm font-bold text-muted-foreground">
                          {subjects.length} available
                        </span>
                      </div>

                      {subjects.length > 4 && (
                        <div className="relative mb-4">
                          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            placeholder="Search subject..."
                            value={bankSubjectSearch}
                            onChange={(e) => setBankSubjectSearch(e.target.value)}
                            className="pl-11 h-12 text-sm font-bold rounded-2xl bg-background/50 border-2"
                          />
                        </div>
                      )}

                      {subjects.length === 0 ? (
                        <p className="text-base font-semibold text-muted-foreground py-4 text-center">
                          No subjects with saved questions found. Switch to "Import" to practice!
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-72 overflow-y-auto pr-1">
                          {filteredBankSubjects.map((s) => {
                            const qCount = s._count?.questions ?? 0;
                            return (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => {
                                  setBankSubjectId(s.id);
                                  setBankTopicId(""); // Reset topic
                                }}
                                className="p-4 rounded-2xl text-left border-2 transition-all flex flex-col justify-between gap-1.5 min-w-0 bg-card border-border hover:border-primary/50 hover:bg-primary/5 hover:scale-[1.02] active:scale-[0.98] shadow-sm"
                              >
                                <span className="font-black text-base truncate block w-full">{s.name}</span>
                                <span className="text-sm font-bold text-muted-foreground">
                                  {qCount} question{qCount !== 1 ? "s" : ""}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Selected Subject Pill */}
                      <div className="p-4 rounded-2xl bg-primary/10 border-2 border-primary/20 flex items-center justify-between shadow-sm">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-black uppercase text-primary tracking-wider opacity-80">Selected Subject</span>
                          <span className="text-lg sm:text-xl font-black text-foreground leading-none">{selectedBankSubject?.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setBankSubjectId("");
                            setBankTopicId("");
                          }}
                          className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-background border-2 border-border text-sm font-bold text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all active:scale-95 shadow-sm"
                        >
                          Change
                        </button>
                      </div>

                      {/* Topic Selection */}
                      {bankTopics.length > 0 && (
                        <div>
                          <label className="text-sm font-black text-muted-foreground uppercase tracking-wider block mb-4">
                            Choose Topic
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-72 overflow-y-auto pr-1">
                            <button
                              type="button"
                              onClick={() => setBankTopicId("all")}
                              className={`p-4 rounded-2xl text-left border-2 transition-all flex flex-col justify-between gap-1.5 min-w-0 hover:scale-[1.02] active:scale-[0.98] ${
                                bankTopicId === "all"
                                  ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                                  : "bg-card border-border hover:border-primary/50 hover:bg-primary/5 shadow-sm"
                              }`}
                            >
                              <span className="font-black text-base truncate block w-full">All Topics</span>
                              <span
                                className={`text-sm font-bold ${
                                  bankTopicId === "all"
                                    ? "text-primary-foreground/80"
                                    : "text-muted-foreground"
                                }`}
                              >
                                {selectedBankSubject?._count?.questions ?? 0} total
                              </span>
                            </button>
                            {bankTopics.map((t) => {
                              const selected = bankTopicId === t.id;
                              return (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => setBankTopicId(t.id)}
                                  className={`p-4 rounded-2xl text-left border-2 transition-all flex flex-col justify-between gap-1.5 min-w-0 hover:scale-[1.02] active:scale-[0.98] ${
                                    selected
                                      ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                                      : "bg-card border-border hover:border-primary/50 hover:bg-primary/5 shadow-sm"
                                  }`}
                                >
                                  <span className="font-black text-base truncate block w-full">{t.name}</span>
                                  <span
                                    className={`text-sm font-bold ${
                                      selected
                                        ? "text-primary-foreground/80"
                                        : "text-muted-foreground"
                                    }`}
                                  >
                                    {t._count?.questions ?? 0} questions
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="pt-2 flex justify-end">
                        <Button
                          size="lg"
                          onClick={() => setStep(2)}
                          disabled={!bankTopicId}
                          className="w-full md:w-auto px-8 h-12 text-sm sm:text-base rounded-2xl font-black gap-1.5 shadow-md shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                        >
                          Next
                          <ChevronRight className="w-5 h-5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2: Choose Timer & Question Count */}
              {step === 2 && (
                <div className="space-y-6 animate-fade-in">
                  <div className="p-6 rounded-3xl bg-muted/20 border-2 border-border/80 space-y-6 text-center shadow-inner">
                    <div className="w-16 h-16 rounded-3xl bg-primary/15 border-2 border-primary/30 flex items-center justify-center mx-auto text-primary shadow-sm">
                      <Timer className="w-8 h-8" />
                    </div>

                    <div>
                      <h3 className="text-xl sm:text-2xl font-black tracking-tight">Question Timer</h3>
                      <p className="text-sm font-semibold text-muted-foreground mt-1">
                        Choose time limit per question.
                      </p>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 max-w-lg mx-auto">
                      {TIMER_PRESETS.map((preset) => {
                        const active = !isCustomTimer && selectedTimer === preset.seconds;
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => {
                              setIsCustomTimer(false);
                              setSelectedTimer(preset.seconds);
                            }}
                            className={`py-3 sm:py-4 px-2 rounded-2xl text-sm font-black border-2 transition-all text-center hover:scale-105 active:scale-95 ${
                              active
                                ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/30 scale-105"
                                : "border-border bg-card hover:border-primary/50 shadow-sm"
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom timer option */}
                    <div className="flex flex-col items-center justify-center gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsCustomTimer(!isCustomTimer)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all ${
                          isCustomTimer
                            ? "border-primary bg-primary/15 text-primary"
                            : "border-border/60 bg-background/50 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Custom Seconds
                      </button>
                      {isCustomTimer && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <Input
                            type="number"
                            min={3}
                            max={300}
                            placeholder="Sec"
                            value={customTimerInput}
                            onChange={(e) => setCustomTimerInput(e.target.value)}
                            className="h-9 w-24 text-center text-xs rounded-xl"
                            autoFocus
                          />
                          <span className="text-xs text-muted-foreground font-semibold">sec</span>
                        </div>
                      )}
                    </div>

                    <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-background/80 border border-border text-xs font-bold text-primary">
                      <Clock className="w-3.5 h-3.5" />
                      <span>
                        {effectiveTimerSeconds > 0 ? `${effectiveTimerSeconds}s per question` : "No limit (unlimited)"}
                      </span>
                    </div>
                  </div>

                  {bankAvailableQuestions > 0 && (
                    <div className="pt-2">
                      <label className="text-sm font-black text-muted-foreground uppercase tracking-wider block mb-4">
                        Number of Questions to Solve
                      </label>
                      <div className="grid grid-cols-4 sm:grid-cols-5 gap-3 mb-4">
                        {[5, 10, 20, 50, bankAvailableQuestions]
                          .filter((n, idx, arr) => n <= bankAvailableQuestions && arr.indexOf(n) === idx)
                          .map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setBankCount(n)}
                              className={`py-3 sm:py-4 rounded-2xl text-sm sm:text-base font-black border-2 transition-all text-center hover:scale-105 active:scale-95 ${
                                bankCount === n
                                  ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/30 scale-105"
                                  : "border-border bg-card hover:border-primary/50 shadow-sm"
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

                  <div className="pt-4 flex items-center justify-between gap-3">
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => setStep(1)}
                      className="px-6 h-14 text-sm sm:text-base rounded-2xl font-black gap-2 border-2 hover:bg-muted/50 hover:scale-105 active:scale-95 transition-all"
                    >
                      <ChevronLeft className="w-5 h-5" />
                      Back
                    </Button>

                    <Button
                      size="lg"
                      onClick={handleStartFromBank}
                      disabled={bankAvailableQuestions === 0 || loading}
                      isLoading={loading}
                      className="flex-1 max-w-xs h-14 text-base sm:text-lg font-black rounded-2xl shadow-lg shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                      <Play className="w-5 h-5 mr-2 fill-current" />
                      Start ({Math.min(bankCount, bankAvailableQuestions)} Qs)
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* 3-Step Import Wizard: 1. Subject & Topic -> 2. Timer -> 3. Import JSON */
            <div>
              {/* STEP 1: Select Subject & Topic */}
              {step === 1 && (
                <div className="space-y-5 animate-fade-in">
                  {!subjectName ? (
                    // Subject Selection
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <label className="text-sm font-black text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                          <Layers className="w-4 h-4 text-primary" />
                          Choose Subject
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setAddingSubject(true);
                            setAddingTopic(false);
                          }}
                          className="text-sm font-black text-primary flex items-center gap-1.5 hover:underline px-3 py-1.5 rounded-xl hover:bg-primary/10 transition-colors"
                        >
                          <Plus className="w-4 h-4" /> Add
                        </button>
                      </div>

                      {subjects.length > 4 && !addingSubject && (
                        <div className="relative mb-4">
                          <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            placeholder="Search subject..."
                            value={subjectSearch}
                            onChange={(e) => setSubjectSearch(e.target.value)}
                            className="pl-11 h-12 text-sm font-bold rounded-2xl bg-background/50 border-2"
                          />
                        </div>
                      )}

                      {addingSubject ? (
                        <div className="flex gap-2">
                          <Input
                            autoFocus
                            placeholder="Subject name"
                            value={newSubjectInput}
                            onChange={(e) => setNewSubjectInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && commitNewSubject()}
                            className="h-12 rounded-2xl text-sm font-bold border-2"
                          />
                          <Button onClick={commitNewSubject} className="rounded-2xl h-12 px-4 shrink-0 font-black shadow-md shadow-primary/20 hover:scale-105 active:scale-95 transition-all">
                            <Check className="w-5 h-5" />
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setAddingSubject(false)}
                            className="rounded-2xl h-12 px-4 shrink-0 text-sm font-bold border-2 hover:bg-muted/50"
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-72 overflow-y-auto pr-1">
                          {subjects.length === 0 && (
                            <p className="text-base font-semibold text-muted-foreground py-4 text-center col-span-full">
                              No subjects yet — click "+ Add" to create one.
                            </p>
                          )}
                          {filteredSubjects.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                setSubjectName(s.name);
                                setTopicName("");
                              }}
                              className={`p-4 rounded-2xl text-left border-2 transition-all flex flex-col justify-between gap-1.5 min-w-0 bg-card border-border hover:border-primary/50 hover:bg-primary/5 hover:scale-[1.02] active:scale-[0.98] shadow-sm`}
                            >
                              <span className="font-black text-base truncate block w-full">{s.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    // Topic Selection (Subject is selected)
                    <div className="space-y-6">
                      {/* Selected Subject Pill */}
                      <div className="p-4 rounded-2xl bg-primary/10 border-2 border-primary/20 flex items-center justify-between shadow-sm">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-black uppercase text-primary tracking-wider opacity-80">Selected Subject</span>
                          <span className="text-lg sm:text-xl font-black text-foreground leading-none">{subjectName}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSubjectName("");
                            setTopicName("");
                          }}
                          className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-background border-2 border-border text-sm font-bold text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all active:scale-95 shadow-sm"
                        >
                          Change
                        </button>
                      </div>

                      {/* Topic Selection */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <label className="text-sm font-black text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                            <Layers className="w-4 h-4 text-primary" />
                            Choose Topic
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setAddingTopic(true);
                              setAddingSubject(false);
                            }}
                            className="text-sm font-black text-primary flex items-center gap-1.5 hover:underline px-3 py-1.5 rounded-xl hover:bg-primary/10 transition-colors"
                          >
                            <Plus className="w-4 h-4" /> Add
                          </button>
                        </div>

                        {addingTopic ? (
                          <div className="flex gap-2">
                            <Input
                              autoFocus
                              placeholder="Topic name"
                              value={newTopicInput}
                              onChange={(e) => setNewTopicInput(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && commitNewTopic()}
                              className="h-12 rounded-2xl text-sm font-bold border-2"
                            />
                            <Button onClick={commitNewTopic} className="rounded-2xl h-12 px-4 shrink-0 font-black shadow-md shadow-primary/20 hover:scale-105 active:scale-95 transition-all">
                              <Check className="w-5 h-5" />
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => setAddingTopic(false)}
                              className="rounded-2xl h-12 px-4 shrink-0 text-sm font-bold border-2 hover:bg-muted/50"
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-72 overflow-y-auto pr-1">
                            {topicsList.length === 0 && (
                              <p className="text-base font-semibold text-muted-foreground py-4 text-center col-span-full">
                                No topics yet — click "+ Add" to create one.
                              </p>
                            )}
                            {filteredTopics.map((t) => {
                              const selected = topicName.toLowerCase() === t.name.toLowerCase();
                              return (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => setTopicName(t.name)}
                                  className={`p-4 rounded-2xl text-left border-2 transition-all flex flex-col justify-between gap-1.5 min-w-0 hover:scale-[1.02] active:scale-[0.98] ${
                                    selected
                                      ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                                      : "bg-card border-border hover:border-primary/50 hover:bg-primary/5 shadow-sm"
                                  }`}
                                >
                                  <span className="font-black text-base truncate block w-full">{t.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {error && (
                        <p className="text-danger text-xs font-medium text-center bg-danger/10 p-2.5 rounded-xl">
                          {error}
                        </p>
                      )}

                      <div className="pt-2 flex justify-end">
                        <Button
                          size="lg"
                          onClick={handleStep1Next}
                          disabled={!topicName.trim()}
                          className="w-full md:w-auto px-8 h-12 text-sm sm:text-base rounded-2xl font-black gap-1.5 shadow-md shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                        >
                          Next
                          <ChevronRight className="w-5 h-5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2: Choose Timer */}
              {step === 2 && (
                <div className="space-y-6 animate-fade-in">
                  <div className="p-6 rounded-3xl bg-muted/20 border-2 border-border/80 space-y-6 text-center shadow-inner">
                    <div className="w-16 h-16 rounded-3xl bg-primary/15 border-2 border-primary/30 flex items-center justify-center mx-auto text-primary shadow-sm">
                      <Timer className="w-8 h-8" />
                    </div>

                    <div>
                      <h3 className="text-xl sm:text-2xl font-black tracking-tight">Question Timer</h3>
                      <p className="text-sm font-semibold text-muted-foreground mt-1">
                        Choose time limit per question.
                      </p>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 max-w-lg mx-auto">
                      {TIMER_PRESETS.map((preset) => {
                        const active = !isCustomTimer && selectedTimer === preset.seconds;
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => {
                              setIsCustomTimer(false);
                              setSelectedTimer(preset.seconds);
                            }}
                            className={`py-3 sm:py-4 px-2 rounded-2xl text-sm font-black border-2 transition-all text-center hover:scale-105 active:scale-95 ${
                              active
                                ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/30 scale-105"
                                : "border-border bg-card hover:border-primary/50 shadow-sm"
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Custom timer option */}
                    <div className="flex flex-col items-center justify-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsCustomTimer(!isCustomTimer)}
                        className={`text-sm font-black px-4 py-2 rounded-2xl border-2 transition-all ${
                          isCustomTimer
                            ? "border-primary bg-primary/15 text-primary"
                            : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40"
                        }`}
                      >
                        Custom Seconds
                      </button>
                      {isCustomTimer && (
                        <div className="flex items-center gap-2 mt-1">
                          <Input
                            type="number"
                            min={3}
                            max={300}
                            placeholder="Sec"
                            value={customTimerInput}
                            onChange={(e) => setCustomTimerInput(e.target.value)}
                            className="h-12 w-28 text-center text-lg font-black rounded-2xl border-2"
                            autoFocus
                          />
                          <span className="text-base font-bold text-muted-foreground">sec</span>
                        </div>
                      )}
                    </div>

                    <div className="inline-flex items-center gap-2 px-5 py-2 rounded-2xl bg-background/80 border-2 border-border text-sm font-black text-primary">
                      <Clock className="w-4 h-4" />
                      <span>
                        {effectiveTimerSeconds > 0 ? `${effectiveTimerSeconds}s per question` : "No limit (unlimited)"}
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 flex items-center justify-between gap-3">
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => setStep(1)}
                      className="px-6 h-14 text-sm sm:text-base rounded-2xl font-black gap-2 border-2 hover:bg-muted/50 hover:scale-105 active:scale-95 transition-all"
                    >
                      <ChevronLeft className="w-5 h-5" />
                      Back
                    </Button>

                    <Button
                      size="lg"
                      onClick={handleStep2Next}
                      className="px-8 h-14 text-sm sm:text-base rounded-2xl font-black gap-1.5 shadow-md shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                    >
                      Next
                      <ChevronRight className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              )}

              {/* STEP 3: Import Questions (JSON Upload/Paste with Copy Format button) */}
              {step === 3 && (
                <div className="space-y-4 animate-fade-in">
                  {/* Selected Arena & Timer Pill */}
                  <div className="p-4 rounded-2xl bg-muted/40 border-2 border-border/80 flex items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2 font-bold min-w-0">
                      <span className="bg-primary/15 text-primary px-3 py-1 rounded-xl border border-primary/20 text-sm font-black truncate">
                        {subjectName} › {topicName}
                      </span>
                      <span className="bg-muted px-3 py-1 rounded-xl text-muted-foreground text-sm font-bold shrink-0">
                        {effectiveTimerSeconds > 0 ? `${effectiveTimerSeconds}s` : "No Timer"}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="text-sm font-black text-primary hover:underline shrink-0 px-3 py-1.5 rounded-xl hover:bg-primary/10 transition-colors"
                    >
                      Edit
                    </button>
                  </div>

                  {/* Input Mode Selector & Format Button */}
                  <div className="flex items-center gap-2">
                    <div className="grid grid-cols-2 gap-2 flex-1">
                      <button
                        type="button"
                        onClick={() => setInputMode("paste")}
                        className={`flex items-center justify-center gap-2 py-3 sm:py-3.5 rounded-2xl border-2 text-sm font-black transition-all ${
                          inputMode === "paste"
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40"
                        }`}
                      >
                        <FileJson className="w-5 h-5" />
                        Paste JSON
                      </button>
                      <button
                        type="button"
                        onClick={() => setInputMode("upload")}
                        className={`flex items-center justify-center gap-2 py-3 sm:py-3.5 rounded-2xl border-2 text-sm font-black transition-all ${
                          inputMode === "upload"
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40"
                        }`}
                      >
                        <Upload className="w-5 h-5" />
                        Upload File
                      </button>
                    </div>
                    
                    <button
                      type="button"
                      onClick={handleCopyFormat}
                      title="Copy JSON Template"
                      className={`flex items-center justify-center gap-1.5 px-4 py-3.5 rounded-2xl text-sm font-black transition-all border-2 shrink-0 ${
                        copiedFormat
                          ? "bg-success/15 border-success/40 text-success"
                          : "bg-primary/15 text-primary border-primary/30 hover:bg-primary/25"
                      }`}
                    >
                      {copiedFormat ? (
                        <Check className="w-5 h-5 text-success stroke-[2.5]" />
                      ) : (
                        <Copy className="w-5 h-5" />
                      )}
                      <span className="hidden sm:inline">Format</span>
                    </button>
                  </div>

                  {inputMode === "paste" ? (
                    <div>
                      <textarea
                        className="w-full h-44 p-4 rounded-2xl bg-card border-2 border-border focus:border-primary focus:outline-none font-mono text-sm resize-none shadow-inner"
                        placeholder="Paste questions JSON here..."
                        value={jsonText}
                        onChange={(e) => {
                          setJsonText(e.target.value);
                          validateJson(e.target.value);
                        }}
                      />
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-border rounded-2xl p-8 text-center hover:border-primary/50 transition-colors bg-card/50 cursor-pointer hover:bg-primary/5">
                      <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                      <p className="text-base font-black mb-1">Select or drag a .json file</p>
                      <p className="text-sm text-muted-foreground mb-4">JSON format required</p>
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="json-upload"
                      />
                      <label htmlFor="json-upload" className="inline-block cursor-pointer">
                        <span className="inline-flex items-center justify-center px-6 py-2.5 text-sm font-black rounded-2xl border-2 border-border bg-background hover:bg-muted hover:border-primary/50 transition-all hover:scale-105 active:scale-95">
                          Browse Files
                        </span>
                      </label>
                    </div>
                  )}



                  {/* Question Preview & Selector (ONLY QUESTIONS, NO ANSWERS SHOWN) */}
                  {parsedQuestions.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-foreground">
                            {count}/{parsedQuestions.length} Selected
                          </span>
                          {!isPractice && (
                            <span className="text-xs font-black text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-md">
                              {cost} Coins
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <Button variant="outline" size="sm" onClick={selectAll} className="text-[11px] h-6 px-2 rounded-lg">
                            All
                          </Button>
                          <Button variant="outline" size="sm" onClick={selectNone} className="text-[11px] h-6 px-2 rounded-lg">
                            None
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowRandomModal(true)}
                            className="text-[11px] h-6 px-2 rounded-lg gap-1"
                          >
                            <Shuffle className="w-3 h-3" />
                            Random
                          </Button>
                        </div>
                      </div>

                      {/* Question List: ONLY question text, absolutely no answers */}
                      <div className="max-h-44 overflow-y-auto space-y-1.5 border border-border/80 rounded-xl p-2 bg-background/30">
                        {parsedQuestions.map((q, idx) => {
                          const selected = selectedIndices.has(idx);
                          return (
                            <div
                              key={idx}
                              onClick={() => toggleSelection(idx)}
                              className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all flex items-center gap-2.5 ${
                                selected
                                  ? "bg-primary/10 border-primary/50 text-foreground"
                                  : "border-border/40 opacity-60 hover:opacity-100"
                              }`}
                            >
                              <div
                                className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                                  selected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground"
                                }`}
                              >
                                {selected && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-xs truncate leading-snug">
                                  {idx + 1}. {q.question}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {error && (
                    <p className="text-danger text-xs font-medium text-center bg-danger/10 p-2.5 rounded-xl">
                      {error}
                    </p>
                  )}

                  {/* Navigation Buttons */}
                  <div className="pt-4 flex items-center justify-between gap-3">
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => setStep(2)}
                      className="px-6 h-14 text-sm sm:text-base rounded-2xl font-black gap-2 border-2 hover:bg-muted/50 hover:scale-105 active:scale-95 transition-all"
                    >
                      <ChevronLeft className="w-5 h-5" />
                      Back
                    </Button>

                    <Button
                      size="lg"
                      onClick={handleStartImported}
                      disabled={count === 0 || !canAfford || loading}
                      isLoading={loading}
                      className="flex-1 max-w-xs h-14 text-base sm:text-lg font-black rounded-2xl shadow-lg shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                      <Play className="w-5 h-5 mr-2 fill-current" />
                      {isPractice ? "Start Practice" : `Pay & Start (${cost} Coins)`}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Random Count Selection Modal */}
      {showRandomModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-xs p-5 space-y-4 animate-fade-in">
            <h3 className="font-bold text-sm">Select Random Questions</h3>
            <p className="text-xs text-muted-foreground">
              How many questions would you like to randomly pick from the {parsedQuestions.length} imported?
            </p>
            <Input
              type="number"
              min={1}
              max={parsedQuestions.length}
              value={randomCount}
              onChange={(e) => setRandomCount(parseInt(e.target.value) || 1)}
              className="h-10 text-sm rounded-xl"
              autoFocus
            />
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="ghost" size="sm" onClick={() => setShowRandomModal(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={applyRandomSelect}>
                Apply Selection
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
    <Suspense fallback={null}>
      <NewSessionFormInner {...props} />
    </Suspense>
  );
}
