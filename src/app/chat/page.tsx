"use client";

import { useState, useRef, useEffect } from "react";
import {
  Send,
  Sparkles,
  Bot,
  User,
  CheckCircle2,
  Calendar,
  Mic,
  MicOff,
  Plus,
  Trash2,
  MessageSquare,
  PanelLeftClose,
  PanelLeft,
  Flame,
  Check,
  X,
  Play,
  RotateCcw,
} from "lucide-react";
import { AppShell, NavMenu } from "@/components/NavMenu";
import {
  sendChatMessage,
  ChatMessage,
  GeneratedQuiz,
} from "@/app/actions/ai-chat";
import {
  getAiAssistantName,
  getAiPermanentNotes,
  setAiPermanentNotes,
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

const CHAT_SESSIONS_KEY = "mcq_chat_sessions_v2";

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
    content: `👋 Hello! I'm **${aiName}**, your personal study coach.\n\nI can help you with anything:\n• **Generate MCQs**: Paste lecture notes or paragraphs and say *"Make MCQs from this"*\n• **Manage Routine**: Say *"Add a study block for Math at 3 PM"* or *"Build my schedule for today"*\n• **Remember Habits**: Say *"Remember that I have coaching on Wednesdays at 2:30 PM"*\n• **Explain Concepts**: Ask me anything in Math, Physics, Accounting, or Biology!`,
    timestamp: Date.now(),
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

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

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

  // 4. Voice Dictation Setup
  const toggleVoiceDictation = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    if (
      typeof window === "undefined" ||
      (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window))
    ) {
      alert("Voice speech recognition is not supported in this browser. Please use Google Chrome or Edge.");
      return;
    }

    try {
      const windowObj = window as unknown as {
        SpeechRecognition?: new () => {
          continuous: boolean;
          interimResults: boolean;
          lang: string;
          start: () => void;
          stop: () => void;
          onstart: () => void;
          onresult: (e: {
            resultIndex: number;
            results: Array<Array<{ transcript: string }>>;
          }) => void;
          onerror: () => void;
          onend: () => void;
        };
        webkitSpeechRecognition?: new () => {
          continuous: boolean;
          interimResults: boolean;
          lang: string;
          start: () => void;
          stop: () => void;
          onstart: () => void;
          onresult: (e: {
            resultIndex: number;
            results: Array<Array<{ transcript: string }>>;
          }) => void;
          onerror: () => void;
          onend: () => void;
        };
      };

      const SpeechRecognitionClass =
        windowObj.SpeechRecognition || windowObj.webkitSpeechRecognition;

      if (!SpeechRecognitionClass) {
        alert("Speech recognition not supported in this browser.");
        return;
      }

      const recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript.trim()) {
          setInput((prev) => (prev ? `${prev} ${transcript.trim()}` : transcript.trim()));
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.error("Speech recognition error:", e);
      setIsListening(false);
    }
  };

  // 5. Send Message Handler
  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || isSending) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    const userMsg: ChatMessage = {
      id: "usr_" + Date.now().toString(36),
      role: "user",
      content: text,
      timestamp: Date.now(),
    };

    const newHistory = [...messages, userMsg];
    persistMessages(newHistory);
    setInput("");
    setIsSending(true);

    try {
      const history = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

      const reply = await sendChatMessage(text, history, {
        aiName,
        notepadNotes: getAiPermanentNotes(),
      });

      // Handle Agentic Action Execution on client
      if (reply.actionTaken) {
        if (reply.actionTaken.type === "added_block" && reply.actionTaken.blockData) {
          const b = reply.actionTaken.blockData;
          upsertBlock({
            id: generateBlockId(),
            date: formatDateKey(new Date()),
            type: b.type,
            title: b.title,
            timeMode: b.startTime ? "single" : "anytime",
            startTime: b.startTime,
            endTime: b.endTime,
            isCompleted: false,
            subject: b.subject,
            topic: b.topic,
            notes: b.notes,
            order: Date.now(),
            createdAt: Date.now(),
          });
        } else if (
          reply.actionTaken.type === "updated_notepad" &&
          reply.actionTaken.newNotepadText
        ) {
          const currentNotes = getAiPermanentNotes();
          const merged = currentNotes
            ? `${currentNotes}\n• ${reply.actionTaken.newNotepadText}`
            : reply.actionTaken.newNotepadText;
          setAiPermanentNotes(merged);
        }
      }

      persistMessages([...newHistory, reply]);
    } catch (err) {
      console.error("Chat error:", err);
      persistMessages([
        ...newHistory,
        {
          id: "err_" + Date.now().toString(36),
          role: "assistant",
          content: "Sorry, I had trouble processing that. Please try again!",
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  // 6. Session Management
  const handleNewChat = () => {
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
  };

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

  // 7. Interactive Practice Quiz Handlers
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

  return (
    <AppShell showBottomBar={false}>
      <div className="relative flex h-[100dvh] w-full overflow-hidden bg-background">
        {/* ================================================================= */}
        {/*  CHATGPT / GEMINI STYLE SIDEBAR (Sessions & History)             */}
        {/* ================================================================= */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-72 bg-card border-r border-white/10 flex flex-col transition-transform duration-300 md:relative md:translate-x-0 ${
            sidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
          }`}
        >
          {/* Sidebar Top: New Chat + Close button on mobile */}
          <div className="p-4 border-b border-white/5 flex items-center justify-between gap-2">
            <button
              onClick={handleNewChat}
              className="flex-1 py-2.5 px-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-primary text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-violet-600/25 hover:brightness-110 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>New Chat</span>
            </button>

            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden w-9 h-9 rounded-xl hover:bg-white/10 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Temporary Chat Toggle (Incognito / Not saved) */}
          <div className="px-4 py-2 border-b border-white/5 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              Temporary Chat
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
                      content: `🔥 **Temporary Chat activated.** Messages in this session will not be saved to your history.`,
                      timestamp: Date.now(),
                    },
                  ]);
                }
              }}
              className={`w-9 h-5 rounded-full transition-colors relative ${
                isTemporaryChat ? "bg-amber-500" : "bg-white/10"
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
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground px-2 mb-1 block">
              Recent Chats
            </span>

            {sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => handleSelectSession(s.id)}
                className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer text-xs font-semibold transition-all ${
                  activeSessionId === s.id && !isTemporaryChat
                    ? "bg-primary/15 text-primary border border-primary/25"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-70" />
                  <span className="truncate">{s.title || "Chat Session"}</span>
                </div>

                <button
                  onClick={(e) => handleDeleteSession(s.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-danger rounded-lg transition-all"
                  title="Delete chat"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Sidebar Bottom Nav Links */}
          <div className="p-3 border-t border-white/5 space-y-1">
            <Link
              href="/routine"
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
            >
              <Calendar className="w-4 h-4 text-primary" />
              <span>Daily Routine</span>
            </Link>
            <Link
              href="/routine/settings"
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
            >
              <Bot className="w-4 h-4 text-violet-400" />
              <span>AI Settings & Name</span>
            </Link>
          </div>
        </aside>

        {/* Sidebar Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ================================================================= */}
        {/*  MAIN CHAT CONTAINER (ChatGPT / Claude Clean Modern View)         */}
        {/* ================================================================= */}
        <div className="flex-1 flex flex-col h-full min-w-0">
          {/* Top Header Bar */}
          <header className="h-14 px-4 border-b border-white/5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="w-9 h-9 rounded-xl hover:bg-white/10 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
                aria-label="Toggle Sidebar"
              >
                {sidebarOpen ? (
                  <PanelLeftClose className="w-5 h-5" />
                ) : (
                  <PanelLeft className="w-5 h-5" />
                )}
              </button>

              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-foreground">
                  {aiName}
                </span>
                <span className="text-[10px] font-black uppercase tracking-wider bg-violet-500/20 text-violet-300 border border-violet-500/30 px-2 py-0.5 rounded-full">
                  AI Study Coach
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/routine"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
              >
                <Calendar className="w-3.5 h-3.5 text-primary" />
                <span>Routine</span>
              </Link>
              <NavMenu />
            </div>
          </header>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto px-4 py-6 max-w-3xl w-full mx-auto space-y-6">
            {messages.map((m) => {
              const isUser = m.role === "user";

              return (
                <div
                  key={m.id}
                  className={`flex gap-3 items-start ${isUser ? "flex-row-reverse" : "flex-row"}`}
                >
                  {/* Avatar */}
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      isUser
                        ? "bg-primary text-white shadow-md shadow-primary/20"
                        : "bg-violet-600/20 text-violet-300 border border-violet-500/30"
                    }`}
                  >
                    {isUser ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                  </div>

                  {/* Bubble */}
                  <div
                    className={`max-w-[85%] rounded-3xl p-4 text-sm leading-relaxed ${
                      isUser
                        ? "bg-primary text-primary-foreground font-semibold rounded-tr-sm"
                        : "bg-card border border-white/10 text-foreground font-medium rounded-tl-sm shadow-md"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{m.content}</p>

                    {/* Interactive Quiz Launcher Card */}
                    {m.generatedQuiz && (
                      <div className="mt-3.5 p-3.5 rounded-2xl bg-violet-950/30 border border-violet-500/40 space-y-2.5 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-black uppercase tracking-wider text-violet-300 flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5" />
                            Practice Quiz Ready
                          </span>
                          <span className="text-xs font-bold text-muted-foreground">
                            {m.generatedQuiz.questions.length} Questions
                          </span>
                        </div>

                        <h4 className="text-sm font-black text-foreground">
                          {m.generatedQuiz.title}
                        </h4>

                        <button
                          type="button"
                          onClick={() => handleStartQuiz(m.generatedQuiz!)}
                          className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-violet-600 to-primary hover:brightness-110 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-violet-600/30 transition-all active:scale-95"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Start Practice Quiz Now</span>
                        </button>
                      </div>
                    )}

                    {/* Database Action Badges */}
                    {m.actionTaken?.type === "added_topics" && (
                      <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Database Updated
                        </span>
                        <Link
                          href="/subjects"
                          className="text-xs font-black text-primary hover:underline"
                        >
                          View Subjects →
                        </Link>
                      </div>
                    )}

                    {m.actionTaken?.type === "added_block" && (
                      <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Routine Block Scheduled
                        </span>
                        <Link
                          href="/routine"
                          className="text-xs font-black text-primary hover:underline"
                        >
                          Open Routine →
                        </Link>
                      </div>
                    )}

                    {m.actionTaken?.type === "updated_notepad" && (
                      <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Notepad Saved
                        </span>
                        <Link
                          href="/routine/settings"
                          className="text-xs font-black text-primary hover:underline"
                        >
                          View in Settings →
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {isSending && (
              <div className="flex gap-3 items-center">
                <div className="w-8 h-8 rounded-xl bg-violet-600/20 text-violet-300 flex items-center justify-center border border-violet-500/30">
                  <Sparkles className="w-4 h-4 animate-spin" />
                </div>
                <div className="p-3.5 rounded-2xl bg-card border border-white/10 text-xs font-bold text-muted-foreground animate-pulse">
                  {aiName} is thinking...
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Bottom Input Area (Modern ChatGPT Pill Bar with Voice Dictation) */}
          <div className="p-4 max-w-3xl w-full mx-auto shrink-0">
            {/* Listening indicator */}
            {isListening && (
              <div className="mb-2 flex items-center justify-center gap-2 text-xs font-bold text-danger animate-pulse">
                <span className="w-2.5 h-2.5 rounded-full bg-danger" />
                Listening to your voice... Speak now
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2 p-1.5 rounded-3xl bg-card border border-white/10 shadow-xl focus-within:border-primary transition-all"
            >
              {/* Voice Dictation Mic Button */}
              <button
                type="button"
                onClick={toggleVoiceDictation}
                className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
                  isListening
                    ? "bg-danger text-white animate-pulse"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                }`}
                title={isListening ? "Stop listening" : "Voice dictation (Speech to text)"}
                aria-label="Voice dictation"
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              <input
                type="text"
                placeholder={`Ask ${aiName}, paste notes to make MCQs, or say 'Add block' ...`}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isSending}
                className="flex-1 px-2 py-2 bg-transparent text-foreground placeholder:text-muted-foreground text-sm font-medium focus:outline-none"
              />

              <button
                type="submit"
                disabled={isSending || !input.trim()}
                className="w-10 h-10 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-md shadow-primary/25 hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none"
                aria-label="Send"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/*  INTERACTIVE MCQ PRACTICE MODAL (Launched directly from chat!)      */}
      {/* =================================================================== */}
      {activeQuiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
            onClick={() => setActiveQuiz(null)}
          />

          <div className="relative w-full max-w-lg rounded-3xl bg-card border border-white/10 shadow-2xl p-6 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/5 mb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-violet-400">
                  Interactive Practice Quiz
                </span>
                <h3 className="font-black text-lg text-foreground">
                  {activeQuiz.title}
                </h3>
              </div>
              <button
                onClick={() => setActiveQuiz(null)}
                className="w-8 h-8 rounded-xl hover:bg-white/10 text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!quizCompleted ? (
              <div className="space-y-4">
                {/* Progress */}
                <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
                  <span>
                    Question {currentQuizIndex + 1} of {activeQuiz.questions.length}
                  </span>
                  <span className="text-primary font-black">Score: {quizScore}</span>
                </div>

                {/* Question */}
                <p className="text-sm sm:text-base font-bold text-foreground">
                  {activeQuiz.questions[currentQuizIndex].question}
                </p>

                {/* Options */}
                <div className="space-y-2">
                  {activeQuiz.questions[currentQuizIndex].options.map((opt, idx) => {
                    const isSelected = selectedOption === idx;
                    const isCorrect = idx === activeQuiz.questions[currentQuizIndex].answerIndex;
                    let style = "bg-white/5 hover:bg-white/10 border-white/10 text-foreground";

                    if (selectedOption !== null) {
                      if (isCorrect) {
                        style = "bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold";
                      } else if (isSelected) {
                        style = "bg-danger/20 border-danger text-danger font-bold";
                      }
                    }

                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={selectedOption !== null}
                        onClick={() => handleSelectQuizOption(idx)}
                        className={`w-full p-3 rounded-2xl border text-left text-xs sm:text-sm font-semibold transition-all flex items-center justify-between gap-2 ${style}`}
                      >
                        <span>{opt}</span>
                        {selectedOption !== null && isCorrect && (
                          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                        )}
                        {selectedOption !== null && isSelected && !isCorrect && (
                          <X className="w-4 h-4 text-danger shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Explanation */}
                {selectedOption !== null && (
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-xs text-muted-foreground space-y-1 animate-in fade-in duration-150">
                    <span className="font-bold text-foreground block">Explanation:</span>
                    <p>{activeQuiz.questions[currentQuizIndex].explanation}</p>
                  </div>
                )}

                {/* Next button */}
                {selectedOption !== null && (
                  <button
                    type="button"
                    onClick={handleNextQuizQuestion}
                    className="w-full py-3 px-4 rounded-xl bg-primary hover:brightness-110 text-primary-foreground font-black text-xs sm:text-sm transition-all"
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
                <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-xl font-black text-foreground">Quiz Completed!</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    You scored <span className="font-bold text-emerald-400">{quizScore}</span> out of{" "}
                    <span className="font-bold">{activeQuiz.questions.length}</span>!
                  </p>
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleStartQuiz(activeQuiz)}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-foreground flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Retry
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveQuiz(null)}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-primary hover:brightness-110 text-primary-foreground text-xs font-black transition-colors"
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
