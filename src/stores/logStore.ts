import { create } from "zustand";
import type { LogCategory, LogEntry, LogLevel } from "@/lib/logger";

const MAX_LOGS = 500;

type LogLevelFilter = LogLevel | "all";

interface LogState {
  entries: LogEntry[];
  panelOpen: boolean;
  levelFilter: LogLevelFilter;
  addEntry: (entry: LogEntry) => void;
  hydrateEntries: (incoming: LogEntry[]) => void;
  clearLogs: () => void;
  openPanel: () => void;
  closePanel: () => void;
  setLevelFilter: (level: LogLevelFilter) => void;
}

export const useLogStore = create<LogState>((set) => ({
  entries: [],
  panelOpen: false,
  levelFilter: "all",
  addEntry: (entry) =>
    set((s) => ({
      entries: [...s.entries, entry].slice(-MAX_LOGS),
    })),
  hydrateEntries: (incoming) =>
    set((s) => {
      const ids = new Set(s.entries.map((entry) => entry.id));
      const fresh = incoming.filter((entry) => !ids.has(entry.id));
      return { entries: [...fresh, ...s.entries].slice(-MAX_LOGS) };
    }),
  clearLogs: () => set({ entries: [] }),
  openPanel: () => set({ panelOpen: true }),
  closePanel: () => set({ panelOpen: false }),
  setLevelFilter: (levelFilter) => set({ levelFilter }),
}));

export function countLogErrors(entries: LogEntry[]): number {
  return entries.filter((e) => e.level === "error").length;
}

export function getFilteredLogs(
  entries: LogEntry[],
  levelFilter: LogLevelFilter,
  categoryFilter: LogCategory | "all" = "all",
  searchQuery = "",
): LogEntry[] {
  const q = searchQuery.trim().toLowerCase();
  return entries.filter((e) => {
    if (levelFilter !== "all" && e.level !== levelFilter) return false;
    if (categoryFilter !== "all" && e.category !== categoryFilter) return false;
    if (q) {
      const haystack = `${e.message} ${e.category} ${JSON.stringify(e.metadata ?? {})}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}
