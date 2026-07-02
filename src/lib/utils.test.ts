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

  it("returns raw string for invalid dates", () => {
    expect(formatDate("not-a-date")).toBe("not-a-date");
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
