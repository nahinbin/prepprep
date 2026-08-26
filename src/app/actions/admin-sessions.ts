"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/app/actions/admin-auth";
import { getEconomySettings } from "@/app/actions/settings";
import { revalidatePath } from "next/cache";

export async function getAdminSessions(filters?: {
  userId?: string;
  search?: string;
  mode?: "all" | "real" | "practice";
}) {
  await requireAdmin();

  const where: any = {};

  if (filters?.userId && filters.userId !== "all") {
    where.userId = filters.userId;
  }

  if (filters?.mode === "real") {
    where.isPractice = false;
  } else if (filters?.mode === "practice") {
    where.isPractice = true;
  }

  if (filters?.search && filters.search.trim()) {
    const term = filters.search.trim();
    where.OR = [
      { user: { username: { contains: term, mode: "insensitive" } } },
      { id: { contains: term, mode: "insensitive" } },
    ];
  }

  const [sessions, users, settings] = await Promise.all([
    prisma.session.findMany({
      where,
      include: {
        user: { select: { id: true, username: true, profilePicture: true } },
        _count: { select: { attempts: true, mistakes: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 150,
    }),
    prisma.user.findMany({
      select: { id: true, username: true },
      orderBy: { username: "asc" },
    }),
    getEconomySettings(),
  ]);

  return {
    sessions: sessions.map((s) => {
      const coinsEarned = s.isPractice ? 0 : s.correctAnswers * settings.coinsPerCorrect;
      const totalAnswered = s.correctAnswers + s.wrongAnswers;
      const accuracy = totalAnswered > 0 ? Math.round((s.correctAnswers / totalAnswered) * 100) : 0;
      return {
        id: s.id,
        userId: s.userId,
        username: s.user.username,
        profilePicture: s.user.profilePicture,
        totalQuestions: s.totalQuestions,
        correctAnswers: s.correctAnswers,
        wrongAnswers: s.wrongAnswers,
        positivePoints: s.positivePoints,
        negativePoints: s.negativePoints,
        netPoints: s.netPoints,
        coinsEarned,
        accuracy,
        isPractice: s.isPractice,
        attemptCount: s._count.attempts,
        mistakeCount: s._count.mistakes,
        createdAt: s.createdAt.toISOString(),
      };
    }),
    users,
  };
}

export async function getAdminSessionDetails(sessionId: string) {
  await requireAdmin();

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      user: { select: { id: true, username: true } },
      attempts: {
        orderBy: { id: "asc" },
      },
      mistakes: true,
    },
  });

  if (!session) return { error: "Session not found" };

  return {
    session: {
      id: session.id,
      userId: session.userId,
      username: session.user.username,
      totalQuestions: session.totalQuestions,
      correctAnswers: session.correctAnswers,
      wrongAnswers: session.wrongAnswers,
      positivePoints: session.positivePoints,
      negativePoints: session.negativePoints,
      netPoints: session.netPoints,
      isPractice: session.isPractice,
      createdAt: session.createdAt.toISOString(),
      attempts: session.attempts.map((a) => ({
        id: a.id,
        question: a.question,
        selectedAnswer: a.selectedAnswer,
        correctAnswer: a.correctAnswer,
        isCorrect: a.isCorrect,
        pointsGained: a.pointsGained,
        pointsLost: a.pointsLost,
      })),
      mistakesCount: session.mistakes.length,
    },
  };
}

export async function deleteAdminSession(sessionId: string) {
  await requireAdmin();

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    return { error: "Session not found." };
  }

  const settings = await getEconomySettings();
  const coinsEarned = session.isPractice ? 0 : session.correctAnswers * settings.coinsPerCorrect;
  const user = await prisma.user.findUnique({ where: { id: session.userId } });

  await prisma.$transaction(async (tx) => {
    // 1. Rollback user stats and coins if this was a real session
    if (!session.isPractice && user) {
      const newPos = Math.max(0, user.positivePoints - session.positivePoints);
      const newNeg = Math.max(0, user.negativePoints - session.negativePoints);
      const newCoins = Math.max(0, user.coins - coinsEarned);

      await tx.user.update({
        where: { id: session.userId },
        data: {
          positivePoints: newPos,
          negativePoints: newNeg,
          coins: newCoins,
        },
      });

      // Delete the corresponding coin transaction
      await tx.coinTransaction.deleteMany({
        where: {
          userId: session.userId,
          reason: { contains: session.id },
        },
      });
    }

    // 2. Delete all mistakes recorded under this session
    await tx.mistake.deleteMany({
      where: { sessionId: session.id },
    });

    // 3. Delete all attempts recorded under this session
    await tx.attempt.deleteMany({
      where: { sessionId: session.id },
    });

    // 4. Delete the session itself
    await tx.session.delete({
      where: { id: session.id },
    });
  });

  revalidatePath("/admin");
  revalidatePath("/admin/sessions");
  revalidatePath("/admin/users");
  revalidatePath("/admin/transactions");
  revalidatePath("/mistakes");
  revalidatePath("/history");
  revalidatePath("/rewards");
  revalidatePath("/profile");
  revalidatePath("/");

  return {
    success: true,
    rolledBackXp: session.positivePoints,
    rolledBackNegativeXp: session.negativePoints,
    rolledBackCoins: coinsEarned,
  };
}

export async function cleanUserDuplicateMistakes(userId: string): Promise<{
  success: boolean;
  deletedDuplicatesCount: number;
  error?: string;
}> {
  try {
    await requireAdmin();

    const where: any = {};
    if (userId && userId !== "all") {
      where.userId = userId;
    }

    const allMistakes = await prisma.mistake.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    const seen = new Set<string>();
    const duplicateIdsToDelete: string[] = [];

    for (const m of allMistakes) {
      const key = `${m.userId}_${m.question}_${m.fromPractice}`;
      if (seen.has(key)) {
        duplicateIdsToDelete.push(m.id);
      } else {
        seen.add(key);
      }
    }

    if (duplicateIdsToDelete.length > 0) {
      await prisma.mistake.deleteMany({
        where: { id: { in: duplicateIdsToDelete } },
      });
    }

    revalidatePath("/admin/sessions");
    revalidatePath("/admin/users");
    revalidatePath("/mistakes");

    return { success: true, deletedDuplicatesCount: duplicateIdsToDelete.length };
  } catch (err: any) {
    return { success: false, deletedDuplicatesCount: 0, error: err.message || "Failed to clean duplicates" };
  }
}

export async function adminAdjustUserPoints(
  userId: string,
  data: {
    positivePoints?: number;
    negativePoints?: number;
    coins?: number;
  }
) {
  await requireAdmin();

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { error: "User not found." };

  const update: any = {};
  if (data.positivePoints !== undefined) {
    update.positivePoints = Math.max(0, Math.floor(data.positivePoints));
  }
  if (data.negativePoints !== undefined) {
    update.negativePoints = Math.max(0, Math.floor(data.negativePoints));
  }
  if (data.coins !== undefined) {
    update.coins = Math.max(0, Math.floor(data.coins));
  }

  await prisma.user.update({
    where: { id: userId },
    data: update,
  });

  revalidatePath("/admin/users");
  revalidatePath("/admin/sessions");
  revalidatePath("/");

  return { success: true };
}
