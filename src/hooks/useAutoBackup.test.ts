import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useAutoBackup } from "./useAutoBackup";
import { useDataStore } from "@/stores/index";
import { db } from "@/services/db";

vi.mock("@/services/db", () => ({
  db: { backupDatabase: vi.fn(async () => undefined) },
}));

vi.mock("@/lib/logger", () => ({
  logger: { app: { info: vi.fn(), error: vi.fn() } },
}));

const mockedBackup = vi.mocked(db.backupDatabase);

describe("useAutoBackup", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    useDataStore.setState({
      settings: { auto_backup_frequency: "daily", backup_path: "/backups" },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("skips scheduling when frequency is never", () => {
    useDataStore.setState({
      settings: { auto_backup_frequency: "never", backup_path: "/backups" },
    });
    renderHook(() => useAutoBackup());
    act(() => vi.advanceTimersByTime(24 * 60 * 60 * 1000));
    expect(mockedBackup).not.toHaveBeenCalled();
  });

  it("skips scheduling when backup path is empty", () => {
    useDataStore.setState({
      settings: { auto_backup_frequency: "daily", backup_path: "" },
    });
    renderHook(() => useAutoBackup());
    act(() => vi.advanceTimersByTime(24 * 60 * 60 * 1000));
    expect(mockedBackup).not.toHaveBeenCalled();
  });

  it("runs backup on daily interval", async () => {
    renderHook(() => useAutoBackup());
    await act(async () => {
      vi.advanceTimersByTime(24 * 60 * 60 * 1000);
    });
    expect(mockedBackup).toHaveBeenCalledTimes(1);
    expect(mockedBackup.mock.calls[0][0]).toMatch(/^\/backups\/kwiken-backup-/);
  });

  it("clears interval on unmount", () => {
    const { unmount } = renderHook(() => useAutoBackup());
    unmount();
    act(() => vi.advanceTimersByTime(24 * 60 * 60 * 1000));
    expect(mockedBackup).not.toHaveBeenCalled();
  });
});
