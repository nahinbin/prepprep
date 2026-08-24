"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/app/actions/admin-auth";
import { getSession } from "@/app/actions/auth";

export async function getAdminUsers() {
  await requireAdmin();

  const users = await prisma.user.findMany({
    include: {
      sessions: true,
      orders: { include: { reward: true }, orderBy: { createdAt: "desc" } },
      _count: { select: { sessions: true, mistakes: true, orders: true } },
    },
    orderBy: { username: "asc" },
  });

  return users.map((u) => {
    const totalQ = u.sessions.reduce((a, s) => a + s.correctAnswers + s.wrongAnswers, 0);
    const correct = u.sessions.reduce((a, s) => a + s.correctAnswers, 0);
    const accuracy = totalQ > 0 ? Math.round((correct / totalQ) * 100) : 0;
    const netXp = u.positivePoints - u.negativePoints;

    return {
      id: u.id,
      username: u.username,
      profilePicture: u.profilePicture,
      coins: u.coins,
      positivePoints: u.positivePoints,
      negativePoints: u.negativePoints,
      netXp,
      accuracy,
      sessionCount: u._count.sessions,
      mistakeCount: u._count.mistakes,
      orderCount: u._count.orders,
      orders: u.orders.map((o) => ({
        id: o.id,
        rewardName: o.reward.name,
        coinCost: o.coinCost,
        status: o.status,
        createdAt: o.createdAt,
      })),
    };
  });
}

export async function getAdminOrders() {
  await requireAdmin();

  return prisma.order.findMany({
    include: {
      user: { select: { id: true, username: true } },
      reward: { select: { id: true, name: true, image: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateOrderStatus(orderId: string, status: string) {
  await requireAdmin();
  await prisma.order.update({ where: { id: orderId }, data: { status } });
  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  return { success: true };
}

export async function getAdminRewards() {
  await requireAdmin();
  return prisma.reward.findMany({ orderBy: { createdAt: "desc" } });
}

export async function createReward(data: {
  name: string;
  image: string;
  coinCost: number;
  minXp: number;
  minAccuracy: number;
}) {
  await requireAdmin();

  const name = data.name.trim();
  if (!name) return { error: "Reward name is required." };
  if (!data.image) return { error: "Reward image is required." };
  if (!Number.isFinite(data.coinCost) || data.coinCost < 0) {
    return { error: "Invalid coin cost." };
  }

  await prisma.reward.create({
    data: {
      name,
      image: data.image,
      coinCost: Math.floor(data.coinCost),
      minXp: Math.max(0, Math.floor(data.minXp || 0)),
      minAccuracy: Math.min(100, Math.max(0, Math.floor(data.minAccuracy || 0))),
    },
  });

  revalidatePath("/admin/rewards");
  revalidatePath("/rewards");
  return { success: true };
}

export async function updateReward(
  id: string,
  data: {
    name: string;
    image?: string;
    coinCost: number;
    minXp: number;
    minAccuracy: number;
    isActive: boolean;
  }
) {
  await requireAdmin();

  const name = data.name.trim();
  if (!name) return { error: "Reward name is required." };

  await prisma.reward.update({
    where: { id },
    data: {
      name,
      ...(data.image ? { image: data.image } : {}),
      coinCost: Math.floor(data.coinCost),
      minXp: Math.max(0, Math.floor(data.minXp || 0)),
      minAccuracy: Math.min(100, Math.max(0, Math.floor(data.minAccuracy || 0))),
      isActive: data.isActive,
    },
  });

  revalidatePath("/admin/rewards");
  revalidatePath("/rewards");
  return { success: true };
}

export async function deleteReward(id: string) {
  await requireAdmin();

  const orderCount = await prisma.order.count({ where: { rewardId: id } });
  if (orderCount > 0) {
    await prisma.reward.update({ where: { id }, data: { isActive: false } });
    revalidatePath("/admin/rewards");
    revalidatePath("/rewards");
    return { success: true, deactivated: true };
  }

  await prisma.reward.delete({ where: { id } });
  revalidatePath("/admin/rewards");
  revalidatePath("/rewards");
  return { success: true };
}

export async function getActiveRewardsForUser() {
  const user = await getSession();
  if (!user) return { error: "Not authenticated" as const };

  const rewards = await prisma.reward.findMany({
    where: { isActive: true },
    orderBy: { coinCost: "asc" },
  });

  const sessions = await prisma.session.findMany({
    where: { userId: user.id },
    select: { correctAnswers: true, wrongAnswers: true, isPractice: true },
  });

  const { calcAccuracy } = await import("@/lib/stats");
  const accuracy = calcAccuracy(sessions);
  const netXp = user.positivePoints - user.negativePoints;

  return {
    rewards,
    user: {
      coins: user.coins,
      netXp,
      accuracy,
      username: user.username,
    },
  };
}

export async function purchaseReward(data: {
  rewardId: string;
  fullName: string;
  phone: string;
  address: string;
  city: string;
  country: string;
}) {
  const user = await getSession();
  if (!user) return { error: "Not authenticated" };

  const fullName = data.fullName.trim();
  const phone = data.phone.trim();
  const address = data.address.trim();
  const city = data.city.trim();
  const country = data.country.trim();

  if (!fullName || !phone || !address || !city || !country) {
    return { error: "Please fill in all delivery details." };
  }

  const reward = await prisma.reward.findUnique({ where: { id: data.rewardId } });
  if (!reward || !reward.isActive) return { error: "Reward not available." };

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser) return { error: "User not found." };

  if (dbUser.coins < reward.coinCost) {
    return { error: "Not enough coins." };
  }

  const netXp = dbUser.positivePoints - dbUser.negativePoints;
  if (netXp < reward.minXp) {
    return { error: `Need at least ${reward.minXp} XP to buy this. You have ${netXp} XP.` };
  }

  const sessions = await prisma.session.findMany({
    where: { userId: user.id },
    select: { correctAnswers: true, wrongAnswers: true, isPractice: true },
  });
  const { calcAccuracy } = await import("@/lib/stats");
  const accuracy = calcAccuracy(sessions);

  if (accuracy < reward.minAccuracy) {
    return {
      error: `Need at least ${reward.minAccuracy}% accuracy. You have ${accuracy}%.`,
    };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { coins: { decrement: reward.coinCost } },
    }),
    prisma.coinTransaction.create({
      data: {
        userId: user.id,
        amount: -reward.coinCost,
        reason: `Purchased reward: ${reward.name}`,
      },
    }),
    prisma.order.create({
      data: {
        userId: user.id,
        rewardId: reward.id,
        coinCost: reward.coinCost,
        fullName,
        phone,
        address,
        city,
        country,
        status: "pending",
      },
    }),
  ]);

  revalidatePath("/rewards");
  revalidatePath("/");
  revalidatePath("/admin/orders");
  return { success: true };
}
