export type LogCategory = "app" | "db" | "import" | "update" | "security";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  category: LogCategory;
  level: LogLevel;
  message: string;
  metadata?: Record<string, unknown>;
}

const SENSITIVE_KEYS = ["password", "token", "secret", "key", "hash"];

function sanitize(metadata?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(metadata)) {
    if (SENSITIVE_KEYS.some((s) => k.toLowerCase().includes(s))) {
      clean[k] = "[REDACTED]";
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

function log(category: LogCategory, level: LogLevel, message: string, metadata?: Record<string, unknown>) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    category,
    level,
    message,
    metadata: sanitize(metadata),
  };
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
