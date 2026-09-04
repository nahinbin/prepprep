"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/app/actions/auth";
import { getEconomySettings } from "@/app/actions/settings";
import { revalidatePath } from "next/cache";
import { didLevelUp } from "@/lib/levels";

export async function fetchMistakeQuestions(filters?: {
  subjectName?: string;
  topicName?: string;
  subjectId?: string;
  topicId?: string;
}) {
  const user = await getSession();
  if (!user) return { error: "Not authenticated" };

  const where: any = {
    userId: user.id,
    isCorrected: false,
  };

  if (filters?.topicName && filters.topicName !== "all") {
    where.topicName = filters.topicName;
  } else if (filters?.subjectName && filters.subjectName !== "all") {
    where.subjectName = filters.subjectName;
  } else if (filters?.topicId && filters.topicId !== "all") {
    // Check if topicId is actually topic name or id
    where.OR = [
      { topicName: filters.topicId },
      { subjectName: filters.topicId },
    ];
  } else if (filters?.subjectId && filters.subjectId !== "all") {
    where.subjectName = filters.subjectId;
  }

  const mistakes = await prisma.mistake.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  const questions = mistakes.map((m) => {
    let parsedOptions: Record<string, string> = {};
    try {
      parsedOptions = typeof m.options === "string" ? JSON.parse(m.options) : m.options;
    } catch {
      parsedOptions = {};
    }

    return {
      mistakeId: m.id,
      id: m.id,
      question: m.question,
      options: parsedOptions,
      answer: m.correctAnswer,
      correctCount: m.correctCount,
      fromPractice: m.fromPractice,
      subjectName: m.subjectName,
      topicName: m.topicName,
    };
  });

  return { questions };
}

export async function saveRedoSessionData(data: {
  attempts: Array<{ mistakeId: string; selectedAnswer: string; isCorrect: boolean }>;
}) {
  const user = await getSession();
  if (!user) return { error: "Not authenticated" };

  if (!data.attempts || data.attempts.length === 0) {
    return { success: true, pointsRecovered: 0, fullyCorrected: 0, progressMade: 0 };
  }

  const settings = await getEconomySettings();
  const attemptMap = new Map(data.attempts.map((a) => [a.mistakeId, a]));
  const mistakeIds = Array.from(attemptMap.keys());

  const result = await prisma.$transaction(async (tx) => {
    const currentUser = await tx.user.findUnique({
      where: { id: user.id },
      select: { positivePoints: true, negativePoints: true },
    });
    const oldXp = (currentUser?.positivePoints ?? 0) - (currentUser?.negativePoints ?? 0);

    const mistakes = await tx.mistake.findMany({
      where: {
        id: { in: mistakeIds },
        userId: user.id,
      },
    });

    let pointsRecovered = 0;
    let fullyCorrected = 0;
    let progressMade = 0;

    for (const mistake of mistakes) {
      const att = attemptMap.get(mistake.id);
      if (!att) continue;

      if (att.isCorrect) {
        if (mistake.correctCount >= 1) {
          // Solved twice correctly (back-to-back): PERMANENTLY DELETE from database
          await tx.mistake.delete({
            where: { id: mistake.id },
          });
          fullyCorrected++;
          if (!mistake.fromPractice) {
            pointsRecovered += settings.redoXpRecovery;
          }
        } else {
          // Solved once: need one more correct answer
          await tx.mistake.update({
            where: { id: mistake.id },
            data: { correctCount: 1 },
          });
          progressMade++;
        }
      } else {
        // Answered wrong: reset streak to 0
        await tx.mistake.update({
          where: { id: mistake.id },
          data: { correctCount: 0 },
        });
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

    return { pointsRecovered, fullyCorrected, progressMade, oldXp };
  });

  revalidatePath("/mistakes");
  revalidatePath("/profile");
  revalidatePath("/history");
  revalidatePath("/");

  const { oldXp, ...stats } = result;
  const level = didLevelUp(oldXp, oldXp + stats.pointsRecovered);

  return { success: true, ...stats, ...(level ?? {}) };
}

