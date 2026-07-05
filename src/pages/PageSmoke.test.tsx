import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import DashboardPage from "./DashboardPage";
import AccountsPage from "./AccountsPage";
import AccountDetailPage from "./AccountDetailPage";
import CategoriesPage from "./CategoriesPage";
import BudgetsPage from "./BudgetsPage";
import ReportsPage from "./ReportsPage";
import ImportExportPage from "./ImportExportPage";
import AdvancedPage from "./AdvancedPage";
import SettingsPage from "./SettingsPage";
import SetupWizard from "./SetupWizard";
import { useDataStore, useSecurityStore, useUiStore } from "@/stores/index";

const mocks = vi.hoisted(() => {
  const account = {
    id: "acct-1",
    name: "Checking",
    account_type: "checking",
    currency: "USD",
    opening_balance: 1000,
    balance: 925,
    institution: "Bank",
    is_archived: false,
    created_at: "2026-01-01T00:00:00Z",
  };
  const category = {
    id: "cat-1",
    name: "Food",
    parent_id: null,
    category_type: "expense",
    is_tax_related: false,
  };
  const transaction = {
    id: "tx-1",
    account_id: account.id,
    date: "2026-01-02",
    amount: -75,
    payee_name: "Grocer",
    category_name: "Food",
    memo: "Weekly groceries",
    cleared: false,
    reconciled: false,
    splits: [],
    tags: [],
    running_balance: 925,
  };

  return {
    db: {
      listAccounts: vi.fn(async () => [account]),
      getAccount: vi.fn(async () => account),
      createAccount: vi.fn(async () => account),
      updateAccount: vi.fn(async () => account),
      deleteAccount: vi.fn(async () => undefined),
      archiveAccount: vi.fn(async () => account),
      listCategories: vi.fn(async () => [category]),
      createCategory: vi.fn(async () => category),
      updateCategory: vi.fn(async () => category),
      deleteCategory: vi.fn(async () => undefined),
      listAutoRules: vi.fn(async () => []),
      createAutoRule: vi.fn(async () => ({
        id: "rule-1",
        pattern: "coffee",
        category_id: category.id,
        category_name: category.name,
        target_field: "payee",
        match_type: "contains",
        priority: 100,
        enabled: true,
      })),
      deleteAutoRule: vi.fn(async () => undefined),
      applyAutoRulesToTransactions: vi.fn(async () => 0),
      getAccountRegister: vi.fn(async () => ({
        account,
        transactions: [transaction],
        total_count: 1,
        saved_filters: [],
      })),
      listTransactions: vi.fn(async () => [transaction]),
      deleteTransaction: vi.fn(async () => undefined),
      bulkDeleteTransactions: vi.fn(async () => undefined),
      duplicateTransaction: vi.fn(async () => transaction),
      setTransactionCleared: vi.fn(async () => ({ ...transaction, cleared: true })),
      createTransfer: vi.fn(async () => []),
      getReconciliationStatus: vi.fn(async () => ({
        account_id: account.id,
        statement_date: "2026-01-31",
        statement_balance: 925,
        cleared_balance: 925,
        difference: 0,
        transactions: [transaction],
      })),
      finishReconciliation: vi.fn(async () => undefined),
      createSavedFilter: vi.fn(async () => ({ id: "filter-1", name: "Food", account_id: account.id, filter_json: "{}" })),
      listSavedFilters: vi.fn(async () => []),
      listBudgets: vi.fn(async () => [
        { id: "budget-1", category_id: category.id, category_name: "Food", period: "2026-01", amount: 500, spent: 75 },
      ]),
      createBudget: vi.fn(async () => ({ id: "budget-1", category_id: category.id, period: "2026-01", amount: 500, spent: 75 })),
      updateBudget: vi.fn(async () => undefined),
      deleteBudget: vi.fn(async () => undefined),
      getDashboardSummary: vi.fn(async () => ({
        net_worth: 925,
        monthly_income: 1000,
        monthly_spending: -75,
        recent_transactions: [transaction],
        upcoming_recurring: [],
        budget_alerts: [
          { id: "budget-1", category_id: category.id, category_name: "Food", amount: 500, spent: 75 },
        ],
      })),
      getSpendingByCategory: vi.fn(async () => [{ category_id: category.id, category_name: "Food", amount: 75 }]),
      getIncomeVsExpense: vi.fn(async () => [{ month: "2026-01", income: 1000, expenses: 75 }]),
      getCashFlow: vi.fn(async () => [{ month: "2026-01", income: 1000, expenses: 75 }]),
      getBalanceHistory: vi.fn(async () => [{ date: "2026-01-01", balance: 1000 }]),
      getNetWorthHistory: vi.fn(async () => [{ date: "2026-01-01", balance: 925 }]),
      getTaxSummary: vi.fn(async () => []),
      previewCsvImport: vi.fn(async () => ({
        rows: [{ date: "2026-01-01", amount: -10, payee: "Coffee", is_duplicate: false }],
        total_rows: 1,
        duplicate_count: 0,
      })),
      previewQifImport: vi.fn(async () => ({ rows: [], total_rows: 0, duplicate_count: 0 })),
      previewOfxImport: vi.fn(async () => ({ rows: [], total_rows: 0, duplicate_count: 0 })),
      commitCsvImport: vi.fn(async () => 1),
      commitQifImport: vi.fn(async () => 0),
      commitOfxImport: vi.fn(async () => 0),
      exportTransactionsCsv: vi.fn(async () => "date,amount"),
      exportAccountsCsv: vi.fn(async () => "name,balance"),
      exportCategoriesCsv: vi.fn(async () => "name,type"),
      backupDatabase: vi.fn(async () => undefined),
      restoreDatabase: vi.fn(async () => undefined),
      listRecurring: vi.fn(async () => []),
      createRecurring: vi.fn(async () => undefined),
      updateRecurring: vi.fn(async () => undefined),
      deleteRecurring: vi.fn(async () => undefined),
      enterDueRecurring: vi.fn(async () => []),
      listTags: vi.fn(async () => []),
      createTag: vi.fn(async () => ({ id: "tag-1", name: "Tax", color: "#2563eb" })),
      deleteTag: vi.fn(async () => undefined),
      listTemplates: vi.fn(async () => []),
      createTemplate: vi.fn(async () => undefined),
      deleteTemplate: vi.fn(async () => undefined),
      listHoldings: vi.fn(async () => []),
      upsertHolding: vi.fn(async () => undefined),
      deleteHolding: vi.fn(async () => undefined),
      getLoanDetails: vi.fn(async () => null),
      setLoanDetails: vi.fn(async () => undefined),
      calculateLoanPayment: vi.fn(async () => 250),
      listExchangeRates: vi.fn(async () => []),
      setExchangeRate: vi.fn(async () => undefined),
      setSetting: vi.fn(async () => undefined),
      getAllSettings: vi.fn(async () => ({ currency: "USD", theme: "light" })),
      setMasterPassword: vi.fn(async () => undefined),
      lockApp: vi.fn(async () => undefined),
      createTransaction: vi.fn(async () => transaction),
      updateTransaction: vi.fn(async () => transaction),
      listAttachments: vi.fn(async () => []),
      addAttachment: vi.fn(async () => ({
        id: "att-1",
        transaction_id: transaction.id,
        file_path: "C:\\e2e\\receipt.pdf",
      })),
      deleteAttachment: vi.fn(async () => undefined),
      getLogsDirectory: vi.fn(async () => "C:\\e2e\\logs"),
      appendFrontendLog: vi.fn(async () => undefined),
      readFrontendLogTail: vi.fn(async () => []),
      getDiagnosticSnapshot: vi.fn(async () => ({
        app_version: "2.6.0",
        schema_version: 2,
        db_ready: true,
        db_corrupt: false,
        unclean_shutdown: false,
        has_accounts: true,
        account_count: 1,
        logs_directory: "C:\\e2e\\logs",
        frontend_log_file: "C:\\e2e\\logs\\kwiken-frontend.log",
        rust_log_file: "C:\\e2e\\logs\\kwiken-rust.log",
      })),
    },
  };
});

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(async () => "C:\\e2e\\input.csv"),
  save: vi.fn(async () => "C:\\e2e\\backup.db"),
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  readTextFile: vi.fn(async () => "date,amount,payee\n2026-01-01,-10.00,Coffee"),
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn(async () => undefined),
  openPath: vi.fn(async () => undefined),
  revealItemInDir: vi.fn(async () => undefined),
}));

