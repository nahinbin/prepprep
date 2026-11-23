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

  // 2. Fetch user's actual database subjects and topics strictly scoped to this user
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

  // If user has no subjects in DB, check bio or fall back
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

  // 3. Fetch topic mastery directly from PostgreSQL for this user
  const dbMasteries = await prisma.topicMasteryRecord.findMany({
    where: { userId: user.id },
  });

  const topicMasteryMap: Record<string, number> = {};
  for (const m of dbMasteries) {
    const key = `${m.subject.trim().toLowerCase()}:::${m.topic.trim().toLowerCase()}`;
    topicMasteryMap[key] = m.percentage;
  }

  // Also include any client-passed mastery if present
  if (params.topicMastery) {
    for (const [k, v] of Object.entries(params.topicMastery)) {
      if (topicMasteryMap[k] === undefined) {
        topicMasteryMap[k] = v.percentage;
      }
    }
  }

  // 4. Build topic status breakdown
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

  // 5. Try Gemini API with strict, unambiguous cognitive constraints
  if (isGeminiConfigured()) {
    try {
      const prompt = `You are the student's elite personal academic strategist and daily schedule optimizer.
You must construct an optimal, highly realistic 1-day routine for ${dayOfWeek}, ${dateKey}.

STUDENT PROFILE:
- Name: ${dbUser?.name || user.username}
- Studying: ${dbUser?.bio || "General Studies / Exam Preparation"}

PERMANENT NOTES & WEEKLY COMMITMENTS (From Settings/Notepad):
${permanentNotes || "None specified. Regular healthy student routine."}

TEMPORARY NOTE / STUDENT'S WORDS FOR TODAY:
${todayNote || "None specified. Regular focused study day."}

STUDENT'S ELIGIBLE SUBJECTS & UNFINISHED TOPICS IN DATABASE:
${JSON.stringify(eligibleTopics.slice(0, 40), null, 2)}

TOPICS ALREADY 100% COMPLETED (STRICT RULE: NEVER SCHEDULE THESE!):
${JSON.stringify(completedTopics.map((t) => `${t.subject} - ${t.topic}`), null, 2)}

STRICT SCHEDULING RULES (DO NOT VIOLATE):
1. ABSOLUTE TIME CONSTRAINTS & OUTINGS:
   - If the student states in their temporary note or permanent notes that they are going out, having an appointment, attending classes, coaching, or busy during specific hours (e.g. "going out from 3 PM to 6 PM", "dentist at 2 PM", "at coaching 2:30 to 5 PM"), you MUST schedule a normal/event block for that EXACT time window.
   - You MUST NEVER schedule any study blocks during the hours the student is busy or out!

2. MULTI-SUBJECT DIVERSIFICATION (INTERLEAVING):
   - NEVER stack the same subject for the whole day!
   - If the student has 2 or more subjects, you MUST alternate and distribute study blocks across DIFFERENT subjects (e.g., Morning: Subject A, Afternoon: Subject B, Evening: Subject C or Arena session).
   - Rotating subjects prevents mental fatigue and maximizes retention.

3. EXAM PROXIMITY & TIMELINES:
   - If the student mentions an upcoming exam date or timeline (e.g. "exam on Friday", "exam in 1 month", "have a test coming up"), calculate the urgency!
   - Give higher priority, focused practice, and timed MCQ recall blocks to that exam's subject without completely neglecting other responsibilities.

4. REALISTIC AND EMPATHETIC PACING:
   - If the student mentions feeling tired, sick, having low energy, or limited hours, do NOT schedule intense 8-hour blocks. Use lighter 40-50 minute sprints with generous recovery periods.
   - Never schedule topics in the COMPLETED list.
   - Include vital daily blocks: Wake up, meals (Breakfast, Lunch, Dinner), wind-down, and a healthy sleep target (e.g. 11:00 PM).

Output strictly valid JSON with this shape:
{
  "summary": "Warm, encouraging 1-2 sentence note explaining why this schedule is tailored to their exact notes, energy level, and exam goals.",
  "blocks": [
    {
      "type": "normal" | "study",
      "title": "Block Title (e.g. 'Wake up & Morning Refresh', 'Physics Deep Focus', 'Going Out / Free Time', 'Biology MCQ Sprint')",
      "timeMode": "range" | "single",
      "startTime": "HH:MM (24-hour e.g. 07:00, 14:30)",
      "endTime": "HH:MM (24-hour e.g. 08:30, 17:00)",
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
        return {
          success: true,
          summary: aiResponse.summary || `Personalized schedule ready for ${dayOfWeek}!`,
          blocks: aiResponse.blocks,
          generatedBy: "gemini",
        };
      }
    } catch (err) {
      console.warn("Gemini schedule generation failed, using smart engine fallback:", err);
    }
  }

  // 6. Smart Heuristic Engine (Fallback when Gemini is unavailable)
  // Parse user constraints from temporary note and permanent notes
  const combinedText = `${permanentNotes} ${todayNote}`.toLowerCase();

  // Detect outing / busy window (e.g. "from 3 to 6", "from 15:00 to 18:00", "going out 2pm to 5pm")
  let busyWindow: { start: string; end: string; title: string } | null = null;
  const outingMatch = combinedText.match(
    /(?:going\s+out|outing|appointment|dentist|event|busy|doctor|coaching|class)\s*(?:from|at)?\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:to|-)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i
  );

  const normalizeTime = (tStr: string): string => {
    const isPm = tStr.toLowerCase().includes("pm");
    const isAm = tStr.toLowerCase().includes("am");
    const clean = tStr.replace(/[a-z\s]/gi, "");
    let [hStr, mStr] = clean.split(":");
    let h = parseInt(hStr, 10);
    const m = mStr ? mStr.padStart(2, "0") : "00";
    if (isPm && h < 12) h += 12;
    if (isAm && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${m}`;
  };

  if (outingMatch) {
    busyWindow = {
      start: normalizeTime(outingMatch[1]),
      end: normalizeTime(outingMatch[2]),
      title: "Outing / Scheduled Event",
    };
  }

  // Group eligible topics by subject to enforce multi-subject interleaving
  const subjectsMap = new Map<string, Array<{ topic: string; percentage: number; status: string }>>();
  for (const t of eligibleTopics) {
    if (!subjectsMap.has(t.subject)) {
      subjectsMap.set(t.subject, []);
    }
    subjectsMap.get(t.subject)!.push(t);
  }

  // Pick up to 3 study targets across DIFFERENT subjects
  const chosenTargets: Array<{ subject: string; topic: string; note: string }> = [];
  const subjectKeys = Array.from(subjectsMap.keys());

  for (let i = 0; i < Math.min(3, subjectKeys.length); i++) {
    const subName = subjectKeys[i];
    const tops = subjectsMap.get(subName)!;
    // Prefer partial topic, else first not started
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

  // Fallback if user only had 1 subject: pick multiple topics from that subject
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
      title: "Wake up & Refresh",
      timeMode: "single",
      startTime: "07:00",
      notes: "Hydrate & light stretch",
    },
    {
      type: "normal",
      title: "Breakfast & Fuel",
      timeMode: "range",
      startTime: "07:30",
      endTime: "08:15",
    },
  ];

  // Block 1: Morning Focus (Subject 1)
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

  // Block 2: Late Morning (Subject 2 - Different Subject!)
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
    endTime: "14:00",
  });

  // Check if user has an outing / busy window scheduled
  if (busyWindow) {
    generatedBlocks.push({
      type: "normal",
      title: busyWindow.title,
      timeMode: "range",
      startTime: busyWindow.start,
      endTime: busyWindow.end,
      notes: "Scheduled appointment / personal commitment",
    });
  } else {
    // Afternoon: Subject 3 or Free Time
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
      type: "normal",
      title: "Free Time / Outdoor Walk",
      timeMode: "range",
      startTime: "16:30",
      endTime: "17:45",
    });
  }

  // Evening Practice & Review
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
    endTime: "21:30",
  });

  generatedBlocks.push({
    type: "normal",
    title: "Sleep & Recovery",
    timeMode: "single",
    startTime: "23:00",
    notes: "Rest well to consolidate memory",
  });

  return {
    success: true,
    summary: busyWindow
      ? `Tailored routine honoring your ${busyWindow.title} (${busyWindow.start} - ${busyWindow.end}) with diversified study blocks!`
      : `Interleaved multi-subject schedule balancing ${chosenTargets.map((c) => c.subject).join(", ")} and healthy recovery!`,
    blocks: generatedBlocks,
    generatedBy: "smart-engine",
  };
}
