export interface BalanceRow {
  amount: number;
}

export function computeRunningBalances(
  openingBalance: number,
  rows: BalanceRow[],
): number[] {
  let balance = openingBalance;
  return rows.map((row) => {
    balance += row.amount;
    return balance;
  });
}

export function computeAccountBalance(openingBalance: number, amounts: number[]): number {
  return openingBalance + amounts.reduce((sum, a) => sum + a, 0);
}