vi.mock("@/services/updateService", () => ({
  checkForUpdatesAndApply: vi.fn(async () => undefined),
}));

vi.mock("@/services/db", () => ({
  db: mocks.db,
}));

function renderRoute(ui: ReactNode, initialEntries = ["/"]) {
  return render(<MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
  useDataStore.setState({
    initialized: true,
    hasAccounts: true,
    settings: { currency: "USD", date_format: "MM/dd/yyyy", theme: "light" },
  });
  useSecurityStore.setState({
    hasMasterPassword: false,
    isLocked: false,
    privacyMode: false,
    lastActivity: Date.now(),
  });
  useUiStore.setState({
    theme: "light",
    toasts: [],
    confirm: { open: false, title: "", message: "" },
    hasUnsavedChanges: false,
    showUpdateDialog: false,
    updatePhase: "idle",
    updateMessage: "",
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("page smoke coverage", () => {
  it("renders dashboard data", async () => {
    renderRoute(<DashboardPage />);
    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("Net Worth")).toBeInTheDocument();
  });

  it("renders accounts", async () => {
    renderRoute(<AccountsPage />);
    expect(await screen.findByRole("heading", { name: "Accounts" })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Checking" })).toBeInTheDocument();
  });

  it("renders account register", async () => {
    renderRoute(
      <Routes>
        <Route path="/accounts/:id" element={<AccountDetailPage />} />
      </Routes>,
      ["/accounts/acct-1"],
    );
    expect(await screen.findByText("Grocer")).toBeInTheDocument();
    expect(screen.getByTestId("transaction-register")).toBeInTheDocument();
  });

  it("renders categories and rules", async () => {
    renderRoute(<CategoriesPage />);
    expect(await screen.findByRole("heading", { name: "Categories" })).toBeInTheDocument();
    expect(await screen.findByText("Food")).toBeInTheDocument();
  });

  it("renders budgets", async () => {
    renderRoute(<BudgetsPage />);
    expect(await screen.findByRole("heading", { name: "Budgets" })).toBeInTheDocument();
    expect(await screen.findByText("Food")).toBeInTheDocument();
  });

  it("renders reports controls", async () => {
    renderRoute(<ReportsPage />);
    expect(await screen.findByRole("heading", { name: "Reports" })).toBeInTheDocument();
    expect(await screen.findByText("Food")).toBeInTheDocument();
  });

  it("renders import/export sections", async () => {
    renderRoute(<ImportExportPage />);
    expect(await screen.findByRole("heading", { name: "Import / Export" })).toBeInTheDocument();
    expect(screen.getByText("Backup & Restore")).toBeInTheDocument();
  });

  it("renders advanced tools", async () => {
    renderRoute(<AdvancedPage />);
    expect(await screen.findByRole("heading", { name: "Advanced" })).toBeInTheDocument();
    expect(await screen.findByText("Recurring")).toBeInTheDocument();
  });

  it("renders settings", async () => {
    renderRoute(<SettingsPage />);
    expect(await screen.findByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(await screen.findByText("Security")).toBeInTheDocument();
  });

  it("renders setup wizard", () => {
    renderRoute(<SetupWizard />);
    expect(screen.getByTestId("setup-wizard")).toBeInTheDocument();
    expect(screen.getByText("Welcome to Kwiken")).toBeInTheDocument();
  });
});
