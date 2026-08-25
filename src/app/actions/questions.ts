"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/app/actions/auth";
import { revalidatePath } from "next/cache";

async function requireAuth() {
  const user = await getSession();
  if (!user) throw new Error("Not authenticated");
  return user;
}

export async function getQuestionBankData(filters?: {
  subjectId?: string;
  topicId?: string;
  search?: string;
}) {
  const user = await requireAuth();

  // Fetch all user's subjects with their topics and question counts
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

  // Build filter for questions
  const where: any = {
    subject: { userId: user.id },
  };

  if (filters?.subjectId && filters.subjectId !== "all") {
    where.subjectId = filters.subjectId;
  }

  if (filters?.topicId && filters.topicId !== "all") {
    where.topicId = filters.topicId;
  }

  if (filters?.search && filters.search.trim()) {
    where.question = {
      contains: filters.search.trim(),
      mode: "insensitive",
    };
  }

  const questions = await prisma.question.findMany({
    where,
    include: {
      subject: { select: { id: true, name: true } },
      topic: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const totalQuestionsCount = await prisma.question.count({
    where: { subject: { userId: user.id } },
  });

  return {
    subjects,
    questions: questions.map((q) => {
      let parsedOptions: Record<string, string> = {};
      try {
        parsedOptions = JSON.parse(q.options);
      } catch {
        parsedOptions = {};
      }
      return {
        id: q.id,
        question: q.question,
        options: parsedOptions,
        answer: q.correctAnswer,
        subjectId: q.subjectId,
        subjectName: q.subject.name,
        topicId: q.topicId,
        topicName: q.topic.name,
        createdAt: q.createdAt.toISOString(),
      };
    }),
    totalQuestionsCount,
  };
}

export async function deleteQuestionFromBank(questionId: string) {
  const user = await requireAuth();

  const question = await prisma.question.findFirst({
    where: {
      id: questionId,
      subject: { userId: user.id },
    },
  });

  if (!question) return { error: "Question not found or unauthorized." };

  await prisma.question.delete({
    where: { id: questionId },
  });

  revalidatePath("/questions");
  revalidatePath("/subjects");
  revalidatePath("/session/new");
  return { success: true };
}

export async function deleteMultipleQuestions(questionIds: string[]) {
  const user = await requireAuth();
  if (!questionIds || questionIds.length === 0) return { error: "No questions selected" };

  await prisma.question.deleteMany({
    where: {
      id: { in: questionIds },
      subject: { userId: user.id },
    },
  });

  revalidatePath("/questions");
  revalidatePath("/subjects");
  revalidatePath("/session/new");
  return { success: true, count: questionIds.length };
}
