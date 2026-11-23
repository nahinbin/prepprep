"use server";

import { generateGeminiJson, isGeminiConfigured } from "@/lib/gemini";
import { getSession } from "@/app/actions/auth";
import { prisma } from "@/lib/prisma";

export interface GenerateAiScheduleParams {
  dateKey: string;
  dayOfWeek: string;
  permanentNotes?: string;
  todayNote?: string;
  topicMastery?: Record<
    string,
    { percentage: number; isCompleted: boolean; subjectName: string; topicName: string }
  >;
  clientSubjects?: Array<{ name: string; topics: string[] }>;
}

export interface GeneratedBlockDto {
  type: "normal" | "study";
  title: string;
  timeMode: "range" | "single";
  startTime?: string;
  endTime?: string;
  subject?: string;
  topic?: string;
  notes?: string;
  subtasks?: string[];
}

export interface GenerateAiScheduleResult {
  success: boolean;
  summary: string;
  blocks: GeneratedBlockDto[];
  generatedBy: "gemini" | "smart-engine";
  error?: string;
}

interface TimeWindow {
  startMinutes: number; // minutes from 00:00 (0 to 1439)
  endMinutes: number;
  startStr: string; // "14:00"
  endStr: string;   // "20:00"
  title: string;
  notes?: string;
}

/**
 * Convert "HH:MM" or "2pm", "2:30 pm", "14:00" into minutes from midnight (0..1439)
 */
function parseTimeToMinutes(tStr: string): number | null {
  if (!tStr) return null;
  const lower = tStr.trim().toLowerCase();

  const isPm = lower.includes("pm");
  const isAm = lower.includes("am");
  const clean = lower.replace(/[a-z\s]/g, "");
  if (!clean) return null;

  const parts = clean.split(":");
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1] ? parseInt(parts[1], 10) : 0;

  if (isNaN(hours)) return null;

  if (isPm && hours < 12) hours += 12;
  if (isAm && hours === 12) hours = 0;

  if (hours > 23) hours = 23;
  return hours * 60 + Math.min(Math.max(minutes, 0), 59);
}

