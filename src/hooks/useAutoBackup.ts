import { useEffect, useRef } from "react";
import { useDataStore } from "@/stores/index";
import { db } from "@/services/db";
import { logger } from "@/lib/logger";

const FREQUENCY_MS: Record<string, number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
};

export function useAutoBackup() {
  const settings = useDataStore((s) => s.settings);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const frequency = settings.auto_backup_frequency ?? "never";
    const backupPath = settings.backup_path ?? "";

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (frequency === "never" || !backupPath) return;

    const ms = FREQUENCY_MS[frequency];
    if (!ms) return;

    const runBackup = async () => {
      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const dest = `${backupPath}/kwiken-backup-${timestamp}.db`;
        await db.backupDatabase(dest);
        logger.app.info("Auto backup completed", { dest });
      } catch (e) {
        logger.app.error("Auto backup failed", { error: String(e) });
      }
    };

    intervalRef.current = setInterval(runBackup, ms);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [settings.auto_backup_frequency, settings.backup_path]);
}
