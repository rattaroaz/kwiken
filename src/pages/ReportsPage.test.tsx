import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReportsPage from "./ReportsPage";
import { useUiStore } from "@/stores/index";

vi.mock("@/components/reports/ReportCharts", () => ({
  default: () => <div data-testid="report-charts">Charts</div>,
}));

const mocks = vi.hoisted(() => ({
  listAccounts: vi.fn(async () => [
    {
      id: "acct-1",
      name: "Checking",
      account_type: "checking",
      currency: "USD",
      opening_balance: 1000,
      balance: 925,
      is_archived: false,
      created_at: "2026-01-01",
    },
  ]),
  getSpendingByCategory: vi.fn(async () => [
    { category_id: "cat-1", category_name: "Food", amount: 75 },
  ]),
  getIncomeVsExpense: vi.fn(async () => [{ month: "2026-01", income: 1000, expenses: 75 }]),
  getCashFlow: vi.fn(async () => [{ month: "2026-01", income: 1000, expenses: 75 }]),
  getBalanceHistory: vi.fn(async () => [{ date: "2026-01-01", balance: 1000 }]),
  getNetWorthHistory: vi.fn(async () => [{ date: "2026-01-01", balance: 925 }]),
  getTaxSummary: vi.fn(async () => [{ category_id: "cat-1", category_name: "Taxes", amount: 200 }]),
}));

vi.mock("@/services/db", () => ({ db: mocks }));

vi.mock("@/lib/utils", async () => {
  const actual = await vi.importActual<typeof import("@/lib/utils")>("@/lib/utils");
  return {
    ...actual,
    downloadTextFile: vi.fn(),
    printReport: vi.fn(),
  };
});

describe("ReportsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUiStore.setState({ toasts: [] });
  });

  it("loads spending report by default", async () => {
    render(<ReportsPage />);
    await waitFor(() => {
      expect(mocks.getSpendingByCategory).toHaveBeenCalled();
    });
    expect(screen.getByTestId("report-charts")).toBeInTheDocument();
  });

  it("switches to income tab", async () => {
    const user = userEvent.setup();
    render(<ReportsPage />);
    await user.click(screen.getByRole("button", { name: "Income vs Expense" }));
    await waitFor(() => {
      expect(mocks.getIncomeVsExpense).toHaveBeenCalled();
    });
  });

  it("exports spending csv", async () => {
    const user = userEvent.setup();
    render(<ReportsPage />);
    await waitFor(() => expect(mocks.getSpendingByCategory).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: "Export CSV" }));
    expect(useUiStore.getState().toasts.some((t) => t.type === "success")).toBe(true);
  });

  it("prints spending report", async () => {
    const user = userEvent.setup();
    const { printReport } = await import("@/lib/utils");
    render(<ReportsPage />);
    await waitFor(() => expect(mocks.getSpendingByCategory).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: "Print" }));
    expect(printReport).toHaveBeenCalled();
  });
});
