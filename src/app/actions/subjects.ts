"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/app/actions/auth";
import { revalidatePath } from "next/cache";

async function requireAuth() {
  const user = await getSession();
  if (!user) throw new Error("Not authenticated");
  return user;
}

export async function getSubjectsWithStats() {
  const user = await requireAuth();

  const subjects = await prisma.subject.findMany({
    where: { userId: user.id },
    include: {
      topics: {
        include: {
          _count: { select: { questions: true } },
        },
        orderBy: { name: "asc" },
      },
      _count: { select: { questions: true } },
    },
    orderBy: { name: "asc" },
  });

  return subjects;
}

export async function createSubject(name: string) {
  const user = await requireAuth();
  const trimmed = name.trim();
  if (!trimmed) return { error: "Subject name is required." };

  const userSubjects = await prisma.subject.findMany({
    where: { userId: user.id },
  });
  if (userSubjects.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
    return { error: "A subject with this name already exists in your account." };
  }

  const subject = await prisma.subject.create({
    data: { name: trimmed, userId: user.id },
  });
  revalidatePath("/subjects");
  revalidatePath("/session/new");
  revalidatePath("/questions");
  revalidatePath("/mistakes");
  return { success: true, subject };
}

export async function updateSubject(id: string, name: string) {
  const user = await requireAuth();
  const trimmed = name.trim();
  if (!trimmed) return { error: "Subject name is required." };

  const existingSubject = await prisma.subject.findFirst({
    where: { id, userId: user.id },
  });
  if (!existingSubject) return { error: "Subject not found." };

  const duplicate = await prisma.subject.findFirst({
    where: { userId: user.id, name: trimmed, NOT: { id } },
  });
  if (duplicate) return { error: "A subject with this name already exists in your account." };

  const subject = await prisma.subject.update({
    where: { id },
    data: { name: trimmed },
  });
  revalidatePath("/subjects");
  revalidatePath("/session/new");
  revalidatePath("/questions");
  revalidatePath("/mistakes");
  return { success: true, subject };
}

export async function deleteSubject(id: string) {
  const user = await requireAuth();

  const subject = await prisma.subject.findFirst({
    where: { id, userId: user.id },
  });
  if (!subject) return { error: "Subject not found." };

  await prisma.subject.delete({
    where: { id },
  });

  revalidatePath("/subjects");
  revalidatePath("/session/new");
  revalidatePath("/questions");
  revalidatePath("/mistakes");
  return { success: true };
}

export async function createTopic(subjectId: string, name: string) {
  const user = await requireAuth();
  const trimmed = name.trim();
  if (!trimmed) return { error: "Topic name is required." };

  const subject = await prisma.subject.findFirst({
    where: { id: subjectId, userId: user.id },
  });
  if (!subject) return { error: "Subject not found." };

  const existing = await prisma.topic.findUnique({
    where: { subjectId_name: { subjectId, name: trimmed } },
  });
  if (existing) return { error: "A topic with this name already exists under this subject." };

  const topic = await prisma.topic.create({
    data: { name: trimmed, subjectId },
  });
  revalidatePath("/subjects");
  revalidatePath("/session/new");
  revalidatePath("/questions");
  revalidatePath("/mistakes");
  return { success: true, topic };
}

export async function updateTopic(id: string, name: string) {
  const user = await requireAuth();
  const trimmed = name.trim();
  if (!trimmed) return { error: "Topic name is required." };

  const topic = await prisma.topic.findUnique({
    where: { id },
    include: { subject: true },
  });
  if (!topic || topic.subject.userId !== user.id) return { error: "Topic not found." };

  const duplicate = await prisma.topic.findFirst({
    where: { subjectId: topic.subjectId, name: trimmed, NOT: { id } },
  });
  if (duplicate) return { error: "A topic with this name already exists under this subject." };

  const updated = await prisma.topic.update({
    where: { id },
    data: { name: trimmed },
  });
  revalidatePath("/subjects");
  revalidatePath("/session/new");
  revalidatePath("/questions");
  revalidatePath("/mistakes");
  return { success: true, topic: updated };
}

export async function deleteTopic(id: string) {
  const user = await requireAuth();

  const topic = await prisma.topic.findUnique({
    where: { id },
    include: { subject: true },
  });
  if (!topic || topic.subject.userId !== user.id) return { error: "Topic not found." };

  await prisma.topic.delete({
    where: { id },
  });

  revalidatePath("/subjects");
  revalidatePath("/session/new");
  revalidatePath("/questions");
  revalidatePath("/mistakes");
  return { success: true };
}

