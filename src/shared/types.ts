export interface Account {
  id: string;
  name: string;
  account_type: string;
  currency: string;
  opening_balance: number;
  institution?: string;
  is_archived: boolean;
  minimum_payment?: number;
  payment_due_day?: number;
  created_at: string;
  balance: number;
}

export interface CreateAccount {
  name: string;
  account_type: string;
  currency: string;
  opening_balance: number;
  institution?: string;
  minimum_payment?: number;
  payment_due_day?: number;
}

export interface Category {
  id: string;
  name: string;
  parent_id?: string;
  category_type: string;
  is_tax_related: boolean;
}

export interface Payee {
  id: string;
  name: string;
  default_category_id?: string;
}

export interface TransactionSplit {
  id: string;
  transaction_id: string;
  category_id?: string;
  amount: number;
  memo?: string;
}

export interface Transaction {
  id: string;
  account_id: string;
  date: string;
  payee_id?: string;
  payee_name?: string;
  category_id?: string;
  category_name?: string;
  amount: number;
  memo?: string;
  cleared: boolean;
  reconciled: boolean;
  transfer_id?: string;
  splits: TransactionSplit[];
  tags: string[];
  running_balance?: number;
}

export interface CreateTransaction {
  account_id: string;
  date: string;
  payee_name?: string;
  category_id?: string;
  amount: number;
  memo?: string;
  cleared: boolean;
  splits: CreateSplit[];
  tag_ids: string[];
}

export interface CreateSplit {
  category_id?: string;
  amount: number;
  memo?: string;
}

export interface CreateTransfer {
  from_account_id: string;
  to_account_id: string;
  date: string;
  amount: number;
  memo?: string;
  cleared: boolean;
}

export interface Budget {
  id: string;
  category_id: string;
  category_name: string;
  period: string;
  amount: number;
  spent: number;
}

export interface RecurringTransaction {
  id: string;
  account_id: string;
  payee_name?: string;
  category_id?: string;
  amount: number;
  memo?: string;
  frequency: string;
  next_date: string;
  auto_enter: boolean;
  reminder_days: number;
}

export interface Attachment {
  id: string;
  transaction_id: string;
  file_path: string;
  mime_type?: string;
}

export interface Tag {
  id: string;
  name: string;
  color?: string;
}

export interface AutoCategorizeRule {
  id: string;
  pattern: string;
  category_id: string;
  category_name: string;
}

export interface SavedFilter {
  id: string;
  name: string;
  account_id?: string;
  filter_json: string;
}

export interface TransactionTemplate {
  id: string;
  name: string;
  payee_name?: string;
  category_id?: string;
  amount?: number;
  memo?: string;
}

export interface InvestmentHolding {
  id: string;
  account_id: string;
  symbol: string;
  shares: number;
  cost_basis: number;
  current_price?: number;
}

export interface LoanDetails {
  account_id: string;
  principal: number;
  interest_rate: number;
  term_months: number;
  start_date: string;
}

export interface ExchangeRate {
  id: string;
  from_currency: string;
  to_currency: string;
  rate: number;
  effective_date: string;
}

export interface TransactionFilter {
  account_id?: string;
  date_from?: string;
  date_to?: string;
  payee?: string;
  category_id?: string;
  amount_min?: number;
  amount_max?: number;
  memo?: string;
  cleared?: boolean;
}

export interface ReconciliationSession {
  account_id: string;
  statement_date: string;
  statement_balance: number;
  cleared_total: number;
  difference: number;
}

export interface DashboardSummary {
  net_worth: number;
  monthly_income: number;
  monthly_spending: number;
  recent_transactions: Transaction[];
  upcoming_recurring: RecurringTransaction[];
  budget_alerts: Budget[];
}

export interface CategorySpending {
  category_id: string;
  category_name: string;
  amount: number;
}

export interface MonthlyFlow {
  month: string;
  income: number;
  expenses: number;
}

export interface BalancePoint {
  date: string;
  balance: number;
}

export interface ImportRow {
  date: string;
  amount: number;
  payee?: string;
  memo?: string;
  category?: string;
  is_duplicate: boolean;
}

export interface ImportPreview {
  rows: ImportRow[];
  total_rows: number;
  duplicate_count: number;
}

export interface TaxSummaryRow {
  category_name: string;
  amount: number;
}

export interface AppInitStatus {
  db_ready: boolean;
  has_accounts: boolean;
  schema_version: number;
}

export type Theme = "light" | "dark" | "system";

export type UpdateDialogPhase =
  | "idle"
  | "checking"
  | "up_to_date"
  | "downloading"
  | "installing"
  | "error";

export interface Toast {
  id: string;
  type: "success" | "error" | "info";
  message: string;
}

export interface ConfirmState {
  open: boolean;
  title: string;
  message: string;
  onConfirm?: () => void;
}
