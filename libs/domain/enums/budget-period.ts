/** How often a budget's allowance resets. */
export const BUDGET_PERIODS = ["weekly", "monthly"] as const;
export type BudgetPeriod = (typeof BUDGET_PERIODS)[number];
