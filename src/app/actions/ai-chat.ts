"use server";

import { generateGeminiText, isGeminiConfigured } from "@/lib/gemini";
import { bulkAddTopicsToSubject, getUserSubjectsAndTopics } from "@/app/actions/subjects";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  actionTaken?: {
    type: "added_topics" | "study_tip";
    subjectName?: string;
    addedCount?: number;
    skippedCount?: number;
    topics?: string[];
  };
  timestamp: number;
}

export async function sendChatMessage(
  message: string,
  history: Array<{ role: "user" | "assistant"; content: string }>
): Promise<ChatMessage> {
  const trimmed = message.trim();
  const lower = trimmed.toLowerCase();

  // 1. Detect if user is asking to add topics to a subject
  // e.g. "add these topics to math: algebra, calculus, geometry"
  // or "add topics to physics", "create topics for cardiology in medicine"
  const addTopicsRegex = /(?:add|create|put|insert)(?:\s+(?:these|the following|some|\d+))?\s+topics?\s+(?:to|in|under|for)\s+([a-zA-Z0-9_\s]+?)[:\n\-\?]([\s\S]+)/i;
  const match = trimmed.match(addTopicsRegex);

  if (match) {
    const rawSubject = match[1].replace(/^(?:the subject|subject)\s+/i, "").trim();
    const rawTopics = match[2];

    // Split topics by newline, comma, bullet points, numbering
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
            content: `✅ Successfully updated **${res.subjectName}**!\n\n• **${res.addedCount}** new topics added\n• **${res.skippedCount}** topics were already in your database (skipped to prevent duplicates)\n\nAdded topics:\n${res.addedTopics.slice(0, 10).map((t) => `• ${t}`).join("\n")}${res.addedTopics.length > 10 ? `\n• ...and ${res.addedTopics.length - 10} more` : ""}\n\nYou can now schedule these directly in your Daily Routine or practice them in the Question Bank!`,
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

  // 2. Fetch existing subjects to give Gemini context
  const userSubjects = await getUserSubjectsAndTopics();
  const subjectsContext = userSubjects
    .map((s) => `• ${s.name} (${s.topics.length} topics: ${s.topics.slice(0, 8).join(", ")})`)
    .join("\n");

  // 3. Call Gemini if configured
  if (isGeminiConfigured()) {
    try {
      const systemInstruction = `You are the MCQ Arena Academic AI Assistant and study coach.
You help students prepare for high-stakes exams (medical, engineering, university finals).
You have direct knowledge of the student's current subjects and topics:
${subjectsContext || "No subjects added yet."}

Guidelines:
- Keep answers encouraging, concise, and structured.
- If the student lists topics they want to add to a subject, tell them you can automatically save them if they say "Add topics to [Subject]: [list of topics]".
- Give practical study advice: Pomodoro sprints, active recall, MCQ mistake review, spaced repetition.`;

      const conversationPrompt = history
        .slice(-6)
        .map((h) => `${h.role === "user" ? "Student" : "Assistant"}: ${h.content}`)
        .join("\n\n") + `\n\nStudent: ${trimmed}\nAssistant:`;

      const reply = await generateGeminiText(conversationPrompt, {
        systemInstruction,
        temperature: 0.5,
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

  // 4. Smart Local Reply Fallback
  let smartReply = "";
  if (lower.includes("math") || lower.includes("physics") || lower.includes("biology") || lower.includes("chemistry")) {
    smartReply = `I see you're focusing on your core subjects! Here's a tip: break down difficult formulas into 45-minute focus sprints in your **Daily Routine**, followed by 15 minutes of rapid MCQ practice in **Free Practice** mode.\n\nTo have me automatically add topics to your subject, just type:\n\`Add topics to [Subject Name]: Topic 1, Topic 2, Topic 3...\``;
  } else if (lower.includes("exam") || lower.includes("final") || lower.includes("prepare")) {
    smartReply = `Exam preparation is all about consistency! Make sure to use the **✨ Generate Schedule with AI** button on your Daily Routine page each morning. It automatically skips topics you've already completed (100%) and schedules your unfinished topics with optimal timing!`;
  } else {
    smartReply = `Hello! I'm your MCQ Arena Study Coach. I can:\n\n1. **Auto-Add Topics**: Say \`Add topics to [Subject]: Topic 1, Topic 2...\` and I will instantly create them in your database, skipping any duplicates.\n2. **Optimize Routine**: Help you plan high-yield study sprints and breaks.\n3. **Exam Strategy**: Advise on spaced repetition and MCQ time management.\n\nWhat are you preparing for today?`;
  }

  return {
    id: "msg_" + Date.now().toString(36),
    role: "assistant",
    content: smartReply,
    timestamp: Date.now(),
  };
}

