"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/app/actions/auth";
import { revalidatePath } from "next/cache";
import { RoutineSubtask } from "@/lib/routineTypes";

async function requireUser() {
  const user = await getSession();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export interface DbRoutineBlock {
  id: string;
  userId: string;
  date: string;
  type: "study" | "normal";
  title: string;
  timeMode: "range" | "single" | "anytime";
  startTime?: string;
  endTime?: string;
  isCompleted: boolean;
  subject?: string;
  topic?: string;
  notes?: string;
  subtasks: RoutineSubtask[];
  order: number;
}

export async function getUserRoutineBlocks(dateKey?: string) {
  const user = await requireUser();

  const whereClause: { userId: string; date?: string } = { userId: user.id };
  if (dateKey) {
    whereClause.date = dateKey;
  }

  const blocks = await prisma.routineBlock.findMany({
    where: whereClause,
    orderBy: [{ startTime: "asc" }, { order: "asc" }, { createdAt: "asc" }],
  });

  return blocks.map((b) => ({
    id: b.id,
    userId: b.userId,
    date: b.date,
    type: (b.type as "study" | "normal") || "study",
    title: b.title,
    timeMode: (b.timeMode as "range" | "single" | "anytime") || "range",
    startTime: b.startTime || undefined,
    endTime: b.endTime || undefined,
    isCompleted: b.isCompleted,
    subject: b.subject || undefined,
    topic: b.topic || undefined,
    notes: b.notes || undefined,
    subtasks: JSON.parse(b.subtasks || "[]"),
    order: b.order,
  }));
}

export async function upsertDbRoutineBlock(block: {
  id?: string;
  date: string;
  type: "study" | "normal";
  title: string;
  timeMode?: "range" | "single" | "anytime";
  startTime?: string;
  endTime?: string;
  isCompleted?: boolean;
  subject?: string;
  topic?: string;
  notes?: string;
  subtasks?: RoutineSubtask[];
  order?: number;
}) {
  const user = await requireUser();
  const subtasksJson = JSON.stringify(block.subtasks || []);

  if (block.id) {
    const existing = await prisma.routineBlock.findFirst({
      where: { id: block.id, userId: user.id },
    });

    if (existing) {
      const updated = await prisma.routineBlock.update({
        where: { id: block.id },
        data: {
          date: block.date,
          type: block.type,
          title: block.title,
          timeMode: block.timeMode || existing.timeMode,
          startTime: block.startTime ?? null,
          endTime: block.endTime ?? null,
          isCompleted: block.isCompleted !== undefined ? block.isCompleted : existing.isCompleted,
          subject: block.subject ?? null,
          topic: block.topic ?? null,
          notes: block.notes ?? null,
          subtasks: subtasksJson,
          order: block.order !== undefined ? block.order : existing.order,
        },
      });

      revalidatePath("/routine");
      return { success: true, block: updated };
    }
  }

  const created = await prisma.routineBlock.create({
    data: {
      userId: user.id,
      date: block.date,
      type: block.type,
      title: block.title,
      timeMode: block.timeMode || "range",
      startTime: block.startTime ?? null,
      endTime: block.endTime ?? null,
      isCompleted: block.isCompleted ?? false,
      subject: block.subject ?? null,
      topic: block.topic ?? null,
      notes: block.notes ?? null,
      subtasks: subtasksJson,
      order: block.order ?? 0,
    },
  });

  revalidatePath("/routine");
  return { success: true, block: created };
}

export async function toggleDbRoutineBlockCompleted(id: string) {
  const user = await requireUser();
  const existing = await prisma.routineBlock.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) return { error: "Block not found" };

  const updated = await prisma.routineBlock.update({
    where: { id },
    data: { isCompleted: !existing.isCompleted },
  });

  revalidatePath("/routine");
  return { success: true, isCompleted: updated.isCompleted };
}

export async function toggleDbRoutineSubtask(blockId: string, subtaskId: string) {
  const user = await requireUser();
  const existing = await prisma.routineBlock.findFirst({
    where: { id: blockId, userId: user.id },
  });
  if (!existing) return { error: "Block not found" };

  const subtasks: Array<{ id: string; title: string; completed: boolean }> = JSON.parse(
    existing.subtasks || "[]"
  );
  const updatedSubtasks = subtasks.map((st) =>
    st.id === subtaskId ? { ...st, completed: !st.completed } : st
  );

  await prisma.routineBlock.update({
    where: { id: blockId },
    data: { subtasks: JSON.stringify(updatedSubtasks) },
  });

  revalidatePath("/routine");
  return { success: true };
}

export async function deleteDbRoutineBlock(id: string) {
  const user = await requireUser();
  const existing = await prisma.routineBlock.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) return { error: "Block not found" };

  await prisma.routineBlock.delete({
    where: { id },
  });

  revalidatePath("/routine");
  return { success: true };
}

export async function bulkCreateDbRoutineBlocks(
  blocks: Array<{
    date: string;
    type: "study" | "normal";
    title: string;
    timeMode?: "range" | "single" | "anytime";
    startTime?: string;
    endTime?: string;
    isCompleted?: boolean;
    subject?: string;
    topic?: string;
    notes?: string;
    subtasks?: RoutineSubtask[];
    order?: number;
  }>
) {
  const user = await requireUser();
  if (!blocks || blocks.length === 0) return { success: true, count: 0 };

  const created = await prisma.routineBlock.createMany({
    data: blocks.map((b) => ({
      userId: user.id,
      date: b.date,
      type: b.type,
      title: b.title,
      timeMode: b.timeMode || "range",
      startTime: b.startTime ?? null,
      endTime: b.endTime ?? null,
      isCompleted: b.isCompleted ?? false,
      subject: b.subject ?? null,
      topic: b.topic ?? null,
      notes: b.notes ?? null,
      subtasks: JSON.stringify(b.subtasks || []),
      order: b.order ?? 0,
    })),
  });

  revalidatePath("/routine");
  return { success: true, count: created.count };
}

