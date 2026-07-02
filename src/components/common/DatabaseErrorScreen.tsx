import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { db } from "@/services/db";
import { useUiStore } from "@/stores/index";

interface Props {
  uncleanShutdown?: boolean;
}

export default function DatabaseErrorScreen({ uncleanShutdown }: Props) {
  const [restoring, setRestoring] = useState(false);
  const addToast = useUiStore((s) => s.addToast);

  const handleRestore = async () => {
    const selected = await open({
      filters: [{ name: "SQLite database", extensions: ["db"] }],
      multiple: false,
    });
    if (!selected || typeof selected !== "string") return;
    setRestoring(true);
    try {
      await db.restoreDatabase(selected);
      addToast("success", "Database restored. Restarting…");
      window.location.reload();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Restore failed");
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center p-8" data-testid="database-error-screen">
      <div className="max-w-lg rounded-lg border border-destructive/50 bg-card p-8 shadow-lg">
        <h1 className="text-xl font-bold text-destructive">Database problem detected</h1>
        {uncleanShutdown && !restoring && (
          <p className="mt-2 text-sm text-muted-foreground">
            Kwiken did not shut down cleanly last time. Your data should be intact, but you may
            want to verify recent transactions.
          </p>
        )}
        <p className="mt-3 text-sm text-muted-foreground">
          The database failed an integrity check or could not be opened. Restore from a backup file
          if you have one.
        </p>
        <button
          type="button"
          onClick={handleRestore}
          disabled={restoring}
          className="mt-6 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          data-testid="database-restore"
        >
          {restoring ? "Restoring…" : "Restore from backup"}
        </button>
      </div>
    </div>
  );
}
