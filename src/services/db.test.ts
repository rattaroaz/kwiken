import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
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
});
