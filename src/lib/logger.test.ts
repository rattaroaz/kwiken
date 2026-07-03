import { describe, expect, it, vi, beforeEach } from "vitest";
import { useLogStore } from "@/stores/logStore";
import { formatDbError, getMinLogLevel, logger, sanitizeMetadata, shouldLog } from "./logger";

describe("sanitizeMetadata", () => {
  it("redacts sensitive keys", () => {
    const result = sanitizeMetadata({ password: "secret", user: "alice" });
    expect(result?.password).toBe("[REDACTED]");
    expect(result?.user).toBe("alice");
  });

  it("redacts nested sensitive keys", () => {
    const result = sanitizeMetadata({ nested: { apiKey: "abc123" } });
    expect((result?.nested as Record<string, unknown>).apiKey).toBe("[REDACTED]");
  });
});

describe("shouldLog", () => {
  it("filters below minimum level", () => {
    expect(shouldLog("debug", "info")).toBe(false);
    expect(shouldLog("error", "info")).toBe(true);
  });
});

describe("getMinLogLevel", () => {
  it("returns a valid level", () => {
    expect(["debug", "info", "warn", "error"]).toContain(getMinLogLevel());
  });
});

describe("formatDbError", () => {
  it("maps UNIQUE constraint", () => {
    expect(formatDbError(new Error("UNIQUE constraint failed"))).toMatch(/already exists/);
  });

  it("maps FOREIGN KEY constraint", () => {
    expect(formatDbError(new Error("FOREIGN KEY constraint"))).toMatch(/linked/);
  });

  it("maps not found", () => {
    expect(formatDbError(new Error("Account not found"))).toMatch(/not found/);
  });
});

describe("logger integration with logStore", () => {
  beforeEach(() => {
    useLogStore.setState({ entries: [], panelOpen: false, levelFilter: "all" });
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  it("adds entries to the store", () => {
    logger.app.info("hello test");
    expect(useLogStore.getState().entries).toHaveLength(1);
    expect(useLogStore.getState().entries[0].message).toBe("hello test");
  });

  it("respects log level gating", () => {
    logger.app.debug("hidden", undefined);
    const entries = useLogStore.getState().entries.filter((e) => e.message === "hidden");
    if (getMinLogLevel() === "debug") {
      expect(entries).toHaveLength(1);
    } else {
      expect(entries).toHaveLength(0);
    }
  });

  it("logs across all categories", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    logger.db.error("db failure");
    logger.import.warn("import warning");
    logger.update.info("update info");
    logger.security.warn("security warning");
    const messages = useLogStore.getState().entries.map((e) => e.message);
    expect(messages).toEqual(
      expect.arrayContaining(["db failure", "import warning", "update info", "security warning"]),
    );
  });
});
