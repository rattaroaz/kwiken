import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { db } from "@/services/db";
import { logger } from "@/lib/logger";
import { initObservability, isSaveLogsToDiskEnabled } from "@/lib/observability";
import { setLogFileEnabled } from "@/lib/logFile";
import { waitForTauri } from "@/lib/tauriInvoke";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import { useDataStore, useSecurityStore, useUiStore } from "@/stores/index";
import type { Theme } from "@/shared/types";
import { useAutoBackup } from "@/hooks/useAutoBackup";
import { useIdleLock } from "@/hooks/useIdleLock";
import AppShell from "@/components/layout/AppShell";
import ToastContainer from "@/components/common/ToastContainer";
import ConfirmDialog from "@/components/common/ConfirmDialog";
import LockScreen from "@/components/security/LockScreen";
import DatabaseErrorScreen from "@/components/common/DatabaseErrorScreen";
import SetupWizard from "@/pages/SetupWizard";
import DashboardPage from "@/pages/DashboardPage";
import AccountsPage from "@/pages/AccountsPage";
import AccountDetailPage from "@/pages/AccountDetailPage";
import CategoriesPage from "@/pages/CategoriesPage";
import BudgetsPage from "@/pages/BudgetsPage";
import ReportsPage from "@/pages/ReportsPage";
import ImportExportPage from "@/pages/ImportExportPage";
import AdvancedPage from "@/pages/AdvancedPage";
import SettingsPage from "@/pages/SettingsPage";
import LoadingSkeleton from "@/components/common/LoadingSkeleton";
import UpdateDialog from "@/components/help/UpdateDialog";

function applyTheme(theme: Theme) {
  const isDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
}

/** Prevent overlapping init invoke chains (Strict Mode / HMR remount). */
let appInitInFlight: Promise<void> | null = null;

