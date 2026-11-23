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

/**
 * Save AI generated MCQs directly into the student's Question Bank in PostgreSQL
 */
export async function saveGeneratedQuestionsToBank(data: {
  subjectName: string;
  topicName: string;
  questions: Array<{
    question: string;
    options: Record<string, string>;
    answer: string;
  }>;
}) {
  const user = await requireAuth();
  const subName = data.subjectName.trim() || "General";
  const topName = data.topicName.trim() || "General Practice";

  if (!data.questions || data.questions.length === 0) {
    return { error: "No questions to save." };
  }

  // 1. Find or create subject for this user
  let subject = await prisma.subject.findFirst({
    where: {
      userId: user.id,
      name: { equals: subName, mode: "insensitive" },
    },
  });
  if (!subject) {
    subject = await prisma.subject.create({
      data: { name: subName, userId: user.id },
    });
  }

  // 2. Find or create topic under this subject
  let topic = await prisma.topic.findFirst({
    where: {
      subjectId: subject.id,
      name: { equals: topName, mode: "insensitive" },
    },
  });
  if (!topic) {
    topic = await prisma.topic.create({
      data: { name: topName, subjectId: subject.id },
    });
  }

  // 3. Insert questions
  const created = await prisma.$transaction(
    data.questions.map((q) =>
      prisma.question.create({
        data: {
          subjectId: subject.id,
          topicId: topic.id,
          question: q.question.trim(),
          options: JSON.stringify(q.options),
          correctAnswer: q.answer.trim(),
        },
      })
    )
  );

  revalidatePath("/questions");
  revalidatePath("/subjects");
  revalidatePath("/session/new");

  return {
    success: true,
    savedCount: created.length,
    subjectName: subject.name,
    topicName: topic.name,
    subjectId: subject.id,
    topicId: topic.id,
    questionIds: created.map((q) => q.id),
  };
}
