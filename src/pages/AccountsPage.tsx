import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Modal from "@/components/common/Modal";
import LoadingSkeleton from "@/components/common/LoadingSkeleton";
import { ACCOUNT_TYPES } from "@/lib/constants";
import { db } from "@/services/db";
import { formatCurrency } from "@/lib/utils";
import { useDataStore, useSecurityStore, useUiStore } from "@/stores/index";
import type { Account, CreateAccount } from "@/shared/types";

const emptyForm: CreateAccount = {
  name: "",
  account_type: "checking",
  currency: "USD",
  opening_balance: 0,
  institution: "",
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState<CreateAccount>(emptyForm);
  const [saving, setSaving] = useState(false);

  const settings = useDataStore((s) => s.settings);
  const privacyMode = useSecurityStore((s) => s.privacyMode);
  const addToast = useUiStore((s) => s.addToast);
  const showConfirm = useUiStore((s) => s.showConfirm);
  const currency = settings.currency ?? "USD";

  const load = async () => {
    try {
      const data = await db.listAccounts(showArchived);
      setAccounts(data);
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Failed to load accounts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [showArchived]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, currency: settings.currency ?? "USD" });
    setModalOpen(true);
  };

  const openEdit = (acc: Account) => {
    setEditing(acc);
    setForm({
      name: acc.name,
      account_type: acc.account_type,
      currency: acc.currency,
      opening_balance: acc.opening_balance,
      institution: acc.institution ?? "",
      minimum_payment: acc.minimum_payment,
      payment_due_day: acc.payment_due_day,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      addToast("error", "Account name is required");
      return;
    }
    setSaving(true);
    try {
      const input = { ...form, institution: form.institution || undefined };
      if (editing) {
        await db.updateAccount(editing.id, input);
        addToast("success", "Account updated");
      } else {
        await db.createAccount(input);
        addToast("success", "Account created");
      }
      setModalOpen(false);
      await load();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Failed to save account");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (acc: Account) => {
    showConfirm("Delete Account", `Delete "${acc.name}"? This cannot be undone.`, async () => {
      try {
        await db.deleteAccount(acc.id);
        addToast("success", "Account deleted");
        await load();
      } catch (e) {
        addToast("error", e instanceof Error ? e.message : "Failed to delete account");
      }
    });
  };

  const handleArchive = async (acc: Account) => {
    try {
      await db.archiveAccount(acc.id, !acc.is_archived);
      addToast("success", acc.is_archived ? "Account restored" : "Account archived");
      await load();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Failed to archive account");
    }
  };

  const typeLabel = (v: string) => ACCOUNT_TYPES.find((t) => t.value === v)?.label ?? v;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Accounts</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded"
            />
            Show archived
          </label>
          <button
            type="button"
            onClick={openCreate}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            + New Account
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingSkeleton rows={6} />
      ) : accounts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">No accounts yet</p>
          <button type="button" onClick={openCreate} className="mt-3 text-sm text-primary hover:underline">
            Create your first account
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((acc) => (
            <div
              key={acc.id}
              className={`rounded-lg border border-border bg-card p-5 ${acc.is_archived ? "opacity-60" : ""}`}
            >
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <Link to={`/accounts/${acc.id}`} className="text-lg font-semibold text-primary hover:underline">
                    {acc.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">{typeLabel(acc.account_type)}</p>
                  {acc.institution && <p className="text-xs text-muted-foreground">{acc.institution}</p>}
                </div>
                {acc.is_archived && (
                  <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">Archived</span>
                )}
              </div>
              <p className="text-2xl font-bold">
                {formatCurrency(acc.balance, acc.currency || currency, privacyMode)}
              </p>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => openEdit(acc)} className="text-xs text-muted-foreground hover:text-foreground">
                  Edit
                </button>
                <button type="button" onClick={() => handleArchive(acc)} className="text-xs text-muted-foreground hover:text-foreground">
                  {acc.is_archived ? "Restore" : "Archive"}
                </button>
                <button type="button" onClick={() => handleDelete(acc)} className="text-xs text-destructive hover:underline">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Account" : "New Account"}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Type</label>
            <select
              value={form.account_type}
              onChange={(e) => setForm({ ...form, account_type: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {ACCOUNT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Institution</label>
            <input
              type="text"
              value={form.institution ?? ""}
              onChange={(e) => setForm({ ...form, institution: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Currency</label>
              <input
                type="text"
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            {!editing && (
              <div>
                <label className="mb-1 block text-sm font-medium">Opening Balance</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.opening_balance}
                  onChange={(e) => setForm({ ...form, opening_balance: parseFloat(e.target.value) || 0 })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
