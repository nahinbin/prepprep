"use server";

import { generateGeminiText, generateGeminiJson, isGeminiConfigured } from "@/lib/gemini";
import {
  bulkAddTopicsToSubject,
  getUserSubjectsAndTopics,
  createSubject,
  deleteSubjectByName,
  renameSubjectByName,
  deleteTopicFromSubject,
} from "@/app/actions/subjects";
import { getSession } from "@/app/actions/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

const DEFAULT_AI_NAME = "AI Assistant";

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
      | "deleted_subject"
      | "renamed_subject"
      | "deleted_topic"
      | "study_tip"
      | "added_block"
      | "deleted_block"
      | "updated_notepad"
      | "changed_name"
      | "generated_schedule"
      | "created_quiz";
    subjectName?: string;
    newSubjectName?: string;
    topicName?: string;
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

/** Helper to split raw topic text into clean list */
function parseTopicsList(raw: string): string[] {
  return raw
    .split(/[\n,;•\-\*]+|\band\b/i)
    .map((t) => t.replace(/^\s*\d+[\.\)\-]?\s*/, "").trim())
    .filter((t) => t.length > 0 && !t.match(/^(?:topics?|and|with|please|also)$/i));
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

  if (!user) {
    return {
      id: "msg_" + Date.now().toString(36),
      role: "assistant",
      content: "⚠️ Please log in to your account first so I can save your subjects, topics, and routines to the database!",
      timestamp: Date.now(),
    };
  }

  // =========================================================================
  // LAYER 1: FAST DETERMINISTIC PATTERN MATCHER & DATABASE EXECUTOR
  // =========================================================================

  // 1. Rename AI Assistant
  // e.g. "change your name to Jarvis" or "call yourself Echo" or "your name is now Alex"
  const changeNameRegex = /(?:change\s+your\s+name\s+to|call\s+yourself|your\s+name\s+is\s+now|rename\s+yourself\s+to)\s+([a-zA-Z0-9_\-\s]{2,25})/i;
  const matchChangeName = trimmed.match(changeNameRegex);
  if (matchChangeName) {
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
        content: `Got it! My name is now **${newName}**. I've saved this in your account database and I will remember it across all your devices and sessions! What shall we tackle next?`,
        actionTaken: {
          type: "changed_name",
          newName,
        },
        timestamp: Date.now(),
      };
      if (sessionId) await saveDbChatMessage(sessionId, responseMsg);
      return responseMsg;
    }
  }

  // 2. Delete Subject
  // e.g. "delete subject Biology" or "remove subject Chemistry" or "delete the subject Physics"
  const deleteSubRegex = /(?:delete|remove|drop)\s+(?:the\s+)?subject\s+([a-zA-Z0-9_\s]+)$/i;
  const matchDeleteSub = trimmed.match(deleteSubRegex);
  if (matchDeleteSub) {
    const subName = matchDeleteSub[1].trim();
    const res = await deleteSubjectByName(subName);
    if ("error" in res && res.error) {
      const responseMsg: ChatMessage = {
        id: "msg_" + Date.now().toString(36),
        role: "assistant",
        content: `⚠️ Could not delete subject: ${res.error}`,
        timestamp: Date.now(),
      };
      if (sessionId) await saveDbChatMessage(sessionId, responseMsg);
      return responseMsg;
    }
    const responseMsg: ChatMessage = {
      id: "msg_" + Date.now().toString(36),
      role: "assistant",
      content: `🗑️ I've deleted the subject **${res.deletedName}** and its questions from your database.`,
      actionTaken: {
        type: "deleted_subject",
        subjectName: res.deletedName,
      },
      timestamp: Date.now(),
    };
    if (sessionId) await saveDbChatMessage(sessionId, responseMsg);
    return responseMsg;
  }

  // 3. Rename Subject
  // e.g. "rename subject Math to Mathematics" or "change subject Physics to Advanced Physics"
  const renameSubRegex = /(?:rename|change)\s+(?:the\s+)?subject\s+(?:named\s+|called\s+)?([a-zA-Z0-9_\s]+?)\s+to\s+([a-zA-Z0-9_\s]+)$/i;
  const matchRenameSub = trimmed.match(renameSubRegex);
  if (matchRenameSub) {
    const oldName = matchRenameSub[1].trim();
    const newName = matchRenameSub[2].trim();
    const res = await renameSubjectByName(oldName, newName);
    if ("error" in res && res.error) {
      const responseMsg: ChatMessage = {
        id: "msg_" + Date.now().toString(36),
        role: "assistant",
        content: `⚠️ Could not rename subject: ${res.error}`,
        timestamp: Date.now(),
      };
      if (sessionId) await saveDbChatMessage(sessionId, responseMsg);
      return responseMsg;
    }
    const responseMsg: ChatMessage = {
      id: "msg_" + Date.now().toString(36),
      role: "assistant",
      content: `✏️ Renamed subject **${res.oldName}** to **${res.newName}** in your database!`,
      actionTaken: {
        type: "renamed_subject",
        subjectName: res.newName,
      },
      timestamp: Date.now(),
    };
    if (sessionId) await saveDbChatMessage(sessionId, responseMsg);
    return responseMsg;
  }

  // 4. Delete Topic from Subject
  // e.g. "delete topic Optics from Physics" or "remove topic Kinematics in Math"
  const deleteTopicRegex = /(?:delete|remove)\s+(?:the\s+)?topic\s+([a-zA-Z0-9_\s]+?)\s+(?:from|in|under)\s+(?:the\s+)?(?:subject\s+)?([a-zA-Z0-9_\s]+)$/i;
  const matchDeleteTopic = trimmed.match(deleteTopicRegex);
  if (matchDeleteTopic) {
    const topName = matchDeleteTopic[1].trim();
    const subName = matchDeleteTopic[2].trim();
    const res = await deleteTopicFromSubject(subName, topName);
    if ("error" in res && res.error) {
      const responseMsg: ChatMessage = {
        id: "msg_" + Date.now().toString(36),
        role: "assistant",
        content: `⚠️ Could not remove topic: ${res.error}`,
        timestamp: Date.now(),
      };
      if (sessionId) await saveDbChatMessage(sessionId, responseMsg);
      return responseMsg;
    }
    const responseMsg: ChatMessage = {
      id: "msg_" + Date.now().toString(36),
      role: "assistant",
      content: `🗑️ Removed topic **${res.topicName}** from subject **${res.subjectName}** in your database.`,
      actionTaken: {
        type: "deleted_topic",
        subjectName: res.subjectName,
        topicName: res.topicName,
      },
      timestamp: Date.now(),
    };
    if (sessionId) await saveDbChatMessage(sessionId, responseMsg);
    return responseMsg;
  }

  // 5. Create Subject WITH Topics
  // e.g. "add Biology with topics Genetics, Cell Biology, Ecology"
  // or "create subject Physics with topics: Optics, Kinematics"
  // or "add Math and topics Algebra, Calculus"
  const subWithTopicsRegex = /^(?:please\s+)?(?:create|add|make|insert|set\s*up)\s+(?:a\s+)?(?:new\s+)?(?:subject\s+)?([a-zA-Z0-9_\s]+?)\s+(?:with|having|including|and)\s+(?:topics?|subtopics?)\s*[:\n\-\?]?\s*([\s\S]+)$/i;
  const matchSubWithTopics = trimmed.match(subWithTopicsRegex);
  if (matchSubWithTopics) {
    const rawSub = matchSubWithTopics[1].replace(/^(?:the subject|subject)\s+/i, "").trim();
    const rawTopics = matchSubWithTopics[2];
    const topicsList = parseTopicsList(rawTopics);

    if (rawSub && topicsList.length > 0) {
      const res = await bulkAddTopicsToSubject(rawSub, topicsList);
      if ("error" in res && res.error) {
        const responseMsg: ChatMessage = {
          id: "msg_" + Date.now().toString(36),
          role: "assistant",
          content: `⚠️ Could not add subject/topics: ${res.error}`,
          timestamp: Date.now(),
        };
        if (sessionId) await saveDbChatMessage(sessionId, responseMsg);
        return responseMsg;
      }
      if ("success" in res && res.success) {
        const responseMsg: ChatMessage = {
          id: "msg_" + Date.now().toString(36),
          role: "assistant",
          content: `✅ I've added **${res.subjectName}** to your account database with **${res.addedCount}** topics!\n\n**Topics added:**\n${res.addedTopics.map((t) => `• ${t}`).join("\n")}${res.skippedCount > 0 ? `\n\n*(Skipped ${res.skippedCount} existing topics)*` : ""}\n\nYou can now view this on your **Subjects** page or pick them in your **Daily Routine**!`,
          actionTaken: {
            type: "created_subject",
            subjectName: res.subjectName,
            addedCount: res.addedCount,
            skippedCount: res.skippedCount,
            topics: res.addedTopics,
          },
          timestamp: Date.now(),
        };
        if (sessionId) await saveDbChatMessage(sessionId, responseMsg);
        return responseMsg;
      }
    }
  }

  // 6. Create Subject ALONE
  // e.g. "create subject Physics", "add subject Advanced Math", "add Math as a subject"
  const createSubRegex = /^(?:please\s+)?(?:create|add|make|insert)\s+(?:a\s+)?(?:new\s+)?(?:subject\s+)?([a-zA-Z0-9_\s]+?)(?:\s+as\s+a\s+subject)?$/i;
  const matchCreateSub = trimmed.match(createSubRegex);
  if (matchCreateSub && !lower.includes("block") && !lower.includes("topic") && !lower.includes("note") && !lower.includes("quiz")) {
    const subName = matchCreateSub[1].replace(/^(?:the subject|subject)\s+/i, "").trim();
    if (subName && subName.length >= 2) {
      const res = await createSubject(subName);
      if ("error" in res && res.error) {
        const responseMsg: ChatMessage = {
          id: "msg_" + Date.now().toString(36),
          role: "assistant",
          content: `⚠️ ${res.error}`,
          timestamp: Date.now(),
        };
        if (sessionId) await saveDbChatMessage(sessionId, responseMsg);
        return responseMsg;
      }
      const responseMsg: ChatMessage = {
        id: "msg_" + Date.now().toString(36),
        role: "assistant",
        content: `✅ Created subject **${subName}** in your account database! You can now add topics or schedule study blocks for it.`,
        actionTaken: {
          type: "created_subject",
          subjectName: subName,
        },
        timestamp: Date.now(),
      };
      if (sessionId) await saveDbChatMessage(sessionId, responseMsg);
      return responseMsg;
    }
  }

  // 7. Add Topics to existing subject
  // e.g. "add these topics to math: algebra, calculus, geometry"
  const addTopicsRegex = /(?:add|create|put|insert)(?:\s+(?:these|the following|some|\d+))?\s+topics?\s+(?:to|in|under|for|into)\s+([a-zA-Z0-9_\s]+?)[:\n\-\?]([\s\S]+)/i;
  const matchTopics = trimmed.match(addTopicsRegex);
  if (matchTopics) {
    const rawSubject = matchTopics[1].replace(/^(?:the subject|subject)\s+/i, "").trim();
    const rawTopics = matchTopics[2];
    const extractedTopics = parseTopicsList(rawTopics);

    if (extractedTopics.length > 0) {
      const res = await bulkAddTopicsToSubject(rawSubject, extractedTopics);
      if ("error" in res && res.error) {
        const responseMsg: ChatMessage = {
          id: "msg_" + Date.now().toString(36),
          role: "assistant",
          content: `⚠️ Could not add topics: ${res.error}`,
          timestamp: Date.now(),
        };
        if (sessionId) await saveDbChatMessage(sessionId, responseMsg);
        return responseMsg;
      }
      if ("success" in res && res.success) {
        const responseMsg: ChatMessage = {
          id: "msg_" + Date.now().toString(36),
          role: "assistant",
          content: `✅ Updated **${res.subjectName}** in your database!\n\n• **${res.addedCount}** new topics added\n• **${res.skippedCount}** duplicates skipped\n\nAdded:\n${res.addedTopics.slice(0, 10).map((t) => `• ${t}`).join("\n")}${res.addedTopics.length > 10 ? `\n• ...and ${res.addedTopics.length - 10} more` : ""}\n\nYou can now study these or select them in Daily Routine!`,
          actionTaken: {
            type: "added_topics",
            subjectName: res.subjectName,
            addedCount: res.addedCount,
            skippedCount: res.skippedCount,
            topics: res.addedTopics,
          },
          timestamp: Date.now(),
        };
        if (sessionId) await saveDbChatMessage(sessionId, responseMsg);
        return responseMsg;
      }
    }
  }

  // 8. Add Routine Block
  // e.g. "add a study block for Physics at 4 PM" or "add block: sleep at 11 PM"
  const addBlockMatch = trimmed.match(/(?:add|create|schedule)\s+(?:a\s+)?(study|normal)?\s*block(?:\s+for|\s+to|\s*:)?\s*([^,\n]+?)(?:\s+(?:at|from)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?))?/i);
  if (addBlockMatch) {
    const rawType = (addBlockMatch[1] || "").toLowerCase() === "study" ? "study" : "normal";
    const rawSubjectOrTitle = addBlockMatch[2].trim();
    const rawTime = addBlockMatch[3] ? addBlockMatch[3].trim() : undefined;

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
      content: `📅 I've added a **${rawType === "study" ? "Study Block" : "Routine Block"}** to your Daily Routine for today: **${rawSubjectOrTitle}**${rawTime ? ` at ${rawTime}` : ""}!\n\nIt is now saved in your routine schedule.`,
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
    if (sessionId) await saveDbChatMessage(sessionId, blockMsg);
    return blockMsg;
  }

  // 9. Update Permanent Notepad
  if (lower.startsWith("remember") || lower.includes("add to notepad") || lower.includes("save to notepad") || lower.includes("add to my notes")) {
    const cleanNote = trimmed.replace(/^(?:remember\s+(?:that)?|add\s+to\s+(?:my\s+)?notepad(?:\s*:)?|save\s+to\s+(?:my\s+)?notepad(?:\s*:)?|add\s+to\s+my\s+notes(?:\s*:)?)/i, "").trim();
    if (cleanNote) {
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
      if (sessionId) await saveDbChatMessage(sessionId, noteMsg);
      return noteMsg;
    }
  }

  // 10. Generate Practice Quiz from Notes/Concepts
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
        if (sessionId) await saveDbChatMessage(sessionId, responseMsg);
        return responseMsg;
      }
    } catch (e) {
      console.warn("Gemini quiz generation error:", e);
    }
  }

  // =========================================================================
  // LAYER 2: GEMINI AI INTENT PARSER & CONVERSATIONAL CONTROLLER
  // =========================================================================

  // Fetch subjects & topics context so Gemini knows current state
  let subjectsContext = "";
  try {
    const userSubjects = await getUserSubjectsAndTopics();
    subjectsContext = userSubjects
      .map((s) => `• ${s.name} (${s.topics.length} topics: ${s.topics.join(", ")})`)
      .join("\n");
  } catch (err) {
    console.warn("Failed to fetch subjects context for AI chat:", err);
  }

  if (isGeminiConfigured()) {
    try {
      interface GeminiIntentResult {
        action?: {
          type:
            | "create_subject_with_topics"
            | "create_subject"
            | "delete_subject"
            | "rename_subject"
            | "add_topics"
            | "delete_topic"
            | "create_routine_block"
            | "update_notepad"
            | "none";
          subjectName?: string;
          topics?: string[];
          newSubjectName?: string;
          topicName?: string;
          blockTitle?: string;
          blockType?: "study" | "normal";
          blockTime?: string;
          note?: string;
        } | null;
        reply: string;
      }

      const intentPrompt = `Analyze the student's message and determine if they want to execute an action on their database, or if they are simply asking a question/conversing.

Student's current subjects in database:
${subjectsContext || "None yet."}

User message: "${trimmed}"

If an action is requested, output valid JSON:
{
  "action": {
    "type": "create_subject_with_topics" | "create_subject" | "delete_subject" | "rename_subject" | "add_topics" | "delete_topic" | "create_routine_block" | "update_notepad" | "none",
    "subjectName": string (if applicable),
    "topics": string[] (if adding topics),
    "newSubjectName": string (if renaming),
    "topicName": string (if deleting topic),
    "blockTitle": string (if routine block),
    "blockType": "study" | "normal",
    "blockTime": string (e.g. "14:00"),
    "note": string (if notepad)
  },
  "reply": "Your conversational response as ${aiName}"
}

If no database action is needed, set action to null and answer the student's question thoroughly in markdown in "reply".`;

      const intentRes = await generateGeminiJson<GeminiIntentResult>(intentPrompt, {
        systemInstruction: `You are ${aiName}, the student's personal AI study coach and academic partner for MCQ Arena. You have full permission to control subjects, topics, and routines on the user's account.`,
        temperature: 0.2,
      });

      if (intentRes && intentRes.action && intentRes.action.type && intentRes.action.type !== "none") {
        const act = intentRes.action;

        // Execute action on PostgreSQL
        if (act.type === "create_subject_with_topics" && act.subjectName) {
          const res = await bulkAddTopicsToSubject(act.subjectName, act.topics || []);
          if ("success" in res && res.success) {
            const finalMsg: ChatMessage = {
              id: "msg_" + Date.now().toString(36),
              role: "assistant",
              content: `✅ I've added **${res.subjectName}** to your database with **${res.addedCount}** topics!\n\n${intentRes.reply || ""}`,
              actionTaken: {
                type: "created_subject",
                subjectName: res.subjectName,
                topics: res.addedTopics,
              },
              timestamp: Date.now(),
            };
            if (sessionId) await saveDbChatMessage(sessionId, finalMsg);
            return finalMsg;
          }
        } else if (act.type === "create_subject" && act.subjectName) {
          const res = await createSubject(act.subjectName);
          if ("success" in res && res.success) {
            const finalMsg: ChatMessage = {
              id: "msg_" + Date.now().toString(36),
              role: "assistant",
              content: `✅ Created subject **${act.subjectName}** in your account!\n\n${intentRes.reply || ""}`,
              actionTaken: {
                type: "created_subject",
                subjectName: act.subjectName,
              },
              timestamp: Date.now(),
            };
            if (sessionId) await saveDbChatMessage(sessionId, finalMsg);
            return finalMsg;
          }
        } else if (act.type === "delete_subject" && act.subjectName) {
          const res = await deleteSubjectByName(act.subjectName);
          if ("success" in res && res.success) {
            const finalMsg: ChatMessage = {
              id: "msg_" + Date.now().toString(36),
              role: "assistant",
              content: `🗑️ Deleted subject **${res.deletedName}** from your database.\n\n${intentRes.reply || ""}`,
              actionTaken: {
                type: "deleted_subject",
                subjectName: res.deletedName,
              },
              timestamp: Date.now(),
            };
            if (sessionId) await saveDbChatMessage(sessionId, finalMsg);
            return finalMsg;
          }
        } else if (act.type === "rename_subject" && act.subjectName && act.newSubjectName) {
          const res = await renameSubjectByName(act.subjectName, act.newSubjectName);
          if ("success" in res && res.success) {
            const finalMsg: ChatMessage = {
              id: "msg_" + Date.now().toString(36),
              role: "assistant",
              content: `✏️ Renamed subject **${res.oldName}** to **${res.newName}**.\n\n${intentRes.reply || ""}`,
              actionTaken: {
                type: "renamed_subject",
                subjectName: res.newName,
              },
              timestamp: Date.now(),
            };
            if (sessionId) await saveDbChatMessage(sessionId, finalMsg);
            return finalMsg;
          }
        } else if (act.type === "add_topics" && act.subjectName && act.topics && act.topics.length > 0) {
          const res = await bulkAddTopicsToSubject(act.subjectName, act.topics);
          if ("success" in res && res.success) {
            const finalMsg: ChatMessage = {
              id: "msg_" + Date.now().toString(36),
              role: "assistant",
              content: `✅ Added **${res.addedCount}** topics to **${res.subjectName}**!\n\n${intentRes.reply || ""}`,
              actionTaken: {
                type: "added_topics",
                subjectName: res.subjectName,
                topics: res.addedTopics,
              },
              timestamp: Date.now(),
            };
            if (sessionId) await saveDbChatMessage(sessionId, finalMsg);
            return finalMsg;
          }
        } else if (act.type === "delete_topic" && act.subjectName && act.topicName) {
          const res = await deleteTopicFromSubject(act.subjectName, act.topicName);
          if ("success" in res && res.success) {
            const finalMsg: ChatMessage = {
              id: "msg_" + Date.now().toString(36),
              role: "assistant",
              content: `🗑️ Removed topic **${res.topicName}** from **${res.subjectName}**.\n\n${intentRes.reply || ""}`,
              actionTaken: {
                type: "deleted_topic",
                subjectName: res.subjectName,
                topicName: res.topicName,
              },
              timestamp: Date.now(),
            };
            if (sessionId) await saveDbChatMessage(sessionId, finalMsg);
            return finalMsg;
          }
        } else if (act.type === "create_routine_block" && act.blockTitle) {
          const now = new Date();
          const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
          await prisma.routineBlock.create({
            data: {
              userId: user.id,
              date: dateKey,
              type: act.blockType || "study",
              title: act.blockTitle,
              timeMode: "range",
              startTime: act.blockTime || "15:00",
              endTime: "16:00",
              subject: act.blockType === "study" ? act.subjectName || act.blockTitle : null,
            },
          });
          revalidatePath("/routine");
          const finalMsg: ChatMessage = {
            id: "msg_" + Date.now().toString(36),
            role: "assistant",
            content: `📅 Added block **${act.blockTitle}** to your Daily Routine!\n\n${intentRes.reply || ""}`,
            actionTaken: {
              type: "added_block",
            },
            timestamp: Date.now(),
          };
          if (sessionId) await saveDbChatMessage(sessionId, finalMsg);
          return finalMsg;
        }
      }

      if (intentRes?.reply) {
        const finalMsg: ChatMessage = {
          id: "msg_" + Date.now().toString(36),
          role: "assistant",
          content: intentRes.reply,
          timestamp: Date.now(),
        };
        if (sessionId) await saveDbChatMessage(sessionId, finalMsg);
        return finalMsg;
      }
    } catch (err) {
      console.warn("Gemini intent error, fallback to conversation:", err);
    }

    // Direct Gemini conversation fallback
    try {
      const systemInstruction = `You are ${aiName}, the student's personal AI study coach and academic partner for MCQ Arena.
Always refer to yourself as ${aiName}.
Current user's subjects in database:
${subjectsContext || "No subjects added yet."}
Permanent Notepad Rules:
${context.notepadNotes || user?.aiNotepad || "Standard schedule."}

Keep explanations clear, engaging, and exam-focused. Answer in good markdown formatting.`;

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
      if (sessionId) await saveDbChatMessage(sessionId, geminiMsg);
      return geminiMsg;
    } catch (err) {
      console.warn("Gemini text error:", err);
    }
  }

  // =========================================================================
  // LAYER 3: CONVERSATIONAL SMART FALLBACK
  // =========================================================================
  let smartReply = "";
  if (lower.includes("hello") || lower.includes("hi") || lower.includes("hey") || lower.includes("who are you")) {
    smartReply = `Hey! I'm **${aiName}**, your personal study coach. I'm connected to your account database — I can create or delete subjects, add topics, organize your daily routine, and generate exam MCQs.\n\nWhat are you working on today?`;
  } else if (lower.includes("math") || lower.includes("calculus") || lower.includes("derivative") || lower.includes("integral")) {
    smartReply = `For Mathematics, active recall and problem solving are key! I can create a Mathematics subject with topics like Calculus, Linear Algebra, and Differential Equations for you, or schedule daily practice blocks.\n\nWant me to add Math topics to your account right now?`;
  } else if (lower.includes("exam") || lower.includes("final") || lower.includes("prepare") || lower.includes("schedule")) {
    smartReply = `Exam preparation is about consistent sprints without burnout. Head over to **Daily Routine** to organize your day, or tell me to schedule focus blocks for your high-yield subjects!`;
  } else {
    smartReply = `I'm with you! As **${aiName}**, I can manage your entire study workspace:\n\n• **Add Subjects & Topics**: Say *"Add Biology with topics Genetics, Cell Biology, Ecology"*\n• **Delete or Rename Subjects**: Say *"Delete subject Chemistry"* or *"Rename Math to Calculus"*\n• **Daily Routine**: Say *"Add a study block for Physics at 4 PM"*\n• **Generate MCQs**: Paste your lecture notes and say *"Make MCQs from this"*\n\nWhat would you like me to do?`;
  }

  const fallbackFinalMsg: ChatMessage = {
    id: "msg_" + Date.now().toString(36),
    role: "assistant",
    content: smartReply,
    timestamp: Date.now(),
  };
  if (sessionId) await saveDbChatMessage(sessionId, fallbackFinalMsg);
  return fallbackFinalMsg;
}
