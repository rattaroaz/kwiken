import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { db: { error: vi.fn() } },
  formatDbError: (e: unknown) => String(e),
  withTiming: async <T>(_cat: string, _name: string, fn: () => Promise<T>) => fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import { db } from "./db";

const mockedInvoke = vi.mocked(invoke);

describe("db service", () => {
  beforeEach(() => {
    mockedInvoke.mockReset();
  });

  it("calls init_app and returns status", async () => {
    mockedInvoke.mockResolvedValueOnce({
      db_ready: true,
      has_accounts: true,
      schema_version: 1,
      db_corrupt: false,
      unclean_shutdown: false,
    });
    const status = await db.initApp();
    expect(mockedInvoke).toHaveBeenCalledWith("init_app", undefined);
    expect(status.has_accounts).toBe(true);
  });

  it("passes filter with pagination to list_transactions", async () => {
    mockedInvoke.mockResolvedValueOnce([]);
    await db.listTransactions({ account_id: "a1", limit: 50, offset: 0 });
    expect(mockedInvoke).toHaveBeenCalledWith("list_transactions", {
      filter: { account_id: "a1", limit: 50, offset: 0 },
    });
  });

  it("calls get_account_register with batched args", async () => {
    mockedInvoke.mockResolvedValueOnce({
      account: { id: "a1", name: "Checking", balance: 0 },
      transactions: [],
      total_count: 0,
      saved_filters: [],
    });
    await db.getAccountRegister("a1", { limit: 100 });
    expect(mockedInvoke).toHaveBeenCalledWith("get_account_register", {
      accountId: "a1",
      filter: { limit: 100 },
    });
  });

  it("wraps invoke errors with formatted message", async () => {
    mockedInvoke.mockRejectedValueOnce("database locked");
    await expect(db.listAccounts()).rejects.toThrow("database locked");
  });

  it("calls account CRUD commands", async () => {
    mockedInvoke.mockResolvedValue({});
    await db.createAccount({
      name: "Savings",
      account_type: "savings",
      currency: "USD",
      opening_balance: 0,
    });
    expect(mockedInvoke).toHaveBeenCalledWith("create_account", expect.any(Object));
    await db.archiveAccount("a1", true);
    expect(mockedInvoke).toHaveBeenCalledWith("archive_account", { id: "a1", archived: true });
  });

  it("calls transaction and transfer commands", async () => {
    mockedInvoke.mockResolvedValue({});
    const input = {
      account_id: "a1",
      date: "2026-01-01",
      amount: -10,
      cleared: false,
      splits: [],
      tag_ids: [],
    };
    await db.createTransaction(input);
    expect(mockedInvoke).toHaveBeenCalledWith("create_transaction", { input });
    await db.bulkDeleteTransactions(["t1", "t2"]);
    expect(mockedInvoke).toHaveBeenCalledWith("bulk_delete_transactions", { ids: ["t1", "t2"] });
    await db.createTransfer({
      from_account_id: "a1",
      to_account_id: "a2",
      date: "2026-01-01",
      amount: 50,
      cleared: false,
    });
    expect(mockedInvoke).toHaveBeenCalledWith("create_transfer", expect.any(Object));
  });

  it("calls budget and auto rule commands", async () => {
    mockedInvoke.mockResolvedValue({});
    await db.createBudget("cat-1", "2026-07", 500);
    expect(mockedInvoke).toHaveBeenCalledWith("create_budget", {
      categoryId: "cat-1",
      period: "2026-07",
      amount: 500,
    });
    await db.applyAutoRulesToTransactions(true);
    expect(mockedInvoke).toHaveBeenCalledWith("apply_auto_rules_to_transactions", { overwrite: true });
    await db.createAutoRule("coffee", "cat-1", "payee", "contains", 10, true);
    expect(mockedInvoke).toHaveBeenCalledWith("create_auto_rule", expect.objectContaining({ pattern: "coffee" }));
  });

  it("calls attachment commands", async () => {
    mockedInvoke.mockResolvedValue({});
    await db.addAttachment("tx-1", "C:\\receipt.pdf", "application/pdf");
    expect(mockedInvoke).toHaveBeenCalledWith("add_attachment", {
      transactionId: "tx-1",
      filePath: "C:\\receipt.pdf",
      mimeType: "application/pdf",
    });
    await db.listAttachments("tx-1");
    expect(mockedInvoke).toHaveBeenCalledWith("list_attachments", { transactionId: "tx-1" });
  });

  it("calls security commands", async () => {
    mockedInvoke.mockResolvedValue(true);
    await db.setMasterPassword("secret");
    expect(mockedInvoke).toHaveBeenCalledWith("set_master_password", { password: "secret" });
    await db.unlockApp("secret");
    expect(mockedInvoke).toHaveBeenCalledWith("unlock_app", { password: "secret" });
    await db.lockApp();
    expect(mockedInvoke).toHaveBeenCalledWith("lock_app", undefined);
  });

  it("calls import and export commands", async () => {
    mockedInvoke.mockResolvedValue("csv-data");
    await db.exportTransactionsCsv("a1");
    expect(mockedInvoke).toHaveBeenCalledWith("export_transactions_csv", { accountId: "a1" });
    mockedInvoke.mockResolvedValue({ rows: [], total_rows: 0, duplicate_count: 0 });
    await db.previewCsvImport("date,amount", "a1");
    expect(mockedInvoke).toHaveBeenCalledWith("preview_csv_import", expect.any(Object));
    mockedInvoke.mockResolvedValue(3);
    await db.commitQifImport("!Type:Bank", "a1");
    expect(mockedInvoke).toHaveBeenCalledWith("commit_qif_import", expect.any(Object));
  });

  it("calls report commands", async () => {
    mockedInvoke.mockResolvedValue([]);
    await db.getSpendingByCategory("2026-01-01", "2026-01-31");
    expect(mockedInvoke).toHaveBeenCalledWith("get_spending_by_category", {
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
    });
    await db.getTaxSummary(2026);
    expect(mockedInvoke).toHaveBeenCalledWith("get_tax_summary", { year: 2026 });
  });

  it("calls backup and restore commands", async () => {
    mockedInvoke.mockResolvedValue(undefined);
    await db.backupDatabase("/tmp/backup.db");
    expect(mockedInvoke).toHaveBeenCalledWith("backup_database", { destPath: "/tmp/backup.db" });
    await db.restoreDatabase("/tmp/backup.db");
    expect(mockedInvoke).toHaveBeenCalledWith("restore_database", { srcPath: "/tmp/backup.db" });
  });

  it("calls observability commands", async () => {
    mockedInvoke.mockResolvedValueOnce("/tmp/logs");
    await db.getLogsDirectory();
    expect(mockedInvoke).toHaveBeenCalledWith("get_logs_directory", undefined);
    mockedInvoke.mockResolvedValueOnce(undefined);
    await db.appendFrontendLog('{"message":"test"}');
    expect(mockedInvoke).toHaveBeenCalledWith("append_frontend_log", { line: '{"message":"test"}' });
    mockedInvoke.mockResolvedValueOnce({
      app_version: "2.6.0",
      schema_version: 2,
      db_ready: true,
      db_corrupt: false,
      unclean_shutdown: false,
      has_accounts: true,
      account_count: 1,
      logs_directory: "/tmp/logs",
      frontend_log_file: "/tmp/logs/kwiken-frontend.log",
      rust_log_file: "/tmp/logs/kwiken-rust.log",
    });
    const snapshot = await db.getDiagnosticSnapshot();
    expect(snapshot.account_count).toBe(1);
  });
});

