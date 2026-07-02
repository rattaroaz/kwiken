import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { db } from "@/services/db";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useDataStore, useSecurityStore, useUiStore } from "@/stores/index";
import type { DashboardSummary } from "@/shared/types";
import LoadingSkeleton, { CardSkeleton } from "@/components/common/LoadingSkeleton";

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [netWorthHistory, setNetWorthHistory] = useState<{ date: string; balance: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const settings = useDataStore((s) => s.settings);
  const privacyMode = useSecurityStore((s) => s.privacyMode);
  const addToast = useUiStore((s) => s.addToast);
  const currency = settings.currency ?? "USD";
  const dateFormat = settings.date_format ?? "MM/dd/yyyy";

  useEffect(() => {
    async function load() {
      try {
        const [dash, history] = await Promise.all([
          db.getDashboardSummary(),
          db.getNetWorthHistory(6),
        ]);
        setSummary(dash);
        setNetWorthHistory(history);
      } catch (e) {
        addToast("error", e instanceof Error ? e.message : "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [addToast]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <LoadingSkeleton rows={5} />
      </div>
    );
  }

  if (!summary) return null;

  const hidden = privacyMode;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Net Worth</p>
          <p className="mt-1 text-2xl font-bold text-card-foreground">
            {formatCurrency(summary.net_worth, currency, hidden)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Monthly Income</p>
          <p className="mt-1 text-2xl font-bold text-success">
            {formatCurrency(summary.monthly_income, currency, hidden)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Monthly Spending</p>
          <p className="mt-1 text-2xl font-bold text-destructive">
            {formatCurrency(Math.abs(summary.monthly_spending), currency, hidden)}
          </p>
        </div>
      </div>

      {netWorthHistory.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-4 text-lg font-semibold">Net Worth Trend</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={netWorthHistory}>
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => hidden ? "•••" : `$${v}`} />
              <Tooltip formatter={(v) => formatCurrency(Number(v), currency, hidden)} />
              <Line type="monotone" dataKey="balance" stroke="#2563eb" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-4 text-lg font-semibold">Recent Transactions</h2>
          {summary.recent_transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions yet</p>
          ) : (
            <ul className="divide-y divide-border">
              {summary.recent_transactions.map((tx) => (
                <li key={tx.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{tx.payee_name || "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(tx.date, dateFormat)} · {tx.category_name || "Uncategorized"}
                    </p>
                  </div>
                  <span className={tx.amount >= 0 ? "text-success" : "text-destructive"}>
                    {formatCurrency(tx.amount, currency, hidden)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-4 text-lg font-semibold">Upcoming Recurring</h2>
          {summary.upcoming_recurring.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming recurring transactions</p>
          ) : (
            <ul className="divide-y divide-border">
              {summary.upcoming_recurring.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{r.payee_name || "—"}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(r.next_date, dateFormat)}</p>
                  </div>
                  <span>{formatCurrency(r.amount, currency, hidden)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {summary.budget_alerts.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-4 text-lg font-semibold">Budget Alerts</h2>
          <div className="space-y-4">
            {summary.budget_alerts.map((b) => {
              const pct = b.amount > 0 ? Math.min((b.spent / b.amount) * 100, 100) : 0;
              const over = b.spent > b.amount;
              return (
                <div key={b.id}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{b.category_name}</span>
                    <span className={over ? "text-destructive" : "text-muted-foreground"}>
                      {formatCurrency(b.spent, currency, hidden)} / {formatCurrency(b.amount, currency, hidden)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${over ? "bg-destructive" : "bg-primary"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {summary.budget_alerts.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-4 text-lg font-semibold">Budget Overview</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={summary.budget_alerts.map((b) => ({ name: b.category_name, spent: b.spent, budget: b.amount }))}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="spent" fill="#2563eb" name="Spent" />
              <Bar dataKey="budget" fill="#94a3b8" name="Budget" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="text-sm text-muted-foreground">
        <Link to="/accounts" className="text-primary hover:underline">View all accounts →</Link>
      </div>
    </div>
  );
}
