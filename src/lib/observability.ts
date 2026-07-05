import { APP_VERSION } from "@/lib/constants";
import { loadRecentLogEntries, setLogFileEnabled } from "@/lib/logFile";
import { initLogSession, logger } from "@/lib/logger";
import { useLogStore } from "@/stores/logStore";

const SESSION_ID_KEY = "kwiken_session_id";

function getSessionId(): string {
  const existing = sessionStorage.getItem(SESSION_ID_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  sessionStorage.setItem(SESSION_ID_KEY, id);
  return id;
}

export async function initObservability(options: {
  saveLogsToDisk: boolean;
  schemaVersion?: number;
  hasAccounts?: boolean;
}) {
  setLogFileEnabled(options.saveLogsToDisk);

  initLogSession({
    session_id: getSessionId(),
    app_version: APP_VERSION,
    schema_version: options.schemaVersion,
    has_accounts: options.hasAccounts,
  });

  if (options.saveLogsToDisk) {
    const recent = await loadRecentLogEntries(200);
    if (recent.length > 0) {
      useLogStore.getState().hydrateEntries(recent);
    }
  }

  logger.app.info("Observability initialized", {
    save_logs_to_disk: options.saveLogsToDisk,
    session_id: getSessionId(),
  });
}

export function isSaveLogsToDiskEnabled(settings: Record<string, string>) {
  return (settings.save_logs_to_disk ?? "true") !== "false";
}
