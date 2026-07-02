import { useEffect, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { db } from "@/services/db";
import { downloadTextFile } from "@/lib/utils";
import { useUiStore } from "@/stores/index";
import type { Account, ImportPreview } from "@/shared/types";

type ImportFormat = "csv" | "qif" | "ofx";

export default function ImportExportPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [importAccount, setImportAccount] = useState("");
  const [format, setFormat] = useState<ImportFormat>("csv");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [importing, setImporting] = useState(false);

  const addToast = useUiStore((s) => s.addToast);
  const showConfirm = useUiStore((s) => s.showConfirm);

  useEffect(() => {
    db.listAccounts().then((a) => {
      setAccounts(a);
      if (a.length > 0) setImportAccount(a[0].id);
    }).catch((e) => addToast("error", e instanceof Error ? e.message : "Failed to load accounts"));
  }, [addToast]);

  const pickImportFile = async () => {
    if (!importAccount) {
      addToast("error", "Select an account first");
      return;
    }
    const extensions: Record<ImportFormat, string[]> = {
      csv: ["csv"],
      qif: ["qif"],
      ofx: ["ofx", "qfx"],
    };
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: format.toUpperCase(), extensions: extensions[format] }],
      });
      if (!selected) return;
      const content = await readTextFile(selected as string);
      setFileContent(content);

      let prev: ImportPreview;
      if (format === "csv") prev = await db.previewCsvImport(content, importAccount);
      else if (format === "qif") prev = await db.previewQifImport(content, importAccount);
      else prev = await db.previewOfxImport(content, importAccount);

      setPreview(prev);
      addToast("info", `Found ${prev.total_rows} rows (${prev.duplicate_count} duplicates)`);
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Import preview failed");
    }
  };

  const commitImport = async () => {
    if (!importAccount || !fileContent) return;
    setImporting(true);
    try {
      let count: number;
      if (format === "csv" && preview) {
        const rows = preview.rows.filter((r) => !r.is_duplicate);
        count = await db.commitCsvImport(rows, importAccount);
      } else if (format === "qif") {
        count = await db.commitQifImport(fileContent, importAccount);
      } else {
        count = await db.commitOfxImport(fileContent, importAccount);
      }
      addToast("success", `Imported ${count} transactions`);
      setPreview(null);
      setFileContent("");
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const exportCsv = async (type: "transactions" | "accounts" | "categories") => {
    try {
      let content: string;
      let filename: string;
      if (type === "transactions") {
        content = await db.exportTransactionsCsv(importAccount || undefined);
        filename = "kwiken-transactions.csv";
      } else if (type === "accounts") {
        content = await db.exportAccountsCsv();
        filename = "kwiken-accounts.csv";
      } else {
        content = await db.exportCategoriesCsv();
        filename = "kwiken-categories.csv";
      }
      downloadTextFile(content, filename);
      addToast("success", "Export downloaded");
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Export failed");
    }
  };

  const backup = async () => {
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

  const restore = () => {
    showConfirm("Restore Database", "This will replace all current data. Are you sure?", async () => {
      try {
        const src = await open({
          multiple: false,
          filters: [{ name: "Database", extensions: ["db"] }],
        });
        if (!src) return;
        await db.restoreDatabase(src as string);
        addToast("success", "Database restored. Please restart the app.");
      } catch (e) {
        addToast("error", e instanceof Error ? e.message : "Restore failed");
      }
    });
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Import / Export</h1>

      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Import Transactions</h2>
        <div className="mb-4 flex flex-wrap gap-3">
          <select value={importAccount} onChange={(e) => setImportAccount(e.target.value)} className="rounded-md border border-input px-3 py-2 text-sm">
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select value={format} onChange={(e) => { setFormat(e.target.value as ImportFormat); setPreview(null); }} className="rounded-md border border-input px-3 py-2 text-sm">
            <option value="csv">CSV</option>
            <option value="qif">QIF</option>
            <option value="ofx">OFX</option>
          </select>
          <button type="button" onClick={pickImportFile} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
            Choose File
          </button>
          {preview && (
            <button type="button" onClick={commitImport} disabled={importing} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50">
              {importing ? "Importing…" : `Import ${preview.total_rows - preview.duplicate_count} rows`}
            </button>
          )}
        </div>

        {preview && (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Payee</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-left">Category</th>
                  <th className="px-3 py-2 text-center">Dup</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {preview.rows.slice(0, 50).map((row, i) => (
                  <tr key={i} className={row.is_duplicate ? "opacity-50" : ""}>
                    <td className="px-3 py-2">{row.date}</td>
                    <td className="px-3 py-2">{row.payee || "—"}</td>
                    <td className="px-3 py-2 text-right">{row.amount}</td>
                    <td className="px-3 py-2">{row.category || "—"}</td>
                    <td className="px-3 py-2 text-center">{row.is_duplicate ? "✓" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.rows.length > 50 && (
              <p className="px-3 py-2 text-xs text-muted-foreground">Showing first 50 of {preview.rows.length} rows</p>
            )}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Export Data</h2>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => exportCsv("transactions")} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">Transactions CSV</button>
          <button type="button" onClick={() => exportCsv("accounts")} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">Accounts CSV</button>
          <button type="button" onClick={() => exportCsv("categories")} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">Categories CSV</button>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Backup & Restore</h2>
        <div className="flex gap-3">
          <button type="button" onClick={backup} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Backup Database</button>
          <button type="button" onClick={restore} className="rounded-md border border-destructive px-4 py-2 text-sm text-destructive hover:bg-destructive/10">Restore Database</button>
        </div>
      </section>
    </div>
  );
}