export default function App() {
  const initialized = useDataStore((s) => s.initialized);
  const hasAccounts = useDataStore((s) => s.hasAccounts);
  const setInitialized = useDataStore((s) => s.setInitialized);
  const setSettings = useDataStore((s) => s.setSettings);
  const setTheme = useUiStore((s) => s.setTheme);
  const theme = useUiStore((s) => s.theme);
  const addToast = useUiStore((s) => s.addToast);
  const setHasMasterPassword = useSecurityStore((s) => s.setHasMasterPassword);
  const setLocked = useSecurityStore((s) => s.setLocked);
  const setPrivacyMode = useSecurityStore((s) => s.setPrivacyMode);
  const isLocked = useSecurityStore((s) => s.isLocked);
  const [dbCorrupt, setDbCorrupt] = useState(false);
  const [uncleanShutdown, setUncleanShutdown] = useState(false);
  const [notInTauri, setNotInTauri] = useState(false);

  useAutoBackup();
  useIdleLock();

  useEffect(() => {
    if (useDataStore.getState().initialized) return;

    if (!appInitInFlight) {
      appInitInFlight = (async () => {
        // Keep disk log IPC off until all startup invokes finish.
        setLogFileEnabled(false);

        if (import.meta.env.VITE_E2E !== "true") {
          try {
            await waitForTauri();
          } catch {
            setNotInTauri(true);
            setInitialized(true, false);
            return;
          }
        }

        if (import.meta.env.VITE_E2E === "true") {
          const forceSetup = sessionStorage.getItem("e2e-force-setup") === "1";
          if (forceSetup) {
            setInitialized(true, false);
            return;
          }
          const status = await db.initApp();
          const settings = await db.getAllSettings();
          const merged = { ...DEFAULT_SETTINGS, ...settings };
          setSettings(merged);
          await initObservability({
            saveLogsToDisk: isSaveLogsToDiskEnabled(merged),
            schemaVersion: status.schema_version,
            hasAccounts: status.has_accounts,
          });
          setTheme((merged.theme ?? "system") as Theme);
          applyTheme((merged.theme ?? "system") as Theme);
          const hasPw = await db.hasMasterPassword();
          setHasMasterPassword(hasPw);
          const locked = await db.isAppLocked();
          setLocked(locked);
          setInitialized(true, status.has_accounts);
          return;
        }

        try {
          const status = await db.initApp();
          if (status.db_corrupt) {
            console.error("Database integrity check failed", status.schema_version);
            setDbCorrupt(true);
            setInitialized(true, false);
            return;
          }

          const settings = await db.getAllSettings();
          const merged = { ...DEFAULT_SETTINGS, ...settings };
          setSettings(merged);

          const themeValue = (merged.theme ?? "system") as Theme;
          setTheme(themeValue);
          applyTheme(themeValue);
          if (String(merged.privacy_mode) === "true") setPrivacyMode(true);

          const hasPw = await db.hasMasterPassword();
          setHasMasterPassword(hasPw);
          const locked = await db.isAppLocked();
          setLocked(locked);

          // Enable disk logging only after the critical invoke chain finishes.
          await initObservability({
            saveLogsToDisk: isSaveLogsToDiskEnabled(merged),
            schemaVersion: status.schema_version,
            hasAccounts: status.has_accounts,
          });

          setInitialized(true, status.has_accounts);
          if (status.unclean_shutdown) {
            setUncleanShutdown(true);
          }
          logger.app.info("App initialized", { hasAccounts: status.has_accounts });
        } catch (e) {
          console.error("Init failed", e);
          setLogFileEnabled(isSaveLogsToDiskEnabled(DEFAULT_SETTINGS));
          addToast("error", e instanceof Error ? e.message : "Failed to initialize app");
          setInitialized(true, false);
        }
      })().finally(() => {
        // Allow a later remount to re-run only if init never marked initialized.
        if (!useDataStore.getState().initialized) {
          appInitInFlight = null;
        }
      });
    }

    void appInitInFlight;
  }, [setInitialized, setSettings, setTheme, setHasMasterPassword, setLocked, setPrivacyMode, addToast]);

  useEffect(() => {
    applyTheme(theme);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (theme === "system") applyTheme("system");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  useEffect(() => {
    if (import.meta.env.VITE_E2E === "true") return;
    const markClean = () => {
      db.markCleanShutdown().catch(() => {});
    };
    window.addEventListener("beforeunload", markClean);
    return () => {
      window.removeEventListener("beforeunload", markClean);
    };
  }, []);

  useEffect(() => {
    if (uncleanShutdown && initialized) {
      logger.app.warn("Unclean shutdown detected from previous session");
      logger.app.info("Displayed unclean shutdown recovery notice");
      // Only show when the previous session really crashed — not every dev restart.
      addToast(
        "info",
        "Kwiken recovered from an unexpected shutdown. Recent data should be intact.",
      );
      setUncleanShutdown(false);
    }
  }, [uncleanShutdown, initialized, addToast]);

  if (!initialized) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <LoadingSkeleton rows={3} className="w-64" />
      </div>
    );
  }

  if (notInTauri) {
    return (
      <div className="flex h-full items-center justify-center p-8" data-testid="not-in-tauri">
        <div className="max-w-md space-y-3 text-center">
          <h1 className="text-xl font-semibold">Open the Kwiken desktop window</h1>
          <p className="text-sm text-muted-foreground">
            This page is running in a normal browser, where Tauri{" "}
            <code className="text-xs">invoke</code> is unavailable. Start the app with:
          </p>
          <pre className="rounded-md bg-muted px-3 py-2 text-left text-sm">npm run tauri dev</pre>
          <p className="text-sm text-muted-foreground">
            Then use the Kwiken window that opens — not the Vite URL at localhost:1420.
          </p>
        </div>
      </div>
    );
  }

  if (dbCorrupt) {
    return <DatabaseErrorScreen />;
  }

  if (!hasAccounts) {
    return (
      <>
        <SetupWizard />
        <ToastContainer />
        <UpdateDialog />
      </>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="accounts" element={<AccountsPage />} />
          <Route path="accounts/:id" element={<AccountDetailPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="budgets" element={<BudgetsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="import-export" element={<ImportExportPage />} />
          <Route path="advanced" element={<AdvancedPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
      {isLocked && <LockScreen />}
      <ToastContainer />
      <ConfirmDialog />
      <UpdateDialog />
    </BrowserRouter>
  );
}
