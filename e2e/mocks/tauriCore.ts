type Json = Record<string, unknown>;

interface MockAccount {
  id: string;
  name: string;
  account_type: string;
  currency: string;
  opening_balance: number;
  balance: number;
  institution?: string;
  is_archived: boolean;
  created_at: string;
}

interface MockTransaction {
  id: string;
  account_id: string;
  date: string;
  amount: number;
  payee_name?: string;
  category_name?: string;
  memo?: string;
  cleared: boolean;
  reconciled: boolean;
  splits: [];
  tags: [];
  running_balance?: number;
}

interface E2EStore {
  settings: Record<string, string>;
  accounts: MockAccount[];
  transactions: MockTransaction[];
  categories: Array<{
    id: string;
    name: string;
    parent_id?: string;
    category_type: string;
    is_tax_related: boolean;
  }>;
}

function getStore(): E2EStore {
  const root = globalThis as typeof globalThis & { __kwikenE2EStore?: E2EStore };
  if (!root.__kwikenE2EStore) {
    root.__kwikenE2EStore = {
      settings: { theme: "light", currency: "USD", date_format: "MM/dd/yyyy" },
      accounts: [],
      transactions: [],
      categories: [
        { id: "cat-food", name: "Food & Dining", category_type: "expense", is_tax_related: false },
        { id: "cat-grocery", name: "Groceries", parent_id: "cat-food", category_type: "expense", is_tax_related: false },
      ],
    };
    seedDefaultData(root.__kwikenE2EStore);
  }
  return root.__kwikenE2EStore;
}

const store = getStore();

function seedDefaultData(target: E2EStore) {
  if (target.accounts.length > 0) return;
  const accountId = "e2e-default-account";
  target.accounts.push({
    id: accountId,
    name: "E2E Checking",
    account_type: "checking",
    currency: "USD",
    opening_balance: 1000,
    balance: 957.5,
    is_archived: false,
    created_at: "2024-01-01T00:00:00Z",
  });
  target.transactions.push({
    id: "e2e-tx-1",
    account_id: accountId,
    date: "2026-06-15",
    amount: -42.5,
    payee_name: "Grocery",
    category_name: "Groceries",
    cleared: true,
    reconciled: false,
    splits: [],
    tags: [],
    running_balance: 957.5,
  });
}

function uid(): string {
  return crypto.randomUUID();
}

function recalcBalances(accountId: string) {
  const account = store.accounts.find((a) => a.id === accountId);
  if (!account) return;
  const txs = store.transactions
    .filter((t) => t.account_id === accountId)
    .sort((a, b) => a.date.localeCompare(b.date));
  let balance = account.opening_balance;
  for (const tx of txs) {
    balance += tx.amount;
    tx.running_balance = balance;
  }
  account.balance = balance;
}

function spendingByCategory(dateFrom: string, dateTo: string) {
  const totals = new Map<string, { category_id: string; category_name: string; amount: number }>();
  for (const tx of store.transactions) {
    if (tx.date < dateFrom || tx.date > dateTo || tx.amount >= 0) continue;
    const key = tx.category_name ?? "Uncategorized";
    const existing = totals.get(key) ?? { category_id: key, category_name: key, amount: 0 };
    existing.amount += Math.abs(tx.amount);
    totals.set(key, existing);
  }
  return Array.from(totals.values());
}

export class Resource {
  async close(): Promise<void> {}
}

export class Channel<T = unknown> {
  onmessage: ((response: T) => void) | undefined;
}

export async function invoke<T>(cmd: string, args?: Json): Promise<T> {
  switch (cmd) {
    case "init_app":
      return {
        db_ready: true,
        has_accounts: store.accounts.length > 0,
        schema_version: 1,
        db_corrupt: false,
        unclean_shutdown: false,
      } as T;

    case "get_all_settings":
      return { ...store.settings } as T;

    case "set_setting": {
      const key = String(args?.key ?? "");
      const value = String(args?.value ?? "");
      store.settings[key] = value;
      return undefined as T;
    }

    case "has_master_password":
    case "is_app_locked":
      return false as T;

    case "list_accounts":
      return store.accounts.filter((a) => !a.is_archived) as T;

    case "get_account": {
      const id = String(args?.id);
      const account = store.accounts.find((a) => a.id === id);
      if (!account) throw new Error("Account not found");
      return account as T;
    }

    case "create_account": {
      const input = (args?.input ?? {}) as Json;
      const account: MockAccount = {
        id: uid(),
        name: String(input.name ?? "Account"),
        account_type: String(input.account_type ?? "checking"),
        currency: String(input.currency ?? "USD"),
        opening_balance: Number(input.opening_balance ?? 0),
        balance: Number(input.opening_balance ?? 0),
        institution: input.institution ? String(input.institution) : undefined,
        is_archived: false,
        created_at: new Date().toISOString(),
      };
      store.accounts.push(account);
      return account as T;
    }

    case "get_account_register": {
      const accountId = String(args?.accountId);
      const filter = (args?.filter ?? {}) as Json;
      const account = store.accounts.find((a) => a.id === accountId);
      if (!account) throw new Error("Account not found");
      recalcBalances(accountId);
      let txs = store.transactions.filter((t) => t.account_id === accountId);
      if (filter.payee) {
        const q = String(filter.payee).toLowerCase();
        txs = txs.filter((t) => t.payee_name?.toLowerCase().includes(q));
      }
      const total = txs.length;
      const offset = Number(filter.offset ?? 0);
      const limit = Number(filter.limit ?? 100);
      txs = txs.slice(offset, offset + limit);
      return {
        account,
        transactions: txs,
        total_count: total,
        saved_filters: [],
      } as T;
    }

    case "list_transactions": {
      const filter = (args?.filter ?? {}) as Json;
      const accountId = String(filter.account_id ?? "");
      recalcBalances(accountId);
      return store.transactions.filter((t) => t.account_id === accountId) as T;
    }

    case "create_transaction": {
      const input = (args?.input ?? {}) as Json;
      const tx: MockTransaction = {
        id: uid(),
        account_id: String(input.account_id),
        date: String(input.date),
        amount: Number(input.amount),
        payee_name: input.payee_name ? String(input.payee_name) : undefined,
        category_name: "Groceries",
        memo: input.memo ? String(input.memo) : undefined,
        cleared: Boolean(input.cleared),
        reconciled: false,
        splits: [],
        tags: [],
      };
      store.transactions.push(tx);
      recalcBalances(tx.account_id);
      return tx as T;
    }

    case "list_categories":
      return store.categories as T;

    case "get_spending_by_category": {
      const dateFrom = String(args?.dateFrom ?? args?.date_from ?? "");
      const dateTo = String(args?.dateTo ?? args?.date_to ?? "");
      return spendingByCategory(dateFrom, dateTo) as T;
    }

    case "get_income_vs_expense":
    case "get_cash_flow":
      return [{ month: "2024-01", income: 1000, expenses: 400 }] as T;

    case "get_balance_history":
    case "get_net_worth_history":
      return [{ date: "2024-01-01", balance: 1000 }] as T;

    case "get_tax_summary":
      return [] as T;

    case "get_dashboard_summary":
      return {
        net_worth: store.accounts.reduce((s, a) => s + a.balance, 0),
        monthly_income: 0,
        monthly_spending: 0,
        recent_transactions: store.transactions.slice(-5),
        upcoming_recurring: [],
        budget_alerts: [],
      } as T;

    case "mark_clean_shutdown_cmd":
      return undefined as T;

    default:
      throw new Error(`E2E mock: unhandled command ${cmd}`);
  }
}
