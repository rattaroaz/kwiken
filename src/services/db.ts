import { invoke } from "@tauri-apps/api/core";
import { logger, formatDbError } from "@/lib/logger";
import type {
  Account,
  AppInitStatus,
  Attachment,
  AutoCategorizeRule,
  BalancePoint,
  Budget,
  Category,
  CategorySpending,
  CreateAccount,
  CreateTransaction,
  CreateTransfer,
  DashboardSummary,
  ExchangeRate,
  ImportPreview,
  ImportRow,
  InvestmentHolding,
  LoanDetails,
  MonthlyFlow,
  Payee,
  ReconciliationSession,
  RecurringTransaction,
  SavedFilter,
  Tag,
  TaxSummaryRow,
  Transaction,
  TransactionFilter,
  TransactionTemplate,
} from "@/shared/types";

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (e) {
    logger.db.error(`Command ${cmd} failed`, { error: String(e) });
    throw new Error(formatDbError(e));
  }
}

export const db = {
  initApp: () => call<AppInitStatus>("init_app"),
  getSchemaVersion: () => call<number>("get_schema_version"),

  listAccounts: (includeArchived = false) =>
    call<Account[]>("list_accounts", { includeArchived }),
  getAccount: (id: string) => call<Account>("get_account", { id }),
  createAccount: (input: CreateAccount) => call<Account>("create_account", { input }),
  updateAccount: (id: string, input: CreateAccount) =>
    call<Account>("update_account", { id, input }),
  deleteAccount: (id: string) => call<void>("delete_account", { id }),
  archiveAccount: (id: string, archived: boolean) =>
    call<Account>("archive_account", { id, archived }),

  listCategories: () => call<Category[]>("list_categories"),
  createCategory: (
    name: string,
    parentId: string | null,
    categoryType: string,
    isTaxRelated: boolean,
  ) => call<Category>("create_category", { name, parentId, categoryType, isTaxRelated }),
  updateCategory: (
    id: string,
    name: string,
    parentId: string | null,
    categoryType: string,
    isTaxRelated: boolean,
  ) => call<Category>("update_category", { id, name, parentId, categoryType, isTaxRelated }),
  deleteCategory: (id: string) => call<void>("delete_category", { id }),

  listPayees: () => call<Payee[]>("list_payees"),
  searchPayees: (query: string, limit = 10) =>
    call<Payee[]>("search_payees", { query, limit }),
  createPayee: (name: string, defaultCategoryId?: string) =>
    call<Payee>("create_payee", { name, defaultCategoryId }),
  updatePayee: (id: string, name: string, defaultCategoryId?: string) =>
    call<Payee>("update_payee", { id, name, defaultCategoryId }),
  deletePayee: (id: string) => call<void>("delete_payee", { id }),

  listTransactions: (filter: TransactionFilter = {}) =>
    call<Transaction[]>("list_transactions", { filter }),
  getTransaction: (id: string) => call<Transaction>("get_transaction", { id }),
  createTransaction: (input: CreateTransaction) =>
    call<Transaction>("create_transaction", { input }),
  updateTransaction: (id: string, input: CreateTransaction) =>
    call<Transaction>("update_transaction", { id, input }),
  deleteTransaction: (id: string) => call<void>("delete_transaction", { id }),
  bulkDeleteTransactions: (ids: string[]) =>
    call<void>("bulk_delete_transactions", { ids }),
  duplicateTransaction: (id: string) => call<Transaction>("duplicate_transaction", { id }),
  setTransactionCleared: (id: string, cleared: boolean) =>
    call<Transaction>("set_transaction_cleared", { id, cleared }),

  createTransfer: (input: CreateTransfer) =>
    call<Transaction[]>("create_transfer", { input }),
  updateTransferAmount: (transferId: string, amount: number) =>
    call<Transaction[]>("update_transfer_amount", { transferId, amount }),

  getReconciliationStatus: (
    accountId: string,
    statementDate: string,
    statementBalance: number,
  ) =>
    call<ReconciliationSession>("get_reconciliation_status", {
      accountId,
      statementDate,
      statementBalance,
    }),
  finishReconciliation: (accountId: string) =>
    call<void>("finish_reconciliation", { accountId }),

  listBudgets: (period: string) => call<Budget[]>("list_budgets", { period }),
  createBudget: (categoryId: string, period: string, amount: number) =>
    call<Budget>("create_budget", { categoryId, period, amount }),
  updateBudget: (id: string, amount: number) => call<Budget>("update_budget", { id, amount }),
  deleteBudget: (id: string) => call<void>("delete_budget", { id }),

  listRecurring: () => call<RecurringTransaction[]>("list_recurring"),
  createRecurring: (data: {
    accountId: string;
    payeeName?: string;
    categoryId?: string;
    amount: number;
    memo?: string;
    frequency: string;
    nextDate: string;
    autoEnter: boolean;
    reminderDays: number;
  }) => call<RecurringTransaction>("create_recurring", { ...data }),
  updateRecurring: (
    id: string,
    data: {
      accountId: string;
      payeeName?: string;
      categoryId?: string;
      amount: number;
      memo?: string;
      frequency: string;
      nextDate: string;
      autoEnter: boolean;
      reminderDays: number;
    },
  ) => call<RecurringTransaction>("update_recurring", { id, ...data }),
  deleteRecurring: (id: string) => call<void>("delete_recurring", { id }),
  enterDueRecurring: (ids: string[]) =>
    call<Transaction[]>("enter_due_recurring", { ids }),

  getSetting: (key: string) => call<string | null>("get_setting", { key }),
  setSetting: (key: string, value: string) => call<void>("set_setting", { key, value }),
  getAllSettings: () => call<Record<string, string>>("get_all_settings"),

  addAttachment: (transactionId: string, filePath: string, mimeType?: string) =>
    call<Attachment>("add_attachment", { transactionId, filePath, mimeType }),
  listAttachments: (transactionId: string) =>
    call<Attachment[]>("list_attachments", { transactionId }),
  deleteAttachment: (id: string) => call<void>("delete_attachment", { id }),

  listTags: () => call<Tag[]>("list_tags"),
  createTag: (name: string, color?: string) => call<Tag>("create_tag", { name, color }),
  deleteTag: (id: string) => call<void>("delete_tag", { id }),

  listAutoRules: () => call<AutoCategorizeRule[]>("list_auto_rules"),
  createAutoRule: (pattern: string, categoryId: string) =>
    call<AutoCategorizeRule>("create_auto_rule", { pattern, categoryId }),
  deleteAutoRule: (id: string) => call<void>("delete_auto_rule", { id }),

  listSavedFilters: () => call<SavedFilter[]>("list_saved_filters"),
  createSavedFilter: (name: string, accountId: string | null, filterJson: string) =>
    call<SavedFilter>("create_saved_filter", { name, accountId, filterJson }),
  deleteSavedFilter: (id: string) => call<void>("delete_saved_filter", { id }),

  listTemplates: () => call<TransactionTemplate[]>("list_templates"),
  createTemplate: (data: Omit<TransactionTemplate, "id">) =>
    call<TransactionTemplate>("create_template", { ...data }),
  deleteTemplate: (id: string) => call<void>("delete_template", { id }),

  listHoldings: (accountId: string) => call<InvestmentHolding[]>("list_holdings", { accountId }),
  upsertHolding: (data: Omit<InvestmentHolding, "id"> & { id?: string }) =>
    call<InvestmentHolding>("upsert_holding", { ...data }),
  deleteHolding: (id: string) => call<void>("delete_holding", { id }),

  getLoanDetails: (accountId: string) =>
    call<LoanDetails | null>("get_loan_details", { accountId }),
  setLoanDetails: (details: LoanDetails) => call<LoanDetails>("set_loan_details", { details }),
  calculateLoanPayment: (accountId: string) =>
    call<number>("calculate_loan_payment", { accountId }),

  listExchangeRates: () => call<ExchangeRate[]>("list_exchange_rates"),
  setExchangeRate: (fromCurrency: string, toCurrency: string, rate: number, effectiveDate: string) =>
    call<ExchangeRate>("set_exchange_rate", { fromCurrency, toCurrency, rate, effectiveDate }),

  getDashboardSummary: () => call<DashboardSummary>("get_dashboard_summary"),
  getSpendingByCategory: (dateFrom: string, dateTo: string) =>
    call<CategorySpending[]>("get_spending_by_category", { dateFrom, dateTo }),
  getIncomeVsExpense: (months: number) =>
    call<MonthlyFlow[]>("get_income_vs_expense", { months }),
  getCashFlow: (dateFrom: string, dateTo: string) =>
    call<MonthlyFlow[]>("get_cash_flow", { dateFrom, dateTo }),
  getBalanceHistory: (accountId: string, months: number) =>
    call<BalancePoint[]>("get_balance_history", { accountId, months }),
  getNetWorthHistory: (months: number) =>
    call<BalancePoint[]>("get_net_worth_history", { months }),
  getTaxSummary: (year: number) => call<TaxSummaryRow[]>("get_tax_summary", { year }),

  exportTransactionsCsv: (accountId?: string) =>
    call<string>("export_transactions_csv", { accountId }),
  exportAccountsCsv: () => call<string>("export_accounts_csv"),
  exportCategoriesCsv: () => call<string>("export_categories_csv"),
  previewCsvImport: (csvContent: string, accountId: string) =>
    call<ImportPreview>("preview_csv_import", { csvContent, accountId }),
  commitCsvImport: (rows: ImportRow[], accountId: string) =>
    call<number>("commit_csv_import", { rows, accountId }),
  previewQifImport: (qifContent: string, accountId: string) =>
    call<ImportPreview>("preview_qif_import", { qifContent, accountId }),
  commitQifImport: (qifContent: string, accountId: string) =>
    call<number>("commit_qif_import", { qifContent, accountId }),
  previewOfxImport: (ofxContent: string, accountId: string) =>
    call<ImportPreview>("preview_ofx_import", { ofxContent, accountId }),
  commitOfxImport: (ofxContent: string, accountId: string) =>
    call<number>("commit_ofx_import", { ofxContent, accountId }),

  backupDatabase: (destPath: string) => call<void>("backup_database", { destPath }),
  restoreDatabase: (srcPath: string) => call<void>("restore_database", { srcPath }),

  setMasterPassword: (password: string) => call<void>("set_master_password", { password }),
  verifyMasterPassword: (password: string) => call<boolean>("verify_master_password", { password }),
  hasMasterPassword: () => call<boolean>("has_master_password"),
  lockApp: () => call<void>("lock_app"),
  unlockApp: (password: string) => call<boolean>("unlock_app", { password }),
  isAppLocked: () => call<boolean>("is_app_locked"),
};
