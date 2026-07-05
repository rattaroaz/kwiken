import { invoke } from "@tauri-apps/api/core";
import type { LogEntry } from "@/lib/logger";

let enabled = import.meta.env.MODE !== "test";

export function setLogFileEnabled(value: boolean) {
  enabled = value;
}

export function isLogFileEnabled() {
  return enabled;
}

export async function appendLogEntryToFile(entry: LogEntry) {
  if (!enabled || import.meta.env.VITE_E2E === "true") return;
  try {
    await invoke("append_frontend_log", { line: JSON.stringify(entry) });
  } catch {
    // File logging is best-effort and must not break the app.
  }
}

export async function loadRecentLogEntries(maxLines = 200): Promise<LogEntry[]> {
  if (import.meta.env.VITE_E2E === "true") return [];
  try {
    const tail = await invoke<string>("read_frontend_log_tail", { maxLines });
    if (!tail.trim()) return [];
    return tail
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line) as LogEntry;
        } catch {
          return null;
        }
      })
      .filter((entry): entry is LogEntry => entry !== null);
  } catch {
    return [];
  }
}
