"use server";

import { generateGeminiText, generateGeminiJson, isGeminiConfigured } from "@/lib/gemini";
import { bulkAddTopicsToSubject, getUserSubjectsAndTopics, createSubject } from "@/app/actions/subjects";
import { getSession } from "@/app/actions/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export const DEFAULT_AI_NAME = "AI Assistant";

export interface GeneratedQuizQuestion {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

export interface GeneratedQuiz {
  title: string;
  subject?: string;
  questions: GeneratedQuizQuestion[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  actionTaken?: {
    type:
      | "added_topics"
      | "created_subject"
      | "study_tip"
      | "added_block"
      | "updated_notepad"
      | "changed_name"
      | "generated_schedule"
      | "created_quiz";
    subjectName?: string;
    addedCount?: number;
    skippedCount?: number;
    topics?: string[];
    blockData?: {
      type: "study" | "normal";
      title: string;
      subject?: string;
      topic?: string;
      startTime?: string;
      endTime?: string;
      notes?: string;
    };
    newNotepadText?: string;
    newName?: string;
    scheduleSummary?: string;
  };
  generatedQuiz?: GeneratedQuiz;
  timestamp: number;
}

export interface ChatContext {
  aiName?: string;
  notepadNotes?: string;
  activePresets?: string[];
}

export interface DbChatSessionSummary {
  id: string;
  title: string;
  updatedAt: number;
  messages: ChatMessage[];
}

/**
 * Get all chat sessions for the logged-in user from PostgreSQL database
 */
export async function getDbChatSessions(): Promise<DbChatSessionSummary[]> {
  try {
    const user = await getSession();
    if (!user) return [];

    const sessions = await prisma.aiChatSession.findMany({
      where: { userId: user.id },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return sessions.map((s) => ({
      id: s.id,
      title: s.title,
      updatedAt: s.updatedAt.getTime(),
      messages: s.messages.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
        actionTaken: m.actionTaken ? JSON.parse(m.actionTaken) : undefined,
        generatedQuiz: m.quizData ? JSON.parse(m.quizData) : undefined,
        timestamp: m.createdAt.getTime(),
      })),
    }));
  } catch (err) {
    console.error("Failed to load DB chat sessions:", err);
    return [];
  }
}

/**
 * Create a new chat session in PostgreSQL for the logged-in user
 */
export async function createDbChatSession(title: string = "New Chat") {
  const user = await getSession();
  if (!user) return null;

  const session = await prisma.aiChatSession.create({
    data: {
      userId: user.id,
      title: title.slice(0, 50),
    },
  });

  return {
    id: session.id,
    title: session.title,
    updatedAt: session.updatedAt.getTime(),
    messages: [],
  };
}

/**
 * Delete a chat session in PostgreSQL for the logged-in user
 */
export async function deleteDbChatSession(sessionId: string) {
  const user = await getSession();
  if (!user) return { success: false };

  const session = await prisma.aiChatSession.findFirst({
    where: { id: sessionId, userId: user.id },
  });
  if (!session) return { success: false };

  await prisma.aiChatSession.delete({
    where: { id: sessionId },
  });

  return { success: true };
}

/**
 * Persist a chat message directly in PostgreSQL
 */
export async function saveDbChatMessage(sessionId: string, message: ChatMessage) {
  try {
    const user = await getSession();
    if (!user) return null;

    const session = await prisma.aiChatSession.findFirst({
      where: { id: sessionId, userId: user.id },
    });
    if (!session) return null;

    const record = await prisma.aiChatMessage.create({
      data: {
        sessionId,
        role: message.role,
        content: message.content,
        actionTaken: message.actionTaken ? JSON.stringify(message.actionTaken) : null,
        quizData: message.generatedQuiz ? JSON.stringify(message.generatedQuiz) : null,
      },
    });

    // Update session timestamp & title if it's the first user message
    const isFirstUser = message.role === "user" && session.title === "New Chat";
    await prisma.aiChatSession.update({
      where: { id: sessionId },
      data: {
        updatedAt: new Date(),
        ...(isFirstUser ? { title: message.content.slice(0, 40) } : {}),
      },
    });

    return record;
  } catch (err) {
    console.warn("Failed to save DB chat message:", err);
    return null;
  }
}

/**
 * Send a chat message, execute DB actions, generate response, and persist in PostgreSQL
 */
export async function sendChatMessage(
  message: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  context: ChatContext = {},
  sessionId?: string
): Promise<ChatMessage> {
  const user = await getSession();
  const trimmed = message.trim();
  const lower = trimmed.toLowerCase();

  // Determine AI name: from context, from user DB profile, or default "AI Assistant"
  let aiName = context.aiName?.trim();
  if (!aiName && user?.aiName) {
    aiName = user.aiName.trim();
  }
  if (!aiName) {
    aiName = DEFAULT_AI_NAME;
  }

  // 1. Detect if user is asking to change AI name
  // e.g. "change your name to Jarvis" or "call yourself Echo" or "your name is now Alex"
  const changeNameRegex = /(?:change\s+your\s+name\s+to|call\s+yourself|your\s+name\s+is\s+now|rename\s+yourself\s+to)\s+([a-zA-Z0-9_\-\s]{2,25})/i;
  const matchChangeName = trimmed.match(changeNameRegex);
  if (matchChangeName && user) {
    const newName = matchChangeName[1].trim();
    if (newName) {
      await prisma.user.update({
        where: { id: user.id },
        data: { aiName: newName },
      });
      revalidatePath("/chat");
      revalidatePath("/routine/settings");

      const responseMsg: ChatMessage = {
        id: "msg_" + Date.now().toString(36),
        role: "assistant",
        content: `Got it! My name is now **${newName}**. I'll remember this across your account and all future sessions! What shall we tackle next?`,
        actionTaken: {
          type: "changed_name",
          newName,
        },
        timestamp: Date.now(),
      };

      if (sessionId) {
        await saveDbChatMessage(sessionId, responseMsg);
      }
      return responseMsg;
    }
  }

  // 2. Detect if user is asking to create a new Subject
  // e.g. "create subject Physics" or "add subject Advanced Math"
  const createSubRegex = /^(?:please\s+)?(?:create|add|make)\s+subject\s+([a-zA-Z0-9_\s]+)$/i;
  const matchSub = trimmed.match(createSubRegex);
  if (matchSub && user) {
    const subName = matchSub[1].trim();
    if (subName) {
      const res = await createSubject(subName);
      if ("error" in res && res.error) {
        return {
          id: "msg_" + Date.now().toString(36),
          role: "assistant",
          content: `⚠️ Could not create subject: ${res.error}`,
          timestamp: Date.now(),
        };
      }
      const responseMsg: ChatMessage = {
        id: "msg_" + Date.now().toString(36),
        role: "assistant",
        content: `✅ I've created the subject **${subName}** in your account! You can now add topics or ask me to schedule study sessions for it.`,
        actionTaken: {
          type: "created_subject",
          subjectName: subName,
        },
        timestamp: Date.now(),
      };
      if (sessionId) {
        await saveDbChatMessage(sessionId, responseMsg);
      }
      return responseMsg;
    }
  }

  // 3. Detect if user is asking to add topics to a subject
  // e.g. "add these topics to math: algebra, calculus, geometry"
  const addTopicsRegex = /(?:add|create|put|insert)(?:\s+(?:these|the following|some|\d+))?\s+topics?\s+(?:to|in|under|for)\s+([a-zA-Z0-9_\s]+?)[:\n\-\?]([\s\S]+)/i;
  const matchTopics = trimmed.match(addTopicsRegex);

  if (matchTopics) {
    const rawSubject = matchTopics[1].replace(/^(?:the subject|subject)\s+/i, "").trim();
    const rawTopics = matchTopics[2];

    const extractedTopics = rawTopics
      .split(/[\n,;•\-\*]+/)
      .map((t) => t.replace(/^\s*\d+[\.\)\-]?\s*/, "").trim())
      .filter((t) => t.length > 1 && !t.startsWith("skip") && !t.startsWith("note"));

    if (extractedTopics.length > 0) {
      try {
        const res = await bulkAddTopicsToSubject(rawSubject, extractedTopics);
        if ("error" in res && res.error) {
          return {
            id: "msg_" + Date.now().toString(36),
            role: "assistant",
            content: `⚠️ Could not add topics: ${res.error}`,
            timestamp: Date.now(),
          };
        }
        if ("success" in res && res.success) {
          const responseMsg: ChatMessage = {
            id: "msg_" + Date.now().toString(36),
            role: "assistant",
            content: `✅ I've updated **${res.subjectName}** for you in your database!\n\n• **${res.addedCount}** new topics added\n• **${res.skippedCount}** duplicates skipped\n\nAdded:\n${res.addedTopics.slice(0, 10).map((t) => `• ${t}`).join("\n")}${res.addedTopics.length > 10 ? `\n• ...and ${res.addedTopics.length - 10} more` : ""}\n\nYou can now study these or practice them in MCQ Arena!`,
            actionTaken: {
              type: "added_topics",
              subjectName: res.subjectName,
              addedCount: res.addedCount,
              skippedCount: res.skippedCount,
              topics: res.addedTopics,
            },
            timestamp: Date.now(),
          };
          if (sessionId) {
            await saveDbChatMessage(sessionId, responseMsg);
          }
          return responseMsg;
        }
      } catch {
        return {
          id: "msg_" + Date.now().toString(36),
          role: "assistant",
          content: `⚠️ Please log in first so I can save these topics to your account database! (Extracted ${extractedTopics.length} topics for **${rawSubject}**).`,
          timestamp: Date.now(),
        };
      }
    }
  }

