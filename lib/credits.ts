export type CreditAction = "translate" | "repair" | "analyze";

export type CreditCost = {
  action: CreditAction;
  base: number;
  perKb: number;
  max: number;
};

export const CREDIT_COSTS: Record<CreditAction, CreditCost> = {
  translate: { action: "translate", base: 0.05, perKb: 0.01, max: 3 },
  analyze: { action: "analyze", base: 0.01, perKb: 0, max: 0.25 },
  repair: { action: "repair", base: 0.08, perKb: 0.02, max: 5 },
};

export function estimateCreditCost(action: CreditAction, bytes: number) {
  const rule = CREDIT_COSTS[action];
  const kb = Math.max(1, Math.ceil(bytes / 1024));
  return Math.min(rule.max, Number((rule.base + kb * rule.perKb).toFixed(2)));
}
