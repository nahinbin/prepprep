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
  await requireAuth();

  const subjects = await prisma.subject.findMany({
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
  await requireAuth();
  const trimmed = name.trim();
  if (!trimmed) return { error: "Subject name is required." };

  const caseInsensitiveMatch = await prisma.subject.findMany();
  if (caseInsensitiveMatch.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
    return { error: "A subject with this name already exists." };
  }

  const subject = await prisma.subject.create({ data: { name: trimmed } });
  revalidatePath("/subjects");
  revalidatePath("/session/new");
  revalidatePath("/mistakes");
  return { success: true, subject };
}

export async function updateSubject(id: string, name: string) {
  await requireAuth();
  const trimmed = name.trim();
  if (!trimmed) return { error: "Subject name is required." };

  const duplicate = await prisma.subject.findFirst({
    where: { name: trimmed, NOT: { id } },
  });
  if (duplicate) return { error: "A subject with this name already exists." };

  const subject = await prisma.subject.update({
    where: { id },
    data: { name: trimmed },
  });
  revalidatePath("/subjects");
  revalidatePath("/session/new");
  revalidatePath("/mistakes");
  return { success: true, subject };
}

export async function deleteSubject(id: string) {
  await requireAuth();

  const questionCount = await prisma.question.count({ where: { subjectId: id } });
  if (questionCount > 0) {
    return { error: `Cannot delete: this subject has ${questionCount} question(s). Remove questions first.` };
  }

  await prisma.topic.deleteMany({ where: { subjectId: id } });
  await prisma.subject.delete({ where: { id } });
  revalidatePath("/subjects");
  revalidatePath("/session/new");
  revalidatePath("/mistakes");
  return { success: true };
}

export async function createTopic(subjectId: string, name: string) {
  await requireAuth();
  const trimmed = name.trim();
  if (!trimmed) return { error: "Topic name is required." };

  const existing = await prisma.topic.findUnique({
    where: { subjectId_name: { subjectId, name: trimmed } },
  });
  if (existing) return { error: "A topic with this name already exists under this subject." };

  const topic = await prisma.topic.create({
    data: { name: trimmed, subjectId },
  });
  revalidatePath("/subjects");
  revalidatePath("/session/new");
  revalidatePath("/mistakes");
  return { success: true, topic };
}

export async function updateTopic(id: string, name: string) {
  await requireAuth();
  const trimmed = name.trim();
  if (!trimmed) return { error: "Topic name is required." };

  const topic = await prisma.topic.findUnique({ where: { id } });
  if (!topic) return { error: "Topic not found." };

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
  revalidatePath("/mistakes");
  return { success: true, topic: updated };
}

export async function deleteTopic(id: string) {
  await requireAuth();

  const questionCount = await prisma.question.count({ where: { topicId: id } });
  if (questionCount > 0) {
    return { error: `Cannot delete: this topic has ${questionCount} question(s). Remove questions first.` };
  }

  await prisma.topic.delete({ where: { id } });
  revalidatePath("/subjects");
  revalidatePath("/session/new");
  revalidatePath("/mistakes");
  return { success: true };
}

export async function getMistakeStatsBySubject() {
  const user = await requireAuth();

  const mistakes = await prisma.mistake.findMany({
    where: { userId: user.id, isCorrected: false },
    include: {
      question: {
        select: {
          subjectId: true,
          topicId: true,
          subject: { select: { id: true, name: true } },
          topic: { select: { id: true, name: true } },
        },
      },
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
    const sub = m.question.subject;
    const top = m.question.topic;

    if (!subjectMap.has(sub.id)) {
      subjectMap.set(sub.id, {
        id: sub.id,
        name: sub.name,
        count: 0,
        topics: new Map(),
      });
    }
    const entry = subjectMap.get(sub.id)!;
    entry.count++;

    if (!entry.topics.has(top.id)) {
      entry.topics.set(top.id, { id: top.id, name: top.name, count: 0 });
    }
    entry.topics.get(top.id)!.count++;
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
