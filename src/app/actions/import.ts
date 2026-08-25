"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/app/actions/auth";
import { revalidatePath } from "next/cache";

export async function importQuestions(data: {
  questions: Array<{
    id?: number;
    subject?: string;
    topic?: string;
    question: string;
    options: Record<string, string>;
    answer: string;
  }>;
  defaultSubject: string;
  defaultTopic: string;
}) {
  const user = await getSession();
  if (!user) return { error: "Not authenticated" };

  let importedCount = 0;

  for (const q of data.questions) {
    const subjectName = (q.subject || data.defaultSubject).trim();
    const topicName = (q.topic || data.defaultTopic).trim();

    if (!subjectName || !topicName) continue;

    let subject = await prisma.subject.findFirst({
      where: { userId: user.id, name: subjectName },
    });
    if (!subject) {
      subject = await prisma.subject.create({
        data: { name: subjectName, userId: user.id },
      });
    }

    let topic = await prisma.topic.findUnique({
      where: { subjectId_name: { subjectId: subject.id, name: topicName } },
    });
    if (!topic) {
      topic = await prisma.topic.create({
        data: { name: topicName, subjectId: subject.id },
      });
    }

    const existing = await prisma.question.findFirst({
      where: {
        subjectId: subject.id,
        topicId: topic.id,
        question: q.question.trim(),
      },
    });

    if (!existing) {
      await prisma.question.create({
        data: {
          externalId: q.id || null,
          subjectId: subject.id,
          topicId: topic.id,
          question: q.question.trim(),
          options: JSON.stringify(q.options),
          correctAnswer: q.answer.trim(),
        },
      });
      importedCount++;
    }
  }

  revalidatePath("/questions");
  revalidatePath("/subjects");
  revalidatePath("/session/new");
  return { success: true, count: importedCount };
}
