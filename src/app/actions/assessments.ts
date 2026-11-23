"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/app/actions/auth";
import { revalidatePath } from "next/cache";

async function requireUser() {
  const user = await getSession();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export interface CreateAssessmentInput {
  name: string;
  topic?: string;
  subjectName: string;
  dueDate: string; // ISO string
  totalMarks: number;
  weight?: number;
  description?: string;
  remindersEnabled?: boolean;
}

export interface AssessmentRecord {
  id: string;
  userId: string;
  name: string;
  topic: string | null;
  subjectName: string;
  dueDate: Date;
  totalMarks: number;
  weight: number | null;
  description: string | null;
  status: string;
  estimatedMarks: number | null;
  obtainedMarks: number | null;
  remindersEnabled: boolean;
  remindersSent: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function getAssessments(): Promise<AssessmentRecord[]> {
  const user = await requireUser();

  const assessments = await prisma.assessment.findMany({
    where: { userId: user.id },
    orderBy: { dueDate: "asc" },
  });

  return assessments as AssessmentRecord[];
}

export async function createAssessment(
  data: CreateAssessmentInput
): Promise<AssessmentRecord> {
  const user = await requireUser();

  const assessment = await prisma.assessment.create({
    data: {
      userId: user.id,
      name: data.name.trim(),
      topic: data.topic?.trim() || null,
      subjectName: data.subjectName.trim(),
      dueDate: new Date(data.dueDate),
      totalMarks: data.totalMarks,
      weight: data.weight ?? null,
      description: data.description?.trim() || null,
      remindersEnabled: data.remindersEnabled ?? true,
      status: "not_started",
      remindersSent: "[]",
    },
  });

  revalidatePath("/academics");
  return assessment as AssessmentRecord;
}

export async function updateAssessment(
  id: string,
  data: Partial<CreateAssessmentInput>
): Promise<AssessmentRecord> {
  const user = await requireUser();

  const existing = await prisma.assessment.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) throw new Error("Assessment not found");

  const updated = await prisma.assessment.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.topic !== undefined && { topic: data.topic?.trim() || null }),
      ...(data.subjectName !== undefined && {
        subjectName: data.subjectName.trim(),
      }),
      ...(data.dueDate !== undefined && { dueDate: new Date(data.dueDate) }),
      ...(data.totalMarks !== undefined && { totalMarks: data.totalMarks }),
      ...(data.weight !== undefined && { weight: data.weight ?? null }),
      ...(data.description !== undefined && {
        description: data.description?.trim() || null,
      }),
      ...(data.remindersEnabled !== undefined && {
        remindersEnabled: data.remindersEnabled,
      }),
    },
  });

  revalidatePath("/academics");
  return updated as AssessmentRecord;
}

export async function deleteAssessment(id: string): Promise<{ success: boolean }> {
  const user = await requireUser();

  const existing = await prisma.assessment.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) throw new Error("Assessment not found");

  await prisma.assessment.delete({ where: { id } });

  revalidatePath("/academics");
  return { success: true };
}

export async function setAssessmentStatus(
  id: string,
  status: string,
  marks?: { estimated?: number; obtained?: number }
): Promise<AssessmentRecord> {
  const user = await requireUser();

  const existing = await prisma.assessment.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) throw new Error("Assessment not found");

  const updateData: Record<string, unknown> = { status };

  if (status === "submitted" && marks?.estimated !== undefined) {
    updateData.estimatedMarks = marks.estimated;
  }
  if (status === "marks_received" && marks?.obtained !== undefined) {
    updateData.obtainedMarks = marks.obtained;
  }

  const updated = await prisma.assessment.update({
    where: { id },
    data: updateData,
  });

  revalidatePath("/academics");
  return updated as AssessmentRecord;
}