export async function getMistakeStatsBySubject() {
  const user = await requireAuth();

  const mistakes = await prisma.mistake.findMany({
    where: { userId: user.id, isCorrected: false },
    select: {
      id: true,
      subjectName: true,
      topicName: true,
    },
  });

  const subjectMap = new Map<
    string,
    {
      id: string;
      name: string;
      count: number;
      topics: Map<string, { id: string; name: string; count: number }>;
    }
  >();

  for (const m of mistakes) {
    const subName = m.subjectName || "General";
    const topName = m.topicName || "General";

    if (!subjectMap.has(subName)) {
      subjectMap.set(subName, {
        id: subName,
        name: subName,
        count: 0,
        topics: new Map(),
      });
    }
    const entry = subjectMap.get(subName)!;
    entry.count++;

    if (!entry.topics.has(topName)) {
      entry.topics.set(topName, { id: topName, name: topName, count: 0 });
    }
    entry.topics.get(topName)!.count++;
  }

  return Array.from(subjectMap.values())
    .map((s) => ({
      id: s.id,
      name: s.name,
      count: s.count,
      topics: Array.from(s.topics.values()).sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Bulk add topics under an existing (or new) subject, skipping duplicates
 */
export async function bulkAddTopicsToSubject(
  subjectNameOrId: string,
  topicNames: string[]
) {
  const user = await requireAuth();
  const trimmedSub = subjectNameOrId.trim();
  if (!trimmedSub) return { error: "Subject is required." };
  if (!topicNames || topicNames.length === 0) return { error: "No topics provided." };

  // Filter unique non-empty topic names
  const cleanTopics = Array.from(
    new Set(topicNames.map((t) => t.trim()).filter(Boolean))
  );

  // Find existing subject (by ID or case-insensitive name)
  let subject = await prisma.subject.findFirst({
    where: {
      userId: user.id,
      OR: [
        { id: trimmedSub },
        { name: { equals: trimmedSub, mode: "insensitive" } },
      ],
    },
    include: { topics: true },
  });

  // If not found, create it
  if (!subject) {
    subject = await prisma.subject.create({
      data: { name: trimmedSub, userId: user.id },
      include: { topics: true },
    });
  }

  const existingTopicNames = new Set(
    subject.topics.map((t) => t.name.toLowerCase())
  );

  const toCreate = cleanTopics
    .filter((t) => !existingTopicNames.has(t.toLowerCase()))
    .map((name) => ({
      name,
      subjectId: subject.id,
    }));

  if (toCreate.length > 0) {
    await prisma.topic.createMany({
      data: toCreate,
      skipDuplicates: true,
    });
  }

  revalidatePath("/subjects");
  revalidatePath("/routine");
  revalidatePath("/questions");

  return {
    success: true,
    subjectName: subject.name,
    subjectId: subject.id,
    addedCount: toCreate.length,
    skippedCount: cleanTopics.length - toCreate.length,
    addedTopics: toCreate.map((t) => t.name),
  };
}

/**
 * Get all user subjects and their topics for AI scheduling and routine planning
 */
export async function getUserSubjectsAndTopics() {
  try {
    const user = await getSession();
    if (!user) return [];

    const subjects = await prisma.subject.findMany({
      where: { userId: user.id },
      include: {
        topics: {
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });

    return subjects.map((s) => ({
      id: s.id,
      name: s.name,
      topics: s.topics.map((t) => t.name),
    }));
  } catch {
    return [];
  }
}

/**
 * Delete a subject by its name for the authenticated user
 */
export async function deleteSubjectByName(name: string) {
  const user = await requireAuth();
  const trimmed = name.trim();
  if (!trimmed) return { error: "Subject name is required." };

  const subject = await prisma.subject.findFirst({
    where: {
      userId: user.id,
      name: { equals: trimmed, mode: "insensitive" },
    },
  });
  if (!subject) return { error: `Subject "${trimmed}" not found.` };

  await prisma.subject.delete({
    where: { id: subject.id },
  });

  revalidatePath("/subjects");
  revalidatePath("/session/new");
  revalidatePath("/questions");
  revalidatePath("/mistakes");
  revalidatePath("/routine");
  return { success: true, deletedName: subject.name };
}

/**
 * Rename a subject by its name for the authenticated user
 */
export async function renameSubjectByName(oldName: string, newName: string) {
  const user = await requireAuth();
  const trimmedOld = oldName.trim();
  const trimmedNew = newName.trim();
  if (!trimmedOld || !trimmedNew) return { error: "Both old and new names are required." };

  const subject = await prisma.subject.findFirst({
    where: {
      userId: user.id,
      name: { equals: trimmedOld, mode: "insensitive" },
    },
  });
  if (!subject) return { error: `Subject "${trimmedOld}" not found.` };

  const duplicate = await prisma.subject.findFirst({
    where: {
      userId: user.id,
      name: { equals: trimmedNew, mode: "insensitive" },
      NOT: { id: subject.id },
    },
  });
  if (duplicate) return { error: `A subject named "${trimmedNew}" already exists.` };

  const updated = await prisma.subject.update({
    where: { id: subject.id },
    data: { name: trimmedNew },
  });

  revalidatePath("/subjects");
  revalidatePath("/session/new");
  revalidatePath("/questions");
  revalidatePath("/routine");
  return { success: true, oldName: subject.name, newName: updated.name };
}

/**
 * Delete a topic from a subject by name for the authenticated user
 */
export async function deleteTopicFromSubject(subjectName: string, topicName: string) {
  const user = await requireAuth();
  const trimmedSub = subjectName.trim();
  const trimmedTop = topicName.trim();
  if (!trimmedSub || !trimmedTop) return { error: "Subject and topic names are required." };

  const subject = await prisma.subject.findFirst({
    where: {
      userId: user.id,
      name: { equals: trimmedSub, mode: "insensitive" },
    },
  });
  if (!subject) return { error: `Subject "${trimmedSub}" not found.` };

  const topic = await prisma.topic.findFirst({
    where: {
      subjectId: subject.id,
      name: { equals: trimmedTop, mode: "insensitive" },
    },
  });
  if (!topic) return { error: `Topic "${trimmedTop}" not found under "${subject.name}".` };

  await prisma.topic.delete({
    where: { id: topic.id },
  });

  revalidatePath("/subjects");
  revalidatePath("/questions");
  revalidatePath("/routine");
  return { success: true, subjectName: subject.name, topicName: topic.name };
}