  // 4. Detect if user is asking to generate MCQs from text/reading
  const isMcqRequest =
    lower.includes("make mcq") ||
    lower.includes("create mcq") ||
    lower.includes("generate mcq") ||
    lower.includes("make questions") ||
    lower.includes("quiz me") ||
    lower.includes("test me on") ||
    (lower.includes("mcq") && trimmed.length > 80);

  if (isMcqRequest && isGeminiConfigured()) {
    try {
      const quizPrompt = `Create 4 high-yield multiple-choice questions from the following text/concept:
"${trimmed}"

Return valid raw JSON matching this shape:
{
  "title": "Short descriptive quiz title",
  "subject": "Subject name or General",
  "questions": [
    {
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answerIndex": 0,
      "explanation": "Clear explanation of why this is correct."
    }
  ]
}`;

      const generated = await generateGeminiJson<GeneratedQuiz>(quizPrompt, {
        systemInstruction: "You are an elite exam question creator. Generate high-quality conceptual MCQs with 4 options each.",
        temperature: 0.3,
      });

      if (generated && Array.isArray(generated.questions) && generated.questions.length > 0) {
        const responseMsg: ChatMessage = {
          id: "msg_" + Date.now().toString(36),
          role: "assistant",
          content: `🎯 I generated a **${generated.questions.length}-question practice quiz** from your notes!\n\nClick **Start Practice Quiz** below to test yourself right now:`,
          actionTaken: {
            type: "created_quiz",
          },
          generatedQuiz: generated,
          timestamp: Date.now(),
        };
        if (sessionId) {
          await saveDbChatMessage(sessionId, responseMsg);
        }
        return responseMsg;
      }
    } catch (e) {
      console.warn("Gemini quiz generation error:", e);
    }
  }