export async function toggleAssessmentReminders(
  id: string
): Promise<AssessmentRecord> {
  const user = await requireUser();

  const existing = await prisma.assessment.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) throw new Error("Assessment not found");

  const updated = await prisma.assessment.update({
    where: { id },
    data: { remindersEnabled: !existing.remindersEnabled },
  });

  revalidatePath("/academics");
  return updated as AssessmentRecord;
}

export async function checkDeadlineReminders(): Promise<{ checked: number; created: number }> {
  const user = await requireUser();

  const assessments = await prisma.assessment.findMany({
    where: {
      userId: user.id,
      status: { notIn: ["submitted", "marks_received"] },
    },
  });

  const now = new Date();
  let created = 0;

  for (const assessment of assessments) {
    if (!assessment.remindersEnabled) continue;

    const remindersSent: string[] = JSON.parse(assessment.remindersSent || "[]");
    const dueDate = new Date(assessment.dueDate);
    const msUntilDue = dueDate.getTime() - now.getTime();
    const newIntervalsSent: string[] = [];

    // Check overdue
    if (msUntilDue < 0 && !remindersSent.includes("overdue")) {
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: "DEADLINE_REMINDER",
          content: `"${assessment.name}" (${assessment.subjectName}) is overdue! Due date has passed.`,
          link: "/academics",
          isRead: false,
        },
      });
      newIntervalsSent.push("overdue");
      created++;
    }

    // 1 week: between 7 days and 6 days before due
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const sixDays = 6 * 24 * 60 * 60 * 1000;
    if (
      msUntilDue > 0 &&
      msUntilDue <= sevenDays &&
      msUntilDue > sixDays &&
      !remindersSent.includes("1_week")
    ) {
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: "DEADLINE_REMINDER",
          content: `Reminder: "${assessment.name}" (${assessment.subjectName}) is due in 1 week.`,
          link: "/academics",
          isRead: false,
        },
      });
      newIntervalsSent.push("1_week");
      created++;
    }

    // 3 days: between 3 days and 2 days before due
    const threeDays = 3 * 24 * 60 * 60 * 1000;
    const twoDays = 2 * 24 * 60 * 60 * 1000;
    if (
      msUntilDue > 0 &&
      msUntilDue <= threeDays &&
      msUntilDue > twoDays &&
      !remindersSent.includes("3_days")
    ) {
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: "DEADLINE_REMINDER",
          content: `Reminder: "${assessment.name}" (${assessment.subjectName}) is due in 3 days.`,
          link: "/academics",
          isRead: false,
        },
      });
      newIntervalsSent.push("3_days");
      created++;
    }

    // 1 day: between 1 day and 12 hours before due
    const oneDay = 24 * 60 * 60 * 1000;
    const twelveHours = 12 * 60 * 60 * 1000;
    if (
      msUntilDue > 0 &&
      msUntilDue <= oneDay &&
      msUntilDue > twelveHours &&
      !remindersSent.includes("1_day")
    ) {
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: "DEADLINE_REMINDER",
          content: `Reminder: "${assessment.name}" (${assessment.subjectName}) is due tomorrow!`,
          link: "/academics",
          isRead: false,
        },
      });
      newIntervalsSent.push("1_day");
      created++;
    }

    // 1 hour: between 1 hour and 0 before due
    const oneHour = 60 * 60 * 1000;
    if (
      msUntilDue > 0 &&
      msUntilDue <= oneHour &&
      !remindersSent.includes("1_hour")
    ) {
      await prisma.notification.create({
        data: {
          userId: user.id,
          type: "DEADLINE_REMINDER",
          content: `Urgent: "${assessment.name}" (${assessment.subjectName}) is due in less than 1 hour!`,
          link: "/academics",
          isRead: false,
        },
      });
      newIntervalsSent.push("1_hour");
      created++;
    }

    if (newIntervalsSent.length > 0) {
      const updatedSent = [...remindersSent, ...newIntervalsSent];
      await prisma.assessment.update({
        where: { id: assessment.id },
        data: { remindersSent: JSON.stringify(updatedSent) },
      });
    }
  }

  return { checked: assessments.length, created };
}
