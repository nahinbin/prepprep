"use server";

import { generateGeminiJson, isGeminiConfigured } from "@/lib/gemini";
import { getUserSubjectsAndTopics } from "@/app/actions/subjects";

export interface GenerateAiScheduleParams {
  dateKey: string;
  dayOfWeek: string;
  permanentNotes: string;
  todayNote?: string;
  topicMastery: Record<
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
  const {
    dateKey,
    dayOfWeek = "Today",
    permanentNotes = "",
    todayNote = "",
    topicMastery = {},
    clientSubjects,
  } = params;

  // 1. Fetch user subjects from DB or fallback to client provided
  let subjects = await getUserSubjectsAndTopics();
  if (subjects.length === 0 && clientSubjects && clientSubjects.length > 0) {
    subjects = clientSubjects.map((s, idx) => ({
      id: `client_${idx}`,
      name: s.name,
      topics: s.topics,
    }));
  }

  // Fallback default subjects if user hasn't added any yet
  if (subjects.length === 0) {
    subjects = [
      {
        id: "sub_1",
        name: "Physics",
        topics: ["Kinematics & Dynamics", "Thermodynamics", "Wave Optics", "Electromagnetism"],
      },
      {
        id: "sub_2",
        name: "Chemistry",
        topics: ["Organic Reaction Mechanisms", "Chemical Kinetics", "Coordination Compounds", "Periodic Trends"],
      },
      {
        id: "sub_3",
        name: "Mathematics",
        topics: ["Calculus & Integrals", "Differential Equations", "Vectors & 3D Geometry", "Probability"],
      },
      {
        id: "sub_4",
        name: "Biology",
        topics: ["Genetics & Heredity", "Human Physiology", "Cell Biology", "Ecology & Evolution"],
      },
    ];
  }

  // 2. Build topic status breakdown for prompt (exclude 100% completed)
  const topicListWithStatus: Array<{
    subject: string;
    topic: string;
    percentage: number;
    status: "completed" | "partial" | "not_started";
  }> = [];

