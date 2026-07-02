import { useEffect } from "react";
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

  useAutoBackup();
  useIdleLock();

  useEffect(() => {
    async function init() {
      if (import.meta.env.VITE_E2E === "true") {
        setInitialized(true, true);
        return;
      }
      try {
        const status = await db.initApp();
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

  if (!initialized) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <LoadingSkeleton rows={3} className="w-64" />
      </div>
    );
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
