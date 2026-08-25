"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/app/actions/auth";
import { getEconomySettings } from "@/app/actions/settings";
import { findOrCreateSubjectTopic } from "@/app/actions/economy";
import { revalidatePath } from "next/cache";

export async function saveSessionData(data: {
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  positivePoints: number;
  negativePoints: number;
  netPoints: number;
  isPractice?: boolean;
  subjectName?: string;
  topicName?: string;
  subjectId?: string;
  topicId?: string;
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

  // Handle mistakes: for any incorrect answer, ensure a Question record exists under the REAL subject and topic
  const wrongAttempts = data.attempts.filter((a) => !a.isCorrect);
  if (wrongAttempts.length > 0) {
    // Resolve subject and topic for this user
    let targetSubjectId = data.subjectId;
    let targetTopicId = data.topicId;

    if (!targetSubjectId || !targetTopicId) {
      if (data.subjectName && data.topicName) {
        const { subject, topic } = await findOrCreateSubjectTopic(
          user.id,
          data.subjectName,
          data.topicName
        );
        targetSubjectId = subject.id;
        targetTopicId = topic.id;
      } else {
        // Fallback to user's first available subject and topic
        const firstSub = await prisma.subject.findFirst({
          where: { userId: user.id },
          include: { topics: true },
        });
        if (firstSub && firstSub.topics.length > 0) {
          targetSubjectId = firstSub.id;
          targetTopicId = firstSub.topics[0].id;
        } else {
          const { subject, topic } = await findOrCreateSubjectTopic(
            user.id,
            data.subjectName || "General",
            data.topicName || "General"
          );
          targetSubjectId = subject.id;
          targetTopicId = topic.id;
        }
      }
    }

    for (const a of wrongAttempts) {
      // Check if this is already an existing Question ID in DB
      let q = await prisma.question.findFirst({
        where: {
          id: a.questionId,
          subject: { userId: user.id },
        },
      });

      if (!q) {
        // Find existing matching text under user's subjects
        q = await prisma.question.findFirst({
          where: {
            subject: { userId: user.id },
            question: a.question,
          },
        });

        if (!q) {
          q = await prisma.question.create({
            data: {
              subjectId: targetSubjectId!,
              topicId: targetTopicId!,
              question: a.question,
              options: a.options,
              correctAnswer: a.correctAnswer,
            },
          });
        }
      }

      await prisma.mistake.create({
        data: {
          userId: user.id,
          sessionId: session.id,
          questionId: q.id,
          selectedAnswer: a.selectedAnswer,
          correctAnswer: a.correctAnswer,
          fromPractice: isPractice,
        },
      });
    }
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

  revalidatePath("/mistakes");
  revalidatePath("/session/new");
  revalidatePath("/subjects");
  revalidatePath("/questions");

  return { sessionId: session.id };
}

export async function saveQuestionsFromSession({
  questionsToSave,
  subjectName,
  topicName,
  subjectId,
  topicId,
}: {
  questionsToSave: Array<{
    question: string;
    options: string;
    correctAnswer: string;
  }>;
  subjectName?: string;
  topicName?: string;
  subjectId?: string;
  topicId?: string;
}) {
  const user = await getSession();
  if (!user) return { error: "Not authenticated" };
  if (!questionsToSave || questionsToSave.length === 0) {
    return { error: "No questions selected" };
  }

  // 1. Resolve actual user subject and topic
  let targetSubjectId = subjectId;
  let targetTopicId = topicId;
  let finalSubjectName = subjectName;
  let finalTopicName = topicName;

  if (!targetSubjectId || !targetTopicId) {
    if (subjectName && topicName) {
      const { subject, topic } = await findOrCreateSubjectTopic(
        user.id,
        subjectName,
        topicName
      );
      targetSubjectId = subject.id;
      targetTopicId = topic.id;
      finalSubjectName = subject.name;
      finalTopicName = topic.name;
    } else {
      const firstSub = await prisma.subject.findFirst({
        where: { userId: user.id },
        include: { topics: true },
      });
      if (firstSub && firstSub.topics.length > 0) {
        targetSubjectId = firstSub.id;
        targetTopicId = firstSub.topics[0].id;
        finalSubjectName = firstSub.name;
        finalTopicName = firstSub.topics[0].name;
      } else {
        const { subject, topic } = await findOrCreateSubjectTopic(
          user.id,
          "General",
          "General"
        );
        targetSubjectId = subject.id;
        targetTopicId = topic.id;
        finalSubjectName = subject.name;
        finalTopicName = topic.name;
      }
    }
  }

  // 2. Insert each question into the user's Question Bank under that subject & topic
  let savedCount = 0;
  for (const item of questionsToSave) {
    const existing = await prisma.question.findFirst({
      where: {
        subjectId: targetSubjectId,
        topicId: targetTopicId,
        question: item.question,
      },
    });

    if (!existing) {
      await prisma.question.create({
        data: {
          subjectId: targetSubjectId!,
          topicId: targetTopicId!,
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
  revalidatePath("/questions");
  return {
    success: true,
    savedCount,
    total: questionsToSave.length,
    subjectName: finalSubjectName,
    topicName: finalTopicName,
  };
}
