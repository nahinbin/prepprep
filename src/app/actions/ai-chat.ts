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
import { generateAiDailySchedule } from "@/app/actions/ai-schedule";
import { bulkCreateDbRoutineBlocks } from "@/app/actions/routine";
import { saveGeneratedQuestionsToBank } from "@/app/actions/questions";

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
  topic?: string;
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
    newName?: string;
    newNotepadText?: string;
    scheduleSummary?: string;
    blockData?: {
      type: "study" | "normal";
      title: string;
      subject?: string;
      topic?: string;
      startTime?: string;
      endTime?: string;
      notes?: string;
    };
  };
  generatedQuiz?: GeneratedQuiz;
  timestamp: number;
}

export interface ChatContext {
  activeSubject?: string;
  activeTopic?: string;
  notepadNotes?: string;
  recentAccuracy?: number;
  totalXp?: number;
  aiName?: string;
}

export async function getDbChatSessions() {
  const user = await getSession();
  if (!user) return [];

  const sessions = await prisma.aiChatSession.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return sessions.map((s) => ({
    id: s.id,
    title: s.title,
    updatedAt: s.updatedAt.getTime(),
    messages: s.messages.map((m) => {
      let actionTaken = undefined;
      let generatedQuiz = undefined;
      try {
        if (m.actionTaken) actionTaken = JSON.parse(m.actionTaken);
      } catch {}
      try {
        if (m.quizData) generatedQuiz = JSON.parse(m.quizData);
      } catch {}
      return {
        id: m.id,
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
        actionTaken,
        generatedQuiz,
        timestamp: m.createdAt.getTime(),
      };
    }),
  }));
}

export async function createDbChatSession(title: string = "New Chat") {
  const user = await getSession();
  if (!user) return null;

  const session = await prisma.aiChatSession.create({
    data: {
      userId: user.id,
      title,
    },
  });

  return {
    id: session.id,
    title: session.title,
    updatedAt: session.updatedAt.getTime(),
    messages: [],
  };
}

export async function deleteDbChatSession(sessionId: string) {
  const user = await getSession();
  if (!user) return { error: "Unauthorized" };

  await prisma.aiChatSession.deleteMany({
    where: { id: sessionId, userId: user.id },
  });

  revalidatePath("/chat");
  return { success: true };
}

