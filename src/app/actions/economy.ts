"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/app/actions/auth";
import { sessionCostForCount } from "@/lib/constants";
import { getEconomySettings } from "@/app/actions/settings";

export async function findOrCreateSubjectTopic(
  userId: string,
  subjectName: string,
  topicName: string
) {
  const trimmedSub = subjectName.trim();
  const trimmedTop = topicName.trim();

  let subject = await prisma.subject.findFirst({
    where: {
      userId,
      name: { equals: trimmedSub, mode: "insensitive" },
    },
  });

  if (!subject) {
    subject = await prisma.subject.create({
      data: { name: trimmedSub, userId },
    });
  }

  let topic = await prisma.topic.findFirst({
    where: {
      subjectId: subject.id,
      name: { equals: trimmedTop, mode: "insensitive" },
    },
  });

  if (!topic) {
    topic = await prisma.topic.create({
      data: { name: trimmedTop, subjectId: subject.id },
    });
  }

  return { subject, topic };
}

export async function startSessionCoins({
  subjectId,
  topicId,
  count,
  cost,
  isPractice = false,
}: {
  subjectId: string;
  topicId: string;
  count: number;
  cost: number;
  isPractice?: boolean;
}) {
  const user = await getSession();
  if (!user) return { error: "Not authenticated" };

  // Ensure subject belongs to this user
  const subject = await prisma.subject.findFirst({
    where: { id: subjectId, userId: user.id },
  });
  if (!subject) return { error: "Subject not found in your account." };

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!isPractice && (!dbUser || dbUser.coins < cost)) {
    return { error: "Not enough coins." };
  }

  const whereClause: { subjectId: string; topicId?: string } = { subjectId };
  if (topicId !== "all") {
    whereClause.topicId = topicId;
  }

  const allQuestions = await prisma.question.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
  });

  if (allQuestions.length === 0) {
    return {
      error: "No questions found in this selection. Save some questions first or import them.",
    };
  }

  const finalCount = Math.min(count, allQuestions.length);
  const shuffled = allQuestions.sort(() => 0.5 - Math.random());
  const selectedQuestions = shuffled.slice(0, finalCount).map((q) => ({
    id: q.id,
    question: q.question,
    options: JSON.parse(q.options),
    answer: q.correctAnswer,
  }));

  if (!isPractice && cost > 0) {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { coins: { decrement: cost } },
      }),
      prisma.coinTransaction.create({
        data: {
          userId: user.id,
          amount: -cost,
          reason: `Started ${finalCount}-question session`,
        },
      }),
    ]);
  }

  const settings = await getEconomySettings();

  return {
    success: true,
    questions: selectedQuestions,
    cost: isPractice ? 0 : cost,
    isPractice,
    settings: {
      xpPerCorrect: settings.xpPerCorrect,
      xpPerWrong: settings.xpPerWrong,
      coinsPerCorrect: settings.coinsPerCorrect,
    },
  };
}

export async function startImportedSessionCoins({
  subjectName,
  topicName,
  questions,
  isPractice = false,
}: {
  subjectName: string;
  topicName: string;
  questions: Array<{
    id?: number;
    question: string;
    options: Record<string, string>;
    answer: string;
  }>;
  isPractice?: boolean;
}) {
  const user = await getSession();
  if (!user) return { error: "Not authenticated" };

  const count = questions.length;
  if (count === 0) return { error: "No questions selected." };

  const settings = await getEconomySettings();
  const cost = isPractice ? 0 : sessionCostForCount(count, settings.coinsPerQuestionCost);

  if (!isPractice) {
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser || dbUser.coins < cost) {
      return { error: "Not enough coins." };
    }
  }

  // Ensure user's private subject and topic exist for organization
  await findOrCreateSubjectTopic(user.id, subjectName, topicName);

  // We do NOT flood the database with questions that aren't explicitly saved!
  // Instead, questions are passed in-memory to the session with formatted IDs.
  const formattedQuestions = questions.map((q, idx) => ({
    id: `session-q-${idx + 1}-${Date.now()}`,
    question: q.question.trim(),
    options: q.options,
    answer: q.answer.trim(),
    subjectName: subjectName.trim(),
    topicName: topicName.trim(),
  }));

  if (!isPractice && cost > 0) {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { coins: { decrement: cost } },
      }),
      prisma.coinTransaction.create({
        data: {
          userId: user.id,
          amount: -cost,
          reason: `Started imported session with ${count} questions`,
        },
      }),
    ]);
  }

  return {
    success: true,
    questions: formattedQuestions,
    cost,
    isPractice,
    settings: {
      xpPerCorrect: settings.xpPerCorrect,
      xpPerWrong: settings.xpPerWrong,
      coinsPerCorrect: settings.coinsPerCorrect,
    },
  };
}
