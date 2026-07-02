import { lazy, Suspense, useEffect, useState } from "react";
import { db } from "@/services/db";
import { downloadTextFile, formatCurrency, printReport, todayIso } from "@/lib/utils";
import { useDataStore, useSecurityStore, useUiStore } from "@/stores/index";
import type { Account, BalancePoint, CategorySpending, MonthlyFlow, TaxSummaryRow } from "@/shared/types";
import LoadingSkeleton from "@/components/common/LoadingSkeleton";
import type { ReportTab } from "@/components/reports/ReportCharts";

const ReportCharts = lazy(() => import("@/components/reports/ReportCharts"));

type Tab = ReportTab;

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>("spending");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(todayIso());
  const [months, setMonths] = useState(6);
  const [taxYear, setTaxYear] = useState(new Date().getFullYear());
  const [selectedAccount, setSelectedAccount] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);

  const [spending, setSpending] = useState<CategorySpending[]>([]);
  const [incomeExpense, setIncomeExpense] = useState<MonthlyFlow[]>([]);
  const [cashFlow, setCashFlow] = useState<MonthlyFlow[]>([]);
  const [balanceHistory, setBalanceHistory] = useState<BalancePoint[]>([]);
  const [netWorthHistory, setNetWorthHistory] = useState<BalancePoint[]>([]);
  const [taxSummary, setTaxSummary] = useState<TaxSummaryRow[]>([]);
  const [loading, setLoading] = useState(false);

  const settings = useDataStore((s) => s.settings);
  const privacyMode = useSecurityStore((s) => s.privacyMode);
  const addToast = useUiStore((s) => s.addToast);
  const currency = settings.currency ?? "USD";

  useEffect(() => {
    db.listAccounts().then(setAccounts).catch(() => {});
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        switch (tab) {
          case "spending":
            setSpending(await db.getSpendingByCategory(dateFrom, dateTo));
            break;
          case "income":
            setIncomeExpense(await db.getIncomeVsExpense(months));
            break;
          case "cashflow":
            setCashFlow(await db.getCashFlow(dateFrom, dateTo));
            break;
          case "balance":
            if (selectedAccount) setBalanceHistory(await db.getBalanceHistory(selectedAccount, months));
            break;
          case "networth":
            setNetWorthHistory(await db.getNetWorthHistory(months));
            break;
          case "tax":
            setTaxSummary(await db.getTaxSummary(taxYear));
            break;
        }
      } catch (e) {
        addToast("error", e instanceof Error ? e.message : "Failed to load report");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tab, dateFrom, dateTo, months, taxYear, selectedAccount, addToast]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "spending", label: "Spending" },
    { id: "income", label: "Income vs Expense" },
    { id: "cashflow", label: "Cash Flow" },
    { id: "balance", label: "Balance History" },
    { id: "networth", label: "Net Worth" },
    { id: "tax", label: "Tax Summary" },
  ];

  const exportCsv = () => {
    let csv = "";
    if (tab === "spending") {
      csv = "Category,Amount\n" + spending.map((s) => `"${s.category_name}",${s.amount}`).join("\n");
    } else if (tab === "tax") {
      csv = "Category,Amount\n" + taxSummary.map((s) => `"${s.category_name}",${s.amount}`).join("\n");
    } else if (tab === "income") {
      csv = "Month,Income,Expenses\n" + incomeExpense.map((m) => `${m.month},${m.income},${m.expenses}`).join("\n");
    }
    if (csv) {
      downloadTextFile(csv, `kwiken-${tab}-report.csv`);
      addToast("success", "CSV exported");
    }
  };

  const printPdf = () => {
    let html = "<table><tr><th>Item</th><th>Amount</th></tr>";
    if (tab === "spending") {
      spending.forEach((s) => { html += `<tr><td>${s.category_name}</td><td>${formatCurrency(s.amount, currency)}</td></tr>`; });
    } else if (tab === "tax") {
      taxSummary.forEach((s) => { html += `<tr><td>${s.category_name}</td><td>${formatCurrency(s.amount, currency)}</td></tr>`; });
    }
    html += "</table>";
    printReport(`${tabs.find((t) => t.id === tab)?.label} Report`, html);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reports</h1>
        <div className="flex gap-2">
          <button type="button" onClick={exportCsv} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">Export CSV</button>
          <button type="button" onClick={printPdf} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">Print</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        {(tab === "spending" || tab === "cashflow") && (
          <>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-md border border-input px-3 py-1.5 text-sm" />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-md border border-input px-3 py-1.5 text-sm" />
          </>
        )}
        {(tab === "income" || tab === "balance" || tab === "networth") && (
          <select value={months} onChange={(e) => setMonths(parseInt(e.target.value))} className="rounded-md border border-input px-3 py-1.5 text-sm">
            <option value={3}>3 months</option>
            <option value={6}>6 months</option>
            <option value={12}>12 months</option>
          </select>
        )}
        {tab === "balance" && (
          <select value={selectedAccount} onChange={(e) => setSelectedAccount(e.target.value)} className="rounded-md border border-input px-3 py-1.5 text-sm">
            <option value="">Select account</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        )}
        {tab === "tax" && (
          <input type="number" value={taxYear} onChange={(e) => setTaxYear(parseInt(e.target.value))} className="w-24 rounded-md border border-input px-3 py-1.5 text-sm" />
        )}
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center text-muted-foreground">Loading…</div>
      ) : (
        <div className="rounded-lg border border-border bg-card p-5" data-testid="reports-panel">
          <Suspense fallback={<LoadingSkeleton rows={4} />}>
            <ReportCharts
              tab={tab}
              currency={currency}
              privacyMode={privacyMode}
              spending={spending}
              incomeExpense={incomeExpense}
              cashFlow={cashFlow}
              balanceHistory={balanceHistory}
              netWorthHistory={netWorthHistory}
              taxSummary={taxSummary}
              selectedAccount={selectedAccount}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}
