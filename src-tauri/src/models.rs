use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Account {
    pub id: String,
    pub name: String,
    pub account_type: String,
    pub currency: String,
    pub opening_balance: f64,
    pub institution: Option<String>,
    pub is_archived: bool,
    pub minimum_payment: Option<f64>,
    pub payment_due_day: Option<i32>,
    pub created_at: String,
    pub balance: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateAccount {
    pub name: String,
    pub account_type: String,
    pub currency: String,
    pub opening_balance: f64,
    pub institution: Option<String>,
    pub minimum_payment: Option<f64>,
    pub payment_due_day: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Category {
    pub id: String,
    pub name: String,
    pub parent_id: Option<String>,
    pub category_type: String,
    pub is_tax_related: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Payee {
    pub id: String,
    pub name: String,
    pub default_category_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionSplit {
    pub id: String,
    pub transaction_id: String,
    pub category_id: Option<String>,
    pub amount: f64,
    pub memo: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transaction {
    pub id: String,
    pub account_id: String,
    pub date: String,
    pub payee_id: Option<String>,
    pub payee_name: Option<String>,
    pub category_id: Option<String>,
    pub category_name: Option<String>,
    pub amount: f64,
    pub memo: Option<String>,
    pub cleared: bool,
    pub reconciled: bool,
    pub transfer_id: Option<String>,
    pub splits: Vec<TransactionSplit>,
    pub tags: Vec<String>,
    pub running_balance: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTransaction {
    pub account_id: String,
    pub date: String,
    pub payee_name: Option<String>,
    pub category_id: Option<String>,
    pub amount: f64,
    pub memo: Option<String>,
    pub cleared: bool,
    pub splits: Vec<CreateSplit>,
    pub tag_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSplit {
    pub category_id: Option<String>,
    pub amount: f64,
    pub memo: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTransfer {
    pub from_account_id: String,
    pub to_account_id: String,
    pub date: String,
    pub amount: f64,
    pub memo: Option<String>,
    pub cleared: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Budget {
    pub id: String,
    pub category_id: String,
    pub category_name: String,
    pub period: String,
    pub amount: f64,
    pub spent: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecurringTransaction {
    pub id: String,
    pub account_id: String,
    pub payee_name: Option<String>,
    pub category_id: Option<String>,
    pub amount: f64,
    pub memo: Option<String>,
    pub frequency: String,
    pub next_date: String,
    pub auto_enter: bool,
    pub reminder_days: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Attachment {
    pub id: String,
    pub transaction_id: String,
    pub file_path: String,
    pub mime_type: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tag {
    pub id: String,
    pub name: String,
    pub color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoCategorizeRule {
    pub id: String,
    pub pattern: String,
    pub category_id: String,
    pub category_name: String,
    pub target_field: String,
    pub match_type: String,
    pub priority: i32,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedFilter {
    pub id: String,
    pub name: String,
    pub account_id: Option<String>,
    pub filter_json: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionTemplate {
    pub id: String,
    pub name: String,
    pub payee_name: Option<String>,
    pub category_id: Option<String>,
    pub amount: Option<f64>,
    pub memo: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvestmentHolding {
    pub id: String,
    pub account_id: String,
    pub symbol: String,
    pub shares: f64,
    pub cost_basis: f64,
    pub current_price: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoanDetails {
    pub account_id: String,
    pub principal: f64,
    pub interest_rate: f64,
    pub term_months: i32,
    pub start_date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExchangeRate {
    pub id: String,
    pub from_currency: String,
    pub to_currency: String,
    pub rate: f64,
    pub effective_date: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TransactionFilter {
    pub account_id: Option<String>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub payee: Option<String>,
    pub category_id: Option<String>,
    pub amount_min: Option<f64>,
    pub amount_max: Option<f64>,
    pub memo: Option<String>,
    pub cleared: Option<bool>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountRegister {
    pub account: Account,
    pub transactions: Vec<Transaction>,
    pub total_count: i64,
    pub saved_filters: Vec<SavedFilter>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReconciliationSession {
    pub account_id: String,
    pub statement_date: String,
    pub statement_balance: f64,
    pub cleared_total: f64,
    pub difference: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardSummary {
    pub net_worth: f64,
    pub monthly_income: f64,
    pub monthly_spending: f64,
    pub recent_transactions: Vec<Transaction>,
    pub upcoming_recurring: Vec<RecurringTransaction>,
    pub budget_alerts: Vec<Budget>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategorySpending {
    pub category_id: String,
    pub category_name: String,
    pub amount: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonthlyFlow {
    pub month: String,
    pub income: f64,
    pub expenses: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BalancePoint {
    pub date: String,
    pub balance: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportRow {
    pub date: String,
    pub amount: f64,
    pub payee: Option<String>,
    pub memo: Option<String>,
    pub category: Option<String>,
    pub is_duplicate: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportPreview {
    pub rows: Vec<ImportRow>,
    pub total_rows: usize,
    pub duplicate_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaxSummaryRow {
    pub category_name: String,
    pub amount: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppInitStatus {
    pub db_ready: bool,
    pub has_accounts: bool,
    pub schema_version: i32,
    pub db_corrupt: bool,
    pub unclean_shutdown: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiagnosticSnapshot {
    pub app_version: String,
    pub schema_version: i32,
    pub db_ready: bool,
    pub db_corrupt: bool,
    pub unclean_shutdown: bool,
    pub has_accounts: bool,
    pub account_count: i64,
    pub logs_directory: String,
    pub frontend_log_file: String,
    pub rust_log_file: String,
}
