import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import type {
  BalancePoint,
  CategorySpending,
  MonthlyFlow,
  TaxSummaryRow,
} from "@/shared/types";

const COLORS = ["#2563eb", "#16a34a", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#be185d", "#65a30d"];

export type ReportTab = "spending" | "income" | "cashflow" | "balance" | "networth" | "tax";

interface Props {
  tab: ReportTab;
  currency: string;
  privacyMode: boolean;
  spending: CategorySpending[];
  incomeExpense: MonthlyFlow[];
  cashFlow: MonthlyFlow[];
  balanceHistory: BalancePoint[];
  netWorthHistory: BalancePoint[];
  taxSummary: TaxSummaryRow[];
  selectedAccount: string;
}

export default function ReportCharts({
  tab,
  currency,
  privacyMode,
  spending,
  incomeExpense,
  cashFlow,
  balanceHistory,
  netWorthHistory,
  taxSummary,
  selectedAccount,
}: Props) {
  if (tab === "spending") {
    if (spending.length === 0) return <p className="text-muted-foreground" data-testid="report-spending-empty">No spending data</p>;
    return (
      <div className="grid gap-6 lg:grid-cols-2" data-testid="report-spending">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie data={spending} dataKey="amount" nameKey="category_name" cx="50%" cy="50%" outerRadius={100} label>
              {spending.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => formatCurrency(Number(v), currency, privacyMode)} />
          </PieChart>
        </ResponsiveContainer>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2 text-left">Category</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {spending.map((s) => (
              <tr key={s.category_id} className="border-b border-border">
                <td className="py-2">{s.category_name}</td>
                <td className="py-2 text-right">{formatCurrency(s.amount, currency, privacyMode)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (tab === "income") {
    return (
      <ResponsiveContainer width="100%" height={350} data-testid="report-income">
        <BarChart data={incomeExpense}>
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip formatter={(v) => formatCurrency(Number(v), currency, privacyMode)} />
          <Legend />
          <Bar dataKey="income" fill="#16a34a" name="Income" />
          <Bar dataKey="expenses" fill="#dc2626" name="Expenses" />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (tab === "cashflow") {
    return (
      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={cashFlow}>
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip formatter={(v) => formatCurrency(Number(v), currency, privacyMode)} />
          <Legend />
          <Bar dataKey="income" fill="#16a34a" name="Inflow" />
          <Bar dataKey="expenses" fill="#dc2626" name="Outflow" />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (tab === "balance") {
    if (!selectedAccount) return <p className="text-muted-foreground">Select an account</p>;
    return (
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={balanceHistory}>
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip formatter={(v) => formatCurrency(Number(v), currency, privacyMode)} />
          <Line type="monotone" dataKey="balance" stroke="#2563eb" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (tab === "networth") {
    return (
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={netWorthHistory}>
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip formatter={(v) => formatCurrency(Number(v), currency, privacyMode)} />
          <Line type="monotone" dataKey="balance" stroke="#2563eb" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (taxSummary.length === 0) return <p className="text-muted-foreground">No tax-related transactions</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b">
          <th className="py-2 text-left">Category</th>
          <th className="py-2 text-right">Amount</th>
        </tr>
      </thead>
      <tbody>
        {taxSummary.map((s, i) => (
          <tr key={i} className="border-b border-border">
            <td className="py-2">{s.category_name}</td>
            <td className="py-2 text-right">{formatCurrency(s.amount, currency, privacyMode)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
