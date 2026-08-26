"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/app/actions/admin-auth";
import { revalidatePath } from "next/cache";

export async function adminUpdateUser(
  userId: string,
  data: {
    username?: string;
    password?: string;
    profilePicture?: string | null;
    coins?: number;
    positivePoints?: number;
    negativePoints?: number;
  }
) {
  await requireAdmin();

  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) return { error: "User not found." };

  const update: {
    username?: string;
    password?: string;
    profilePicture?: string | null;
    coins?: number;
    positivePoints?: number;
    negativePoints?: number;
  } = {};

  if (data.username != null) {
    const username = data.username.trim();
    if (!username) return { error: "Username is required." };
    if (username.toLowerCase() === "admin") return { error: "Username reserved." };
    const clash = await prisma.user.findFirst({
      where: { username, NOT: { id: userId } },
    });
    if (clash) return { error: "Username already taken." };
    update.username = username;
  }

  if (data.password != null && data.password.length > 0) {
    update.password = data.password;
  }

  if (data.profilePicture !== undefined) {
    update.profilePicture = data.profilePicture;
  }

  if (data.coins != null) {
    if (!Number.isFinite(data.coins) || data.coins < 0) {
      return { error: "Invalid coin amount." };
    }
    update.coins = Math.floor(data.coins);
  }

  if (data.positivePoints != null) {
    if (!Number.isFinite(data.positivePoints) || data.positivePoints < 0) {
      return { error: "Invalid positive XP amount." };
    }
    update.positivePoints = Math.floor(data.positivePoints);
  }

  if (data.negativePoints != null) {
    if (!Number.isFinite(data.negativePoints) || data.negativePoints < 0) {
      return { error: "Invalid negative XP amount." };
    }
    update.negativePoints = Math.floor(data.negativePoints);
  }

  await prisma.user.update({ where: { id: userId }, data: update });
  revalidatePath("/admin/users");
  revalidatePath("/admin/sessions");
  revalidatePath("/");
  return { success: true };
}

export async function getAdminTransactions() {
  await requireAdmin();
  return prisma.coinTransaction.findMany({
    include: { user: { select: { id: true, username: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function getUserHistory() {
  const { getSession } = await import("@/app/actions/auth");
  const user = await getSession();
  if (!user) return { error: "Not authenticated" as const };

  const [transactions, orders, sessions] = await Promise.all([
    prisma.coinTransaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.order.findMany({
      where: { userId: user.id },
      include: { reward: { select: { name: true, image: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.session.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return { transactions, orders, sessions };
}
