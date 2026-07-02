import { describe, expect, it } from "vitest";
import { countLogErrors, getFilteredLogs } from "./logStore";
import { makeLogEntry } from "@/test/helpers";

describe("getFilteredLogs", () => {
  const entries = [
    makeLogEntry({ level: "info", category: "app", message: "started" }),
    makeLogEntry({ level: "error", category: "db", message: "query failed" }),
    makeLogEntry({ level: "warn", category: "import", message: "duplicate row" }),
  ];

  it("filters by level", () => {
    expect(getFilteredLogs(entries, "error")).toHaveLength(1);
  });

  it("filters by category", () => {
    expect(getFilteredLogs(entries, "all", "db")).toHaveLength(1);
  });

  it("filters by search query", () => {
    expect(getFilteredLogs(entries, "all", "all", "duplicate")).toHaveLength(1);
  });

  it("combines filters", () => {
    expect(getFilteredLogs(entries, "warn", "import", "dup")).toHaveLength(1);
  });
});

describe("countLogErrors", () => {
  it("counts error-level entries", () => {
    const entries = [
      makeLogEntry({ level: "error" }),
      makeLogEntry({ level: "info" }),
      makeLogEntry({ level: "error" }),
    ];
    expect(countLogErrors(entries)).toBe(2);
  });
});
