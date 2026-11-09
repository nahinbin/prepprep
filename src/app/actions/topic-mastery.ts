"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/app/actions/auth";
import { revalidatePath } from "next/cache";

async function requireUser() {
  const user = await getSession();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function getUserTopicMasteries() {
  const user = await requireUser();

  const records = await prisma.topicMasteryRecord.findMany({
    where: { userId: user.id },
  });

  const map: Record<string, { percentage: number; updatedAt: number }> = {};
  for (const r of records) {
    const key = `${r.subject.toLowerCase()}:::${r.topic.toLowerCase()}`;
    map[key] = {
      percentage: r.percentage,
      updatedAt: r.updatedAt.getTime(),
    };
  }

  return map;
}

export async function saveDbTopicMastery(
  subject: string,
  topic: string,
  percentage: number
) {
  const user = await requireUser();
  const cleanSub = subject.trim();
  const cleanTop = topic.trim();
  if (!cleanSub || !cleanTop) return { error: "Subject and topic required" };

  const clamped = Math.min(100, Math.max(0, Math.round(percentage)));

  const record = await prisma.topicMasteryRecord.upsert({
    where: {
      userId_subject_topic: {
        userId: user.id,
        subject: cleanSub,
        topic: cleanTop,
      },
    },
    update: {
      percentage: clamped,
    },
    create: {
      userId: user.id,
      subject: cleanSub,
      topic: cleanTop,
      percentage: clamped,
    },
  });

  revalidatePath("/subjects/progress");
  revalidatePath("/routine");
  return { success: true, record };
}