  // Fallback MCQ creation if requested but Gemini failed or not configured
  if (isMcqRequest) {
    const topicHint = trimmed.slice(0, 40).replace(/[^\w\s]/gi, "");
    const fallbackQuiz: ChatMessage = {
      id: "msg_" + Date.now().toString(36),
      role: "assistant",
      content: `🎯 I've prepared a practice quiz on **${topicHint || "Core Concepts"}**!\n\nClick **Start Practice Quiz** to test your knowledge:`,
      actionTaken: {
        type: "created_quiz",
      },
      generatedQuiz: {
        title: `Quiz: ${topicHint || "Practice Quiz"}`,
        subject: "General",
        questions: [
          {
            question: `What is the primary high-yield concept highlighted in: "${trimmed.slice(0, 60)}..."?`,
            options: [
              "Key foundational definition and principles",
              "Secondary corollary hypothesis",
              "Unrelated experimental artifact",
              "Standard boundary condition",
            ],
            answerIndex: 0,
            explanation: "Core fundamentals and active recall provide the highest exam score improvement.",
          },
          {
            question: "How should this concept be applied under time constraints in exams?",
            options: [
              "Eliminate extreme distractors and verify formulas",
              "Skip without reading the question stem",
              "Only guess option C",
              "Memorize without understanding mechanisms",
            ],
            answerIndex: 0,
            explanation: "Elimination strategy and verified formulas give maximum accuracy.",
          },
        ],
      },
      timestamp: Date.now(),
    };
    if (sessionId) {
      await saveDbChatMessage(sessionId, fallbackQuiz);
    }
    return fallbackQuiz;
  }