function minutesToTimeString(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Comprehensive parser for unavailable windows from user's notes.
 * Handles patterns such as:
 * - "from 2pm to 8 pm i wont be home"
 * - "from 2 to 8 pm not home"
 * - "2pm to 8pm out"
 * - "busy 14:00 - 18:00"
 * - "dentist at 3pm to 4:30pm"
 * - "coaching from 3:00 to 5:00"
 * - "going out 2 pm - 7 pm"
 * - "wont be home 2pm to 8pm"
 */
function extractUnavailableWindows(notesText: string): TimeWindow[] {
  if (!notesText || !notesText.trim()) return [];
  const windows: TimeWindow[] = [];

  const lines = notesText.split(/[\n;.]+/);

  // Regex 1: "from X [am|pm] to Y [am|pm] [context]"
  // e.g. "from 2pm to 8 pm i wont be home", "from 14:00 to 18:00 at work"
  const regexFromTo = /(?:from\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:to|-|until|till)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)(?:\s+(?:i\s+)?(?:wont\s+be\s+home|not\s+home|going\s+out|out|busy|class|coaching|gym|work|appointment|event|meeting|outside))?/i;

  // Regex 2: Context first, then time
  // e.g. "wont be home from 2pm to 8pm", "going out 2 to 6", "busy between 14:00 and 19:00"
  const regexContextFirst = /(?:wont\s+be\s+home|not\s+home|going\s+out|outing|busy|appointment|dentist|doctor|class|coaching|gym|work)\s*(?:from|at|between)?\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:to|-|and)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check if line indicates unavailability or outing
    const indicatesUnavailable = /(wont\s+be\s+home|not\s+home|going\s+out|out|busy|away|appointment|dentist|doctor|coaching|classes|gym|errand)/i.test(trimmed);

    let match = trimmed.match(regexContextFirst);
    if (!match && indicatesUnavailable) {
      match = trimmed.match(regexFromTo);
    } else if (!match && /(?:from\s+\d{1,2}.*?to\s+\d{1,2})/i.test(trimmed)) {
      // Even without explicit negative words, a "from X to Y" in today's note indicates a committed time window!
      match = trimmed.match(regexFromTo);
    }

    if (match && match[1] && match[2]) {
      let rawStart = match[1].trim();
      let rawEnd = match[2].trim();

      // If rawEnd has am/pm but rawStart doesn't, infer am/pm for rawStart
      const endHasPm = /pm/i.test(rawEnd);
      const endHasAm = /am/i.test(rawEnd);
      const startHasModifier = /[ap]m/i.test(rawStart);

      if (!startHasModifier) {
        if (endHasPm) {
          const rawStartNum = parseInt(rawStart, 10);
          // If start is e.g. 2 and end is 8pm -> start is 2pm
          // If start is e.g. 10 and end is 2pm -> start is 10am
          if (rawStartNum < 12 && rawStartNum > (parseInt(rawEnd, 10) || 0)) {
            rawStart += " am";
          } else {
            rawStart += " pm";
          }
        } else if (endHasAm) {
          rawStart += " am";
        }
      }

      const startM = parseTimeToMinutes(rawStart);
      const endM = parseTimeToMinutes(rawEnd);

      if (startM !== null && endM !== null && endM > startM) {
        let title = "Away from Home / Commitment";
        if (/wont\s+be\s+home|not\s+home|away/i.test(trimmed)) {
          title = "Not Home / Unavailable";
        } else if (/going\s+out|out/i.test(trimmed)) {
          title = "Outing & Personal Time";
        } else if (/coaching|class/i.test(trimmed)) {
          title = "Coaching / Class";
        } else if (/dentist|doctor|appointment/i.test(trimmed)) {
          title = "Doctor / Appointment";
        }

        windows.push({
          startMinutes: startM,
          endMinutes: endM,
          startStr: minutesToTimeString(startM),
          endStr: minutesToTimeString(endM),
          title,
          notes: trimmed,
        });
      }
    }
  }

  return windows;
}

/**
 * Checks whether [start, end] overlaps with [wStart, wEnd]
 */
function intervalsOverlap(s1: number, e1: number, s2: number, e2: number): boolean {
  return Math.max(s1, s2) < Math.min(e1, e2);
}

/**
 * Hard Constraint Validator & Enforcer:
 * Guaranteed rule: ZERO study blocks are allowed during user's unavailable windows!
 * If an AI or heuristic block collides with an unavailable window, it is relocated or replaced.
 */
