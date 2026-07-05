import { describe, expect, it } from "vitest";
import { countLogErrors, getFilteredLogs, useLogStore } from "./logStore";
import { makeLogEntry } from "@/test/helpers";

describe("useLogStore", () => {
  it("opens and closes the panel", () => {
    useLogStore.setState({ panelOpen: false });
    useLogStore.getState().openPanel();
    expect(useLogStore.getState().panelOpen).toBe(true);
    useLogStore.getState().closePanel();
    expect(useLogStore.getState().panelOpen).toBe(false);
  });

  it("adds entries and trims to max capacity", () => {
    useLogStore.setState({ entries: [] });
    for (let i = 0; i < 505; i += 1) {
      useLogStore.getState().addEntry(makeLogEntry({ message: `entry-${i}` }));
    }
    expect(useLogStore.getState().entries).toHaveLength(500);
    expect(useLogStore.getState().entries[0]?.message).toBe("entry-5");
  });

  it("hydrates prior entries without duplicates", () => {
    useLogStore.setState({ entries: [makeLogEntry({ id: "keep", message: "live" })] });
    useLogStore.getState().hydrateEntries([
      makeLogEntry({ id: "keep", message: "old" }),
      makeLogEntry({ id: "restored", message: "from disk" }),
    ]);
    const entries = useLogStore.getState().entries;
    expect(entries).toHaveLength(2);
    expect(entries[0]?.id).toBe("restored");
    expect(entries[1]?.message).toBe("live");
  });

  it("updates level filter and clears logs", () => {
    useLogStore.setState({ entries: [makeLogEntry()], levelFilter: "all" });
    useLogStore.getState().setLevelFilter("error");
    expect(useLogStore.getState().levelFilter).toBe("error");
    useLogStore.getState().clearLogs();
    expect(useLogStore.getState().entries).toHaveLength(0);
  });
});

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