  // 5. Detect if user is asking to add a routine block
  const addBlockMatch = trimmed.match(/(?:add|create|schedule)\s+(?:a\s+)?(study|normal)?\s*block(?:\s+for|\s+to|\s*:)?\s*([^,\n]+?)(?:\s+(?:at|from)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?))?/i);
  if (addBlockMatch && user) {
    const rawType = (addBlockMatch[1] || "").toLowerCase() === "study" ? "study" : "normal";
    const rawSubjectOrTitle = addBlockMatch[2].trim();
    const rawTime = addBlockMatch[3] ? addBlockMatch[3].trim() : undefined;

    // Persist directly to DB
    const now = new Date();
    const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    await prisma.routineBlock.create({
      data: {
        userId: user.id,
        date: dateKey,
        type: rawType,
        title: rawSubjectOrTitle,
        timeMode: "range",
        startTime: rawTime || "15:00",
        endTime: "16:00",
        subject: rawType === "study" ? rawSubjectOrTitle : null,
      },
    });
    revalidatePath("/routine");

    const blockMsg: ChatMessage = {
      id: "msg_" + Date.now().toString(36),
      role: "assistant",
      content: `📅 I've added a **${rawType === "study" ? "Study Block" : "Block"}** to your Daily Routine for today: **${rawSubjectOrTitle}**${rawTime ? ` at ${rawTime}` : ""}!\n\nIt is now saved in your routine schedule.`,
      actionTaken: {
        type: "added_block",
        blockData: {
          type: rawType,
          title: rawSubjectOrTitle,
          subject: rawType === "study" ? rawSubjectOrTitle : undefined,
          startTime: rawTime,
        },
      },
      timestamp: Date.now(),
    };
    if (sessionId) {
      await saveDbChatMessage(sessionId, blockMsg);
    }
    return blockMsg;
  }

  // 6. Detect if user is asking to update permanent notepad
  if (lower.startsWith("remember") || lower.includes("add to notepad") || lower.includes("save to notepad") || lower.includes("add to my notes")) {
    const cleanNote = trimmed.replace(/^(?:remember\s+(?:that)?|add\s+to\s+(?:my\s+)?notepad(?:\s*:)?|save\s+to\s+(?:my\s+)?notepad(?:\s*:)?|add\s+to\s+my\s+notes(?:\s*:)?)/i, "").trim();
    if (cleanNote && user) {
      const currentNotes = user.aiNotepad || "";
      const updatedNotes = currentNotes ? `${currentNotes}\n• ${cleanNote}` : `• ${cleanNote}`;
      await prisma.user.update({
        where: { id: user.id },
        data: { aiNotepad: updatedNotes },
      });
      revalidatePath("/routine/settings");

      const noteMsg: ChatMessage = {
        id: "msg_" + Date.now().toString(36),
        role: "assistant",
        content: `📝 Got it! I've saved that into your **Routine Notepad**:\n\n> "${cleanNote}"\n\nI will remember this whenever building your daily schedules!`,
        actionTaken: {
          type: "updated_notepad",
          newNotepadText: cleanNote,
        },
        timestamp: Date.now(),
      };
      if (sessionId) {
        await saveDbChatMessage(sessionId, noteMsg);
      }
      return noteMsg;
    }
  }

  // 7. Fetch subjects & topics context
  let subjectsContext = "";
  try {
    const userSubjects = await getUserSubjectsAndTopics();
    subjectsContext = userSubjects
      .map((s) => `• ${s.name} (${s.topics.length} topics: ${s.topics.slice(0, 8).join(", ")})`)
      .join("\n");
  } catch (err) {
    console.warn("Failed to fetch subjects context for AI chat:", err);
  }

  // 8. Call Gemini LLM if configured
  if (isGeminiConfigured()) {
    try {
      const systemInstruction = `You are ${aiName}, the student's personal AI study coach and academic partner for MCQ Arena.
You are warm, brilliant, encouraging, and deeply knowledgeable across STEM, mathematics, accounting, finance, physics, chemistry, biology, medicine, and business.
Always refer to yourself as ${aiName}.
You have direct knowledge of the student's subjects:
${subjectsContext || "No subjects added yet."}
Permanent Notepad Rules:
${context.notepadNotes || user?.aiNotepad || "Standard schedule."}

Your capabilities:
1. You can teach and explain complex problems step-by-step.
2. If the student gives you notes or readings, you can create MCQs from them.
3. You can manage routine blocks, topics, and exam strategies.
4. Keep explanations clear, engaging, and exam-focused. Answer in good markdown formatting.`;

      const conversationPrompt =
        history
          .slice(-6)
          .map((h) => `${h.role === "user" ? "Student" : aiName}: ${h.content}`)
          .join("\n\n") + `\n\nStudent: ${trimmed}\n${aiName}:`;

      const reply = await generateGeminiText(conversationPrompt, {
        systemInstruction,
        temperature: 0.6,
      });

      const geminiMsg: ChatMessage = {
        id: "msg_" + Date.now().toString(36),
        role: "assistant",
        content: reply,
        timestamp: Date.now(),
      };
      if (sessionId) {
        await saveDbChatMessage(sessionId, geminiMsg);
      }
      return geminiMsg;
    } catch (err) {
      console.warn("Gemini chat error, fallback to smart reply:", err);
    }
  }

  // 9. Smart Conversational Fallback
  let smartReply = "";
  if (lower.includes("hello") || lower.includes("hi") || lower.includes("hey") || lower.includes("who are you")) {
    smartReply = `Hey! I'm **${aiName}**, your personal study coach. I'm here to help you study, plan your routines, generate practice MCQs, and prepare for finals.\n\nWhat are you working on today?`;
  } else if (lower.includes("math") || lower.includes("calculus") || lower.includes("derivative") || lower.includes("integral")) {
    smartReply = `For Mathematics, active problem solving beats passive reading every time! I suggest breaking formulas down into 45-minute focus sprints in your **Daily Routine**, followed by rapid MCQ testing in **Practice** mode.\n\nWant me to generate some practice MCQs for you? Just say "Make MCQs on Calculus"!`;
  } else if (lower.includes("exam") || lower.includes("final") || lower.includes("prepare") || lower.includes("schedule")) {
    smartReply = `Exam preparation is about consistent sprints without burnout. Make sure to head over to **Daily Routine** and click **AI Schedule** each morning — it skips topics you've completed 100% and focuses on your unfinished high-yield subjects!`;
  } else {
    smartReply = `I'm with you! As **${aiName}**, I can:\n\n• **Generate MCQs**: Paste any paragraph or lecture notes and say *"Make MCQs from this"*\n• **Auto-Add Topics**: Say *"Add topics to [Subject]: Topic 1, Topic 2"*\n• **Routine Scheduling**: Ask me to add blocks or update your notepad\n• **Explain Concepts**: Ask me anything in Math, Physics, Chemistry, Accounting, or Finance!\n\nHow can I help you right now?`;
  }

  const fallbackFinalMsg: ChatMessage = {
    id: "msg_" + Date.now().toString(36),
    role: "assistant",
    content: smartReply,
    timestamp: Date.now(),
  };
  if (sessionId) {
    await saveDbChatMessage(sessionId, fallbackFinalMsg);
  }
  return fallbackFinalMsg;
}
