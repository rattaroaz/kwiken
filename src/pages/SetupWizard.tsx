import { useState } from "react";
import { ACCOUNT_TYPES } from "@/lib/constants";
import { db } from "@/services/db";
import { useDataStore, useUiStore } from "@/stores/index";
import type { CreateAccount } from "@/shared/types";

export default function SetupWizard() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<CreateAccount>({
    name: "",
    account_type: "checking",
    currency: "USD",
    opening_balance: 0,
    institution: "",
  });
  const [loading, setLoading] = useState(false);
  const setInitialized = useDataStore((s) => s.setInitialized);
  const addToast = useUiStore((s) => s.addToast);

  const update = (patch: Partial<CreateAccount>) => setForm((f) => ({ ...f, ...patch }));

  const handleFinish = async () => {
    if (!form.name.trim()) {
      addToast("error", "Account name is required");
      return;
    }
    setLoading(true);
    try {
      await db.createAccount({
        ...form,
        institution: form.institution || undefined,
      });
      setInitialized(true, true);
      addToast("success", "Welcome! Your first account has been created.");
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Failed to create account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-background p-6" data-testid="setup-wizard">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-8 shadow-lg">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-card-foreground">Welcome to Kwiken</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Let&apos;s set up your first account to get started.
          </p>
        </div>

        <div className="mb-6 flex gap-2">
          {[0, 1, 2].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full ${s <= step ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Account name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => update({ name: e.target.value })}
                placeholder="e.g. Main Checking"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Institution (optional)</label>
              <input
                type="text"
                value={form.institution ?? ""}
                onChange={(e) => update({ institution: e.target.value })}
                placeholder="e.g. Chase Bank"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Account type</label>
              <select
                value={form.account_type}
                onChange={(e) => update({ account_type: e.target.value })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Currency</label>
              <input
                type="text"
                value={form.currency}
                onChange={(e) => update({ currency: e.target.value.toUpperCase() })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Opening balance</label>
              <input
                type="number"
                step="0.01"
                value={form.opening_balance}
                onChange={(e) => update({ opening_balance: parseFloat(e.target.value) || 0 })}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Enter the current balance of this account.
              </p>
            </div>
          </div>
        )}

        <div className="mt-8 flex justify-between">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Back
            </button>
          ) : (
            <div />
          )}
          {step < 2 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              disabled={loading}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Creating…" : "Finish Setup"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
