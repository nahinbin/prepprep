"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/app/actions/auth";
import { revalidatePath } from "next/cache";

export const DEFAULT_AI_NAME = "AI Assistant";

export const DEFAULT_PRESETS = [
  {
    name: "Standard School Day",
    description: "Balanced day with morning classes, afternoon coaching, and evening self-study.",
    isActive: true,
    isCustom: false,
    blocks: JSON.stringify([
      {
        type: "normal",
        title: "Wake up & Refresh",
        timeMode: "single",
        startTime: "06:30",
      },
      {
        type: "normal",
        title: "School / College",
        timeMode: "range",
        startTime: "08:00",
        endTime: "13:30",
      },
      {
        type: "normal",
        title: "Lunch & Break",
        timeMode: "range",
        startTime: "13:30",
        endTime: "14:30",
      },
      {
        type: "study",
        title: "Coaching / Tuitions",
        subject: "Physics",
        topic: "Kinematics",
        timeMode: "range",
        startTime: "15:00",
        endTime: "17:30",
      },
      {
        type: "normal",
        title: "Snack & Rest",
        timeMode: "range",
        startTime: "17:30",
        endTime: "18:30",
      },
      {
        type: "study",
        title: "Evening Focus Sprint",
        subject: "Chemistry",
        topic: "Chemical Kinetics",
        timeMode: "range",
        startTime: "18:30",
        endTime: "21:00",
      },
      {
        type: "normal",
        title: "Dinner & Relax",
        timeMode: "range",
        startTime: "21:00",
        endTime: "22:00",
      },
      {
        type: "study",
        title: "Daily Review & Formulas",
        subject: "Mathematics",
        topic: "Formulas & Quick MCQs",
        timeMode: "range",
        startTime: "22:00",
        endTime: "23:00",
      },
      {
        type: "normal",
        title: "Sleep",
        timeMode: "single",
        startTime: "23:00",
      },
    ]),
  },
  {
    name: "Weekend / Full Study Sprint",
    description: "Maximum focus routine with deep study blocks and active recall.",
    isActive: false,
    isCustom: false,
    blocks: JSON.stringify([
      {
        type: "normal",
        title: "Wake up & Morning Workout",
        timeMode: "range",
        startTime: "07:00",
        endTime: "08:00",
      },
      {
        type: "study",
        title: "Deep Focus Session 1",
        subject: "Mathematics",
        topic: "Calculus & Integrals",
        timeMode: "range",
        startTime: "08:30",
        endTime: "11:30",
      },
      {
        type: "normal",
        title: "Lunch & Recharge",
        timeMode: "range",
        startTime: "12:00",
        endTime: "13:30",
      },
      {
        type: "study",
        title: "Deep Focus Session 2",
        subject: "Biology",
        topic: "Genetics & Cell Biology",
        timeMode: "range",
        startTime: "14:00",
        endTime: "17:00",
      },
      {
        type: "normal",
        title: "Outdoor Walk & Free Time",
        timeMode: "range",
        startTime: "17:00",
        endTime: "18:30",
      },
      {
        type: "study",
        title: "MCQ Arena Exam Practice",
        subject: "General",
        topic: "Timed Mock Exam",
        timeMode: "range",
        startTime: "19:00",
        endTime: "21:00",
      },
      {
        type: "normal",
        title: "Dinner & Sleep",
        timeMode: "single",
        startTime: "22:30",
      },
    ]),
  },
];

async function requireUser() {
  const user = await getSession();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function getAiProfile() {
  const user = await requireUser();
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      aiName: true,
      aiNotepad: true,
    },
  });

  return {
    aiName: dbUser?.aiName?.trim() || DEFAULT_AI_NAME,
    notepad: dbUser?.aiNotepad || "",
  };
}

export async function updateAiProfile(data: { aiName?: string; notepad?: string }) {
  const user = await requireUser();
  const updateData: { aiName?: string; aiNotepad?: string } = {};

  if (data.aiName !== undefined) {
    updateData.aiName = data.aiName.trim() || DEFAULT_AI_NAME;
  }
  if (data.notepad !== undefined) {
    updateData.aiNotepad = data.notepad;
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: updateData,
    select: {
      aiName: true,
      aiNotepad: true,
    },
  });

  revalidatePath("/routine/settings");
  revalidatePath("/chat");
  revalidatePath("/routine");
  return { success: true, aiName: updated.aiName, notepad: updated.aiNotepad };
}

export async function getDbRoutinePresets() {
  const user = await requireUser();

  let presets = await prisma.routinePreset.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  // Seed default presets for this user if none exist
  if (presets.length === 0) {
    await prisma.routinePreset.createMany({
      data: DEFAULT_PRESETS.map((p) => ({
        userId: user.id,
        name: p.name,
        description: p.description,
        isActive: p.isActive,
        isCustom: p.isCustom,
        blocks: p.blocks,
      })),
    });

    presets = await prisma.routinePreset.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    });
  }

  return presets.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    isActive: p.isActive,
    isCustom: p.isCustom,
    blocks: JSON.parse(p.blocks || "[]"),
  }));
}

export async function saveDbRoutinePreset(data: {
  id?: string;
  name: string;
  description?: string;
  isActive?: boolean;
  blocks: any[];
}) {
  const user = await requireUser();
  const name = data.name.trim();
  if (!name) return { error: "Preset name is required" };

  const blocksJson = JSON.stringify(data.blocks || []);

  if (data.id) {
    const existing = await prisma.routinePreset.findFirst({
      where: { id: data.id, userId: user.id },
    });
    if (!existing) return { error: "Preset not found" };

    const updated = await prisma.routinePreset.update({
      where: { id: data.id },
      data: {
        name,
        description: data.description ?? existing.description,
        isActive: data.isActive !== undefined ? data.isActive : existing.isActive,
        blocks: blocksJson,
      },
    });
    revalidatePath("/routine/settings");
    revalidatePath("/routine");
    return { success: true, preset: updated };
  }

  const created = await prisma.routinePreset.create({
    data: {
      userId: user.id,
      name,
      description: data.description || "",
      isActive: data.isActive ?? true,
      isCustom: true,
      blocks: blocksJson,
    },
  });

  revalidatePath("/routine/settings");
  revalidatePath("/routine");
  return { success: true, preset: created };
}

export async function deleteDbRoutinePreset(id: string) {
  const user = await requireUser();
  const existing = await prisma.routinePreset.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) return { error: "Preset not found" };

  await prisma.routinePreset.delete({
    where: { id },
  });

  revalidatePath("/routine/settings");
  revalidatePath("/routine");
  return { success: true };
}

export async function toggleDbRoutinePreset(id: string) {
  const user = await requireUser();
  const existing = await prisma.routinePreset.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) return { error: "Preset not found" };

  const updated = await prisma.routinePreset.update({
    where: { id },
    data: { isActive: !existing.isActive },
  });

  revalidatePath("/routine/settings");
  revalidatePath("/routine");
  return { success: true, isActive: updated.isActive };
}

