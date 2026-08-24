"use server";

import { prisma } from "@/lib/prisma";
import { DEFAULT_ECONOMY, type EconomySettings } from "@/lib/constants";
import { requireAdmin } from "@/app/actions/admin-auth";
import { revalidatePath } from "next/cache";

export async function getEconomySettings(): Promise<EconomySettings> {
  try {
    let row = await prisma.appSettings.findUnique({ where: { id: "default" } });
    if (!row) {
      row = await prisma.appSettings.create({
        data: { id: "default", ...DEFAULT_ECONOMY },
      });
    }
    return {
      startingCoins: row.startingCoins,
      coinsPerCorrect: row.coinsPerCorrect,
      xpPerCorrect: row.xpPerCorrect,
      xpPerWrong: row.xpPerWrong,
      coinsPerQuestionCost: row.coinsPerQuestionCost,
      redoXpRecovery: row.redoXpRecovery,
    };
  } catch {
    return { ...DEFAULT_ECONOMY };
  }
}

export async function ensureAppSettings() {
  await prisma.appSettings.upsert({
    where: { id: "default" },
    create: { id: "default", ...DEFAULT_ECONOMY },
    update: {},
  });
}

export async function updateEconomySettings(data: Partial<EconomySettings>) {
  await requireAdmin();
  await ensureAppSettings();

  const next = {
    startingCoins: Math.max(0, Math.floor(data.startingCoins ?? DEFAULT_ECONOMY.startingCoins)),
    coinsPerCorrect: Math.max(0, Math.floor(data.coinsPerCorrect ?? DEFAULT_ECONOMY.coinsPerCorrect)),
    xpPerCorrect: Math.max(0, Math.floor(data.xpPerCorrect ?? DEFAULT_ECONOMY.xpPerCorrect)),
    xpPerWrong: Math.max(0, Math.floor(data.xpPerWrong ?? DEFAULT_ECONOMY.xpPerWrong)),
    coinsPerQuestionCost: Math.max(
      0,
      Math.floor(data.coinsPerQuestionCost ?? DEFAULT_ECONOMY.coinsPerQuestionCost)
    ),
    redoXpRecovery: Math.max(0, Math.floor(data.redoXpRecovery ?? DEFAULT_ECONOMY.redoXpRecovery)),
  };

  await prisma.appSettings.update({
    where: { id: "default" },
    data: next,
  });

  revalidatePath("/admin/settings");
  return { success: true, settings: next };
}
