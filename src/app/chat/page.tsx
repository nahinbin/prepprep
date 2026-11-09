"use client";

import { useState, useRef, useEffect } from "react";
import {
  Send,
  Sparkles,
  Bot,
  User,
  CheckCircle2,
  Calendar,
} from "lucide-react";
import { AppShell, NavMenu } from "@/components/NavMenu";
import { sendChatMessage, ChatMessage } from "@/app/actions/ai-chat";
import Link from "next/link";

const STARTER_PROMPTS = [
  "Add topics to Mathematics: Limits, Derivatives, Integrals, Matrices, Probability, Vectors",
  "Generate 10 high-yield exam topics for Physics",
  "How should I structure my study blocks for final exams?",
  "I have 3 hours tonight, what should I study?",
];

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    content: `👋 Hello! I'm your **MCQ Arena AI Study Coach**.\n\nYou can ask me study advice, or give me commands like:\n\n> \`Add topics to [Subject]: Topic 1, Topic 2, Topic 3...\`\n\nI will instantly insert the new topics into your database and skip any that you already have! What would you like to do?`,
    timestamp: 0,
  },
];

let messageCounter = 0;
function nextMessageId(prefix: string): string {
  messageCounter += 1;
  return `${prefix}_${messageCounter}`;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || isSending) return;

    const userMsg: ChatMessage = {
      id: nextMessageId("user"),
      role: "user",
      content: text,
      timestamp: messages.length + 1,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsSending(true);

    try {
      const history = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

      const reply = await sendChatMessage(text, history);
      setMessages((prev) => [...prev, reply]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: nextMessageId("err"),
          role: "assistant",
          content: "Sorry, I had trouble processing that. Please try again!",
          timestamp: messages.length + 2,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <AppShell showBottomBar={false}>
      <div className="w-full max-w-3xl mx-auto px-4 pt-4 pb-6 md:pt-6 md:pb-8 flex flex-col h-[calc(100dvh-2rem)] md:h-[calc(100dvh-3rem)]">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-600 to-primary text-white flex items-center justify-center shadow-lg shadow-violet-600/30">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-foreground">AI Study Assistant</h1>
              <p className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Active · Connected to your subjects & routine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/routine"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
            >
              <Calendar className="w-4 h-4 text-primary" />
              <span className="hidden sm:inline">Daily Routine</span>
            </Link>
            <NavMenu />
          </div>
        </div>

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
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
                      ? "bg-primary text-white"
                      : "bg-violet-500/20 text-violet-400 border border-violet-500/30"
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                </div>

                {/* Message Bubble */}
                <div
                  className={`max-w-[85%] rounded-3xl p-4 text-sm leading-relaxed ${
                    isUser
                      ? "bg-primary text-primary-foreground font-semibold rounded-tr-sm"
                      : "bg-card border border-white/10 text-foreground font-medium rounded-tl-sm shadow-md"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>

                  {/* If action was taken (e.g. bulk added topics) */}
                  {m.actionTaken?.type === "added_topics" && (
                    <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" />
                        Database Updated
                      </span>
                      <Link
                        href="/subjects"
                        className="text-xs font-black text-primary hover:underline"
                      >
                        View in Subjects →
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isSending && (
            <div className="flex gap-3 items-center">
              <div className="w-8 h-8 rounded-xl bg-violet-500/20 text-violet-400 flex items-center justify-center border border-violet-500/30">
                <Sparkles className="w-4 h-4 animate-spin" />
              </div>
              <div className="p-3.5 rounded-2xl bg-card border border-white/10 text-xs font-bold text-muted-foreground animate-pulse">
                Thinking and preparing response...
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Quick Suggestion Chips */}
        {messages.length <= 2 && (
          <div className="pb-3 shrink-0">
            <span className="text-[11px] font-bold text-muted-foreground block mb-1.5 pl-1">
              Try asking:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handleSend(prompt)}
                  disabled={isSending}
                  className="text-xs font-medium px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-muted-foreground hover:text-foreground text-left transition-all disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="shrink-0 flex items-center gap-2 pt-2"
        >
          <input
            type="text"
            placeholder="Ask AI or type: Add topics to [Subject]: Topic 1, Topic 2..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isSending}
            className="flex-1 px-4 py-3 rounded-2xl bg-card border border-white/10 text-foreground placeholder:text-muted-foreground text-sm font-medium focus:outline-none focus:border-primary transition-all disabled:opacity-50"
          />

          <button
            type="submit"
            disabled={isSending || !input.trim()}
            className="w-12 h-12 rounded-2xl bg-gradient-to-r from-violet-600 to-primary text-white flex items-center justify-center shadow-lg shadow-violet-600/30 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none"
            aria-label="Send message"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </AppShell>
  );
}

