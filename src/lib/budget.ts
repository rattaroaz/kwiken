export function budgetProgress(spent: number, budget: number): number {
  if (budget <= 0) return spent > 0 ? 100 : 0;
  return Math.min(100, Math.round((spent / budget) * 100));
}

export function isOverBudget(spent: number, budget: number): boolean {
  return budget > 0 && spent > budget;
}

export function remainingBudget(spent: number, budget: number): number {
  return budget - spent;
}
