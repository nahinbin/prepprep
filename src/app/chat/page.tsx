"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  ArrowUp,
  Sparkles,
  Bot,
  CheckCircle2,
  Calendar,
  Trash2,
  MessageSquare,
  PanelLeftClose,
  PanelLeft,
  Flame,
  Check,
  X,
  Play,
  RotateCcw,
  Copy,
  ChevronDown,
  Layers,
  Clock,
  BookOpen,
  SquarePen,
} from "lucide-react";
import VoicePill from "@/components/ui/VoicePill";
import { AppShell, NavMenu } from "@/components/NavMenu";
import {
  sendChatMessage,
  ChatMessage,
  GeneratedQuiz,
} from "@/app/actions/ai-chat";
import {
  getAiAssistantName,
  upsertBlock,
  generateBlockId,
  formatDateKey,
} from "@/lib/routineStorage";
import Link from "next/link";
import { playCorrectSound, playTapSound } from "@/lib/gameSounds";

interface ChatSession {
  id: string;
  title: string;
  updatedAt: number;
  messages: ChatMessage[];
}

const CHAT_SESSIONS_KEY = "mcq_chat_sessions_v3";

function loadSavedSessions(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CHAT_SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSessionsToStorage(sessions: ChatSession[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(sessions));
  } catch (e) {
    console.error("Failed to save chat sessions:", e);
  }
}

function createWelcomeMessage(aiName: string): ChatMessage {
  return {
    id: "welcome",
    role: "assistant",
    content: `👋 Hello! I'm **${aiName}**, your personal study coach.\n\nI can help you prepare for exams, master tricky topics, and organize your daily life:\n• **Generate MCQs**: Say *"Make 5 MCQs on Cell Division"* or paste your notes\n• **Plan Routine**: Say *"Build my schedule for today"* or *"Add a 2-hour Math block at 4 PM"*\n• **Remember Habits**: Say *"Remember that I have Physics coaching on Mondays at 3 PM"*\n• **Explain Topics**: Ask any question in Physics, Chemistry, Biology, Math, or Accounting!`,
    timestamp: 0,
  };
}

function createNewSession(aiName: string, customId?: string): ChatSession {
  const now = Date.now();
  return {
    id: customId || "sess_" + now.toString(36),
    title: "New Chat",
    updatedAt: now,
    messages: [createWelcomeMessage(aiName)],
  };
}

/**
 * Format markdown text into clean styled JSX (Bolds, bullet lists, inline code, code blocks)
 */
function MarkdownText({ text }: { text: string }) {
  const parts = text.split("\n");

  return (
    <div className="space-y-2 leading-7">
      {parts.map((line, idx) => {
        const trimmed = line.trim();

        // Empty line
        if (!trimmed) {
          return <div key={idx} className="h-1.5" />;
        }

        // Heading 3: ### Heading
        if (trimmed.startsWith("### ")) {
          return (
            <h3 key={idx} className="text-base font-bold text-white pt-2 pb-0.5">
              {renderFormattedSpans(trimmed.slice(4))}
            </h3>
          );
        }

        // Heading 2: ## Heading
        if (trimmed.startsWith("## ")) {
          return (
            <h2 key={idx} className="text-lg font-black text-white pt-3 pb-1 border-b border-white/10">
              {renderFormattedSpans(trimmed.slice(3))}
            </h2>
          );
        }

        // Bullet point: • or - or *
        if (
          trimmed.startsWith("• ") ||
          trimmed.startsWith("- ") ||
          trimmed.startsWith("* ")
        ) {
          return (
            <div key={idx} className="flex items-start gap-2.5 pl-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-2.5" />
              <p className="flex-1 text-[#ececec]">
                {renderFormattedSpans(trimmed.slice(2))}
              </p>
            </div>
          );
        }

        // Numbered list: 1. 2. etc.
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
        if (numMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1.5">
              <span className="text-xs font-bold text-primary font-mono shrink-0 mt-1">
                {numMatch[1]}.
              </span>
              <p className="flex-1 text-[#ececec]">
                {renderFormattedSpans(numMatch[2])}
              </p>
            </div>
          );
        }

        // Standard paragraph
        return (
          <p key={idx} className="text-[#ececec]">
            {renderFormattedSpans(line)}
          </p>
        );
      })}
    </div>
  );
}

/**
 * Parses bold (**text**), italics (*text*), and inline code (`code`)
 */
