import { describe, expect, it } from "vitest";
import { budgetProgress, isOverBudget, remainingBudget } from "./budget";

describe("budget calculations", () => {
  it("calculates progress percentage capped at 100", () => {
    expect(budgetProgress(50, 100)).toBe(50);
    expect(budgetProgress(150, 100)).toBe(100);
  });

  it("detects over-budget spending", () => {
    expect(isOverBudget(120, 100)).toBe(true);
    expect(isOverBudget(80, 100)).toBe(false);
  });

  it("computes remaining budget", () => {
    expect(remainingBudget(75, 100)).toBe(25);
  });
});
