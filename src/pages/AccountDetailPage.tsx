import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Modal from "@/components/common/Modal";
import TransactionForm from "@/components/transactions/TransactionForm";
import LoadingSkeleton from "@/components/common/LoadingSkeleton";
import { db } from "@/services/db";
import { formatCurrency, formatDate, todayIso } from "@/lib/utils";
import { useDataStore, useSecurityStore, useUiStore } from "@/stores/index";
import type {
  Account,
  CreateTransfer,
  ReconciliationSession,
  SavedFilter,
  Transaction,
  TransactionFilter,
} from "@/shared/types";

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [account, setAccount] = useState<Account | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);

  const [filter, setFilter] = useState<TransactionFilter>({});
  const [stmtDate, setStmtDate] = useState(todayIso());
  const [stmtBalance, setStmtBalance] = useState("");
  const [reconStatus, setReconStatus] = useState<ReconciliationSession | null>(null);
  const [transfer, setTransfer] = useState<CreateTransfer>({
    from_account_id: id ?? "",
    to_account_id: "",
    date: todayIso(),
    amount: 0,
    cleared: false,
  });

  const settings = useDataStore((s) => s.settings);
  const privacyMode = useSecurityStore((s) => s.privacyMode);
  const addToast = useUiStore((s) => s.addToast);
  const showConfirm = useUiStore((s) => s.showConfirm);
  const dateFormat = settings.date_format ?? "MM/dd/yyyy";

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [acc, txs, filters, accounts] = await Promise.all([
        db.getAccount(id),
        db.listTransactions({ ...filter, account_id: id }),
        db.listSavedFilters(),
        db.listAccounts(),
      ]);
      setAccount(acc);
      setTransactions(txs);
      setSavedFilters(filters.filter((f) => !f.account_id || f.account_id === id));
      setAllAccounts(accounts.filter((a) => a.id !== id));
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Failed to load account");
    } finally {
      setLoading(false);
    }
  }, [id, filter, addToast]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleSelect = (txId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(txId)) next.delete(txId);
      else next.add(txId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === transactions.length) setSelected(new Set());
    else setSelected(new Set(transactions.map((t) => t.id)));
  };

  const handleDelete = (tx: Transaction) => {
    showConfirm("Delete Transaction", "Delete this transaction?", async () => {
      try {
        await db.deleteTransaction(tx.id);
        addToast("success", "Transaction deleted");
        await load();
      } catch (e) {
        addToast("error", e instanceof Error ? e.message : "Delete failed");
      }
    });
  };

  const handleBulkDelete = () => {
    if (selected.size === 0) return;
    showConfirm("Delete Transactions", `Delete ${selected.size} transactions?`, async () => {
      try {
        await db.bulkDeleteTransactions([...selected]);
        setSelected(new Set());
        addToast("success", "Transactions deleted");
        await load();
      } catch (e) {
        addToast("error", e instanceof Error ? e.message : "Bulk delete failed");
      }
    });
  };

  const handleDuplicate = async (tx: Transaction) => {
    try {
      await db.duplicateTransaction(tx.id);
      addToast("success", "Transaction duplicated");
      await load();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Duplicate failed");
    }
  };

  const handleToggleCleared = async (tx: Transaction) => {
    try {
      await db.setTransactionCleared(tx.id, !tx.cleared);
      await load();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Failed to update cleared status");
    }
  };

  const handleTransfer = async () => {
    if (!transfer.to_account_id || transfer.amount <= 0) {
      addToast("error", "Select destination account and enter amount");
      return;
    }
    try {
      await db.createTransfer({ ...transfer, from_account_id: id! });
      addToast("success", "Transfer created");
      setTransferOpen(false);
      await load();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Transfer failed");
    }
  };

  const checkReconciliation = async () => {
    if (!id) return;
    try {
      const status = await db.getReconciliationStatus(id, stmtDate, parseFloat(stmtBalance) || 0);
      setReconStatus(status);
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Reconciliation check failed");
    }
  };

  const finishReconciliation = async () => {
    if (!id) return;
    try {
      await db.finishReconciliation(id);
      addToast("success", "Reconciliation complete");
      setReconcileOpen(false);
      setReconStatus(null);
      await load();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Failed to finish reconciliation");
    }
  };

  const saveFilter = async () => {
    const name = prompt("Filter name:");
    if (!name) return;
    try {
      await db.createSavedFilter(name, id ?? null, JSON.stringify(filter));
      addToast("success", "Filter saved");
      const filters = await db.listSavedFilters();
      setSavedFilters(filters.filter((f) => !f.account_id || f.account_id === id));
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Failed to save filter");
    }
  };

  const applySavedFilter = (sf: SavedFilter) => {
    try {
      const parsed = JSON.parse(sf.filter_json) as TransactionFilter;
      setFilter(parsed);
    } catch {
      addToast("error", "Invalid saved filter");
    }
  };

  if (loading) return <LoadingSkeleton rows={10} />;
  if (!account) return <p>Account not found</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link to="/accounts" className="text-sm text-muted-foreground hover:text-foreground">← Accounts</Link>
          <h1 className="text-2xl font-bold">{account.name}</h1>
          <p className="text-2xl font-semibold text-primary">
            {formatCurrency(account.balance, account.currency, privacyMode)}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => { setEditingTx(null); setFormOpen(true); }} className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">
            + Transaction
          </button>
          <button type="button" onClick={() => setTransferOpen(true)} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">
            Transfer
          </button>
          <button type="button" onClick={() => setReconcileOpen(true)} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">
            Reconcile
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">From</label>
          <input type="date" value={filter.date_from ?? ""} onChange={(e) => setFilter({ ...filter, date_from: e.target.value || undefined })} className="rounded-md border border-input px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">To</label>
          <input type="date" value={filter.date_to ?? ""} onChange={(e) => setFilter({ ...filter, date_to: e.target.value || undefined })} className="rounded-md border border-input px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Payee</label>
          <input type="text" value={filter.payee ?? ""} onChange={(e) => setFilter({ ...filter, payee: e.target.value || undefined })} className="rounded-md border border-input px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Memo</label>
          <input type="text" value={filter.memo ?? ""} onChange={(e) => setFilter({ ...filter, memo: e.target.value || undefined })} className="rounded-md border border-input px-2 py-1.5 text-sm" />
        </div>
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" checked={filter.cleared === true} onChange={(e) => setFilter({ ...filter, cleared: e.target.checked ? true : undefined })} className="rounded" />
          Cleared only
        </label>
        <button type="button" onClick={saveFilter} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">Save filter</button>
        {savedFilters.map((sf) => (
          <button key={sf.id} type="button" onClick={() => applySavedFilter(sf)} className="rounded-full bg-muted px-3 py-1 text-xs hover:bg-accent">
            {sf.name}
          </button>
        ))}
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-md bg-accent px-4 py-2 text-sm">
          <span>{selected.size} selected</span>
          <button type="button" onClick={handleBulkDelete} className="text-destructive hover:underline">Delete selected</button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left">
                <input type="checkbox" checked={selected.size === transactions.length && transactions.length > 0} onChange={toggleSelectAll} className="rounded" />
              </th>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Payee</th>
              <th className="px-3 py-2 text-left">Category</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 text-right">Balance</th>
              <th className="px-3 py-2 text-center">C</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {transactions.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">No transactions</td></tr>
            ) : (
              transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={selected.has(tx.id)} onChange={() => toggleSelect(tx.id)} className="rounded" />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(tx.date, dateFormat)}</td>
                  <td className="px-3 py-2">{tx.payee_name || "—"}</td>
                  <td className="px-3 py-2">
                    {tx.splits.length > 0 ? (
                      <span className="text-xs text-muted-foreground">Split ({tx.splits.length})</span>
                    ) : (
                      tx.category_name || "—"
                    )}
                  </td>
                  <td className={`px-3 py-2 text-right ${tx.amount >= 0 ? "text-success" : "text-destructive"}`}>
                    {formatCurrency(tx.amount, account.currency, privacyMode)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {tx.running_balance != null ? formatCurrency(tx.running_balance, account.currency, privacyMode) : "—"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button type="button" onClick={() => handleToggleCleared(tx)} className={tx.cleared ? "text-success" : "text-muted-foreground"}>
                      {tx.cleared ? "✓" : "○"}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button type="button" onClick={() => { setEditingTx(tx); setFormOpen(true); }} className="mr-2 text-xs text-primary hover:underline">Edit</button>
                    <button type="button" onClick={() => handleDuplicate(tx)} className="mr-2 text-xs text-muted-foreground hover:underline">Dup</button>
                    <button type="button" onClick={() => handleDelete(tx)} className="text-xs text-destructive hover:underline">Del</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <TransactionForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingTx(null); }}
        accountId={id!}
        transaction={editingTx}
        onSaved={load}
      />

      <Modal open={transferOpen} onClose={() => setTransferOpen(false)} title="Transfer" footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setTransferOpen(false)} className="rounded-md border border-border px-4 py-2 text-sm">Cancel</button>
          <button type="button" onClick={handleTransfer} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Create Transfer</button>
        </div>
      }>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">To Account</label>
            <select value={transfer.to_account_id} onChange={(e) => setTransfer({ ...transfer, to_account_id: e.target.value })} className="w-full rounded-md border border-input px-3 py-2 text-sm">
              <option value="">Select account</option>
              {allAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Date</label>
              <input type="date" value={transfer.date} onChange={(e) => setTransfer({ ...transfer, date: e.target.value })} className="w-full rounded-md border border-input px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Amount</label>
              <input type="number" step="0.01" value={transfer.amount || ""} onChange={(e) => setTransfer({ ...transfer, amount: parseFloat(e.target.value) || 0 })} className="w-full rounded-md border border-input px-3 py-2 text-sm" />
            </div>
          </div>
          <input type="text" placeholder="Memo" value={transfer.memo ?? ""} onChange={(e) => setTransfer({ ...transfer, memo: e.target.value })} className="w-full rounded-md border border-input px-3 py-2 text-sm" />
        </div>
      </Modal>

      <Modal open={reconcileOpen} onClose={() => setReconcileOpen(false)} title="Reconciliation" size="lg" footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={checkReconciliation} className="rounded-md border border-border px-4 py-2 text-sm">Check</button>
          <button type="button" onClick={finishReconciliation} disabled={!reconStatus || reconStatus.difference !== 0} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">Finish</button>
        </div>
      }>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Statement Date</label>
              <input type="date" value={stmtDate} onChange={(e) => setStmtDate(e.target.value)} className="w-full rounded-md border border-input px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Statement Balance</label>
              <input type="number" step="0.01" value={stmtBalance} onChange={(e) => setStmtBalance(e.target.value)} className="w-full rounded-md border border-input px-3 py-2 text-sm" />
            </div>
          </div>
          {reconStatus && (
            <div className="rounded-md bg-muted p-4 text-sm space-y-1">
              <p>Cleared total: {formatCurrency(reconStatus.cleared_total, account.currency, privacyMode)}</p>
              <p>Statement balance: {formatCurrency(reconStatus.statement_balance, account.currency, privacyMode)}</p>
              <p className={reconStatus.difference === 0 ? "text-success font-medium" : "text-destructive font-medium"}>
                Difference: {formatCurrency(reconStatus.difference, account.currency, privacyMode)}
              </p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
