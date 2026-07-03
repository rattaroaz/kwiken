import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "@/services/db";
import { useUiStore } from "@/stores/index";
import { cn } from "@/lib/utils";
import type { Account, Category, Payee, Transaction } from "@/shared/types";

interface CommandItem {
  id: string;
  label: string;
  path: string;
  keywords: string;
  group: string;
  description?: string;
}

const COMMANDS: CommandItem[] = [
  { id: "dashboard", label: "Dashboard", path: "/", keywords: "home overview", group: "Pages" },
  { id: "accounts", label: "Accounts", path: "/accounts", keywords: "bank checking savings", group: "Pages" },
  { id: "categories", label: "Categories", path: "/categories", keywords: "tags organize", group: "Pages" },
  { id: "budgets", label: "Budgets", path: "/budgets", keywords: "spending limits", group: "Pages" },
  { id: "reports", label: "Reports", path: "/reports", keywords: "charts analytics", group: "Pages" },
  { id: "import", label: "Import / Export", path: "/import-export", keywords: "csv qif ofx backup", group: "Pages" },
  { id: "advanced", label: "Advanced", path: "/advanced", keywords: "recurring templates loans", group: "Pages" },
  { id: "settings", label: "Settings", path: "/settings", keywords: "preferences config", group: "Pages" },
];

function matches(item: CommandItem, query: string) {
  const q = query.toLowerCase().trim();
  return (
    item.label.toLowerCase().includes(q) ||
    item.keywords.toLowerCase().includes(q) ||
    (item.description?.toLowerCase().includes(q) ?? false)
  );
}

function accountItem(account: Account): CommandItem {
  return {
    id: `account-${account.id}`,
    label: account.name,
    path: `/accounts/${account.id}`,
    keywords: `${account.account_type} ${account.institution ?? ""} ${account.currency}`,
    group: "Accounts",
    description: `${account.account_type} account`,
  };
}

function categoryItem(category: Category): CommandItem {
  return {
    id: `category-${category.id}`,
    label: category.name,
    path: "/categories",
    keywords: `${category.category_type} ${category.is_tax_related ? "tax" : ""}`,
    group: "Categories",
    description: category.category_type,
  };
}

function payeeItem(payee: Payee): CommandItem {
  return {
    id: `payee-${payee.id}`,
    label: payee.name,
    path: "/accounts",
    keywords: payee.default_category_id ?? "",
    group: "Payees",
    description: "Payee",
  };
}

function transactionItem(tx: Transaction): CommandItem {
  return {
    id: `transaction-${tx.id}`,
    label: tx.payee_name || tx.memo || "Transaction",
    path: `/accounts/${tx.account_id}`,
    keywords: `${tx.date} ${tx.category_name ?? ""} ${tx.memo ?? ""} ${tx.amount}`,
    group: "Transactions",
    description: `${tx.date} · ${tx.category_name ?? "Uncategorized"} · ${tx.amount.toFixed(2)}`,
  };
}

export default function CommandPalette() {
  const open = useUiStore((s) => s.commandPaletteOpen);
  const closeCommandPalette = useUiStore((s) => s.closeCommandPalette);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [searchItems, setSearchItems] = useState<CommandItem[]>([]);
  const [searching, setSearching] = useState(false);
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return COMMANDS;
    const routeMatches = COMMANDS.filter((c) => matches(c, q));
    return [...routeMatches, ...searchItems].slice(0, 30);
  }, [query, searchItems]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      setSearchItems([]);
    }
  }, [open]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  useEffect(() => {
    const q = query.trim();
    if (!open || q.length < 2) {
      setSearchItems([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const [accounts, categories, payees, payeeTransactions, memoTransactions] = await Promise.all([
          db.listAccounts(true),
          db.listCategories(),
          db.searchPayees(q, 8),
          db.listTransactions({ payee: q, limit: 8 }),
          db.listTransactions({ memo: q, limit: 8 }),
        ]);
        if (cancelled) return;

        const seen = new Set<string>();
        const txMatches = [...payeeTransactions, ...memoTransactions].filter((tx) => {
          if (seen.has(tx.id)) return false;
          seen.add(tx.id);
          return true;
        });

        setSearchItems([
          ...accounts.filter((a) => matches(accountItem(a), q)).slice(0, 8).map(accountItem),
          ...categories.filter((c) => matches(categoryItem(c), q)).slice(0, 8).map(categoryItem),
          ...payees.map(payeeItem),
          ...txMatches.slice(0, 10).map(transactionItem),
        ]);
      } catch {
        if (!cancelled) setSearchItems([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 150);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, query]);

  const select = (item: CommandItem) => {
    navigate(item.path);
    closeCommandPalette();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter" && filtered[selected]) {
      e.preventDefault();
      select(filtered[selected]);
    } else if (e.key === "Escape") {
      closeCommandPalette();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-start justify-center pt-[20vh]">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeCommandPalette} />
      <div className="relative z-10 w-full max-w-lg rounded-lg border border-border bg-card shadow-2xl">
        <div className="flex items-center gap-2 border-b border-border px-4">
          <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search pages, accounts, payees, categories, transactions…"
            autoFocus
            className="flex-1 bg-transparent py-3 text-sm outline-none"
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">Esc</kbd>
        </div>
        <ul className="max-h-64 overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-sm text-muted-foreground">No results</li>
          ) : (
            filtered.map((item, i) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => select(item)}
                  className={cn(
                    "flex w-full items-center px-4 py-2.5 text-left text-sm",
                    i === selected ? "bg-accent text-accent-foreground" : "hover:bg-muted",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{item.label}</span>
                    {item.description && (
                      <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
                    )}
                  </span>
                  <span className="ml-3 shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {item.group}
                  </span>
                </button>
              </li>
            ))
          )}
          {searching && <li className="px-4 py-2 text-xs text-muted-foreground">Searching…</li>}
        </ul>
      </div>
    </div>
  );
}
