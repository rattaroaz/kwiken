import { APP_VERSION } from "@/lib/constants";
import { formatLogEntriesAsText } from "@/lib/logExport";
import type { LogEntry } from "@/lib/logger";
import { db } from "@/services/db";
import type { DiagnosticSnapshot } from "@/shared/types";

export interface DiagnosticReport {
  generated_at: string;
  snapshot: DiagnosticSnapshot;
  runtime: {
    user_agent: string;
    platform: string;
    language: string;
  };
  recent_logs: LogEntry[];
}

export async function buildDiagnosticReport(recentLogs: LogEntry[]): Promise<DiagnosticReport> {
  const snapshot = await db.getDiagnosticSnapshot();
  return {
    generated_at: new Date().toISOString(),
    snapshot,
    runtime: {
      user_agent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
    },
    recent_logs: recentLogs,
  };
}

export function formatDiagnosticReportText(report: DiagnosticReport): string {
  const lines = [
    "Kwiken Diagnostic Report",
    "========================",
    `Generated: ${report.generated_at}`,
    `App version: ${report.snapshot.app_version || APP_VERSION}`,
    `Schema version: ${report.snapshot.schema_version}`,
    `Database ready: ${report.snapshot.db_ready}`,
    `Database corrupt: ${report.snapshot.db_corrupt}`,
    `Unclean shutdown: ${report.snapshot.unclean_shutdown}`,
    `Accounts: ${report.snapshot.account_count}`,
    `Logs directory: ${report.snapshot.logs_directory}`,
    `Frontend log: ${report.snapshot.frontend_log_file}`,
    `Rust log: ${report.snapshot.rust_log_file}`,
    "",
    "Runtime",
    "-------",
    `User agent: ${report.runtime.user_agent}`,
    `Platform: ${report.runtime.platform}`,
    `Language: ${report.runtime.language}`,
    "",
    "Recent application logs",
    "-----------------------",
    formatLogEntriesAsText(report.recent_logs),
    "",
  ];
  return lines.join("\n");
}

export function formatDiagnosticReportJson(report: DiagnosticReport): string {
  return JSON.stringify(report, null, 2);
}
