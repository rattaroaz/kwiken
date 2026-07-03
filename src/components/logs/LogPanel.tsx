import { useEffect, useMemo, useRef, useState } from "react";
import { countLogErrors, getFilteredLogs, useLogStore } from "@/stores/logStore";
import type { LogCategory, LogLevel } from "@/lib/logger";
import { formatLogEntriesAsText } from "@/lib/logExport";
import { downloadTextFile } from "@/lib/utils";
import { cn } from "@/lib/utils";

const LEVEL_OPTIONS: { value: LogLevel | "all"; label: string }[] = [
  { value: "all", label: "All levels" },
  { value: "debug", label: "Debug" },
  { value: "info", label: "Info" },
  { value: "warn", label: "Warn" },
  { value: "error", label: "Error" },
];

const CATEGORY_OPTIONS: { value: LogCategory | "all"; label: string }[] = [
  { value: "all", label: "All categories" },
  { value: "app", label: "App" },
  { value: "db", label: "Database" },
  { value: "import", label: "Import" },
  { value: "update", label: "Update" },
  { value: "security", label: "Security" },
];

const levelStyles: Record<LogLevel, string> = {
  debug: "text-muted-foreground",
  info: "text-foreground",
  warn: "text-amber-600 dark:text-amber-400",
  error: "text-red-600 dark:text-red-400",
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function LogPanel() {
  const panelOpen = useLogStore((s) => s.panelOpen);
  const entries = useLogStore((s) => s.entries);
  const levelFilter = useLogStore((s) => s.levelFilter);
  const setLevelFilter = useLogStore((s) => s.setLevelFilter);
  const clearLogs = useLogStore((s) => s.clearLogs);
  const closePanel = useLogStore((s) => s.closePanel);

  const [categoryFilter, setCategoryFilter] = useState<LogCategory | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const errorCount = useMemo(() => countLogErrors(entries), [entries]);

  const filtered = useMemo(
    () => getFilteredLogs(entries, levelFilter, categoryFilter, searchQuery),
    [entries, levelFilter, categoryFilter, searchQuery],
  );

  useEffect(() => {
    if (panelOpen && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [panelOpen, filtered.length]);

  const handleExport = () => {
    const text = formatLogEntriesAsText(filtered);
    downloadTextFile(text, `kwiken-logs-${new Date().toISOString().slice(0, 10)}.txt`);
  };

  const handleCopy = async () => {
    const text = formatLogEntriesAsText(filtered);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  if (!panelOpen) return null;

  return (
    <aside
      className="flex h-full w-80 shrink-0 flex-col border-l border-border bg-card"
      data-testid="log-panel"
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Application Logs</h2>
          {errorCount > 0 && (
            <span
              className="rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-semibold text-destructive-foreground"
              data-testid="log-error-count"
            >
              {errorCount}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={closePanel}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Close log panel"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-3 border-b border-border p-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Search</label>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter messages…"
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            data-testid="log-search"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Log level</label>
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value as LogLevel | "all")}
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            data-testid="log-level-filter"
          >
            {LEVEL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Category</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as LogCategory | "all")}
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            data-testid="log-category-filter"
          >
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span data-testid="log-entry-count">
            {filtered.length} of {entries.length} entries
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={handleCopy}
              className="rounded px-2 py-1 hover:bg-muted hover:text-foreground"
              data-testid="log-copy"
            >
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              onClick={handleExport}
              className="rounded px-2 py-1 hover:bg-muted hover:text-foreground"
              data-testid="log-export"
            >
              Export
            </button>
            <button
              type="button"
              onClick={clearLogs}
              className="rounded px-2 py-1 hover:bg-muted hover:text-foreground"
              data-testid="log-clear"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto p-2 font-mono text-xs">
        {filtered.length === 0 ? (
          <p className="p-4 text-center text-muted-foreground">No log entries</p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((entry) => (
              <li key={entry.id} className="rounded-md border border-border bg-background p-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-muted-foreground">{formatTime(entry.timestamp)}</span>
                  <span className="rounded bg-muted px-1 py-0.5 text-[10px] uppercase">
                    {entry.category}
                  </span>
                  <span
                    className={cn(
                      "rounded px-1 py-0.5 text-[10px] font-semibold uppercase",
                      levelStyles[entry.level],
                    )}
                  >
                    {entry.level}
                  </span>
                </div>
                <p className={cn("mt-1 break-words", levelStyles[entry.level])}>{entry.message}</p>
                {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                  <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-[10px] text-muted-foreground">
                    {JSON.stringify(entry.metadata, null, 2)}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
