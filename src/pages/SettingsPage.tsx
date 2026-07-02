import { useEffect, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import Modal from "@/components/common/Modal";
import { APP_NAME, APP_VERSION, DEFAULT_SETTINGS } from "@/lib/constants";
import { db } from "@/services/db";
import { useDataStore, useSecurityStore, useUiStore } from "@/stores/index";
import type { Account, Theme } from "@/shared/types";

export default function SettingsPage() {
  const settings = useDataStore((s) => s.settings);
  const updateSetting = useDataStore((s) => s.updateSetting);
  const setSettings = useDataStore((s) => s.setSettings);
  const setTheme = useUiStore((s) => s.setTheme);
  const addToast = useUiStore((s) => s.addToast);
  const hasMasterPassword = useSecurityStore((s) => s.hasMasterPassword);
  const setHasMasterPassword = useSecurityStore((s) => s.setHasMasterPassword);
  const setLocked = useSecurityStore((s) => s.setLocked);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [pwModal, setPwModal] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    db.listAccounts().then(setAccounts).catch(() => {});
  }, []);

  const saveSetting = async (key: string, value: string) => {
    try {
      await db.setSetting(key, value);
      updateSetting(key, value);
      if (key === "theme") setTheme(value as Theme);
      addToast("success", "Setting saved");
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Failed to save setting");
    }
  };

  const pickBackupPath = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected) await saveSetting("backup_path", selected as string);
  };

  const setMasterPassword = async () => {
    if (password.length < 4) {
      addToast("error", "Password must be at least 4 characters");
      return;
    }
    if (password !== confirmPw) {
      addToast("error", "Passwords do not match");
      return;
    }
    setSaving(true);
    try {
      await db.setMasterPassword(password);
      setHasMasterPassword(true);
      setPwModal(false);
      setPassword("");
      setConfirmPw("");
      addToast("success", "Master password set");
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Failed to set password");
    } finally {
      setSaving(false);
    }
  };

  const lockNow = async () => {
    try {
      await db.lockApp();
      setLocked(true);
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Failed to lock app");
    }
  };

  const resetSettings = async () => {
    try {
      for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
        await db.setSetting(key, value);
      }
      const all = await db.getAllSettings();
      setSettings({ ...DEFAULT_SETTINGS, ...all });
      setTheme("system");
      addToast("success", "Settings reset to defaults");
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Failed to reset settings");
    }
  };

  const manualBackup = async () => {
    try {
      const dest = await save({
        defaultPath: `kwiken-backup-${new Date().toISOString().slice(0, 10)}.db`,
        filters: [{ name: "Database", extensions: ["db"] }],
      });
      if (!dest) return;
      await db.backupDatabase(dest);
      addToast("success", "Backup created");
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Backup failed");
    }
  };

  const field = (label: string, children: React.ReactNode) => (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <label className="text-sm font-medium">{label}</label>
      <div className="sm:w-64">{children}</div>
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="text-2xl font-bold">Settings</h1>

      <section className="space-y-4 rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">General</h2>
        {field("Currency", (
          <input
            type="text"
            defaultValue={settings.currency ?? "USD"}
            onBlur={(e) => saveSetting("currency", e.target.value.toUpperCase())}
            className="w-full rounded-md border border-input px-3 py-2 text-sm"
          />
        ))}
        {field("Date Format", (
          <select
            defaultValue={settings.date_format ?? "MM/dd/yyyy"}
            onChange={(e) => saveSetting("date_format", e.target.value)}
            className="w-full rounded-md border border-input px-3 py-2 text-sm"
          >
            <option value="MM/dd/yyyy">MM/dd/yyyy</option>
            <option value="dd/MM/yyyy">dd/MM/yyyy</option>
            <option value="yyyy-MM-dd">yyyy-MM-dd</option>
          </select>
        ))}
        {field("Fiscal Year Start", (
          <select
            defaultValue={settings.fiscal_year_start ?? "01"}
            onChange={(e) => saveSetting("fiscal_year_start", e.target.value)}
            className="w-full rounded-md border border-input px-3 py-2 text-sm"
          >
            {Array.from({ length: 12 }, (_, i) => {
              const m = String(i + 1).padStart(2, "0");
              return <option key={m} value={m}>{new Date(2000, i).toLocaleString("en", { month: "long" })}</option>;
            })}
          </select>
        ))}
        {field("Theme", (
          <select
            defaultValue={settings.theme ?? "system"}
            onChange={(e) => saveSetting("theme", e.target.value)}
            className="w-full rounded-md border border-input px-3 py-2 text-sm"
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        ))}
        {field("Default Account", (
          <select
            defaultValue={settings.default_account_id ?? ""}
            onChange={(e) => saveSetting("default_account_id", e.target.value)}
            className="w-full rounded-md border border-input px-3 py-2 text-sm"
          >
            <option value="">None</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        ))}
      </section>

      <section className="space-y-4 rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Backup</h2>
        {field("Backup Path", (
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={settings.backup_path ?? ""}
              placeholder="Not set"
              className="flex-1 rounded-md border border-input px-3 py-2 text-sm"
            />
            <button type="button" onClick={pickBackupPath} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">Browse</button>
          </div>
        ))}
        {field("Auto Backup", (
          <select
            defaultValue={settings.auto_backup_frequency ?? "never"}
            onChange={(e) => saveSetting("auto_backup_frequency", e.target.value)}
            className="w-full rounded-md border border-input px-3 py-2 text-sm"
          >
            <option value="never">Never</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        ))}
        <button type="button" onClick={manualBackup} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">Backup Now</button>
      </section>

      <section className="space-y-4 rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Security</h2>
        {field("Auto-lock (minutes)", (
          <input
            type="number"
            min={0}
            defaultValue={settings.auto_lock_minutes ?? "15"}
            onBlur={(e) => saveSetting("auto_lock_minutes", e.target.value)}
            className="w-full rounded-md border border-input px-3 py-2 text-sm"
          />
        ))}
        <div className="flex gap-3">
          <button type="button" onClick={() => setPwModal(true)} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
            {hasMasterPassword ? "Change Master Password" : "Set Master Password"}
          </button>
          {hasMasterPassword && (
            <button type="button" onClick={lockNow} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">Lock Now</button>
          )}
        </div>
      </section>

      <section className="flex gap-3">
        <button type="button" onClick={() => setAboutOpen(true)} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">About</button>
        <button type="button" onClick={resetSettings} className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted">Reset to Defaults</button>
      </section>

      <Modal open={aboutOpen} onClose={() => setAboutOpen(false)} title={`About ${APP_NAME}`} size="sm">
        <div className="space-y-2 text-center">
          <p className="text-3xl font-bold text-primary">{APP_NAME}</p>
          <p className="text-sm text-muted-foreground">Version {APP_VERSION}</p>
          <p className="text-sm text-muted-foreground">Personal finance management</p>
        </div>
      </Modal>

      <Modal open={pwModal} onClose={() => setPwModal(false)} title="Master Password" footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setPwModal(false)} className="rounded-md border border-border px-4 py-2 text-sm">Cancel</button>
          <button type="button" onClick={setMasterPassword} disabled={saving} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">Save</button>
        </div>
      }>
        <div className="space-y-4">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" className="w-full rounded-md border border-input px-3 py-2 text-sm" />
          <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="Confirm password" className="w-full rounded-md border border-input px-3 py-2 text-sm" />
        </div>
      </Modal>
    </div>
  );
}
