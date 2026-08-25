"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/app/actions/auth";
import { getEconomySettings } from "@/app/actions/settings";
import { revalidatePath } from "next/cache";

export async function saveSessionData(data: {
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  positivePoints: number;
  negativePoints: number;
  netPoints: number;
  isPractice?: boolean;
  attempts: Array<{
    questionId: string;
    question: string;
    options: string;
    correctAnswer: string;
    selectedAnswer: string;
    isCorrect: boolean;
    pointsGained: number;
    pointsLost: number;
  }>;
}) {
  const user = await getSession();
  if (!user) return { error: "Not authenticated" };

  const isPractice = !!data.isPractice;
  const settings = await getEconomySettings();
  const coinsEarned = isPractice
    ? 0
    : data.correctAnswers * settings.coinsPerCorrect;

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      totalQuestions: data.totalQuestions,
      correctAnswers: data.correctAnswers,
      wrongAnswers: data.wrongAnswers,
      positivePoints: isPractice ? 0 : data.positivePoints,
      negativePoints: isPractice ? 0 : data.negativePoints,
      netPoints: isPractice ? 0 : data.netPoints,
      isPractice,
      attempts: {
        create: data.attempts.map((a) => ({
          questionRefId: a.questionId,
          questionId: 0,
          question: a.question,
          options: a.options,
          correctAnswer: a.correctAnswer,
          selectedAnswer: a.selectedAnswer,
          isCorrect: a.isCorrect,
          pointsGained: isPractice ? 0 : a.pointsGained,
          pointsLost: isPractice ? 0 : a.pointsLost,
        })),
      },
    },
  });

  const mistakesData = data.attempts
    .filter((a) => !a.isCorrect)
    .map((a) => ({
      userId: user.id,
      sessionId: session.id,
      questionId: a.questionId,
      selectedAnswer: a.selectedAnswer,
      correctAnswer: a.correctAnswer,
      fromPractice: isPractice,
    }));

  if (mistakesData.length > 0) {
    await prisma.mistake.createMany({
      data: mistakesData,
    });
  }

  if (!isPractice) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        positivePoints: { increment: data.positivePoints },
        negativePoints: { increment: data.negativePoints },
        coins: { increment: coinsEarned },
      },
    });

    if (coinsEarned > 0) {
      await prisma.coinTransaction.create({
        data: {
          userId: user.id,
          amount: coinsEarned,
          reason: `Earned from session ${session.id}`,
        },
      });
    }
  }

  return { sessionId: session.id };
}

export async function saveQuestionsFromSession(
  questionsToSave: Array<{
    question: string;
    options: string;
    correctAnswer: string;
  }>
) {
  const user = await getSession();
  if (!user) return { error: "Not authenticated" };
  if (!questionsToSave || questionsToSave.length === 0) {
    return { error: "No questions selected" };
  }

  // 1. Find or create the "Saved Questions" subject
  let savedSubject = await prisma.subject.findFirst({
    where: { name: "Saved Questions" },
  });
  if (!savedSubject) {
    savedSubject = await prisma.subject.create({
      data: { name: "Saved Questions" },
    });
  }

  // 2. Find or create the "Session Review" topic
  let savedTopic = await prisma.topic.findFirst({
    where: { subjectId: savedSubject.id, name: "Session Review" },
  });
  if (!savedTopic) {
    savedTopic = await prisma.topic.create({
      data: {
        name: "Session Review",
        subjectId: savedSubject.id,
      },
    });
  }

  // 3. Insert or find each question
  let savedCount = 0;
  for (const item of questionsToSave) {
    const existing = await prisma.question.findFirst({
      where: {
        subjectId: savedSubject.id,
        topicId: savedTopic.id,
        question: item.question,
      },
    });

    if (!existing) {
      await prisma.question.create({
        data: {
          subjectId: savedSubject.id,
          topicId: savedTopic.id,
          question: item.question,
          options: item.options,
          correctAnswer: item.correctAnswer,
        },
      });
      savedCount++;
    }
  }

  revalidatePath("/session/new");
  revalidatePath("/subjects");
  return { success: true, savedCount, total: questionsToSave.length };
}