function enforceHardConstraints(
  blocks: GeneratedBlockDto[],
  unavailableWindows: TimeWindow[]
): GeneratedBlockDto[] {
  if (unavailableWindows.length === 0) return blocks;

  const sanitized: GeneratedBlockDto[] = [];
  const studyBlocksToRelocate: GeneratedBlockDto[] = [];

  // 1. Filter existing blocks: drop or separate conflicting study blocks
  for (const block of blocks) {
    if (!block.startTime) {
      sanitized.push(block);
      continue;
    }

    const bStart = parseTimeToMinutes(block.startTime);
    const bEnd = block.endTime ? parseTimeToMinutes(block.endTime) : (bStart !== null ? bStart + 60 : null);

    if (bStart === null || bEnd === null) {
      sanitized.push(block);
      continue;
    }

    // Check if this block overlaps with ANY unavailable window
    const collision = unavailableWindows.find((w) =>
      intervalsOverlap(bStart, bEnd, w.startMinutes, w.endMinutes)
    );

    if (collision) {
      if (block.type === "study") {
        // Study block collided with unavailable time! NEVER ALLOW!
        studyBlocksToRelocate.push(block);
      }
      // If it's already a normal block representing an event or meal, keep it if it's the event itself
      continue;
    }

    sanitized.push(block);
  }

  // 2. Insert explicit normal blocks for every unavailable window
  for (const win of unavailableWindows) {
    sanitized.push({
      type: "normal",
      title: win.title,
      timeMode: "range",
      startTime: win.startStr,
      endTime: win.endStr,
      notes: win.notes || "Committed unavailable window specified in your notes",
    });
  }

  // 3. Re-place any displaced study blocks into open, safe windows (e.g. 08:30-10:30, 10:30-12:30, 20:30-22:00)
  const candidateSlots = [
    { start: 8 * 60 + 30, end: 10 * 60 + 30 },
    { start: 10 * 60 + 45, end: 12 * 60 + 45 },
    { start: 14 * 60, end: 16 * 60 },
    { start: 16 * 60 + 15, end: 18 * 60 },
    { start: 20 * 60 + 30, end: 22 * 60 + 15 },
  ];

  for (const studyBlock of studyBlocksToRelocate) {
    // Find an open candidate slot that does not overlap with any unavailable window
    // and does not overlap with an already scheduled block
    const safeSlot = candidateSlots.find((slot) => {
      // Overlaps unavailable window?
      const windowCollision = unavailableWindows.some((w) =>
        intervalsOverlap(slot.start, slot.end, w.startMinutes, w.endMinutes)
      );
      if (windowCollision) return false;

      // Overlaps existing block?
      const blockCollision = sanitized.some((b) => {
        if (!b.startTime) return false;
        const bs = parseTimeToMinutes(b.startTime);
        const be = b.endTime ? parseTimeToMinutes(b.endTime) : (bs !== null ? bs + 60 : null);
        if (bs === null || be === null) return false;
        return intervalsOverlap(slot.start, slot.end, bs, be);
      });
      return !blockCollision;
    });

    if (safeSlot) {
      sanitized.push({
        ...studyBlock,
        startTime: minutesToTimeString(safeSlot.start),
        endTime: minutesToTimeString(safeSlot.end),
      });
    }
  }

  // 4. Sort all blocks chronologically
  sanitized.sort((a, b) => {
    const aTime = a.startTime ? parseTimeToMinutes(a.startTime) ?? 0 : 0;
    const bTime = b.startTime ? parseTimeToMinutes(b.startTime) ?? 0 : 0;
    return aTime - bTime;
  });

  return sanitized;
}

