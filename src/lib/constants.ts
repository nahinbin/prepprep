export const POINTS_CONFIG = {
  CORRECT: 10,
  WRONG: -5,
};

export const COINS_CONFIG = {
  STARTING_BALANCE: 500,
  CORRECT: 10,
  WRONG: 0,
};

export const SESSION_COSTS: Record<number, number> = {
  10: 50,
  20: 90,
  30: 130,
  50: 200,
  100: 350,
};

export type EconomySettings = {
  startingCoins: number;
  coinsPerCorrect: number;
  xpPerCorrect: number;
  xpPerWrong: number;
  coinsPerQuestionCost: number;
  redoXpRecovery: number;
};

export const DEFAULT_ECONOMY: EconomySettings = {
  startingCoins: COINS_CONFIG.STARTING_BALANCE,
  coinsPerCorrect: COINS_CONFIG.CORRECT,
  xpPerCorrect: POINTS_CONFIG.CORRECT,
  xpPerWrong: Math.abs(POINTS_CONFIG.WRONG),
  coinsPerQuestionCost: 5,
  redoXpRecovery: 5,
};

export function sessionCostForCount(
  count: number,
  coinsPerQuestionCost = DEFAULT_ECONOMY.coinsPerQuestionCost
) {
  if (SESSION_COSTS[count] != null) return SESSION_COSTS[count];
  return count * coinsPerQuestionCost;
}
