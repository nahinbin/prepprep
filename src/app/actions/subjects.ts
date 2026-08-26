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
