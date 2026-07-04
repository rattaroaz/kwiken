import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ImportExportPage from "./ImportExportPage";
import { useUiStore } from "@/stores/index";

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
  exportTransactionsCsv: vi.fn(async () => "date,amount\n2026-01-01,-10"),
  exportAccountsCsv: vi.fn(async () => "name,balance\nChecking,925"),
  exportCategoriesCsv: vi.fn(async () => "name,type\nFood,expense"),
  previewCsvImport: vi.fn(async () => ({
    rows: [{ date: "2026-01-01", amount: -10, payee: "Coffee", is_duplicate: false }],
    total_rows: 1,
    duplicate_count: 0,
  })),
  commitCsvImport: vi.fn(async () => 1),
  backupDatabase: vi.fn(async () => undefined),
}));

vi.mock("@/services/db", () => ({ db: mocks }));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(async () => null),
  save: vi.fn(async () => null),
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  readTextFile: vi.fn(async () => "date,amount\n2026-01-01,-10"),
}));

vi.mock("@/lib/logger", () => ({
  logger: { import: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } },
}));

vi.mock("@/lib/utils", async () => {
  const actual = await vi.importActual<typeof import("@/lib/utils")>("@/lib/utils");
  return { ...actual, downloadTextFile: vi.fn() };
});

describe("ImportExportPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUiStore.setState({ toasts: [], confirm: { open: false, title: "", message: "" } });
  });

  it("exports transactions csv", async () => {
    const user = userEvent.setup();
    render(<ImportExportPage />);
    await screen.findByText("Checking");
    await user.click(screen.getByRole("button", { name: "Transactions CSV" }));
    await waitFor(() => {
      expect(mocks.exportTransactionsCsv).toHaveBeenCalledWith("acct-1");
    });
  });

  it("exports accounts and categories", async () => {
    const user = userEvent.setup();
    render(<ImportExportPage />);
    await screen.findByText("Checking");
    await user.click(screen.getByRole("button", { name: "Accounts CSV" }));
    await user.click(screen.getByRole("button", { name: "Categories CSV" }));
    expect(mocks.exportAccountsCsv).toHaveBeenCalled();
    expect(mocks.exportCategoriesCsv).toHaveBeenCalled();
  });

  it("previews and commits csv import", async () => {
    const user = userEvent.setup();
    const { open } = await import("@tauri-apps/plugin-dialog");
    vi.mocked(open).mockResolvedValueOnce("C:\\imports\\tx.csv");
    render(<ImportExportPage />);
    await screen.findByText("Checking");
    await user.click(screen.getByRole("button", { name: "Choose File" }));
    expect(await screen.findByRole("button", { name: /Import 1 rows/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Import 1 rows/i }));
    await waitFor(() => {
      expect(mocks.commitCsvImport).toHaveBeenCalled();
    });
  });
});
