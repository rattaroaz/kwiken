import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { db } from "@/services/db";
import { logger } from "@/lib/logger";
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

  useAutoBackup();
  useIdleLock();

  useEffect(() => {
    async function init() {
      if (import.meta.env.VITE_E2E === "true") {
        const forceSetup = sessionStorage.getItem("e2e-force-setup") === "1";
        if (forceSetup) {
          setInitialized(true, false);
          return;
        }
        const status = await db.initApp();
        const settings = await db.getAllSettings();
        setSettings({ ...DEFAULT_SETTINGS, ...settings });
        setTheme((settings.theme ?? "system") as Theme);
        applyTheme((settings.theme ?? "system") as Theme);
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
          logger.app.error("Database integrity check failed", { schemaVersion: status.schema_version });
          setDbCorrupt(true);
          setInitialized(true, false);
          return;
        }
        if (status.unclean_shutdown) {
          logger.app.warn("Unclean shutdown detected from previous session");
          setUncleanShutdown(true);
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

        setInitialized(true, status.has_accounts);
        logger.app.info("App initialized", { hasAccounts: status.has_accounts });
      } catch (e) {
        logger.app.error("Init failed", { error: String(e) });
        addToast("error", e instanceof Error ? e.message : "Failed to initialize app");
        setInitialized(true, false);
      }
    }
    init();
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
      markClean();
      window.removeEventListener("beforeunload", markClean);
    };
  }, []);

  useEffect(() => {
    if (uncleanShutdown) {
      logger.app.info("Displayed unclean shutdown recovery notice");
      addToast("info", "Kwiken recovered from an unexpected shutdown. Recent data should be intact.");
      setUncleanShutdown(false);
    }
  }, [uncleanShutdown, addToast]);

  if (!initialized) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <LoadingSkeleton rows={3} className="w-64" />
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
