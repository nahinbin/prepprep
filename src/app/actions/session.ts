"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/app/actions/auth";
import { getEconomySettings } from "@/app/actions/settings";
import { findOrCreateSubjectTopic } from "@/app/actions/economy";
import { revalidatePath } from "next/cache";
import { didLevelUp } from "@/lib/levels";

// In-memory idempotency cache for active/recent session saves
const processedTokens = new Map<string, { sessionId: string; timestamp: number }>();
const activeTokens = new Set<string>();

// Cleanup tokens older than 10 minutes
function cleanOldTokens() {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [token, data] of processedTokens.entries()) {
    if (data.timestamp < cutoff) {
      processedTokens.delete(token);
    }
  }
}

// Cleanup attempt records older than 1 hour (ephemeral review period)
export async function cleanupExpiredAttempts() {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    await prisma.attempt.deleteMany({
      where: {
        session: {
          createdAt: { lt: oneHourAgo },
        },
      },
    });
  } catch (err) {
    console.error("Error cleaning up expired attempts:", err);
  }
}

export async function saveSessionData(data: {
  clientSessionToken?: string;
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

  const token = data.clientSessionToken;
  if (token) {
    cleanOldTokens();
    if (processedTokens.has(token)) {
      return { sessionId: processedTokens.get(token)!.sessionId };
    }
    if (activeTokens.has(token)) {
      // Already processing this exact session request
      return { error: "Session is currently being saved" };
    }
    activeTokens.add(token);
  }

  try {
    const isPractice = !!data.isPractice;
    const settings = await getEconomySettings();
    const coinsEarned = isPractice
      ? 0
      : Math.max(0, data.correctAnswers * settings.coinsPerCorrect);
    const positiveXp = isPractice ? 0 : Math.max(0, data.positivePoints);
    const negativeXp = isPractice ? 0 : Math.max(0, data.negativePoints);
    const netXp = isPractice ? 0 : positiveXp - negativeXp;

    const existingUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { positivePoints: true, negativePoints: true },
    });
    const oldXp = (existingUser?.positivePoints ?? 0) - (existingUser?.negativePoints ?? 0);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the session and attempts in one single query
      const session = await tx.session.create({
        data: {
          userId: user.id,
          totalQuestions: data.totalQuestions,
          correctAnswers: data.correctAnswers,
          wrongAnswers: data.wrongAnswers,
          positivePoints: positiveXp,
          negativePoints: negativeXp,
          netPoints: netXp,
          isPractice,
          attempts: {
            create: data.attempts.map((a) => ({
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

      // 2. Handle mistakes directly in Mistake table (WITHOUT creating Question records)
      const wrongAttempts = data.attempts.filter((a) => !a.isCorrect);
      if (wrongAttempts.length > 0) {
        const subName = (data.subjectName || "General").trim();
        const topName = (data.topicName || "General").trim();

        const mistakeData = wrongAttempts.map((a) => ({
          userId: user.id,
          sessionId: session.id,
          subjectName: subName,
          topicName: topName,
          question: a.question,
          options: a.options,
          correctAnswer: a.correctAnswer,
          selectedAnswer: a.selectedAnswer,
          correctCount: 0,
          isCorrected: false,
          fromPractice: isPractice,
        }));

        await tx.mistake.createMany({
          data: mistakeData,
        });
      }

      // 3. Update user points & coins atomically
      if (!isPractice) {
        await tx.user.update({
          where: { id: user.id },
          data: {
            positivePoints: { increment: positiveXp },
            negativePoints: { increment: negativeXp },
            coins: { increment: coinsEarned },
          },
        });

        if (coinsEarned > 0) {
          await tx.coinTransaction.create({
            data: {
              userId: user.id,
              amount: coinsEarned,
              reason: `Earned from session ${session.id}`,
            },
          });
        }
      }

      return session;
    });

    if (token) {
      processedTokens.set(token, { sessionId: result.id, timestamp: Date.now() });
    }

    // Prune attempts older than 1 hour in background
    cleanupExpiredAttempts().catch(() => {});

    revalidatePath("/mistakes");
    revalidatePath("/session/new");
    revalidatePath("/subjects");
    revalidatePath("/questions");
    revalidatePath("/history");
    revalidatePath("/");

    return {
      sessionId: result.id,
      ...(didLevelUp(oldXp, oldXp + netXp) ?? {}),
    };
  } finally {
    if (token) {
      activeTokens.delete(token);
    }
  }
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
