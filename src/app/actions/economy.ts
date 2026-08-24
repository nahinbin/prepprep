"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/app/actions/auth";
import { sessionCostForCount } from "@/lib/constants";
import { getEconomySettings } from "@/app/actions/settings";

async function findOrCreateSubjectTopic(subjectName: string, topicName: string) {
  const allSubjects = await prisma.subject.findMany();
  let subject = allSubjects.find(
    (s) => s.name.toLowerCase() === subjectName.trim().toLowerCase()
  );
  if (!subject) {
    subject = await prisma.subject.create({ data: { name: subjectName.trim() } });
  }

  let topic = await prisma.topic.findUnique({
    where: { subjectId_name: { subjectId: subject.id, name: topicName.trim() } },
  });
  if (!topic) {
    topic = await prisma.topic.create({
      data: { name: topicName.trim(), subjectId: subject.id },
    });
  }

  return { subject, topic };
}

async function upsertQuestions(
  subjectId: string,
  topicId: string,
  questions: Array<{
    id?: number;
    question: string;
    options: Record<string, string>;
    answer: string;
  }>
) {
  const selectedQuestions = [];

  for (const q of questions) {
    const existing = await prisma.question.findFirst({
      where: { subjectId, topicId, question: q.question },
    });

    let dbQ;
    if (existing) {
      dbQ = existing;
    } else {
      dbQ = await prisma.question.create({
        data: {
          externalId: q.id || null,
          subjectId,
          topicId,
          question: q.question,
          options: JSON.stringify(q.options),
          correctAnswer: q.answer,
        },
      });
    }

    selectedQuestions.push({
      id: dbQ.id,
      question: dbQ.question,
      options: JSON.parse(dbQ.options),
      answer: dbQ.correctAnswer,
    });
  }

  return selectedQuestions;
}

export async function startSessionCoins({
  subjectId,
  topicId,
  count,
  cost,
}: {
  subjectId: string;
  topicId: string;
  count: number;
  cost: number;
}) {
  const user = await getSession();
  if (!user) return { error: "Not authenticated" };

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser || dbUser.coins < cost) {
    return { error: "Not enough coins." };
  }

  const whereClause: { subjectId: string; topicId?: string } = { subjectId };
  if (topicId !== "all") {
    whereClause.topicId = topicId;
  }

  const allQuestions = await prisma.question.findMany({
    where: whereClause,
  });

  if (allQuestions.length < count) {
    return {
      error: `Only ${allQuestions.length} questions available for this selection. Please choose a smaller count.`,
    };
  }

  const shuffled = allQuestions.sort(() => 0.5 - Math.random());
  const selectedQuestions = shuffled.slice(0, count).map((q) => ({
    id: q.id,
    question: q.question,
    options: JSON.parse(q.options),
    answer: q.correctAnswer,
  }));

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { coins: { decrement: cost } },
    }),
    prisma.coinTransaction.create({
      data: {
        userId: user.id,
        amount: -cost,
        reason: `Started ${count}-question session`,
      },
    }),
  ]);

  return { success: true, questions: selectedQuestions };
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

  const { subject, topic } = await findOrCreateSubjectTopic(subjectName, topicName);
  const selectedQuestions = await upsertQuestions(subject.id, topic.id, questions);

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
    questions: selectedQuestions,
    cost,
    isPractice,
    settings: {
      xpPerCorrect: settings.xpPerCorrect,
      xpPerWrong: settings.xpPerWrong,
      coinsPerCorrect: settings.coinsPerCorrect,
    },
  };
}
