import { describe, expect, it } from "vitest";
import { formatDiagnosticReportText } from "./diagnostics";
import type { DiagnosticReport } from "./diagnostics";

const sampleReport: DiagnosticReport = {
  generated_at: "2026-07-04T12:00:00.000Z",
  snapshot: {
    app_version: "2.7.1",
    schema_version: 2,
    db_ready: true,
    db_corrupt: false,
    unclean_shutdown: false,
    has_accounts: true,
    account_count: 2,
    logs_directory: "C:\\Users\\me\\AppData\\Roaming\\com.kwiken.desktop\\logs",
    frontend_log_file: "C:\\Users\\me\\AppData\\Roaming\\com.kwiken.desktop\\logs\\kwiken-frontend.log",
    rust_log_file: "C:\\Users\\me\\AppData\\Roaming\\com.kwiken.desktop\\logs\\kwiken-rust.log",
  },
  runtime: {
    user_agent: "test-agent",
    platform: "Win32",
    language: "en-US",
  },
  recent_logs: [
    {
      id: "log-1",
      timestamp: "2026-07-04T11:59:00.000Z",
      category: "app",
      level: "info",
      message: "App initialized",
    },
  ],
};

describe("formatDiagnosticReportText", () => {
  it("includes snapshot and recent logs", () => {
    const text = formatDiagnosticReportText(sampleReport);
    expect(text).toContain("Kwiken Diagnostic Report");
    expect(text).toContain("Schema version: 2");
    expect(text).toContain("Accounts: 2");
    expect(text).toContain("App initialized");
    expect(text).not.toContain("password");
  });
});
