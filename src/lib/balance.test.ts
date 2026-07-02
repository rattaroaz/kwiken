import { describe, expect, it } from "vitest";
import { computeAccountBalance, computeRunningBalances } from "./balance";

describe("balance calculations", () => {
  it("computes running balances from opening balance", () => {
    const balances = computeRunningBalances(100, [{ amount: -25 }, { amount: 50 }]);
    expect(balances).toEqual([75, 125]);
  });

  it("sums transaction amounts with opening balance", () => {
    expect(computeAccountBalance(100, [-25, 50, -10])).toBe(115);
  });
});
