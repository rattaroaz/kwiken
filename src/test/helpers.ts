import type { LogEntry } from "@/lib/logger";

export function makeLogEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    timestamp: overrides.timestamp ?? new Date().toISOString(),
    category: overrides.category ?? "app",
    level: overrides.level ?? "info",
    message: overrides.message ?? "test message",
    metadata: overrides.metadata,
  };
}
