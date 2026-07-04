import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, renderHook } from "@testing-library/react";
import { useIdleLock } from "./useIdleLock";
import { useDataStore, useSecurityStore } from "@/stores/index";
import { db } from "@/services/db";

vi.mock("@/services/db", () => ({
  db: { lockApp: vi.fn(async () => undefined) },
}));

vi.mock("@/lib/logger", () => ({
  logger: { security: { info: vi.fn() } },
}));

const mockedLock = vi.mocked(db.lockApp);

describe("useIdleLock", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    useDataStore.setState({ settings: { auto_lock_minutes: "15" } });
    useSecurityStore.setState({
      hasMasterPassword: true,
      isLocked: false,
      lastActivity: Date.now(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("updates activity on user input events", () => {
    const before = useSecurityStore.getState().lastActivity;
    renderHook(() => useIdleLock());
    act(() => {
      fireEvent.mouseDown(window);
    });
    expect(useSecurityStore.getState().lastActivity).toBeGreaterThanOrEqual(before);
  });

  it("does not lock when master password is disabled", async () => {
    useSecurityStore.setState({ hasMasterPassword: false, lastActivity: 0 });
    renderHook(() => useIdleLock());
    await act(async () => {
      vi.advanceTimersByTime(20_000);
    });
    expect(mockedLock).not.toHaveBeenCalled();
  });

  it("locks app after idle timeout", async () => {
    useSecurityStore.setState({
      lastActivity: Date.now() - 16 * 60 * 1000,
    });
    renderHook(() => useIdleLock());
    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });
    expect(mockedLock).toHaveBeenCalled();
    expect(useSecurityStore.getState().isLocked).toBe(true);
  });

  it("skips timer when auto lock minutes is zero", async () => {
    useDataStore.setState({ settings: { auto_lock_minutes: "0" } });
    useSecurityStore.setState({ lastActivity: 0 });
    renderHook(() => useIdleLock());
    await act(async () => {
      vi.advanceTimersByTime(20_000);
    });
    expect(mockedLock).not.toHaveBeenCalled();
  });
});
