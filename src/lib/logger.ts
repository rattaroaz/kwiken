import { useLogStore } from "@/stores/logStore";

export type LogCategory = "app" | "db" | "import" | "update" | "security";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  id: string;
  timestamp: string;
  category: LogCategory;
  level: LogLevel;
  message: string;
  metadata?: Record<string, unknown>;
}

const SENSITIVE_KEYS = ["password", "token", "secret", "key", "hash"];

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export function getMinLogLevel(): LogLevel {
  const env = import.meta.env.VITE_LOG_LEVEL as string | undefined;
  if (env && env in LEVEL_RANK) return env as LogLevel;
  return import.meta.env.DEV ? "debug" : "info";
}

export function shouldLog(level: LogLevel, minLevel: LogLevel = getMinLogLevel()): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[minLevel];
}

export function sanitizeMetadata(metadata?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(metadata)) {
    if (SENSITIVE_KEYS.some((s) => k.toLowerCase().includes(s))) {
      clean[k] = "[REDACTED]";
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      clean[k] = sanitizeMetadata(v as Record<string, unknown>);
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

function log(category: LogCategory, level: LogLevel, message: string, metadata?: Record<string, unknown>) {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    category,
    level,
    message,
    metadata: sanitizeMetadata(metadata),
  };

  useLogStore.getState().addEntry(entry);

  const prefix = `[${entry.category}]`;
  switch (level) {
    case "debug":
      console.debug(prefix, message, entry.metadata ?? "");
      break;
    case "info":
      console.info(prefix, message, entry.metadata ?? "");
      break;
    case "warn":
      console.warn(prefix, message, entry.metadata ?? "");
      break;
    case "error":
      console.error(prefix, message, entry.metadata ?? "");
      break;
  }
}

export const logger = {
  app: {
    debug: (msg: string, meta?: Record<string, unknown>) => log("app", "debug", msg, meta),
    info: (msg: string, meta?: Record<string, unknown>) => log("app", "info", msg, meta),
    warn: (msg: string, meta?: Record<string, unknown>) => log("app", "warn", msg, meta),
    error: (msg: string, meta?: Record<string, unknown>) => log("app", "error", msg, meta),
  },
  db: {
    debug: (msg: string, meta?: Record<string, unknown>) => log("db", "debug", msg, meta),
    info: (msg: string, meta?: Record<string, unknown>) => log("db", "info", msg, meta),
    warn: (msg: string, meta?: Record<string, unknown>) => log("db", "warn", msg, meta),
    error: (msg: string, meta?: Record<string, unknown>) => log("db", "error", msg, meta),
  },
  import: {
    info: (msg: string, meta?: Record<string, unknown>) => log("import", "info", msg, meta),
    warn: (msg: string, meta?: Record<string, unknown>) => log("import", "warn", msg, meta),
    error: (msg: string, meta?: Record<string, unknown>) => log("import", "error", msg, meta),
  },
  update: {
    info: (msg: string, meta?: Record<string, unknown>) => log("update", "info", msg, meta),
    error: (msg: string, meta?: Record<string, unknown>) => log("update", "error", msg, meta),
  },
  security: {
    info: (msg: string, meta?: Record<string, unknown>) => log("security", "info", msg, meta),
    warn: (msg: string, meta?: Record<string, unknown>) => log("security", "warn", msg, meta),
    error: (msg: string, meta?: Record<string, unknown>) => log("security", "error", msg, meta),
  },
};

export function formatDbError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes("UNIQUE constraint")) return "A record with that name already exists.";
  if (msg.includes("FOREIGN KEY constraint")) return "This item is linked to other records and cannot be removed.";
  if (msg.includes("not found")) return "The requested record was not found.";
  return msg || "An unexpected database error occurred.";
}
