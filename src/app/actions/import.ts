"use server";

import { prisma } from "@/lib/prisma";

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
  let importedCount = 0;

  for (const q of data.questions) {
    const subjectName = q.subject || data.defaultSubject;
    const topicName = q.topic || data.defaultTopic;

    if (!subjectName || !topicName) continue;

    let subject = await prisma.subject.findUnique({ where: { name: subjectName } });
    if (!subject) {
      subject = await prisma.subject.create({ data: { name: subjectName } });
    }

    let topic = await prisma.topic.findUnique({
      where: { subjectId_name: { subjectId: subject.id, name: topicName } },
    });
    if (!topic) {
      topic = await prisma.topic.create({
        data: { name: topicName, subjectId: subject.id },
      });
    }

    await prisma.question.create({
      data: {
        externalId: q.id || null,
        subjectId: subject.id,
        topicId: topic.id,
        question: q.question,
        options: JSON.stringify(q.options),
        correctAnswer: q.answer,
      },
    });

    importedCount++;
  }

  return { success: true, count: importedCount };
}
