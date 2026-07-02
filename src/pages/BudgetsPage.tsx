import { useEffect, useState } from "react";
import Modal from "@/components/common/Modal";
import LoadingSkeleton from "@/components/common/LoadingSkeleton";
import { db } from "@/services/db";
import { formatCurrency, currentPeriod } from "@/lib/utils";
import { useDataStore, useSecurityStore, useUiStore } from "@/stores/index";
import type { Budget, Category } from "@/shared/types";

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [period, setPeriod] = useState(currentPeriod());
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ category_id: "", amount: "" });

  const settings = useDataStore((s) => s.settings);
  const privacyMode = useSecurityStore((s) => s.privacyMode);
  const addToast = useUiStore((s) => s.addToast);
  const showConfirm = useUiStore((s) => s.showConfirm);
  const currency = settings.currency ?? "USD";

  const load = async () => {
    try {
      const [b, c] = await Promise.all([db.listBudgets(period), db.listCategories()]);
      setBudgets(b);
      setCategories(c.filter((cat) => cat.category_type === "expense"));
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Failed to load budgets");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [period]);

  const handleCreate = async () => {
    const amount = parseFloat(form.amount);
    if (!form.category_id || isNaN(amount) || amount <= 0) {
      addToast("error", "Select a category and enter a valid amount");
      return;
    }
    try {
      await db.createBudget(form.category_id, period, amount);
      addToast("success", "Budget created");
      setModalOpen(false);
      setForm({ category_id: "", amount: "" });
      await load();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Failed to create budget");
    }
  };

  const handleUpdate = async (budget: Budget, newAmount: number) => {
    try {
      await db.updateBudget(budget.id, newAmount);
      addToast("success", "Budget updated");
      await load();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Failed to update budget");
    }
  };

  const handleDelete = (budget: Budget) => {
    showConfirm("Delete Budget", `Delete budget for ${budget.category_name}?`, async () => {
      try {
        await db.deleteBudget(budget.id);
        addToast("success", "Budget deleted");
        await load();
      } catch (e) {
        addToast("error", e instanceof Error ? e.message : "Failed to delete budget");
      }
    });
  };

  if (loading) return <LoadingSkeleton rows={6} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Budgets</h1>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded-md border border-input px-3 py-2 text-sm"
          />
          <button type="button" onClick={() => setModalOpen(true)} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">
            + New Budget
          </button>
        </div>
      </div>

      {budgets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground">No budgets for {period}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {budgets.map((b) => {
            const pct = b.amount > 0 ? Math.min((b.spent / b.amount) * 100, 100) : 0;
            const over = b.spent > b.amount;
            return (
              <div key={b.id} className="rounded-lg border border-border bg-card p-5">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-medium">{b.category_name}</h3>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm ${over ? "text-destructive" : "text-muted-foreground"}`}>
                      {formatCurrency(b.spent, currency, privacyMode)} / {formatCurrency(b.amount, currency, privacyMode)}
                    </span>
                    <button type="button" onClick={() => {
                      const val = prompt("New budget amount:", String(b.amount));
                      if (val) handleUpdate(b, parseFloat(val));
                    }} className="text-xs text-primary hover:underline">Edit</button>
                    <button type="button" onClick={() => handleDelete(b)} className="text-xs text-destructive hover:underline">Delete</button>
                  </div>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all ${over ? "bg-destructive" : "bg-primary"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{pct.toFixed(0)}% used</p>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Budget" footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setModalOpen(false)} className="rounded-md border border-border px-4 py-2 text-sm">Cancel</button>
          <button type="button" onClick={handleCreate} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Create</button>
        </div>
      }>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Category</label>
            <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="w-full rounded-md border border-input px-3 py-2 text-sm">
              <option value="">Select category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Monthly Amount</label>
            <input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="w-full rounded-md border border-input px-3 py-2 text-sm" />
          </div>
        </div>
      </Modal>
    </div>
  );
}
