"use server";

import { generateGeminiText, generateGeminiJson, isGeminiConfigured } from "@/lib/gemini";
import { bulkAddTopicsToSubject, getUserSubjectsAndTopics } from "@/app/actions/subjects";

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
      | "study_tip"
      | "added_block"
      | "updated_notepad"
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

export async function sendChatMessage(
  message: string,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  context: ChatContext = {}
): Promise<ChatMessage> {
  const trimmed = message.trim();
  const lower = trimmed.toLowerCase();
  const aiName = context.aiName?.trim() || "Jarvis";

  // 1. Detect if user is asking to add topics to a subject
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
          return {
            id: "msg_" + Date.now().toString(36),
            role: "assistant",
            content: `✅ I've updated **${res.subjectName}** for you!\n\n• **${res.addedCount}** new topics added to your Question Bank & Routine\n• **${res.skippedCount}** duplicates skipped\n\nAdded:\n${res.addedTopics.slice(0, 10).map((t) => `• ${t}`).join("\n")}${res.addedTopics.length > 10 ? `\n• ...and ${res.addedTopics.length - 10} more` : ""}\n\nYou can now study these or practice them in MCQ Arena!`,
            actionTaken: {
              type: "added_topics",
              subjectName: res.subjectName,
              addedCount: res.addedCount,
              skippedCount: res.skippedCount,
              topics: res.addedTopics,
            },
            timestamp: Date.now(),
          };
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

  // 2. Detect if user is asking to generate MCQs from text/reading
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
        return {
          id: "msg_" + Date.now().toString(36),
          role: "assistant",
          content: `🎯 I generated a **${generated.questions.length}-question practice quiz** from your notes!\n\nClick **Start Practice Quiz** below to test yourself right now:`,
          actionTaken: {
            type: "created_quiz",
          },
          generatedQuiz: generated,
          timestamp: Date.now(),
        };
      }
    } catch (e) {
      console.warn("Gemini quiz generation error:", e);
    }
  }

  // Fallback MCQ creation if requested but Gemini failed or not configured
  if (isMcqRequest) {
    const topicHint = trimmed.slice(0, 40).replace(/[^\w\s]/gi, "");
    return {
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
  }

  // 3. Detect if user is asking to add a routine block
  // e.g. "add a study block for Physics at 4 PM" or "add block: sleep at 11 PM"
  const addBlockMatch = trimmed.match(/(?:add|create|schedule)\s+(?:a\s+)?(study|normal)?\s*block(?:\s+for|\s+to|\s*:)?\s*([^,\n]+?)(?:\s+(?:at|from)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?))?/i);
  if (addBlockMatch) {
    const rawType = (addBlockMatch[1] || "").toLowerCase() === "study" ? "study" : "normal";
    const rawSubjectOrTitle = addBlockMatch[2].trim();
    const rawTime = addBlockMatch[3] ? addBlockMatch[3].trim() : undefined;

    return {
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
  }

  // 4. Detect if user is asking to update permanent notepad
  // e.g. "remember that on tuesdays I have football" or "add to my notepad: coaching on..."
  if (lower.startsWith("remember") || lower.includes("add to notepad") || lower.includes("save to notepad") || lower.includes("add to my notes")) {
    const cleanNote = trimmed.replace(/^(?:remember\s+(?:that)?|add\s+to\s+(?:my\s+)?notepad(?:\s*:)?|save\s+to\s+(?:my\s+)?notepad(?:\s*:)?|add\s+to\s+my\s+notes(?:\s*:)?)/i, "").trim();
    if (cleanNote) {
      return {
        id: "msg_" + Date.now().toString(36),
        role: "assistant",
        content: `📝 Got it! I've saved that into your **Routine Notepad**:\n\n> "${cleanNote}"\n\nI will remember this whenever building your daily schedules!`,
        actionTaken: {
          type: "updated_notepad",
          newNotepadText: cleanNote,
        },
        timestamp: Date.now(),
      };
    }
  }

  // 5. Fetch subjects & topics context
  let subjectsContext = "";
  try {
    const userSubjects = await getUserSubjectsAndTopics();
    subjectsContext = userSubjects
      .map((s) => `• ${s.name} (${s.topics.length} topics: ${s.topics.slice(0, 8).join(", ")})`)
      .join("\n");
  } catch (err) {
    console.warn("Failed to fetch subjects context for AI chat:", err);
  }

  // 6. Call Gemini LLM if configured
  if (isGeminiConfigured()) {
    try {
      const systemInstruction = `You are ${aiName}, the student's personal AI study coach and academic partner for MCQ Arena.
You are warm, brilliant, encouraging, and deeply knowledgeable across STEM, mathematics, accounting, finance, physics, chemistry, biology, medicine, and business.
You have direct knowledge of the student's subjects:
${subjectsContext || "No subjects added yet."}
Permanent Notepad Rules:
${context.notepadNotes || "Standard schedule."}

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

      return {
        id: "msg_" + Date.now().toString(36),
        role: "assistant",
        content: reply,
        timestamp: Date.now(),
      };
    } catch (err) {
      console.warn("Gemini chat error, fallback to smart reply:", err);
    }
  }

  // 7. Smart Conversational Fallback
  let smartReply = "";
  if (lower.includes("hello") || lower.includes("hi") || lower.includes("hey") || lower.includes("who are you")) {
    smartReply = `Hey! I'm **${aiName}**, your personal study coach. I'm here to help you study, plan your routines, generate practice MCQs, and prepare for finals.\n\nWhat are you working on today?`;
  } else if (lower.includes("math") || lower.includes("calculus") || lower.includes("derivative") || lower.includes("integral")) {
    smartReply = `For Mathematics, active problem solving beats passive reading every time! I suggest breaking formulas down into 45-minute focus sprints in your **Daily Routine**, followed by rapid MCQ testing in **Practice** mode.\n\nWant me to generate some practice MCQs for you? Just say "Make MCQs on Calculus"!`;
  } else if (lower.includes("exam") || lower.includes("final") || lower.includes("prepare") || lower.includes("schedule")) {
    smartReply = `Exam preparation is about consistent sprints without burnout. Make sure to head over to **Daily Routine** and click **✨ Build with AI** each morning — it skips topics you've completed 100% and focuses on your unfinished high-yield subjects!`;
  } else {
    smartReply = `I'm with you! As **${aiName}**, I can:\n\n• **Generate MCQs**: Paste any paragraph or lecture notes and say *"Make MCQs from this"*\n• **Auto-Add Topics**: Say *"Add topics to [Subject]: Topic 1, Topic 2"*\n• **Routine Scheduling**: Ask me to add blocks or update your notepad\n• **Explain Concepts**: Ask me anything in Math, Physics, Chemistry, Accounting, or Finance!\n\nHow can I help you right now?`;
  }

  return {
    id: "msg_" + Date.now().toString(36),
    role: "assistant",
    content: smartReply,
    timestamp: Date.now(),
  };
}


