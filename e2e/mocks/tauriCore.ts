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

interface MockAttachment {
  id: string;
  transaction_id: string;
  file_path: string;
  mime_type?: string;
}

interface MockRule {
  id: string;
  pattern: string;
  category_id: string;
  category_name: string;
  target_field: "payee" | "memo" | "payee_or_memo";
  match_type: "contains" | "starts_with" | "equals";
  priority: number;
  enabled: boolean;
}

interface E2EStore {
  settings: Record<string, string>;
  accounts: MockAccount[];
  transactions: MockTransaction[];
  attachments: MockAttachment[];
  rules: MockRule[];
  categories: Array<{
    id: string;
    name: string;
    parent_id?: string;
    category_type: string;
    is_tax_related: boolean;
  }>;
  security: {
    hasMasterPassword: boolean;
    isLocked: boolean;
    password: string;
  };
}

function readSecurityOverride(): Partial<E2EStore["security"]> | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem("e2e-security");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Partial<E2EStore["security"]>;
  } catch {
    return null;
  }
}

function getStore(): E2EStore {
  const root = globalThis as typeof globalThis & { __kwikenE2EStore?: E2EStore };
  if (!root.__kwikenE2EStore) {
    root.__kwikenE2EStore = {
      settings: { theme: "light", currency: "USD", date_format: "MM/dd/yyyy" },
      accounts: [],
      transactions: [],
      attachments: [],
      rules: [],
      categories: [
        { id: "cat-food", name: "Food & Dining", category_type: "expense", is_tax_related: false },
        { id: "cat-grocery", name: "Groceries", parent_id: "cat-food", category_type: "expense", is_tax_related: false },
      ],
      security: {
        hasMasterPassword: false,
        isLocked: false,
        password: "secret",
      },
    };
    seedDefaultData(root.__kwikenE2EStore);
  }
  const override = readSecurityOverride();
  if (override) {
    root.__kwikenE2EStore.security = {
      ...root.__kwikenE2EStore.security,
      ...override,
    };
  }
  return root.__kwikenE2EStore;
}

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
  // Keep within ReportsPage's default range (last ~30 days → today).
  const recent = new Date();
  recent.setDate(recent.getDate() - 7);
  target.transactions.push({
    id: "e2e-tx-1",
    account_id: accountId,
    date: recent.toISOString().slice(0, 10),
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
  const store = getStore();
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

interface ImportRowMock {
  date: string;
  amount: number;
  payee?: string;
  memo?: string;
  category?: string;
  is_duplicate: boolean;
}

function parseCsvPreview(content: string): ImportRowMock[] {
  const lines = content.trim().split("\n");
  if (lines.length === 0) return [];
  const start = lines[0].toLowerCase().includes("date") ? 1 : 0;
  const rows: ImportRowMock[] = [];
  for (const line of lines.slice(start)) {
    if (!line.trim()) continue;
    const fields = line.split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
    if (fields.length < 2) continue;
    rows.push({
      date: fields[0],
      amount: Number(fields[1]),
      payee: fields[2] || undefined,
      memo: fields[3] || undefined,
      category: fields[4] || undefined,
      is_duplicate: false,
    });
  }
  return rows;
}

function ruleMatches(rule: MockRule, tx: MockTransaction): boolean {
  const needle = rule.pattern.trim().toLowerCase();
  const payee = (tx.payee_name ?? "").toLowerCase();
  const memo = (tx.memo ?? "").toLowerCase();
  const values =
    rule.target_field === "memo"
      ? [memo]
      : rule.target_field === "payee_or_memo"
        ? [payee, memo]
        : [payee];
  return values.some((value) => {
    if (rule.match_type === "starts_with") return value.startsWith(needle);
    if (rule.match_type === "equals") return value === needle;
    return value.includes(needle);
  });
}

function spendingByCategory(dateFrom: string, dateTo: string) {
  const store = getStore();
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

export async function invoke<T>(cmd: string, args?: Json): Promise<T> {
  const store = getStore();
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
      return store.security.hasMasterPassword as T;

    case "is_app_locked":
      return store.security.isLocked as T;

    case "unlock_app": {
      const password = String(args?.password ?? "");
      const ok = password === store.security.password;
      if (ok) store.security.isLocked = false;
      return ok as T;
    }

    case "lock_app":
      store.security.isLocked = true;
      return undefined as T;

    case "set_master_password":
      store.security.hasMasterPassword = true;
      store.security.password = String(args?.password ?? store.security.password);
      return undefined as T;

    case "preview_csv_import": {
      const content = String(args?.csvContent ?? "");
      const accountId = String(args?.accountId ?? "");
      const rows = parseCsvPreview(content);
      for (const row of rows) {
        row.is_duplicate = store.transactions.some(
          (t) =>
            t.account_id === accountId &&
            t.date === row.date &&
            Math.abs(t.amount - row.amount) < 0.001 &&
            (t.payee_name ?? "") === (row.payee ?? ""),
        );
      }
      const duplicate_count = rows.filter((r) => r.is_duplicate).length;
      return { rows, total_rows: rows.length, duplicate_count } as T;
    }

    case "commit_csv_import": {
      const rows = (args?.rows ?? []) as ImportRowMock[];
      const accountId = String(args?.accountId ?? "");
      let count = 0;
      for (const row of rows) {
        if (row.is_duplicate) continue;
        store.transactions.push({
          id: uid(),
          account_id: accountId,
          date: row.date,
          amount: row.amount,
          payee_name: row.payee,
          category_name: row.category,
          memo: row.memo,
          cleared: false,
          reconciled: false,
          splits: [],
          tags: [],
        });
        count += 1;
      }
      recalcBalances(accountId);
      return count as T;
    }

    case "backup_database":
    case "restore_database":
      return undefined as T;

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
      const accountId = filter.account_id ? String(filter.account_id) : "";
      if (accountId) recalcBalances(accountId);
      let txs = accountId
        ? store.transactions.filter((t) => t.account_id === accountId)
        : [...store.transactions];
      if (filter.payee) {
        const q = String(filter.payee).toLowerCase();
        txs = txs.filter((t) => t.payee_name?.toLowerCase().includes(q));
      }
      if (filter.memo) {
        const q = String(filter.memo).toLowerCase();
        txs = txs.filter((t) => t.memo?.toLowerCase().includes(q));
      }
      const limit = Number(filter.limit ?? txs.length);
      return txs.slice(0, limit) as T;
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

    case "search_payees": {
      const query = String(args?.query ?? "").toLowerCase();
      const limit = Number(args?.limit ?? 10);
      const names = Array.from(new Set(store.transactions.map((tx) => tx.payee_name).filter(Boolean) as string[]));
      return names
        .filter((name) => name.toLowerCase().includes(query))
        .slice(0, limit)
        .map((name) => ({ id: name, name })) as T;
    }

    case "list_auto_rules":
      return store.rules as T;

    case "create_auto_rule": {
      const categoryId = String(args?.categoryId ?? "");
      const category = store.categories.find((c) => c.id === categoryId);
      const rule: MockRule = {
        id: uid(),
        pattern: String(args?.pattern ?? ""),
        category_id: categoryId,
        category_name: category?.name ?? "Category",
        target_field: (args?.targetField as MockRule["target_field"]) ?? "payee",
        match_type: (args?.matchType as MockRule["match_type"]) ?? "contains",
        priority: Number(args?.priority ?? 100),
        enabled: Boolean(args?.enabled ?? true),
      };
      store.rules.push(rule);
      return rule as T;
    }

    case "delete_auto_rule":
      store.rules = store.rules.filter((rule) => rule.id !== String(args?.id ?? ""));
      return undefined as T;

    case "apply_auto_rules_to_transactions": {
      const overwrite = Boolean(args?.overwrite);
      let count = 0;
      const rules = [...store.rules].filter((rule) => rule.enabled).sort((a, b) => a.priority - b.priority);
      for (const tx of store.transactions) {
        if (!overwrite && tx.category_name) continue;
        const rule = rules.find((candidate) => ruleMatches(candidate, tx));
        if (!rule) continue;
        tx.category_name = rule.category_name;
        count += 1;
      }
      return count as T;
    }

    case "add_attachment": {
      const attachment: MockAttachment = {
        id: uid(),
        transaction_id: String(args?.transactionId ?? ""),
        file_path: String(args?.filePath ?? ""),
        mime_type: args?.mimeType ? String(args.mimeType) : undefined,
      };
      store.attachments.push(attachment);
      return attachment as T;
    }

    case "list_attachments":
      return store.attachments.filter((item) => item.transaction_id === String(args?.transactionId ?? "")) as T;

    case "delete_attachment":
      store.attachments = store.attachments.filter((item) => item.id !== String(args?.id ?? ""));
      return undefined as T;

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

    case "get_logs_directory":
      return "C:\\e2e\\logs" as T;

    case "append_frontend_log":
      return undefined as T;

    case "read_frontend_log_tail":
      return "" as T;

    case "get_diagnostic_snapshot":
      return {
        app_version: "2.7.2",
        schema_version: 1,
        db_ready: true,
        db_corrupt: false,
        unclean_shutdown: false,
        has_accounts: store.accounts.length > 0,
        account_count: store.accounts.length,
        logs_directory: "C:\\e2e\\logs",
        frontend_log_file: "C:\\e2e\\logs\\kwiken-frontend.log",
        rust_log_file: "C:\\e2e\\logs\\kwiken-rust.log",
      } as T;

    default:
      throw new Error(`E2E mock: unhandled command ${cmd}`);
  }
}