function renderFormattedSpans(text: string) {
  // Split on bold, italic, or code
  const tokens = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);

  return tokens.map((tok, i) => {
    if (tok.startsWith("**") && tok.endsWith("**") && tok.length >= 4) {
      return (
        <strong key={i} className="font-bold text-white">
          {tok.slice(2, -2)}
        </strong>
      );
    }
    if (tok.startsWith("*") && tok.endsWith("*") && tok.length >= 2) {
      return (
        <em key={i} className="italic text-[#d4d4d4]">
          {tok.slice(1, -1)}
        </em>
      );
    }
    if (tok.startsWith("`") && tok.endsWith("`") && tok.length >= 2) {
      return (
        <code
          key={i}
          className="px-1.5 py-0.5 rounded-md bg-[#2f2f2f] border border-white/10 text-xs font-mono text-emerald-400"
        >
          {tok.slice(1, -1)}
        </code>
      );
    }
    return tok;
  });
}

export default function ChatPage() {
  const [aiName] = useState<string>(() => getAiAssistantName());
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const loaded = loadSavedSessions();
    if (loaded.length > 0) return loaded;
    return [createNewSession(getAiAssistantName(), "sess_initial")];
  });
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    const loaded = loadSavedSessions();
    return loaded.length > 0 ? loaded[0].id : "sess_initial";
  });
  const [isTemporaryChat, setIsTemporaryChat] = useState<boolean>(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const loaded = loadSavedSessions();
    return loaded.length > 0
      ? loaded[0].messages
      : [createWelcomeMessage(getAiAssistantName())];
  });
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Voice dictation state
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  // In-chat Interactive Quiz Modal state
  const [activeQuiz, setActiveQuiz] = useState<GeneratedQuiz | null>(null);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizCompleted, setQuizCompleted] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  // Auto resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [input]);

  const persistMessages = (newMessages: ChatMessage[]) => {
    setMessages(newMessages);
    if (isTemporaryChat || !activeSessionId) return;

    setSessions((prev) => {
      const updated = prev.map((s) => {
        if (s.id === activeSessionId) {
          const firstUserMsg = newMessages.find((m) => m.role === "user");
          const title = firstUserMsg
            ? firstUserMsg.content.slice(0, 32).trim() + "..."
            : s.title;
          return {
            ...s,
            title,
            messages: newMessages,
            updatedAt: Date.now(),
          };
        }
        return s;
      });
      saveSessionsToStorage(updated);
      return updated;
    });
  };

  // Voice Dictation Handlers (VoicePill integration)
  const startSpeechRecognition = () => {
    const SpeechRecognition =
      (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
        .SpeechRecognition ||
      (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
        .webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn("Speech recognition not supported in this browser.");
      return;
    }

    try {
      const recognition = new (SpeechRecognition as new () => {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        onresult: (e: {
          results: Array<{
            [index: number]: { transcript: string };
            isFinal: boolean;
          }>;
        }) => void;
        onerror: (e: { error: string }) => void;
        onend: () => void;
        start: () => void;
        stop: () => void;
      })();

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event) => {
        let transcript = "";
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setInput(transcript);
      };

      recognition.onerror = (e) => {
        console.warn("Speech recognition error:", e.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
    } catch (err) {
      console.error("Failed to start speech recognition:", err);
      setIsListening(false);
    }
  };

  const stopSpeechRecognition = (reason: string) => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    setIsListening(false);
    if (reason === "cancel") {
      setInput("");
    }
  };

  // Send Message Handler
  const handleSend = async (customPrompt?: string) => {
    const textToSend = (customPrompt || input).trim();
    if (!textToSend || isSending) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    const userMsg: ChatMessage = {
      id: "usr_" + Date.now().toString(36),
      role: "user",
      content: textToSend,
      timestamp: Date.now(),
    };

    const newHistory = [...messages, userMsg];
    persistMessages(newHistory);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    setIsSending(true);

    try {
      const historyPayload = newHistory.map((m) => ({
        role: m.role === "system" ? ("assistant" as const) : m.role,
        content: m.content,
      }));
      const res = await sendChatMessage(textToSend, historyPayload);

      // Execute AI scheduled block if suggested
      if (res.actionTaken?.type === "added_block" && res.actionTaken.blockData) {
        try {
          const rawBlock = res.actionTaken.blockData;
          const newBlock = {
            id: generateBlockId(),
            date: formatDateKey(new Date()),
            type: rawBlock.type || "study",
            title: rawBlock.title || "Study Session",
            timeMode: "range" as const,
            startTime: rawBlock.startTime || "15:00",
            endTime: rawBlock.endTime || "16:00",
            isCompleted: false,
            subject: rawBlock.subject,
            topic: rawBlock.topic,
            notes: rawBlock.notes,
            subtasks: [],
            order: Date.now(),
            createdAt: Date.now(),
          };
          upsertBlock(newBlock);
        } catch (e) {
          console.warn("Failed to schedule routine block from chat:", e);
        }
      }

      persistMessages([...newHistory, res]);
    } catch (err) {
      console.error("Chat error:", err);
      persistMessages([
        ...newHistory,
        {
          id: "err_" + Date.now().toString(36),
          role: "assistant",
          content: "Sorry, I had trouble generating a response. Please check your connection and try again!",
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  // Session Management
  const handleNewChat = useCallback(() => {
    const newSession = createNewSession(aiName);

    setSessions((prev) => {
      const updated = [newSession, ...prev];
      saveSessionsToStorage(updated);
      return updated;
    });

    setActiveSessionId(newSession.id);
    setMessages(newSession.messages);
    setIsTemporaryChat(false);
    setSidebarOpen(false);
  }, [aiName]);

  const handleSelectSession = (id: string) => {
    const found = sessions.find((s) => s.id === id);
    if (found) {
      setActiveSessionId(id);
      setMessages(found.messages);
      setIsTemporaryChat(false);
      setSidebarOpen(false);
    }
  };

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = sessions.filter((s) => s.id !== id);
    saveSessionsToStorage(filtered);
    setSessions(filtered);

    if (activeSessionId === id) {
      if (filtered.length > 0) {
        setActiveSessionId(filtered[0].id);
        setMessages(filtered[0].messages);
      } else {
        handleNewChat();
      }
    }
  };

  // Copy Message Content to Clipboard
  const handleCopyMessage = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Interactive Practice Quiz Handlers
  const handleStartQuiz = (quiz: GeneratedQuiz) => {
    setActiveQuiz(quiz);
    setCurrentQuizIndex(0);
    setSelectedOption(null);
    setQuizScore(0);
    setQuizCompleted(false);
  };

  const handleSelectQuizOption = (index: number) => {
    if (selectedOption !== null || !activeQuiz) return;
    setSelectedOption(index);

    const isCorrect = index === activeQuiz.questions[currentQuizIndex].answerIndex;
    if (isCorrect) {
      try {
        playCorrectSound();
      } catch {}
      setQuizScore((s) => s + 1);
    } else {
      try {
        playTapSound();
      } catch {}
    }
  };

  const handleNextQuizQuestion = () => {
    if (!activeQuiz) return;
    if (currentQuizIndex + 1 < activeQuiz.questions.length) {
      setCurrentQuizIndex((i) => i + 1);
      setSelectedOption(null);
    } else {
      setQuizCompleted(true);
    }
  };

  // Check if current conversation is in the initial welcome state
  const isInitialState = messages.length <= 1 && !messages.some((m) => m.role === "user");

  return (
    <AppShell showBottomBar={false}>
      <div className="relative flex h-[100dvh] w-full overflow-hidden bg-[#212121] text-white">
        {/* ================================================================= */}
        {/*  CHATGPT SIDEBAR (Sessions & History)                            */}
        {/* ================================================================= */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-64 sm:w-72 bg-[#171717] border-r border-[#2f2f2f]/80 flex flex-col transition-transform duration-300 md:relative md:translate-x-0 ${
            sidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
          }`}
        >
          {/* Sidebar Top: New Chat + Close icon on mobile */}
          <div className="p-3.5 border-b border-[#2f2f2f]/60 flex items-center justify-between gap-2">
            <button
              onClick={handleNewChat}
              className="flex-1 py-2 px-3 rounded-lg hover:bg-[#212121] text-[#ececec] font-medium text-sm flex items-center justify-between border border-[#2f2f2f] hover:border-[#3f3f3f] transition-all"
            >
              <div className="flex items-center gap-2">
                <SquarePen className="w-4 h-4 text-primary" />
                <span>New chat</span>
              </div>
              <span className="text-[10px] text-neutral-400 font-mono">Ctrl+K</span>
            </button>

            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden w-8 h-8 rounded-lg hover:bg-[#2f2f2f] text-neutral-400 hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Temporary Chat Toggle (Incognito / Not saved) */}
          <div className="px-3.5 py-2.5 border-b border-[#2f2f2f]/40 flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-300 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              Temporary chat
            </span>
            <button
              type="button"
              onClick={() => {
                setIsTemporaryChat(!isTemporaryChat);
                if (!isTemporaryChat) {
                  setMessages([
                    {
                      id: "temp_start",
                      role: "assistant",
                      content: `🔥 **Temporary chat enabled.** Messages will not be saved to your history.`,
                      timestamp: 0,
                    },
                  ]);
                }
              }}
              className={`w-9 h-5 rounded-full transition-colors relative ${
                isTemporaryChat ? "bg-amber-500" : "bg-[#2f2f2f]"
              }`}
            >
              <span
                className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-transform ${
                  isTemporaryChat ? "right-1" : "left-1"
                }`}
              />
            </button>
          </div>

          {/* Sessions List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            <span className="text-[11px] font-semibold text-neutral-400 px-2.5 pt-2 pb-1 block">
              Recent chats
            </span>

            {sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => handleSelectSession(s.id)}
                className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm transition-all ${
                  activeSessionId === s.id && !isTemporaryChat
                    ? "bg-[#212121] text-white font-medium"
                    : "text-[#b4b4b4] hover:text-white hover:bg-[#212121]/60"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-60" />
                  <span className="truncate">{s.title || "New Chat"}</span>
                </div>

                <button
                  onClick={(e) => handleDeleteSession(s.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 rounded transition-all"
                  title="Delete chat"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Sidebar Bottom Nav Links */}
          <div className="p-3 border-t border-[#2f2f2f]/60 space-y-1">
            <Link
              href="/routine"
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-neutral-300 hover:text-white hover:bg-[#212121] transition-all"
            >
              <Calendar className="w-4 h-4 text-primary" />
              <span>Daily Routine</span>
            </Link>
            <Link
              href="/routine/settings"
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-neutral-300 hover:text-white hover:bg-[#212121] transition-all"
            >
              <Bot className="w-4 h-4 text-violet-400" />
              <span>AI Settings & Name</span>
            </Link>
            <Link
              href="/subjects/progress"
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-neutral-300 hover:text-white hover:bg-[#212121] transition-all"
            >
              <BookOpen className="w-4 h-4 text-emerald-400" />
              <span>Completed Topics</span>
            </Link>
          </div>
        </aside>

        {/* Sidebar Backdrop on Mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ================================================================= */}
        {/*  MAIN CHAT CANVAS (Pure ChatGPT Aesthetic)                       */}
        {/* ================================================================= */}
        <div className="flex-1 flex flex-col h-full min-w-0 bg-[#212121]">
          {/* Top Bar */}
          <header className="h-14 px-4 flex items-center justify-between shrink-0 border-b border-transparent">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="w-9 h-9 rounded-lg hover:bg-[#2f2f2f] text-neutral-400 hover:text-white flex items-center justify-center transition-colors"
                aria-label="Toggle Sidebar"
              >
                {sidebarOpen ? (
                  <PanelLeftClose className="w-5 h-5" />
                ) : (
                  <PanelLeft className="w-5 h-5" />
                )}
              </button>

              {/* Model Dropdown Pill */}
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl hover:bg-[#2f2f2f] cursor-pointer transition-colors group">
                <span className="text-base font-semibold text-white">
                  {aiName}
                </span>
                <span className="text-xs text-neutral-400 font-medium">
                  3.5 Flash
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-neutral-400 group-hover:text-white transition-colors" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleNewChat}
                className="w-9 h-9 rounded-lg hover:bg-[#2f2f2f] text-neutral-400 hover:text-white flex items-center justify-center transition-colors"
                title="New chat"
              >
                <SquarePen className="w-5 h-5" />
              </button>
              <NavMenu />
            </div>
          </header>

          {/* Messages or Welcome Center Screen */}
          <div className="flex-1 overflow-y-auto px-4 py-4 w-full">
            <div className="max-w-3xl w-full mx-auto min-h-full flex flex-col justify-between">
              {isInitialState ? (
                /* =========================================================== */
                /*  SIGNATURE CHATGPT WELCOME / EMPTY STATE                   */
                /* =========================================================== */
                <div className="flex-1 flex flex-col items-center justify-center py-10 px-2 animate-in fade-in duration-300">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 text-primary shadow-lg shadow-black/20">
                    <Sparkles className="w-6 h-6" />
                  </div>

                  <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight text-center mb-8">
                    What can I help with today?
                  </h1>

                  {/* 2x2 Clean Suggestion Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
                    <button
                      type="button"
                      onClick={() =>
                        handleSend(
                          "Build my study schedule for today. Balance my study sessions with breaks."
                        )
                      }
                      className="p-4 rounded-2xl bg-[#2f2f2f]/60 hover:bg-[#2f2f2f] border border-white/5 hover:border-white/15 text-left transition-all active:scale-[0.99] group shadow-sm"
                    >
                      <div className="flex items-center gap-2 mb-1.5 text-primary">
                        <Clock className="w-4 h-4" />
                        <span className="text-sm font-semibold text-white">
                          Build Daily Routine
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 group-hover:text-neutral-300">
                        Create an optimized schedule with study blocks & breaks
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleSend(
                          "Generate 5 high-yield practice MCQs with explanations on Cell Division."
                        )
                      }
                      className="p-4 rounded-2xl bg-[#2f2f2f]/60 hover:bg-[#2f2f2f] border border-white/5 hover:border-white/15 text-left transition-all active:scale-[0.99] group shadow-sm"
                    >
                      <div className="flex items-center gap-2 mb-1.5 text-violet-400">
                        <Layers className="w-4 h-4" />
                        <span className="text-sm font-semibold text-white">
                          Generate Practice MCQs
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 group-hover:text-neutral-300">
                        Interactive practice quiz with instant scoring
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleSend(
                          "Explain Quantum Superposition and Schrödinger's Cat in simple intuitive terms."
                        )
                      }
                      className="p-4 rounded-2xl bg-[#2f2f2f]/60 hover:bg-[#2f2f2f] border border-white/5 hover:border-white/15 text-left transition-all active:scale-[0.99] group shadow-sm"
                    >
                      <div className="flex items-center gap-2 mb-1.5 text-emerald-400">
                        <BookOpen className="w-4 h-4" />
                        <span className="text-sm font-semibold text-white">
                          Explain Any Concept
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 group-hover:text-neutral-300">
                        Break down tough physics or math concepts easily
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleSend(
                          "Remember that I have Physics coaching every Wednesday from 3:00 PM to 5:00 PM."
                        )
                      }
                      className="p-4 rounded-2xl bg-[#2f2f2f]/60 hover:bg-[#2f2f2f] border border-white/5 hover:border-white/15 text-left transition-all active:scale-[0.99] group shadow-sm"
                    >
                      <div className="flex items-center gap-2 mb-1.5 text-amber-400">
                        <Bot className="w-4 h-4" />
                        <span className="text-sm font-semibold text-white">
                          Save Routine Memory
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 group-hover:text-neutral-300">
                        Teach your AI habits, coaching times & commitments
                      </p>
                    </button>
                  </div>
                </div>
              ) : (
                /* =========================================================== */
                /*  CONVERSATION MESSAGES STREAM (ChatGPT Document Style)     */
                /* =========================================================== */
                <div className="space-y-6 pt-2 pb-6">
                  {messages.map((m) => {
                    const isUser = m.role === "user";

                    if (isUser) {
                      return (
                        <div key={m.id} className="flex justify-end">
                          <div className="max-w-[85%] sm:max-w-[70%] bg-[#2f2f2f] text-white px-5 py-3 rounded-[24px] text-[15px] leading-relaxed shadow-sm">
                            <p className="whitespace-pre-wrap">{m.content}</p>
                          </div>
                        </div>
                      );
                    }

                    // Assistant message: Clean flat document layout without chunky box borders
                    return (
                      <div key={m.id} className="group flex gap-3 items-start w-full">
                        {/* Circular AI Avatar */}
                        <div className="w-7 h-7 rounded-full bg-white/10 border border-white/10 flex items-center justify-center shrink-0 mt-0.5 text-primary">
                          <Sparkles className="w-4 h-4" />
                        </div>

                        {/* Text and Actions */}
                        <div className="flex-1 min-w-0 space-y-3">
                          <MarkdownText text={m.content} />

                          {/* Interactive Practice Quiz Launcher Card */}
                          {m.generatedQuiz && (
                            <div className="mt-3 p-4 rounded-2xl bg-[#171717] border border-white/10 space-y-3 max-w-lg">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-violet-400 flex items-center gap-1.5">
                                  <Sparkles className="w-3.5 h-3.5" />
                                  Interactive Quiz Ready
                                </span>
                                <span className="text-xs font-medium text-neutral-400">
                                  {m.generatedQuiz.questions.length} Questions
                                </span>
                              </div>

                              <h4 className="text-sm font-bold text-white">
                                {m.generatedQuiz.title}
                              </h4>

                              <button
                                type="button"
                                onClick={() => handleStartQuiz(m.generatedQuiz!)}
                                className="w-full py-2.5 px-4 rounded-xl bg-white text-black font-semibold text-xs flex items-center justify-center gap-2 hover:bg-neutral-200 active:scale-95 transition-all shadow-md"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                                <span>Start Practice Quiz</span>
                              </button>
                            </div>
                          )}

                          {/* Agentic Action Feedback Tags */}
                          {m.actionTaken?.type === "added_block" && (
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Routine block added to today</span>
                              <Link
                                href="/routine"
                                className="font-bold underline hover:text-emerald-300 ml-1"
                              >
                                View Routine →
                              </Link>
                            </div>
                          )}

                          {m.actionTaken?.type === "updated_notepad" && (
                            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-violet-500/10 border border-violet-500/20 text-xs text-violet-300">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Memory saved in routine notepad</span>
                              <Link
                                href="/routine/settings"
                                className="font-bold underline hover:text-violet-200 ml-1"
                              >
                                Open Settings →
                              </Link>
                            </div>
                          )}

                          {/* ChatGPT Style Copy Button Action Bar */}
                          <div className="pt-1 flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => handleCopyMessage(m.id, m.content)}
                              className="p-1 rounded hover:bg-white/5 text-neutral-400 hover:text-white transition-colors text-xs flex items-center gap-1"
                              title="Copy response"
                            >
                              {copiedId === m.id ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  <span className="text-[11px] text-emerald-400">Copied</span>
                                </>
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Thinking / Streaming Indicator */}
                  {isSending && (
                    <div className="flex gap-3 items-center">
                      <div className="w-7 h-7 rounded-full bg-white/10 border border-white/10 flex items-center justify-center shrink-0 text-primary">
                        <Sparkles className="w-4 h-4 animate-spin" />
                      </div>
                      <div className="flex items-center gap-1.5 text-neutral-400 text-sm">
                        <span className="inline-block w-2 h-2 rounded-full bg-neutral-400 animate-pulse" />
                        <span className="inline-block w-2 h-2 rounded-full bg-neutral-400 animate-pulse delay-150" />
                        <span className="inline-block w-2 h-2 rounded-full bg-neutral-400 animate-pulse delay-300" />
                      </div>
                    </div>
                  )}

                  <div ref={bottomRef} />
                </div>
              )}
            </div>
          </div>

          {/* ================================================================= */}
          {/*  CHATGPT SIGNATURE FLOATING INPUT BAR                            */}
          {/* ================================================================= */}
          <div className="p-4 max-w-3xl w-full mx-auto shrink-0">
            {/* Listening State Banner */}
            {isListening && (
              <div className="mb-2 flex items-center justify-center gap-2 text-xs font-semibold text-rose-400 animate-pulse">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span>Listening to your voice... Speak now</span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="relative rounded-[26px] bg-[#2f2f2f] border border-white/10 shadow-2xl focus-within:border-white/20 transition-all p-2 pl-4"
            >
              <div className="flex items-end gap-2">
                {/* Voice Dictation VoicePill (React Bits) */}
                <div className="mb-0.5 shrink-0 flex items-center">
                  <VoicePill
                    accentColor="#8b5cf6"
                    iconColor="#a1a1aa"
                    background="#232326"
                    size={30}
                    shape="pill"
                    reach={8}
                    showTime
                    waveform
                    slideToCancel
                    cancelDistance={64}
                    attack={40}
                    release={240}
                    sensitivity={1}
                    floor={0.1}
                    openDuration={200}
                    pressScale={0.95}
                    mode="auto"
                    reactive="mic"
                    ariaLabel="Voice dictation"
                    onStart={() => startSpeechRecognition()}
                    onStop={({ reason }) => stopSpeechRecognition(reason)}
                  />
                </div>

                {/* Multiline auto-expanding textarea */}
                <textarea
                  ref={textareaRef}
                  rows={1}
                  placeholder={`Message ${aiName}...`}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  disabled={isSending}
                  className="flex-1 max-h-44 bg-transparent text-white placeholder:text-neutral-400 text-sm font-normal resize-none focus:outline-none py-1.5 leading-6"
                />

                {/* Circular Send Arrow Button */}
                <button
                  type="submit"
                  disabled={isSending || !input.trim()}
                  className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:bg-neutral-200 active:scale-95 transition-all disabled:bg-[#3f3f3f] disabled:text-[#8e8e8e] disabled:cursor-not-allowed mb-0.5 shrink-0 shadow-sm"
                  aria-label="Send"
                >
                  <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>
            </form>

            <p className="text-[11px] text-neutral-400 text-center mt-2 font-normal">
              {aiName} can make mistakes. Verify important academic information.
            </p>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/*  INTERACTIVE MCQ PRACTICE MODAL (Instant Quiz Launcher)             */}
      {/* =================================================================== */}
      {activeQuiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
            onClick={() => setActiveQuiz(null)}
          />

          <div className="relative w-full max-w-lg rounded-3xl bg-[#1e1e1e] border border-white/15 shadow-2xl p-6 overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-white">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-violet-400">
                  Interactive Practice Quiz
                </span>
                <h3 className="font-bold text-lg text-white">
                  {activeQuiz.title}
                </h3>
              </div>
              <button
                onClick={() => setActiveQuiz(null)}
                className="w-8 h-8 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!quizCompleted ? (
              <div className="space-y-4">
                {/* Progress */}
                <div className="flex items-center justify-between text-xs font-semibold text-neutral-400">
                  <span>
                    Question {currentQuizIndex + 1} of {activeQuiz.questions.length}
                  </span>
                  <span className="text-primary font-bold">Score: {quizScore}</span>
                </div>

                {/* Question */}
                <p className="text-sm sm:text-base font-semibold text-white">
                  {activeQuiz.questions[currentQuizIndex].question}
                </p>

                {/* Options */}
                <div className="space-y-2">
                  {activeQuiz.questions[currentQuizIndex].options.map((opt, idx) => {
                    const isSelected = selectedOption === idx;
                    const isCorrect = idx === activeQuiz.questions[currentQuizIndex].answerIndex;
                    let style = "bg-white/5 hover:bg-white/10 border-white/10 text-neutral-200";

                    if (selectedOption !== null) {
                      if (isCorrect) {
                        style = "bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold";
                      } else if (isSelected) {
                        style = "bg-rose-500/20 border-rose-500 text-rose-300 font-bold";
                      }
                    }

                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={selectedOption !== null}
                        onClick={() => handleSelectQuizOption(idx)}
                        className={`w-full p-3.5 rounded-xl border text-left text-xs sm:text-sm transition-all flex items-center justify-between gap-2 ${style}`}
                      >
                        <span>{opt}</span>
                        {selectedOption !== null && isCorrect && (
                          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        )}
                        {selectedOption !== null && isSelected && !isCorrect && (
                          <X className="w-4 h-4 text-rose-400 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Explanation */}
                {selectedOption !== null && (
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-xs text-neutral-300 space-y-1 animate-in fade-in duration-150">
                    <span className="font-bold text-white block">Explanation:</span>
                    <p>{activeQuiz.questions[currentQuizIndex].explanation}</p>
                  </div>
                )}

                {/* Next button */}
                {selectedOption !== null && (
                  <button
                    type="button"
                    onClick={handleNextQuizQuestion}
                    className="w-full py-3 px-4 rounded-xl bg-white text-black hover:bg-neutral-200 font-bold text-xs sm:text-sm transition-all"
                  >
                    {currentQuizIndex + 1 < activeQuiz.questions.length
                      ? "Next Question →"
                      : "Finish Quiz"}
                  </button>
                )}
              </div>
            ) : (
              /* Quiz Finished View */
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-white">Quiz Completed!</h4>
                  <p className="text-xs text-neutral-400 mt-1">
                    You scored <span className="font-bold text-emerald-400">{quizScore}</span> out of{" "}
                    <span className="font-bold text-white">{activeQuiz.questions.length}</span>!
                  </p>
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleStartQuiz(activeQuiz)}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Retry
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveQuiz(null)}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-white text-black hover:bg-neutral-200 text-xs font-bold transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
