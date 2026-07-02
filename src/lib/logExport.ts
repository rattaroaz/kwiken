import type { LogEntry } from "@/lib/logger";

export function formatLogEntryLine(entry: LogEntry): string {
  const meta =
    entry.metadata && Object.keys(entry.metadata).length > 0
      ? ` ${JSON.stringify(entry.metadata)}`
      : "";
  return `${entry.timestamp} [${entry.level.toUpperCase()}] [${entry.category}] ${entry.message}${meta}`;
}

export function formatLogEntriesAsText(entries: LogEntry[]): string {
  return entries.map(formatLogEntryLine).join("\n");
}

export function formatLogEntriesAsJson(entries: LogEntry[]): string {
  return JSON.stringify(entries, null, 2);
}