  for (const sub of subjects) {
    for (const top of sub.topics) {
      const key = `${sub.name.trim().toLowerCase()}:::${top.trim().toLowerCase()}`;
      const rec = topicMastery[key];
      const pct = rec ? rec.percentage : 0;
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

  // 3. Try Gemini API first if configured
  if (isGeminiConfigured()) {
    try {
      const prompt = `You are an elite academic coach and daily routine planner for a student preparing for competitive exams.
Design a highly structured, 1-day routine for ${dayOfWeek}, ${dateKey}.

PERMANENT RULES & WEEKLY COMMITMENTS (From Settings):
${permanentNotes || "Standard student schedule. Healthy sleep by 11 PM."}

TEMPORARY NOTE FOR TODAY:
${todayNote || "None specified. Regular focused study day."}

ELIGIBLE TOPICS TO STUDY (Topics NOT completed yet):
${JSON.stringify(eligibleTopics.slice(0, 35), null, 2)}

TOPICS ALREADY 100% COMPLETED (STRICT RULE: NEVER SCHEDULE THESE!):
${JSON.stringify(completedTopics.map((t) => `${t.subject} - ${t.topic}`), null, 2)}

STRICT SCHEDULING RULES:
1. NEVER schedule any topic that is in the COMPLETED list!
2. Prioritize partially completed topics (${eligibleTopics.filter((t) => t.status === "partial").map((t) => t.topic).join(", ") || "None"}) and give them appropriate focused time (e.g., 45-60 min) to finish them!
3. If permanent notes specify coaching, school, or recurring classes on ${dayOfWeek}, accurately schedule those normal blocks.
4. If the temporary note mentions events (e.g. dentist, exam, feeling tired), incorporate them thoughtfully.
5. Include essential daily normal blocks: Wake up, breakfast, lunch, fresh air / break, dinner, sleep.
6. For study blocks: set clear subject, topic, and concise high-yield subtasks.

Output strictly valid JSON with this shape:
{
  "summary": "Short encouraging note explaining why today's plan is optimal",
  "blocks": [
    {
      "type": "normal" | "study",
      "title": "Block Title",
      "timeMode": "range" | "single",
      "startTime": "07:00",
      "endTime": "07:30",
      "subject": "Physics",
      "topic": "Kinematics",
      "notes": "Target high-yield MCQs",
      "subtasks": ["Solve 15 MCQs", "Formula review"]
    }
  ]
}`;

      const aiResponse = await generateGeminiJson<{
        summary: string;
        blocks: GeneratedBlockDto[];
      }>(prompt, { temperature: 0.3 });

      if (aiResponse && Array.isArray(aiResponse.blocks) && aiResponse.blocks.length > 0) {
        return {
          success: true,
          summary: aiResponse.summary || `Optimized schedule created for ${dayOfWeek}!`,
          blocks: aiResponse.blocks,
          generatedBy: "gemini",
        };
      }
    } catch (err) {
      console.warn("Gemini schedule generation failed, using smart engine fallback:", err);
    }
  }

  // 4. Smart Heuristic Engine (Lightning-Fast Fallback)
  const isCoachingDay =
    (permanentNotes || "").toLowerCase().includes((dayOfWeek || "").toLowerCase()) ||
    ["monday", "wednesday", "friday"].includes((dayOfWeek || "").toLowerCase());

  const partialTopics = eligibleTopics.filter((t) => t.status === "partial");
  const unstartedTopics = eligibleTopics.filter((t) => t.status === "not_started");

  // Pick 2 to 3 study targets for the day
  const chosenTargets: Array<{ subject: string; topic: string; durationMin: number; note: string }> = [];

  // Finish partial topics first
  for (const pt of partialTopics.slice(0, 2)) {
    chosenTargets.push({
      subject: pt.subject,
      topic: pt.topic,
      durationMin: 60, // Shorter duration as user requested!
      note: `Finish remaining ${100 - pt.percentage}% of this topic`,
    });
  }

  // Fill with unstarted topics
  for (const ut of unstartedTopics.slice(0, 3 - chosenTargets.length)) {
    chosenTargets.push({
      subject: ut.subject,
      topic: ut.topic,
      durationMin: 90,
      note: "Core concept mastery & question practice",
    });
  }

  const generatedBlocks: GeneratedBlockDto[] = [
    {
      type: "normal",
      title: "Wake up & Hydrate",
      timeMode: "single",
      startTime: "06:45",
      notes: "Morning sunlight & water",
    },
    {
      type: "normal",
      title: "Breakfast & Refresh",
      timeMode: "range",
      startTime: "07:15",
      endTime: "07:45",
    },
  ];

  if (chosenTargets[0]) {
    generatedBlocks.push({
      type: "study",
      title: `${chosenTargets[0].subject} Focus Sprint`,
      subject: chosenTargets[0].subject,
      topic: chosenTargets[0].topic,
      timeMode: "range",
      startTime: "08:00",
      endTime: chosenTargets[0].durationMin === 60 ? "09:00" : "09:30",
      notes: chosenTargets[0].note,
      subtasks: [
        `Review core theory of ${chosenTargets[0].topic}`,
        "Solve 15-20 practice MCQs",
        "Add key formulas to review sheet",
      ],
    });
  }

  if (chosenTargets[1]) {
    generatedBlocks.push({
      type: "study",
      title: `${chosenTargets[1].subject} Revision Block`,
      subject: chosenTargets[1].subject,
      topic: chosenTargets[1].topic,
      timeMode: "range",
      startTime: "10:00",
      endTime: chosenTargets[1].durationMin === 60 ? "11:00" : "11:30",
      notes: chosenTargets[1].note,
      subtasks: [
        "High-yield problem solving",
        "Review mistake patterns in MCQ Arena",
      ],
    });
  }

  generatedBlocks.push({
    type: "normal",
    title: "Lunch & Power Rest",
    timeMode: "range",
    startTime: "12:30",
    endTime: "13:30",
  });

  if (isCoachingDay) {
    generatedBlocks.push({
      type: "normal",
      title: "Coaching / Classes",
      timeMode: "range",
      startTime: "14:30",
      endTime: "17:00",
      notes: "Attending scheduled coaching session",
    });
  } else {
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
          "Concept notes & flashcard review",
          "Timed 20-min session in MCQ Arena",
        ],
      });
    }

    generatedBlocks.push({
      type: "normal",
      title: "Free Time / Walk & Workout",
      timeMode: "range",
      startTime: "16:30",
      endTime: "17:30",
    });
  }

  generatedBlocks.push({
    type: "study",
    title: "MCQ Arena Exam Simulation",
    subject: chosenTargets[0]?.subject || "Exam Prep",
    topic: "Mixed Rapid Revision",
    timeMode: "range",
    startTime: "18:00",
    endTime: "19:30",
    notes: "Timed speed test to build exam stamina",
    subtasks: [
      "Complete 2 Arena ranked sessions",
      "Redo uncorrected mistakes",
    ],
  });

  generatedBlocks.push({
    type: "normal",
    title: "Dinner & Family Time",
    timeMode: "range",
    startTime: "19:45",
    endTime: "21:00",
  });

  generatedBlocks.push({
    type: "normal",
    title: "Sleep & Brain Recovery",
    timeMode: "single",
    startTime: "23:00",
    notes: "Phone on DND, 7-8 hours quality sleep",
  });

  return {
    success: true,
    summary: isCoachingDay
      ? `Scheduled coaching from 2:30 PM to 5:00 PM with focused morning & evening study sprints!`
      : `Complete balanced day crafted with high-priority unfinished topics and active recovery.`,
    blocks: generatedBlocks,
    generatedBy: "smart-engine",
  };
}

