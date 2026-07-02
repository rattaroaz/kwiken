import { describe, expect, it } from "vitest";
import { formatLogEntriesAsJson, formatLogEntriesAsText, formatLogEntryLine } from "./logExport";
import { makeLogEntry } from "@/test/helpers";

describe("logExport", () => {
  const entry = makeLogEntry({
    timestamp: "2024-01-15T12:00:00.000Z",
    level: "error",
    category: "db",
    message: "Command failed",
    metadata: { cmd: "list_accounts" },
  });

  it("formats a single line", () => {
    const line = formatLogEntryLine(entry);
    expect(line).toContain("[ERROR]");
    expect(line).toContain("[db]");
    expect(line).toContain("Command failed");
    expect(line).toContain("list_accounts");
  });

  it("formats multiple entries as text", () => {
    const text = formatLogEntriesAsText([entry, entry]);
    expect(text.split("\n")).toHaveLength(2);
  });

  it("formats as JSON", () => {
    const json = formatLogEntriesAsJson([entry]);
    const parsed = JSON.parse(json);
    expect(parsed[0].message).toBe("Command failed");
  });
});
