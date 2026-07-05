import { useLogStore } from "@/stores/logStore";
import { appendLogEntryToFile } from "@/lib/logFile";

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

let sessionContext: Record<string, unknown> = {};

export function initLogSession(context: Record<string, unknown>) {
  sessionContext = { ...context };
}

export function getLogSessionContext() {
  return { ...sessionContext };
}

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

function mergeMetadata(metadata?: Record<string, unknown>) {
  return sanitizeMetadata({ ...sessionContext, ...metadata });
}

function log(category: LogCategory, level: LogLevel, message: string, metadata?: Record<string, unknown>) {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    category,
    level,
    message,
    metadata: mergeMetadata(metadata),
  };

  useLogStore.getState().addEntry(entry);
  void appendLogEntryToFile(entry);

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

type LoggerMethods = {
  debug?: (msg: string, meta?: Record<string, unknown>) => void;
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn?: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
};

function categoryLogger(category: LogCategory): LoggerMethods {
  return {
    debug: (msg, meta) => log(category, "debug", msg, meta),
    info: (msg, meta) => log(category, "info", msg, meta),
    warn: (msg, meta) => log(category, "warn", msg, meta),
    error: (msg, meta) => log(category, "error", msg, meta),
  };
}

export const logger = {
  app: categoryLogger("app"),
  db: categoryLogger("db"),
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

export async function withTiming<T>(
  category: LogCategory,
  name: string,
  fn: () => Promise<T>,
  metadata?: Record<string, unknown>,
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    logger[category].info(`${name} completed`, {
      ...metadata,
      duration_ms: Math.round(performance.now() - start),
    });
    return result;
  } catch (error) {
    logger[category].error(`${name} failed`, {
      ...metadata,
      duration_ms: Math.round(performance.now() - start),
      error: String(error),
    });
    throw error;
  }
}

export function formatDbError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes("UNIQUE constraint")) return "A record with that name already exists.";
  if (msg.includes("FOREIGN KEY constraint")) return "This item is linked to other records and cannot be removed.";
  if (msg.includes("not found")) return "The requested record was not found.";
  return msg || "An unexpected database error occurred.";
}
