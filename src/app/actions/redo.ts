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
  const mistakeIds = data.attempts.filter((a) => a.isCorrect).map((a) => a.mistakeId);

  if (mistakeIds.length === 0) {
    return { success: true, pointsRecovered: 0, fullyCorrected: 0, progressMade: 0 };
  }

  const result = await prisma.$transaction(async (tx) => {
    const mistakes = await tx.mistake.findMany({
      where: {
        id: { in: mistakeIds },
        userId: user.id,
        isCorrected: false,
      },
    });

    let pointsRecovered = 0;
    let fullyCorrected = 0;
    let progressMade = 0;

    for (const mistake of mistakes) {
      if (mistake.correctCount >= 1) {
        await tx.mistake.update({
          where: { id: mistake.id },
          data: { isCorrected: true, correctCount: 2 },
        });
        fullyCorrected++;
        if (!mistake.fromPractice) {
          pointsRecovered += settings.redoXpRecovery;
        }
      } else {
        await tx.mistake.update({
          where: { id: mistake.id },
          data: { correctCount: 1 },
        });
        progressMade++;
      }
    }

    if (pointsRecovered > 0) {
      await tx.user.update({
        where: { id: user.id },
        data: {
          negativePoints: { decrement: pointsRecovered },
        },
      });
    }

    return { pointsRecovered, fullyCorrected, progressMade };
  });

  return { success: true, ...result };
}
