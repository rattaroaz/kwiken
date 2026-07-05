import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import { setLogFileEnabled, appendLogEntryToFile, loadRecentLogEntries, isLogFileEnabled } from "./logFile";

const mockedInvoke = vi.mocked(invoke);

describe("logFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setLogFileEnabled(true);
  });

  it("appends serialized entries when enabled", async () => {
    expect(isLogFileEnabled()).toBe(true);
    mockedInvoke.mockResolvedValueOnce(undefined);
    await appendLogEntryToFile({
      id: "1",
      timestamp: "2026-07-04T12:00:00.000Z",
      category: "app",
      level: "info",
      message: "hello",
    });
    expect(mockedInvoke).toHaveBeenCalledWith("append_frontend_log", {
      line: expect.stringContaining('"message":"hello"'),
    });
  });

  it("skips append when disabled", async () => {
    setLogFileEnabled(false);
    await appendLogEntryToFile({
      id: "2",
      timestamp: "2026-07-04T12:00:00.000Z",
      category: "db",
      level: "error",
      message: "fail",
    });
    expect(mockedInvoke).not.toHaveBeenCalled();
  });

  it("loads recent entries from file tail", async () => {
    mockedInvoke.mockResolvedValueOnce(
      JSON.stringify({
        id: "1",
        timestamp: "2026-07-04T12:00:00.000Z",
        category: "app",
        level: "info",
        message: "Restored log",
      }),
    );
    const entries = await loadRecentLogEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.message).toBe("Restored log");
  });
});