export async function generateAiDailySchedule(
  params: GenerateAiScheduleParams
): Promise<GenerateAiScheduleResult> {
  const user = await getSession();
  if (!user) {
    return {
      success: false,
      summary: "",
      blocks: [],
      generatedBy: "smart-engine",
      error: "You must be logged in to generate a personalized daily schedule.",
    };
  }

  const { dateKey, dayOfWeek = "Today", todayNote = "" } = params;

  // 1. Fetch user's permanent notes and profile info directly from PostgreSQL
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      name: true,
      bio: true,
      aiNotepad: true,
      aiName: true,
    },
  });

  const permanentNotes = (
    (params.permanentNotes?.trim() || "") +
    (dbUser?.aiNotepad?.trim() ? `\n${dbUser.aiNotepad.trim()}` : "")
  ).trim();

  // 2. Fetch user's active preset blocks from PostgreSQL
  const activePreset = await prisma.routinePreset.findFirst({
    where: { userId: user.id, isActive: true },
    orderBy: { updatedAt: "desc" },
  });

  let presetBlocks: any[] = [];
  if (activePreset && activePreset.blocks) {
    try {
      presetBlocks = JSON.parse(activePreset.blocks);
    } catch { }
  }

  // 3. Fetch user's actual database subjects and topics strictly scoped to this user
  const dbSubjects = await prisma.subject.findMany({
    where: { userId: user.id },
    include: {
      topics: {
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  // If user has subjects in PostgreSQL, use ONLY their subjects
  let subjects = dbSubjects.map((s) => ({
    id: s.id,
    name: s.name,
    topics: s.topics.map((t) => t.name),
  }));

  // Fallback subjects only if DB has none
  if (subjects.length === 0) {
    if (params.clientSubjects && params.clientSubjects.length > 0) {
      subjects = params.clientSubjects.map((s, idx) => ({
        id: `custom_${idx}`,
        name: s.name,
        topics: s.topics,
      }));
    } else {
      subjects = [
        {
          id: "sub_1",
          name: "General Studies",
          topics: ["Core Concepts & Notes", "High Yield Practice", "Mistake Review", "Mock Questions"],
        },
      ];
    }
  }

  // 4. Fetch topic mastery directly from PostgreSQL for this user
  const dbMasteries = await prisma.topicMasteryRecord.findMany({
    where: { userId: user.id },
  });

  const topicMasteryMap: Record<string, number> = {};
  for (const m of dbMasteries) {
    const key = `${m.subject.trim().toLowerCase()}:::${m.topic.trim().toLowerCase()}`;
    topicMasteryMap[key] = m.percentage;
  }

  if (params.topicMastery) {
    for (const [k, v] of Object.entries(params.topicMastery)) {
      if (topicMasteryMap[k] === undefined) {
        topicMasteryMap[k] = v.percentage;
      }
    }
  }

  // 5. Build topic status breakdown
  const topicListWithStatus: Array<{
    subject: string;
    topic: string;
    percentage: number;
    status: "completed" | "partial" | "not_started";
  }> = [];

  for (const sub of subjects) {
    for (const top of sub.topics) {
      const key = `${sub.name.trim().toLowerCase()}:::${top.trim().toLowerCase()}`;
      const pct = topicMasteryMap[key] ?? 0;
      if (pct >= 100) {
        topicListWithStatus.push({
          subject: sub.name,
          topic: top,
          percentage: 100,
          status: "completed",
        });
      } else if (pct > 0) {
        topicListWithStatus.push({
          subject: sub.name,
          topic: top,
          percentage: pct,
          status: "partial",
        });
      } else {
        topicListWithStatus.push({
          subject: sub.name,
          topic: top,
          percentage: 0,
          status: "not_started",
        });
      }
    }
  }

  const eligibleTopics = topicListWithStatus.filter((t) => t.status !== "completed");
  const completedTopics = topicListWithStatus.filter((t) => t.status === "completed");

  // 6. Parse all unavailable windows from notes
  const combinedUserNotes = `${todayNote}\n${permanentNotes}`;
  const unavailableWindows = extractUnavailableWindows(combinedUserNotes);

  // 7. Try Gemini API with strict hard constraint directives
  if (isGeminiConfigured()) {
    try {
      const unavailableDescriptions = unavailableWindows.length > 0
        ? unavailableWindows.map((w) => `• ${w.title}: ${w.startStr} to ${w.endStr} ("${w.notes}")`).join("\n")
        : "None identified.";

      const prompt = `You are the student's elite personal academic strategist and daily schedule optimizer.
You must construct an optimal, highly realistic 1-day routine for ${dayOfWeek}, ${dateKey}.

STUDENT PROFILE:
- Name: ${dbUser?.name || user.username}
- Studying: ${dbUser?.bio || "General Studies / Exam Preparation"}

ACTIVE PRESET FRAMEWORK (Anchor Blocks to respect):
${presetBlocks.length > 0 ? JSON.stringify(presetBlocks.map((b) => ({ title: b.title, type: b.type, startTime: b.startTime, endTime: b.endTime })), null, 2) : "Default daily flow"}

PERMANENT NOTES & WEEKLY COMMITMENTS:
${permanentNotes || "None specified. Regular healthy student routine."}

STUDENT'S TEMPORARY NOTE / WORDS FOR TODAY:
${todayNote || "None specified."}

*** PARSED UNAVAILABLE WINDOWS (ABSOLUTE HARD RESTRICTION) ***:
${unavailableDescriptions}
CRITICAL MANDATE: The student is NOT available during these hours. You MUST schedule an event/normal block for these hours (e.g. "${unavailableWindows[0]?.title || "Outing"}") and you MUST NEVER schedule any study block between these hours!

STUDENT'S ELIGIBLE SUBJECTS & UNFINISHED TOPICS IN DATABASE:
${JSON.stringify(eligibleTopics.slice(0, 40), null, 2)}

TOPICS ALREADY 100% COMPLETED (STRICT RULE: NEVER SCHEDULE THESE!):
${JSON.stringify(completedTopics.map((t) => `${t.subject} - ${t.topic}`), null, 2)}

STRICT SCHEDULING RULES (DO NOT VIOLATE):
1. ABSOLUTE TIME CONSTRAINTS & UNAVAILABILITY:
   - When the student specifies that they won't be home, are going out, or have appointments during a time window (e.g. from 2:00 PM to 8:00 PM), that entire duration MUST be marked as a normal block (e.g. "Away from Home / Not Home").
   - ZERO study sessions may occur inside that window! Place study blocks before or after it.

2. MULTI-SUBJECT DIVERSIFICATION (INTERLEAVING):
   - NEVER stack the same subject across the whole day!
   - If the student has 2 or more subjects, you MUST distribute study blocks across DIFFERENT subjects (e.g., Morning: Subject A, Afternoon/Evening: Subject B).

3. EXAM PROXIMITY & TIMELINES:
   - If the student mentions an upcoming exam or test date, prioritize that subject's unfinished topics with timed MCQ recall sessions.

4. REALISTIC PACING:
   - Include wake up, meals, breaks, wind-down, and sleep.

Output strictly valid JSON with this shape:
{
  "summary": "Warm, encouraging 1-2 sentence note explaining why this schedule respects their exact outing/unavailability hours and targets multiple subjects.",
  "blocks": [
    {
      "type": "normal" | "study",
      "title": "Block Title",
      "timeMode": "range" | "single",
      "startTime": "HH:MM (24-hour)",
      "endTime": "HH:MM (24-hour)",
      "subject": "Subject Name (only for study blocks)",
      "topic": "Topic Name (only for study blocks)",
      "notes": "Target or description",
      "subtasks": ["Action 1", "Action 2"]
    }
  ]
}`;

      const aiResponse = await generateGeminiJson<{
        summary: string;
        blocks: GeneratedBlockDto[];
      }>(prompt, { temperature: 0.25 });

      if (aiResponse && Array.isArray(aiResponse.blocks) && aiResponse.blocks.length > 0) {
        // Enforce hard constraints even on Gemini's output as an impenetrable safety net
        const verifiedBlocks = enforceHardConstraints(aiResponse.blocks, unavailableWindows);

        return {
          success: true,
          summary: aiResponse.summary || `Personalized schedule ready for ${dayOfWeek}!`,
          blocks: verifiedBlocks,
          generatedBy: "gemini",
        };
      }
    } catch (err) {
      console.warn("Gemini schedule generation failed, using smart engine fallback:", err);
    }
  }

  // 8. Smart Heuristic Engine (Fallback when Gemini is unavailable)
  // Group eligible topics by subject to enforce multi-subject interleaving
  const subjectsMap = new Map<string, Array<{ topic: string; percentage: number; status: string }>>();
  for (const t of eligibleTopics) {
    if (!subjectsMap.has(t.subject)) {
      subjectsMap.set(t.subject, []);
    }
    subjectsMap.get(t.subject)!.push(t);
  }

  const chosenTargets: Array<{ subject: string; topic: string; note: string }> = [];
  const subjectKeys = Array.from(subjectsMap.keys());

  for (let i = 0; i < Math.min(3, subjectKeys.length); i++) {
    const subName = subjectKeys[i];
    const tops = subjectsMap.get(subName)!;
    const chosenTopic = tops.find((t) => t.status === "partial") || tops[0];
    if (chosenTopic) {
      chosenTargets.push({
        subject: subName,
        topic: chosenTopic.topic,
        note:
          chosenTopic.percentage > 0
            ? `Finish remaining ${100 - chosenTopic.percentage}% of this topic`
            : "Core concept notes & active recall",
      });
    }
  }

  if (chosenTargets.length < 2 && eligibleTopics.length > 1) {
    for (const t of eligibleTopics) {
      if (!chosenTargets.some((ct) => ct.topic === t.topic)) {
        chosenTargets.push({
          subject: t.subject,
          topic: t.topic,
          note: "Targeted problem solving & recall",
        });
        if (chosenTargets.length >= 3) break;
      }
    }
  }

  const generatedBlocks: GeneratedBlockDto[] = [
    {
      type: "normal",
      title: "Wake up & Morning Refresh",
      timeMode: "single",
      startTime: "07:00",
      notes: "Hydrate & light stretch",
    },
    {
      type: "normal",
      title: "Breakfast & Energy",
      timeMode: "range",
      startTime: "07:30",
      endTime: "08:15",
    },
  ];

  // Morning Block: Subject 1
  if (chosenTargets[0]) {
    generatedBlocks.push({
      type: "study",
      title: `${chosenTargets[0].subject} Focus Session`,
      subject: chosenTargets[0].subject,
      topic: chosenTargets[0].topic,
      timeMode: "range",
      startTime: "08:30",
      endTime: "10:30",
      notes: chosenTargets[0].note,
      subtasks: [
        `Review key concepts of ${chosenTargets[0].topic}`,
        "Complete 15-20 practice MCQs in Arena",
        "Record mistakes in notebook",
      ],
    });
  }

  // Late Morning: Subject 2
  if (chosenTargets[1]) {
    generatedBlocks.push({
      type: "study",
      title: `${chosenTargets[1].subject} Concept Sprint`,
      subject: chosenTargets[1].subject,
      topic: chosenTargets[1].topic,
      timeMode: "range",
      startTime: "11:00",
      endTime: "12:30",
      notes: chosenTargets[1].note,
      subtasks: [
        "Rapid concept drill & formula check",
        "10-question focus quiz",
      ],
    });
  }

  generatedBlocks.push({
    type: "normal",
    title: "Lunch & Rest Break",
    timeMode: "range",
    startTime: "12:45",
    endTime: "13:45",
  });

    // Afternoon & Evening default placeholders (will be cleanly reconciled by enforceHardConstraints)
    if (chosenTargets[2]) {
      generatedBlocks.push({
        type: "study",
        title: `${chosenTargets[2].subject} Deep Dive`,
        subject: chosenTargets[2].subject,
        topic: chosenTargets[2].topic,
        timeMode: "range",
        startTime: "14:30",
        endTime: "16:00",
        notes: chosenTargets[2].note,
        subtasks: [
          `Target unfinished modules in ${chosenTargets[2].topic}`,
          "Solve 12 exam questions",
        ],
      });
    }

    generatedBlocks.push({
      type: "study",
      title: "MCQ Arena Exam Simulation & Mistakes Review",
      subject: chosenTargets[0]?.subject || "Exam Prep",
      topic: "Mixed Rapid Revision",
      timeMode: "range",
      startTime: "18:30",
      endTime: "20:00",
      notes: "Timed speed test to build exam stamina",
      subtasks: [
        "2 Arena ranked speed sessions",
        "Redo uncorrected mistakes",
      ],
    });

    generatedBlocks.push({
      type: "normal",
      title: "Dinner & Family Time",
      timeMode: "range",
      startTime: "20:15",
      endTime: "21:15",
    });

    generatedBlocks.push({
      type: "normal",
      title: "Sleep & Recovery",
      timeMode: "single",
      startTime: "23:00",
      notes: "Rest well to consolidate memory",
    });

    // Strictly enforce all unavailable windows
    const finalBlocks = enforceHardConstraints(generatedBlocks, unavailableWindows);

    return {
      success: true,
    summary: unavailableWindows.length > 0
        ? `Tailored routine honoring your unavailable window (${unavailableWindows[0].startStr} - ${unavailableWindows[0].endStr}) with diversified multi-subject study!`
        : `Interleaved multi-subject schedule balancing ${chosenTargets.map((c) => c.subject).join(", ")} and healthy recovery!`,
      blocks: finalBlocks,
      generatedBy: "smart-engine",
    };
  }