export async function saveDbChatMessage(sessionId: string, message: ChatMessage) {
  const user = await getSession();
  if (!user) return;

  const session = await prisma.aiChatSession.findFirst({
    where: { id: sessionId, userId: user.id },
  });
  if (!session) return;

  await prisma.aiChatMessage.create({
    data: {
      sessionId,
      role: message.role,
      content: message.content,
      actionTaken: message.actionTaken ? JSON.stringify(message.actionTaken) : null,
      quizData: message.generatedQuiz ? JSON.stringify(message.generatedQuiz) : null,
    },
  });

  if (session.title === "New Chat" && message.role === "user") {
    const newTitle = message.content.slice(0, 32).trim() + "...";
    await prisma.aiChatSession.update({
      where: { id: sessionId },
      data: { title: newTitle, updatedAt: new Date() },
    });
  } else {
    await prisma.aiChatSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    });
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

  if (!user) {
    return {
      id: "msg_" + Date.now().toString(36),
      role: "assistant",
      content: "⚠️ Please log in to your account first so I can save your subjects, topics, and routines to the database!",
      timestamp: Date.now(),
    };
  }

  // Fetch full user profile from PostgreSQL
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      username: true,
      name: true,
      bio: true,
      aiName: true,
      aiNotepad: true,
      coins: true,
      positivePoints: true,
      negativePoints: true,
    },
  });

  const studentName = dbUser?.name?.trim() || dbUser?.username || "Student";
  const studyBio = dbUser?.bio?.trim() || "General Studies / Exam Preparation";

  // Determine AI name: from context, from user DB profile, or default "AI Assistant"
  let aiName = context.aiName?.trim();
  if (!aiName && dbUser?.aiName) {
    aiName = dbUser.aiName.trim();
  }
  if (!aiName) {
    aiName = DEFAULT_AI_NAME;
  }

  // =========================================================================
  // LAYER 1: FAST DETERMINISTIC PATTERN MATCHER & DATABASE EXECUTOR
  // =========================================================================

  // 1. Rename AI Assistant
  // e.g. "change your name to Jarvis" or "call yourself StudyPro"
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
        content: `Got it! My name is now **${newName}**. I've saved this in your account database and I will remember it across all your devices!\n\nJust remember:\n• **My name is:** ${newName}\n• **Your name is:** ${studentName}\n\nWhat shall we tackle next, **${studentName}**?`,
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

  // 2. Set Student's Own Name
  // e.g. "my name is Nahin" or "call me Nahin"
  const matchStudentName = trimmed.match(/^(?:my\s+name\s+is|call\s+me|i\s+am)\s+([a-zA-Z\s]{2,30})$/i);
  if (matchStudentName && !lower.includes("studypro") && !lower.includes("assistant")) {
    const newStudentName = matchStudentName[1].trim();
    if (newStudentName) {
      await prisma.user.update({
        where: { id: user.id },
        data: { name: newStudentName },
      });
      revalidatePath("/routine/settings");
      revalidatePath("/chat");

      const responseMsg: ChatMessage = {
        id: "msg_" + Date.now().toString(36),
        role: "assistant",
        content: `Nice to meet you, **${newStudentName}**! I've saved your name in your profile.\n\nFrom now on:\n• **Your name:** ${newStudentName}\n• **My name:** ${aiName}\n\nI will always address you as **${newStudentName}**! Ready to crush your goals today?`,
        timestamp: Date.now(),
      };
      if (sessionId) await saveDbChatMessage(sessionId, responseMsg);
      return responseMsg;
    }
  }

  // 3. Set Student's Study Focus / What they study
  // e.g. "I am studying Medicine / USMLE" or "preparing for AP Biology"
  const matchStudyBio = trimmed.match(/^(?:i\s+(?:am\s+)?studying|i\s+study|my\s+major\s+is|preparing\s+for|my\s+target\s+is)\s+([a-zA-Z0-9_\-\s,/]{3,60})$/i);
  if (matchStudyBio) {
    const newBio = matchStudyBio[1].trim();
    if (newBio) {
      await prisma.user.update({
        where: { id: user.id },
        data: { bio: newBio },
      });
      revalidatePath("/routine/settings");
      revalidatePath("/chat");

      const responseMsg: ChatMessage = {
        id: "msg_" + Date.now().toString(36),
        role: "assistant",
        content: `Got it, **${studentName}**! I've recorded that you are studying **${newBio}**.\n\nI will tailor all our practice MCQs, daily routines, and high-yield study blocks to this exact target!`,
        timestamp: Date.now(),
      };
      if (sessionId) await saveDbChatMessage(sessionId, responseMsg);
      return responseMsg;
    }
  }

  // 4. Check Stats, Coins, Study History & Reminders
  const isStatsRequest =
    lower.includes("how much coin") ||
    lower.includes("how many coin") ||
    lower.includes("my coin") ||
    lower.includes("coin balance") ||
    lower.includes("how much did i study") ||
    lower.includes("how much i studied") ||
    lower.includes("my study history") ||
    lower.includes("my stats") ||
    lower.includes("my progress") ||
    lower.includes("did i miss study");

  if (isStatsRequest) {
    const netXp = (dbUser?.positivePoints ?? 0) - (dbUser?.negativePoints ?? 0);
    const sessions = await prisma.session.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    const totalSessions = await prisma.session.count({ where: { userId: user.id } });
    const totalQuestionsBank = await prisma.question.count({
      where: { subject: { userId: user.id } },
    });

    const now = Date.now();
    let daysSinceLast = 0;
    if (sessions.length > 0) {
      daysSinceLast = Math.floor((now - sessions[0].createdAt.getTime()) / (1000 * 60 * 60 * 24));
    }

    let reminderNote = "";
    if (sessions.length === 0) {
      reminderNote = "⚠️ You haven't started an MCQ session yet! Let's do your first practice session to earn XP and coins.";
    } else if (daysSinceLast >= 2) {
      reminderNote = `⚠️ You haven't practiced in **${daysSinceLast} days**! Let's do a quick 5-question sprint right now to keep your streak alive.`;
    } else {
      reminderNote = `🔥 Awesome consistency! You practiced ${daysSinceLast === 0 ? "today" : "yesterday"}. Keep this winning streak going!`;
    }

    const statsMsg: ChatMessage = {
      id: "msg_" + Date.now().toString(36),
      role: "assistant",
      content: `📊 **Your Academic Stats & Account Overview, ${studentName}:**\n\n• **Coins Balance:** 🪙 **${dbUser?.coins ?? 0} coins**\n• **Net XP:** ⚡ **${netXp} XP**\n• **Completed Sessions:** 🎯 **${totalSessions} sessions**\n• **Questions in Bank:** 📚 **${totalQuestionsBank} questions**\n\n${reminderNote}`,
      timestamp: Date.now(),
    };
    if (sessionId) await saveDbChatMessage(sessionId, statsMsg);
    return statsMsg;
  }

  // 5. Full Day Schedule Generator from Chat (Respects outings, exams, multi-subject rotation)
  const isScheduleDayRequest =
    lower.includes("schedule my day") ||
    lower.includes("plan my day") ||
    lower.includes("make a schedule") ||
    lower.includes("make my schedule") ||
    lower.includes("build my schedule") ||
    lower.includes("decide a good schedule") ||
    lower.includes("schedule today") ||
    (lower.includes("schedule") && (lower.includes("tired") || lower.includes("going out") || lower.includes("exam on") || lower.includes("exam in")));

  if (isScheduleDayRequest) {
    const now = new Date();
    const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const dayOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][now.getDay()];

    const schedRes = await generateAiDailySchedule({
      dateKey,
      dayOfWeek,
      todayNote: trimmed,
    });

    if (schedRes.success && schedRes.blocks.length > 0) {
      await bulkCreateDbRoutineBlocks(
        schedRes.blocks.map((b, idx) => ({
          date: dateKey,
          type: b.type,
          title: b.title,
          timeMode: b.timeMode || "range",
          startTime: b.startTime,
          endTime: b.endTime,
          isCompleted: false,
          subject: b.subject,
          topic: b.topic,
          notes: b.notes,
          subtasks: b.subtasks?.map((st, sIdx) => ({
            id: `st_${Date.now()}_${sIdx}`,
            text: st,
            completed: false,
          })),
          order: idx,
        }))
      );
      revalidatePath("/routine");

      const blocksSummary = schedRes.blocks
        .slice(0, 8)
        .map((b) => `• **${b.startTime || "Anytime"} - ${b.endTime || ""}:** ${b.title}${b.subject ? ` *(${b.subject})*` : ""}`)
        .join("\n");

      const schedMsg: ChatMessage = {
        id: "msg_" + Date.now().toString(36),
        role: "assistant",
        content: `📅 **I've crafted your personalized daily schedule for today!**\n\n${schedRes.summary}\n\n**Schedule Breakdown:**\n${blocksSummary}\n\nAll **${schedRes.blocks.length} blocks** are saved directly to your Daily Routine database.`,
        actionTaken: {
          type: "generated_schedule",
          scheduleSummary: schedRes.summary,
        },
        timestamp: Date.now(),
      };
      if (sessionId) await saveDbChatMessage(sessionId, schedMsg);
      return schedMsg;
    }
  }

  // 6. Delete Subject
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

  // 7. Rename Subject
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

  // 8. Delete Topic from Subject
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

  // 9. Create Subject WITH Topics
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

  // 10. Create Subject ALONE
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

  // 11. Add Topics to existing subject
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

  // 12. Add Routine Block
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

  // 13. Update Permanent Notepad
  if (lower.startsWith("remember") || lower.includes("add to notepad") || lower.includes("save to notepad") || lower.includes("add to my notes")) {
    const cleanNote = trimmed.replace(/^(?:remember\s+(?:that)?|add\s+to\s+(?:my\s+)?notepad(?:\s*:)?|save\s+to\s+(?:my\s+)?notepad(?:\s*:)?|add\s+to\s+my\s+notes(?:\s*:)?)/i, "").trim();
    if (cleanNote) {
      const currentNotes = dbUser?.aiNotepad || "";
      const updatedNotes = currentNotes ? `${currentNotes}\n• ${cleanNote}` : `• ${cleanNote}`;
      await prisma.user.update({
        where: { id: user.id },
        data: { aiNotepad: updatedNotes },
      });
      revalidatePath("/routine/settings");

      const noteMsg: ChatMessage = {
        id: "msg_" + Date.now().toString(36),
        role: "assistant",
        content: `📝 Got it, **${studentName}**! I've saved that into your **Routine Notepad**:\n\n> "${cleanNote}"\n\nI will remember this whenever optimizing your daily schedules!`,
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

  // 14. Generate Practice Quiz from Notes/Concepts & SAVE TO QUESTION BANK
  const isMcqRequest =
    lower.includes("make mcq") ||
    lower.includes("create mcq") ||
    lower.includes("generate mcq") ||
    lower.includes("make questions") ||
    lower.includes("quiz me") ||
    lower.includes("test me on") ||
    (lower.includes("mcq") && trimmed.length > 60);

  if (isMcqRequest && isGeminiConfigured()) {
    try {
      const quizPrompt = `Create 4 high-yield multiple-choice questions from the following student request:
"${trimmed}"

Return valid raw JSON matching this shape:
{
  "title": "Short descriptive quiz title",
  "subject": "Subject name or General",
  "topic": "Topic name or High Yield Concepts",
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
        // Save questions directly to PostgreSQL Question Bank!
        await saveGeneratedQuestionsToBank({
          subjectName: generated.subject || "General",
          topicName: generated.topic || generated.title || "AI Practice",
          questions: generated.questions.map((q) => ({
            question: q.question,
            options: {
              A: q.options[0] || "",
              B: q.options[1] || "",
              C: q.options[2] || "",
              D: q.options[3] || "",
            },
            answer: ["A", "B", "C", "D"][q.answerIndex] || "A",
          })),
        });

        const responseMsg: ChatMessage = {
          id: "msg_" + Date.now().toString(36),
          role: "assistant",
          content: `🎯 **I've generated a ${generated.questions.length}-question practice quiz and saved them to your Question Bank** under **${generated.subject || "General"} > ${generated.topic || "Practice"}**!\n\nYou can test yourself right here in chat or launch an official timed exam session:`,
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
      const systemInstruction = `CRITICAL IDENTITY RULES:
- You are ${aiName}, the student's personal AI study coach and academic mentor for MCQ Arena.
- The student's name is ${studentName}.
- NEVER address the student as ${aiName}! ${aiName} is YOUR name. Always address the student as ${studentName}.
- The student is studying: ${studyBio}.

Current user's database subjects:
${subjectsContext || "No subjects added yet."}
User's Permanent Routine Rules:
${dbUser?.aiNotepad || "Standard student schedule."}
`;

      const conversationPrompt =
        history
          .slice(-6)
          .map((h) => `${h.role === "user" ? studentName : aiName}: ${h.content}`)
          .join("\n\n") + `\n\n${studentName}: ${trimmed}\n${aiName}:`;

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
    smartReply = `Hey **${studentName}**! I'm **${aiName}**, your personal study coach. I'm connected to your account database — I can create or delete subjects, add topics, organize your daily routine, and generate exam MCQs.\n\nWhat are you working on today?`;
  } else {
    smartReply = `I'm with you, **${studentName}**! As **${aiName}**, I can manage your entire study workspace:\n\n• **Add Subjects & Topics**: Say *"Add Biology with topics Genetics, Cell Biology, Ecology"*\n• **Plan Your Routine**: Say *"Schedule my day: going out 3 to 6 PM, exam in 2 weeks"*\n• **Check Stats**: Say *"How many coins do I have?"* or *"Did I miss studying?"*\n• **Generate MCQs**: Say *"Make 5 MCQs on Cardiology"*\n\nWhat would you like me to do?`;
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
