"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/app/actions/auth";
import { getEconomySettings } from "@/app/actions/settings";

export async function fetchMistakeQuestions(filters?: {
  subjectId?: string;
  topicId?: string;
}) {
  const user = await getSession();
  if (!user) return { error: "Not authenticated" };

  const where: {
    userId: string;
    isCorrected: boolean;
    question?: { subjectId?: string; topicId?: string };
  } = {
    userId: user.id,
    isCorrected: false,
  };

  if (filters?.topicId) {
    where.question = { topicId: filters.topicId };
  } else if (filters?.subjectId) {
    where.question = { subjectId: filters.subjectId };
  }

  const mistakes = await prisma.mistake.findMany({
    where,
    include: { question: true },
  });

  const questions = mistakes.map((m) => ({
    mistakeId: m.id,
    id: m.question.id,
    question: m.question.question,
    options: JSON.parse(m.question.options),
    answer: m.question.correctAnswer,
    correctCount: m.correctCount,
    fromPractice: m.fromPractice,
  }));

  return { questions };
}

export async function saveRedoSessionData(data: {
  attempts: Array<{ mistakeId: string; isCorrect: boolean }>;
}) {
  const user = await getSession();
  if (!user) return { error: "Not authenticated" };

  const settings = await getEconomySettings();
  let pointsRecovered = 0;
  let fullyCorrected = 0;
  let progressMade = 0;

  for (const attempt of data.attempts) {
    if (!attempt.isCorrect) continue;

    const mistake = await prisma.mistake.findUnique({
      where: { id: attempt.mistakeId },
    });
    if (!mistake || mistake.isCorrected) continue;

    if (mistake.correctCount >= 1) {
      await prisma.mistake.update({
        where: { id: attempt.mistakeId },
        data: { isCorrected: true, correctCount: 2 },
      });
      fullyCorrected++;
      // Practice mistakes never affect XP recovery
      if (!mistake.fromPractice) {
        pointsRecovered += settings.redoXpRecovery;
      }
    } else {
      await prisma.mistake.update({
        where: { id: attempt.mistakeId },
        data: { correctCount: 1 },
      });
      progressMade++;
    }
  }

  if (pointsRecovered > 0) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        negativePoints: { decrement: pointsRecovered },
      },
    });
  }

  return { success: true, pointsRecovered, fullyCorrected, progressMade };
}
