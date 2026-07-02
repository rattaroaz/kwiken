import { useEffect, useState } from "react";
import Modal from "@/components/common/Modal";
import { FREQUENCIES } from "@/lib/constants";
import { db } from "@/services/db";
import { formatCurrency, formatDate, todayIso } from "@/lib/utils";
import { useDataStore, useSecurityStore, useUiStore } from "@/stores/index";
import type {
  Account,
  Category,
  ExchangeRate,
  InvestmentHolding,
  LoanDetails,
  RecurringTransaction,
  Tag,
  TransactionTemplate,
} from "@/shared/types";

type Tab = "recurring" | "tags" | "templates" | "holdings" | "loans" | "rates" | "close";

export default function AdvancedPage() {
  const [tab, setTab] = useState<Tab>("recurring");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [templates, setTemplates] = useState<TransactionTemplate[]>([]);
  const [holdings, setHoldings] = useState<InvestmentHolding[]>([]);
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [loanAccount, setLoanAccount] = useState("");
  const [loanDetails, setLoanDetails] = useState<LoanDetails | null>(null);
  const [loanPayment, setLoanPayment] = useState<number | null>(null);
  const [closeYear, setCloseYear] = useState(new Date().getFullYear());

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState<RecurringTransaction | null>(null);
  const [recForm, setRecForm] = useState({
    account_id: "",
    payee_name: "",
    category_id: "",
    amount: "",
    memo: "",
    frequency: "monthly",
    next_date: todayIso(),
    auto_enter: false,
    reminder_days: "3",
  });
  const [tagName, setTagName] = useState("");
  const [tagColor, setTagColor] = useState("#3b82f6");
  const [tplForm, setTplForm] = useState({ name: "", payee_name: "", category_id: "", amount: "", memo: "" });
  const [holdingForm, setHoldingForm] = useState({ symbol: "", shares: "", cost_basis: "", current_price: "" });
  const [loanForm, setLoanForm] = useState({ principal: "", interest_rate: "", term_months: "", start_date: todayIso() });
  const [rateForm, setRateForm] = useState({ from_currency: "USD", to_currency: "EUR", rate: "", effective_date: todayIso() });
  const [selectedRecurring, setSelectedRecurring] = useState<Set<string>>(new Set());

  const settings = useDataStore((s) => s.settings);
  const privacyMode = useSecurityStore((s) => s.privacyMode);
  const addToast = useUiStore((s) => s.addToast);
  const showConfirm = useUiStore((s) => s.showConfirm);
  const updateSetting = useDataStore((s) => s.updateSetting);
  const currency = settings.currency ?? "USD";
  const dateFormat = settings.date_format ?? "MM/dd/yyyy";

  const loadBase = async () => {
    const [accs, cats] = await Promise.all([db.listAccounts(), db.listCategories()]);
    setAccounts(accs);
    setCategories(cats);
    if (accs.length && !selectedAccount) setSelectedAccount(accs[0].id);
    const loanAccs = accs.filter((a) => a.account_type === "loan");
    if (loanAccs.length && !loanAccount) setLoanAccount(loanAccs[0].id);
  };

  const loadTab = async () => {
    try {
      switch (tab) {
        case "recurring":
          setRecurring(await db.listRecurring());
          break;
        case "tags":
          setTags(await db.listTags());
          break;
        case "templates":
          setTemplates(await db.listTemplates());
          break;
        case "holdings":
          if (selectedAccount) setHoldings(await db.listHoldings(selectedAccount));
          break;
        case "rates":
          setRates(await db.listExchangeRates());
          break;
        case "loans":
          if (loanAccount) {
            const details = await db.getLoanDetails(loanAccount);
            setLoanDetails(details);
            if (details) {
              const payment = await db.calculateLoanPayment(loanAccount);
              setLoanPayment(payment);
            }
          }
          break;
      }
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Failed to load data");
    }
  };

  useEffect(() => { loadBase(); }, []);
  useEffect(() => { loadTab(); }, [tab, selectedAccount, loanAccount]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "recurring", label: "Recurring" },
    { id: "tags", label: "Tags" },
    { id: "templates", label: "Templates" },
    { id: "holdings", label: "Holdings" },
    { id: "loans", label: "Loans" },
    { id: "rates", label: "Exchange Rates" },
    { id: "close", label: "Year-End Close" },
  ];

  const openRecurringModal = (rec?: RecurringTransaction) => {
    if (rec) {
      setEditingRecurring(rec);
      setRecForm({
        account_id: rec.account_id,
        payee_name: rec.payee_name ?? "",
        category_id: rec.category_id ?? "",
        amount: String(rec.amount),
        memo: rec.memo ?? "",
        frequency: rec.frequency,
        next_date: rec.next_date,
        auto_enter: rec.auto_enter,
        reminder_days: String(rec.reminder_days),
      });
    } else {
      setEditingRecurring(null);
      setRecForm({
        account_id: selectedAccount,
        payee_name: "",
        category_id: "",
        amount: "",
        memo: "",
        frequency: "monthly",
        next_date: todayIso(),
        auto_enter: false,
        reminder_days: "3",
      });
    }
    setModalOpen(true);
  };

  const saveRecurring = async () => {
    const data = {
      accountId: recForm.account_id,
      payeeName: recForm.payee_name || undefined,
      categoryId: recForm.category_id || undefined,
      amount: parseFloat(recForm.amount) || 0,
      memo: recForm.memo || undefined,
      frequency: recForm.frequency,
      nextDate: recForm.next_date,
      autoEnter: recForm.auto_enter,
      reminderDays: parseInt(recForm.reminder_days) || 0,
    };
    try {
      if (editingRecurring) {
        await db.updateRecurring(editingRecurring.id, data);
        addToast("success", "Recurring transaction updated");
      } else {
        await db.createRecurring(data);
        addToast("success", "Recurring transaction created");
      }
      setModalOpen(false);
      await loadTab();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Failed to save");
    }
  };

  const deleteRecurring = (rec: RecurringTransaction) => {
    showConfirm("Delete", `Delete recurring "${rec.payee_name || "transaction"}"?`, async () => {
      try {
        await db.deleteRecurring(rec.id);
        addToast("success", "Deleted");
        await loadTab();
      } catch (e) {
        addToast("error", e instanceof Error ? e.message : "Delete failed");
      }
    });
  };

  const enterDue = async () => {
    if (selectedRecurring.size === 0) {
      addToast("error", "Select recurring transactions to enter");
      return;
    }
    try {
      const txs = await db.enterDueRecurring([...selectedRecurring]);
      addToast("success", `Entered ${txs.length} transactions`);
      setSelectedRecurring(new Set());
      await loadTab();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Failed to enter transactions");
    }
  };

  const createTag = async () => {
    if (!tagName.trim()) return;
    try {
      await db.createTag(tagName, tagColor);
      setTagName("");
      addToast("success", "Tag created");
      await loadTab();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Failed to create tag");
    }
  };

  const deleteTag = (tag: Tag) => {
    showConfirm("Delete Tag", `Delete "${tag.name}"?`, async () => {
      try {
        await db.deleteTag(tag.id);
        await loadTab();
      } catch (e) {
        addToast("error", e instanceof Error ? e.message : "Delete failed");
      }
    });
  };

  const createTemplate = async () => {
    if (!tplForm.name.trim()) return;
    try {
      await db.createTemplate({
        name: tplForm.name,
        payee_name: tplForm.payee_name || undefined,
        category_id: tplForm.category_id || undefined,
        amount: tplForm.amount ? parseFloat(tplForm.amount) : undefined,
        memo: tplForm.memo || undefined,
      });
      setTplForm({ name: "", payee_name: "", category_id: "", amount: "", memo: "" });
      addToast("success", "Template created");
      await loadTab();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Failed to create template");
    }
  };

  const deleteTemplate = (tpl: TransactionTemplate) => {
    showConfirm("Delete Template", `Delete "${tpl.name}"?`, async () => {
      try {
        await db.deleteTemplate(tpl.id);
        await loadTab();
      } catch (e) {
        addToast("error", e instanceof Error ? e.message : "Delete failed");
      }
    });
  };

  const saveHolding = async () => {
    try {
      await db.upsertHolding({
        account_id: selectedAccount,
        symbol: holdingForm.symbol,
        shares: parseFloat(holdingForm.shares) || 0,
        cost_basis: parseFloat(holdingForm.cost_basis) || 0,
        current_price: holdingForm.current_price ? parseFloat(holdingForm.current_price) : undefined,
      });
      setHoldingForm({ symbol: "", shares: "", cost_basis: "", current_price: "" });
      addToast("success", "Holding saved");
      await loadTab();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Failed to save holding");
    }
  };

  const deleteHolding = (h: InvestmentHolding) => {
    showConfirm("Delete Holding", `Delete ${h.symbol}?`, async () => {
      try {
        await db.deleteHolding(h.id);
        await loadTab();
      } catch (e) {
        addToast("error", e instanceof Error ? e.message : "Delete failed");
      }
    });
  };

  const saveLoanDetails = async () => {
    try {
      await db.setLoanDetails({
        account_id: loanAccount,
        principal: parseFloat(loanForm.principal) || 0,
        interest_rate: parseFloat(loanForm.interest_rate) || 0,
        term_months: parseInt(loanForm.term_months) || 0,
        start_date: loanForm.start_date,
      });
      addToast("success", "Loan details saved");
      await loadTab();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Failed to save loan details");
    }
  };

  const saveRate = async () => {
    try {
      await db.setExchangeRate(
        rateForm.from_currency,
        rateForm.to_currency,
        parseFloat(rateForm.rate) || 0,
        rateForm.effective_date,
      );
      setRateForm({ ...rateForm, rate: "" });
      addToast("success", "Exchange rate saved");
      await loadTab();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : "Failed to save rate");
    }
  };

  const closeBooks = async () => {
    showConfirm("Close Books", `Close books for year ${closeYear}? This marks the year as finalized.`, async () => {
      try {
        await db.setSetting("books_closed_year", String(closeYear));
        updateSetting("books_closed_year", String(closeYear));
        addToast("success", `Books closed for ${closeYear}`);
      } catch (e) {
        addToast("error", e instanceof Error ? e.message : "Failed to close books");
      }
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Advanced</h1>

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

      {tab === "recurring" && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <button type="button" onClick={() => openRecurringModal()} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">+ Add Recurring</button>
            <button type="button" onClick={enterDue} disabled={selectedRecurring.size === 0} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50">Enter Due ({selectedRecurring.size})</button>
          </div>
          <div className="rounded-lg border border-border divide-y divide-border">
            {recurring.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No recurring transactions</p>
            ) : recurring.map((rec) => (
              <div key={rec.id} className="flex items-center gap-3 px-4 py-3">
                <input type="checkbox" checked={selectedRecurring.has(rec.id)} onChange={() => {
                  setSelectedRecurring((prev) => {
                    const next = new Set(prev);
                    if (next.has(rec.id)) next.delete(rec.id); else next.add(rec.id);
                    return next;
                  });
                }} className="rounded" />
                <div className="flex-1">
                  <p className="font-medium">{rec.payee_name || "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {FREQUENCIES.find((f) => f.value === rec.frequency)?.label} · Next: {formatDate(rec.next_date, dateFormat)}
                    {rec.auto_enter && " · Auto-enter"}
                  </p>
                </div>
                <span>{formatCurrency(rec.amount, currency, privacyMode)}</span>
                <button type="button" onClick={() => openRecurringModal(rec)} className="text-xs text-primary">Edit</button>
                <button type="button" onClick={() => deleteRecurring(rec)} className="text-xs text-destructive">Delete</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "tags" && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input type="text" value={tagName} onChange={(e) => setTagName(e.target.value)} placeholder="Tag name" className="rounded-md border border-input px-3 py-2 text-sm" />
            <input type="color" value={tagColor} onChange={(e) => setTagColor(e.target.value)} className="h-10 w-10 rounded border border-input" />
            <button type="button" onClick={createTag} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Add</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span key={tag.id} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-sm" style={{ borderColor: tag.color }}>
                {tag.name}
                <button type="button" onClick={() => deleteTag(tag)} className="text-destructive">×</button>
              </span>
            ))}
          </div>
        </div>
      )}

      {tab === "templates" && (
        <div className="space-y-4">
          <div className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2">
            <input type="text" value={tplForm.name} onChange={(e) => setTplForm({ ...tplForm, name: e.target.value })} placeholder="Template name" className="rounded-md border border-input px-3 py-2 text-sm" />
            <input type="text" value={tplForm.payee_name} onChange={(e) => setTplForm({ ...tplForm, payee_name: e.target.value })} placeholder="Payee" className="rounded-md border border-input px-3 py-2 text-sm" />
            <select value={tplForm.category_id} onChange={(e) => setTplForm({ ...tplForm, category_id: e.target.value })} className="rounded-md border border-input px-3 py-2 text-sm">
              <option value="">Category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input type="number" value={tplForm.amount} onChange={(e) => setTplForm({ ...tplForm, amount: e.target.value })} placeholder="Amount" className="rounded-md border border-input px-3 py-2 text-sm" />
            <input type="text" value={tplForm.memo} onChange={(e) => setTplForm({ ...tplForm, memo: e.target.value })} placeholder="Memo" className="rounded-md border border-input px-3 py-2 text-sm sm:col-span-2" />
            <button type="button" onClick={createTemplate} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground sm:col-span-2">Create Template</button>
          </div>
          <div className="divide-y divide-border rounded-lg border border-border">
            {templates.map((tpl) => (
              <div key={tpl.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium">{tpl.name}</p>
                  <p className="text-xs text-muted-foreground">{tpl.payee_name} {tpl.amount != null && `· ${formatCurrency(tpl.amount, currency, privacyMode)}`}</p>
                </div>
                <button type="button" onClick={() => deleteTemplate(tpl)} className="text-xs text-destructive">Delete</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "holdings" && (
        <div className="space-y-4">
          <select value={selectedAccount} onChange={(e) => setSelectedAccount(e.target.value)} className="rounded-md border border-input px-3 py-2 text-sm">
            {accounts.filter((a) => a.account_type === "investment").map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <div className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2">
            <input type="text" value={holdingForm.symbol} onChange={(e) => setHoldingForm({ ...holdingForm, symbol: e.target.value })} placeholder="Symbol" className="rounded-md border border-input px-3 py-2 text-sm" />
            <input type="number" value={holdingForm.shares} onChange={(e) => setHoldingForm({ ...holdingForm, shares: e.target.value })} placeholder="Shares" className="rounded-md border border-input px-3 py-2 text-sm" />
            <input type="number" value={holdingForm.cost_basis} onChange={(e) => setHoldingForm({ ...holdingForm, cost_basis: e.target.value })} placeholder="Cost basis" className="rounded-md border border-input px-3 py-2 text-sm" />
            <input type="number" value={holdingForm.current_price} onChange={(e) => setHoldingForm({ ...holdingForm, current_price: e.target.value })} placeholder="Current price" className="rounded-md border border-input px-3 py-2 text-sm" />
            <button type="button" onClick={saveHolding} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground sm:col-span-2">Add Holding</button>
          </div>
          <div className="divide-y divide-border rounded-lg border border-border">
            {holdings.map((h) => (
              <div key={h.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium">{h.symbol}</p>
                  <p className="text-xs text-muted-foreground">{h.shares} shares · Cost: {formatCurrency(h.cost_basis, currency, privacyMode)}</p>
                </div>
                <button type="button" onClick={() => deleteHolding(h)} className="text-xs text-destructive">Delete</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "loans" && (
        <div className="space-y-4">
          <select value={loanAccount} onChange={(e) => setLoanAccount(e.target.value)} className="rounded-md border border-input px-3 py-2 text-sm">
            {accounts.filter((a) => a.account_type === "loan").map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <div className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2">
            <input type="number" value={loanForm.principal} onChange={(e) => setLoanForm({ ...loanForm, principal: e.target.value })} placeholder="Principal" className="rounded-md border border-input px-3 py-2 text-sm" />
            <input type="number" step="0.01" value={loanForm.interest_rate} onChange={(e) => setLoanForm({ ...loanForm, interest_rate: e.target.value })} placeholder="Interest rate %" className="rounded-md border border-input px-3 py-2 text-sm" />
            <input type="number" value={loanForm.term_months} onChange={(e) => setLoanForm({ ...loanForm, term_months: e.target.value })} placeholder="Term (months)" className="rounded-md border border-input px-3 py-2 text-sm" />
            <input type="date" value={loanForm.start_date} onChange={(e) => setLoanForm({ ...loanForm, start_date: e.target.value })} className="rounded-md border border-input px-3 py-2 text-sm" />
            <button type="button" onClick={saveLoanDetails} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground sm:col-span-2">Save Loan Details</button>
          </div>
          {loanDetails && (
            <div className="rounded-lg bg-muted p-4 text-sm space-y-1">
              <p>Principal: {formatCurrency(loanDetails.principal, currency, privacyMode)}</p>
              <p>Rate: {loanDetails.interest_rate}%</p>
              <p>Term: {loanDetails.term_months} months</p>
              {loanPayment != null && <p className="font-medium">Monthly payment: {formatCurrency(loanPayment, currency, privacyMode)}</p>}
            </div>
          )}
        </div>
      )}

      {tab === "rates" && (
        <div className="space-y-4">
          <div className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2">
            <input type="text" value={rateForm.from_currency} onChange={(e) => setRateForm({ ...rateForm, from_currency: e.target.value })} placeholder="From" className="rounded-md border border-input px-3 py-2 text-sm" />
            <input type="text" value={rateForm.to_currency} onChange={(e) => setRateForm({ ...rateForm, to_currency: e.target.value })} placeholder="To" className="rounded-md border border-input px-3 py-2 text-sm" />
            <input type="number" step="0.0001" value={rateForm.rate} onChange={(e) => setRateForm({ ...rateForm, rate: e.target.value })} placeholder="Rate" className="rounded-md border border-input px-3 py-2 text-sm" />
            <input type="date" value={rateForm.effective_date} onChange={(e) => setRateForm({ ...rateForm, effective_date: e.target.value })} className="rounded-md border border-input px-3 py-2 text-sm" />
            <button type="button" onClick={saveRate} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground sm:col-span-2">Save Rate</button>
          </div>
          <div className="divide-y divide-border rounded-lg border border-border">
            {rates.map((r) => (
              <div key={r.id} className="px-4 py-3 text-sm">
                {r.from_currency}/{r.to_currency} = {r.rate} <span className="text-muted-foreground">({formatDate(r.effective_date, dateFormat)})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "close" && (
        <div className="max-w-md space-y-4 rounded-lg border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">
            Closing books marks a fiscal year as finalized. Transactions before the closed year should not be modified.
          </p>
          {settings.books_closed_year && (
            <p className="text-sm">Currently closed through: <strong>{settings.books_closed_year}</strong></p>
          )}
          <div className="flex gap-3">
            <input type="number" value={closeYear} onChange={(e) => setCloseYear(parseInt(e.target.value))} className="w-28 rounded-md border border-input px-3 py-2 text-sm" />
            <button type="button" onClick={closeBooks} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Close Books</button>
          </div>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingRecurring ? "Edit Recurring" : "New Recurring"} footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setModalOpen(false)} className="rounded-md border border-border px-4 py-2 text-sm">Cancel</button>
          <button type="button" onClick={saveRecurring} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">Save</button>
        </div>
      }>
        <div className="space-y-4">
          <select value={recForm.account_id} onChange={(e) => setRecForm({ ...recForm, account_id: e.target.value })} className="w-full rounded-md border border-input px-3 py-2 text-sm">
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <input type="text" value={recForm.payee_name} onChange={(e) => setRecForm({ ...recForm, payee_name: e.target.value })} placeholder="Payee" className="w-full rounded-md border border-input px-3 py-2 text-sm" />
          <select value={recForm.category_id} onChange={(e) => setRecForm({ ...recForm, category_id: e.target.value })} className="w-full rounded-md border border-input px-3 py-2 text-sm">
            <option value="">Category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input type="number" step="0.01" value={recForm.amount} onChange={(e) => setRecForm({ ...recForm, amount: e.target.value })} placeholder="Amount" className="w-full rounded-md border border-input px-3 py-2 text-sm" />
          <select value={recForm.frequency} onChange={(e) => setRecForm({ ...recForm, frequency: e.target.value })} className="w-full rounded-md border border-input px-3 py-2 text-sm">
            {FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
          <input type="date" value={recForm.next_date} onChange={(e) => setRecForm({ ...recForm, next_date: e.target.value })} className="w-full rounded-md border border-input px-3 py-2 text-sm" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={recForm.auto_enter} onChange={(e) => setRecForm({ ...recForm, auto_enter: e.target.checked })} className="rounded" />
            Auto-enter when due
          </label>
        </div>
      </Modal>
    </div>
  );
}
