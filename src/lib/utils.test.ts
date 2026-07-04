import { describe, expect, it, vi } from "vitest";
import { formatCurrency, formatDate, todayIso, currentPeriod } from "./utils";

describe("formatCurrency", () => {
  it("formats USD amounts", () => {
    expect(formatCurrency(1234.5)).toBe("$1,234.50");
  });

  it("hides amount in privacy mode", () => {
    expect(formatCurrency(100, "USD", true)).toBe("••••••");
  });
});

describe("formatDate", () => {
  it("formats MM/dd/yyyy by default", () => {
    expect(formatDate("2024-03-15")).toBe("03/15/2024");
  });

  it("formats yyyy-MM-dd", () => {
    expect(formatDate("2024-03-15", "yyyy-MM-dd")).toBe("2024-03-15");
  });

  it("formats dd/MM/yyyy", () => {
    expect(formatDate("2024-03-15", "dd/MM/yyyy")).toBe("15/03/2024");
  });

  it("returns raw string for invalid dates", () => {
    expect(formatDate("not-a-date")).toBe("not-a-date");
  });
});

describe("printReport", () => {
  it("opens print window with content", async () => {
    const { printReport } = await import("./utils");
    const write = vi.fn();
    const print = vi.fn();
    vi.stubGlobal("open", vi.fn(() => ({
      document: { write, close: vi.fn() },
      print,
    })));
    printReport("Spending", "<table></table>");
    expect(write).toHaveBeenCalled();
    expect(print).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("returns early when popup is blocked", async () => {
    const { printReport } = await import("./utils");
    vi.stubGlobal("open", vi.fn(() => null));
    expect(() => printReport("Spending", "<table></table>")).not.toThrow();
    vi.unstubAllGlobals();
  });
});

describe("todayIso", () => {
  it("returns YYYY-MM-DD format", () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("currentPeriod", () => {
  it("returns YYYY-MM format", () => {
    expect(currentPeriod()).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe("downloadTextFile", () => {
  it("creates a download link", async () => {
    const { downloadTextFile } = await import("./utils");
    const click = vi.fn();
    const revoke = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:url"),
      revokeObjectURL: revoke,
    });
    vi.stubGlobal("document", {
      createElement: vi.fn(() => ({ click, href: "", download: "" })),
    });
    downloadTextFile("hello", "test.txt");
    expect(click).toHaveBeenCalled();
    expect(revoke).toHaveBeenCalledWith("blob:url");
    vi.unstubAllGlobals();
  });
});
