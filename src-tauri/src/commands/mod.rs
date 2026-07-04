use crate::db::{
    account_balance, apply_auto_category, auto_rule_matches, check_integrity, detect_unclean_shutdown,
    ensure_payee, mark_clean_shutdown, new_id, now_iso, seed_default_categories,
    validate_file_path,
};
use crate::models::*;
use crate::parsers::{parse_csv_content, parse_ofx_content, parse_qif_content};
use crate::state::AppState;
use chrono::{Datelike, Months, NaiveDate, Utc};
use rusqlite::{params, Connection, Row};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use tauri::State;

fn db_err(e: rusqlite::Error) -> String {
    format!("Database error: {e}")
}

fn to_sqlite_err(msg: String) -> rusqlite::Error {
    rusqlite::Error::ToSqlConversionFailure(Box::new(std::io::Error::new(
        std::io::ErrorKind::Other,
        msg,
    )))
}

fn bool_from_i(v: i32) -> bool {
    v != 0
}

fn load_splits(conn: &Connection, transaction_id: &str) -> Result<Vec<TransactionSplit>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, transaction_id, category_id, amount, memo
             FROM transaction_splits WHERE transaction_id = ?1",
        )
        .map_err(db_err)?;
    let splits = stmt
        .query_map([transaction_id], |row| {
            Ok(TransactionSplit {
                id: row.get(0)?,
                transaction_id: row.get(1)?,
                category_id: row.get(2)?,
                amount: row.get(3)?,
                memo: row.get(4)?,
            })
        })
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)?;
    Ok(splits)
}

fn load_tag_names(conn: &Connection, transaction_id: &str) -> Result<Vec<String>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT t.name FROM tags t
             INNER JOIN transaction_tags tt ON tt.tag_id = t.id
             WHERE tt.transaction_id = ?1
             ORDER BY t.name",
        )
        .map_err(db_err)?;
    let tags = stmt
        .query_map([transaction_id], |row| row.get(0))
        .map_err(db_err)?
        .collect::<Result<Vec<String>, _>>()
        .map_err(db_err)?;
    Ok(tags)
}

fn row_to_transaction(
    conn: &Connection,
    row: &Row,
    running_balance: Option<f64>,
) -> Result<Transaction, String> {
    let id: String = row.get(0).map_err(db_err)?;
    let splits = load_splits(conn, &id)?;
    let tags = load_tag_names(conn, &id)?;
    Ok(Transaction {
        id,
        account_id: row.get(1).map_err(db_err)?,
        date: row.get(2).map_err(db_err)?,
        payee_id: row.get(3).map_err(db_err)?,
        payee_name: row.get(4).map_err(db_err)?,
        category_id: row.get(5).map_err(db_err)?,
        category_name: row.get(6).map_err(db_err)?,
        amount: row.get(7).map_err(db_err)?,
        memo: row.get(8).map_err(db_err)?,
        cleared: bool_from_i(row.get(9).map_err(db_err)?),
        reconciled: bool_from_i(row.get(10).map_err(db_err)?),
        transfer_id: row.get(11).map_err(db_err)?,
        splits,
        tags,
        running_balance,
    })
}

fn get_transaction_internal(conn: &Connection, id: &str) -> Result<Transaction, String> {
    conn.query_row(
        "SELECT t.id, t.account_id, t.date, t.payee_id, p.name, t.category_id, c.name,
                t.amount, t.memo, t.cleared, t.reconciled, t.transfer_id
         FROM transactions t
         LEFT JOIN payees p ON t.payee_id = p.id
         LEFT JOIN categories c ON t.category_id = c.id
         WHERE t.id = ?1",
        [id],
        |row| row_to_transaction(conn, row, None).map_err(to_sqlite_err),
    )
    .map_err(|e| format!("Transaction not found: {e}"))
}

fn insert_splits(
    conn: &Connection,
    transaction_id: &str,
    splits: &[CreateSplit],
) -> Result<(), String> {
    for split in splits {
        conn.execute(
            "INSERT INTO transaction_splits (id, transaction_id, category_id, amount, memo)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![new_id(), transaction_id, split.category_id, split.amount, split.memo],
        )
        .map_err(db_err)?;
    }
    Ok(())
}

fn insert_tags(
    conn: &Connection,
    transaction_id: &str,
    tag_ids: &[String],
) -> Result<(), String> {
    for tag_id in tag_ids {
        conn.execute(
            "INSERT OR IGNORE INTO transaction_tags (transaction_id, tag_id) VALUES (?1, ?2)",
            params![transaction_id, tag_id],
        )
        .map_err(db_err)?;
    }
    Ok(())
}

fn delete_transaction_children(conn: &Connection, transaction_id: &str) -> Result<(), String> {
    conn.execute(
        "DELETE FROM transaction_splits WHERE transaction_id = ?1",
        [transaction_id],
    )
    .map_err(db_err)?;
    conn.execute(
        "DELETE FROM transaction_tags WHERE transaction_id = ?1",
        [transaction_id],
    )
    .map_err(db_err)?;
    conn.execute(
        "DELETE FROM attachments WHERE transaction_id = ?1",
        [transaction_id],
    )
    .map_err(db_err)?;
    Ok(())
}

fn resolve_category(
    conn: &Connection,
    payee_name: &Option<String>,
    memo: &Option<String>,
    category_id: &Option<String>,
) -> Result<Option<String>, String> {
    if category_id.is_some() {
        return Ok(category_id.clone());
    }
    if let Some(name) = payee_name {
        return Ok(apply_auto_category(conn, name, memo.as_deref()));
    }
    Ok(None)
}

fn row_to_account(conn: &Connection, row: &Row) -> Result<Account, String> {
    let id: String = row.get(0).map_err(db_err)?;
    let balance = account_balance(conn, &id)?;
    Ok(Account {
        id,
        name: row.get(1).map_err(db_err)?,
        account_type: row.get(2).map_err(db_err)?,
        currency: row.get(3).map_err(db_err)?,
        opening_balance: row.get(4).map_err(db_err)?,
        institution: row.get(5).map_err(db_err)?,
        is_archived: bool_from_i(row.get(6).map_err(db_err)?),
        minimum_payment: row.get(7).map_err(db_err)?,
        payment_due_day: row.get(8).map_err(db_err)?,
        created_at: row.get(9).map_err(db_err)?,
        balance,
    })
}

fn get_account_internal(conn: &Connection, id: &str) -> Result<Account, String> {
    conn.query_row(
        "SELECT id, name, account_type, currency, opening_balance, institution,
                is_archived, minimum_payment, payment_due_day, created_at
         FROM accounts WHERE id = ?1",
        [id],
        |row| row_to_account(conn, row).map_err(to_sqlite_err),
    )
    .map_err(|e| format!("Account not found: {e}"))
}

fn is_duplicate(
    conn: &Connection,
    account_id: &str,
    date: &str,
    amount: f64,
    payee: &Option<String>,
) -> Result<bool, String> {
    let count: i64 = if let Some(p) = payee {
        conn.query_row(
            "SELECT COUNT(*) FROM transactions t
             LEFT JOIN payees py ON t.payee_id = py.id
             WHERE t.account_id = ?1 AND t.date = ?2 AND t.amount = ?3
             AND lower(py.name) = lower(?4)",
            params![account_id, date, amount, p],
            |r| r.get(0),
        )
        .map_err(db_err)?
    } else {
        conn.query_row(
            "SELECT COUNT(*) FROM transactions t
             WHERE t.account_id = ?1 AND t.date = ?2 AND t.amount = ?3 AND t.payee_id IS NULL",
            params![account_id, date, amount],
            |r| r.get(0),
        )
        .map_err(db_err)?
    };
    Ok(count > 0)
}

fn add_months(date: NaiveDate, months: u32) -> Option<NaiveDate> {
    date.checked_add_months(Months::new(months))
}

fn advance_recurring_date(date_str: &str, frequency: &str) -> Result<String, String> {
    let date = NaiveDate::parse_from_str(date_str, "%Y-%m-%d")
        .map_err(|e| format!("Invalid date: {e}"))?;
    let next = match frequency {
        "daily" => date + chrono::Duration::days(1),
        "weekly" => date + chrono::Duration::weeks(1),
        "monthly" => add_months(date, 1).ok_or_else(|| "Invalid monthly date".to_string())?,
        "yearly" => add_months(date, 12).ok_or_else(|| "Invalid yearly date".to_string())?,
        other => return Err(format!("Unknown frequency: {other}")),
    };
    Ok(next.format("%Y-%m-%d").to_string())
}

fn hash_password(password: &str, salt: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(salt.as_bytes());
    hasher.update(password.as_bytes());
    hex::encode(hasher.finalize())
}

fn period_range(period: &str) -> Result<(String, String), String> {
    let parts: Vec<&str> = period.split('-').collect();
    if parts.len() != 2 {
        return Err("Period must be YYYY-MM".into());
    }
    let year: i32 = parts[0]
        .parse()
        .map_err(|_| "Invalid period year".to_string())?;
    let month: u32 = parts[1]
        .parse()
        .map_err(|_| "Invalid period month".to_string())?;
    let start = format!("{period}-01");
    let next_month = if month == 12 {
        format!("{}-01-01", year + 1)
    } else {
        format!("{year}-{:02}-01", month + 1)
    };
    Ok((start, next_month))
}

fn category_spent(conn: &Connection, category_id: &str, from: &str, to: &str) -> Result<f64, String> {
    let direct: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END), 0)
             FROM transactions
             WHERE category_id = ?1 AND date >= ?2 AND date < ?3",
            params![category_id, from, to],
            |r| r.get(0),
        )
        .map_err(db_err)?;
    let split: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(CASE WHEN s.amount < 0 THEN -s.amount ELSE s.amount END), 0)
             FROM transaction_splits s
             INNER JOIN transactions t ON t.id = s.transaction_id
             WHERE s.category_id = ?1 AND t.date >= ?2 AND t.date < ?3",
            params![category_id, from, to],
            |r| r.get(0),
        )
        .map_err(db_err)?;
    Ok(direct + split)
}

fn row_to_budget(conn: &Connection, row: &Row, period: &str) -> Result<Budget, String> {
    let category_id: String = row.get(1).map_err(db_err)?;
    let (from, to) = period_range(period)?;
    let spent = category_spent(conn, &category_id, &from, &to)?;
    Ok(Budget {
        id: row.get(0).map_err(db_err)?,
        category_id: category_id.clone(),
        category_name: row.get(2).map_err(db_err)?,
        period: row.get(3).map_err(db_err)?,
        amount: row.get(4).map_err(db_err)?,
        spent,
    })
}

fn create_transaction_internal(
    conn: &Connection,
    input: &CreateTransaction,
) -> Result<Transaction, String> {
    let payee_id = if let Some(ref name) = input.payee_name {
        Some(ensure_payee(conn, name).map_err(db_err)?)
    } else {
        None
    };
    let category_id = resolve_category(conn, &input.payee_name, &input.memo, &input.category_id)?;
    let id = new_id();
    conn.execute(
        "INSERT INTO transactions
         (id, account_id, date, payee_id, category_id, amount, memo, cleared, reconciled, transfer_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 0, NULL)",
        params![
            id,
            input.account_id,
            input.date,
            payee_id,
            if input.splits.is_empty() {
                category_id
            } else {
                None::<String>
            },
            input.amount,
            input.memo,
            input.cleared as i32,
        ],
    )
    .map_err(db_err)?;
    if !input.splits.is_empty() {
        insert_splits(conn, &id, &input.splits)?;
    }
    insert_tags(conn, &id, &input.tag_ids)?;
    get_transaction_internal(conn, &id)
}

// ── INIT ──────────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn init_app(state: State<AppState>) -> Result<AppInitStatus, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let db_corrupt = !check_integrity(&conn);
    let unclean_shutdown = detect_unclean_shutdown(&conn)?;
    seed_default_categories(&conn)?;
    let has_accounts: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM accounts LIMIT 1)",
            [],
            |r| r.get::<_, i32>(0),
        )
        .map_err(db_err)?
        != 0;
    let schema_version: i32 = conn
        .query_row("SELECT version FROM schema_version LIMIT 1", [], |r| r.get(0))
        .map_err(db_err)?;
    if db_corrupt {
        log::error!("Database integrity check failed (schema v{schema_version})");
    } else if unclean_shutdown {
        log::warn!("Unclean shutdown detected from previous session");
    } else {
        log::info!(
            "App initialized: has_accounts={has_accounts}, schema_version={schema_version}"
        );
    }
    Ok(AppInitStatus {
        db_ready: !db_corrupt,
        has_accounts,
        schema_version,
        db_corrupt,
        unclean_shutdown,
    })
}

#[tauri::command]
pub fn mark_clean_shutdown_cmd(state: State<AppState>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    mark_clean_shutdown(&conn)
}

// ── ACCOUNTS ──────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn list_accounts(
    state: State<AppState>,
    include_archived: bool,
) -> Result<Vec<Account>, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let sql = if include_archived {
        "SELECT id, name, account_type, currency, opening_balance, institution,
                is_archived, minimum_payment, payment_due_day, created_at
         FROM accounts ORDER BY name"
    } else {
        "SELECT id, name, account_type, currency, opening_balance, institution,
                is_archived, minimum_payment, payment_due_day, created_at
         FROM accounts WHERE is_archived = 0 ORDER BY name"
    };
    let mut stmt = conn.prepare(sql).map_err(db_err)?;
    let accounts = stmt
        .query_map([], |row| row_to_account(&conn, row).map_err(to_sqlite_err))
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)?;
    Ok(accounts)
}

#[tauri::command]
pub fn get_account(state: State<AppState>, id: String) -> Result<Account, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    get_account_internal(&conn, &id)
}

#[tauri::command]
pub fn create_account(state: State<AppState>, input: CreateAccount) -> Result<Account, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let id = new_id();
    let created_at = now_iso();
    conn.execute(
        "INSERT INTO accounts
         (id, name, account_type, currency, opening_balance, institution,
          is_archived, minimum_payment, payment_due_day, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, ?7, ?8, ?9)",
        params![
            id,
            input.name,
            input.account_type,
            input.currency,
            input.opening_balance,
            input.institution,
            input.minimum_payment,
            input.payment_due_day,
            created_at,
        ],
    )
    .map_err(db_err)?;
    if input.opening_balance != 0.0 {
        let tx_id = new_id();
        let transfer_cat: Option<String> = conn
            .query_row(
                "SELECT id FROM categories WHERE name = 'Transfer' LIMIT 1",
                [],
                |r| r.get(0),
            )
            .ok();
        conn.execute(
            "INSERT INTO transactions
             (id, account_id, date, payee_id, category_id, amount, memo, cleared, reconciled, transfer_id)
             VALUES (?1, ?2, ?3, NULL, ?4, ?5, 'Opening Balance', 1, 0, NULL)",
            params![
                tx_id,
                id,
                chrono::Utc::now().format("%Y-%m-%d").to_string(),
                transfer_cat,
                input.opening_balance,
            ],
        )
        .map_err(db_err)?;
    }
    get_account_internal(&conn, &id)
}

#[tauri::command]
pub fn update_account(
    state: State<AppState>,
    id: String,
    input: CreateAccount,
) -> Result<Account, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let updated = conn
        .execute(
            "UPDATE accounts SET name = ?2, account_type = ?3, currency = ?4,
             opening_balance = ?5, institution = ?6, minimum_payment = ?7, payment_due_day = ?8
             WHERE id = ?1",
            params![
                id,
                input.name,
                input.account_type,
                input.currency,
                input.opening_balance,
                input.institution,
                input.minimum_payment,
                input.payment_due_day,
            ],
        )
        .map_err(db_err)?;
    if updated == 0 {
        return Err("Account not found".into());
    }
    get_account_internal(&conn, &id)
}

#[tauri::command]
pub fn delete_account(state: State<AppState>, id: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let tx_ids: Vec<String> = conn
        .prepare("SELECT id FROM transactions WHERE account_id = ?1")
        .map_err(db_err)?
        .query_map([&id], |r| r.get(0))
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)?;
    for tx_id in &tx_ids {
        delete_transaction_children(&conn, tx_id)?;
    }
    conn.execute("DELETE FROM transactions WHERE account_id = ?1", [&id])
        .map_err(db_err)?;
    conn.execute("DELETE FROM recurring_transactions WHERE account_id = ?1", [&id])
        .map_err(db_err)?;
    conn.execute("DELETE FROM investment_holdings WHERE account_id = ?1", [&id])
        .map_err(db_err)?;
    conn.execute("DELETE FROM loan_details WHERE account_id = ?1", [&id])
        .ok();
    let deleted = conn
        .execute("DELETE FROM accounts WHERE id = ?1", [&id])
        .map_err(db_err)?;
    if deleted == 0 {
        return Err("Account not found".into());
    }
    Ok(())
}

#[tauri::command]
pub fn archive_account(
    state: State<AppState>,
    id: String,
    archived: bool,
) -> Result<Account, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let updated = conn
        .execute(
            "UPDATE accounts SET is_archived = ?2 WHERE id = ?1",
            params![id, archived as i32],
        )
        .map_err(db_err)?;
    if updated == 0 {
        return Err("Account not found".into());
    }
    get_account_internal(&conn, &id)
}

// ── CATEGORIES ────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn list_categories(state: State<AppState>) -> Result<Vec<Category>, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let mut stmt = conn
        .prepare(
            "SELECT id, name, parent_id, category_type, is_tax_related
             FROM categories ORDER BY name",
        )
        .map_err(db_err)?;
    let cats = stmt
        .query_map([], |row| {
            Ok(Category {
                id: row.get(0)?,
                name: row.get(1)?,
                parent_id: row.get(2)?,
                category_type: row.get(3)?,
                is_tax_related: bool_from_i(row.get(4)?),
            })
        })
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)?;
    Ok(cats)
}

#[tauri::command]
pub fn create_category(
    state: State<AppState>,
    name: String,
    parent_id: Option<String>,
    category_type: String,
    is_tax_related: bool,
) -> Result<Category, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let id = new_id();
    conn.execute(
        "INSERT INTO categories (id, name, parent_id, category_type, is_tax_related)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, name, parent_id, category_type, is_tax_related as i32],
    )
    .map_err(db_err)?;
    Ok(Category {
        id,
        name,
        parent_id,
        category_type,
        is_tax_related,
    })
}

#[tauri::command]
pub fn update_category(
    state: State<AppState>,
    id: String,
    name: String,
    parent_id: Option<String>,
    category_type: String,
    is_tax_related: bool,
) -> Result<Category, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let updated = conn
        .execute(
            "UPDATE categories SET name = ?2, parent_id = ?3, category_type = ?4, is_tax_related = ?5
             WHERE id = ?1",
            params![id, name, parent_id, category_type, is_tax_related as i32],
        )
        .map_err(db_err)?;
    if updated == 0 {
        return Err("Category not found".into());
    }
    Ok(Category {
        id,
        name,
        parent_id,
        category_type,
        is_tax_related,
    })
}

#[tauri::command]
pub fn delete_category(state: State<AppState>, id: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    conn.execute("DELETE FROM categories WHERE id = ?1", [&id])
        .map_err(|e| format!("Cannot delete category: {e}"))?;
    Ok(())
}

// ── PAYEES ────────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn list_payees(state: State<AppState>) -> Result<Vec<Payee>, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let mut stmt = conn
        .prepare("SELECT id, name, default_category_id FROM payees ORDER BY name")
        .map_err(db_err)?;
    let payees = stmt
        .query_map([], |row| {
            Ok(Payee {
                id: row.get(0)?,
                name: row.get(1)?,
                default_category_id: row.get(2)?,
            })
        })
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)?;
    Ok(payees)
}

#[tauri::command]
pub fn search_payees(
    state: State<AppState>,
    query: String,
    limit: i32,
) -> Result<Vec<Payee>, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let pattern = format!("%{}%", query.to_lowercase());
    let mut stmt = conn
        .prepare(
            "SELECT id, name, default_category_id FROM payees
             WHERE lower(name) LIKE ?1 ORDER BY name LIMIT ?2",
        )
        .map_err(db_err)?;
    let payees = stmt
        .query_map(params![pattern, limit], |row| {
            Ok(Payee {
                id: row.get(0)?,
                name: row.get(1)?,
                default_category_id: row.get(2)?,
            })
        })
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)?;
    Ok(payees)
}

#[tauri::command]
pub fn create_payee(
    state: State<AppState>,
    name: String,
    default_category_id: Option<String>,
) -> Result<Payee, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let id = new_id();
    conn.execute(
        "INSERT INTO payees (id, name, default_category_id) VALUES (?1, ?2, ?3)",
        params![id, name, default_category_id],
    )
    .map_err(db_err)?;
    Ok(Payee {
        id,
        name,
        default_category_id,
    })
}

#[tauri::command]
pub fn update_payee(
    state: State<AppState>,
    id: String,
    name: String,
    default_category_id: Option<String>,
) -> Result<Payee, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let updated = conn
        .execute(
            "UPDATE payees SET name = ?2, default_category_id = ?3 WHERE id = ?1",
            params![id, name, default_category_id],
        )
        .map_err(db_err)?;
    if updated == 0 {
        return Err("Payee not found".into());
    }
    Ok(Payee {
        id,
        name,
        default_category_id,
    })
}

#[tauri::command]
pub fn delete_payee(state: State<AppState>, id: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    conn.execute("DELETE FROM payees WHERE id = ?1", [&id])
        .map_err(|e| format!("Cannot delete payee: {e}"))?;
    Ok(())
}

// ── TRANSACTIONS ──────────────────────────────────────────────────────────────

struct TxFilterParts {
    where_clause: String,
    params: Vec<Box<dyn rusqlite::types::ToSql>>,
}

fn build_tx_filter_parts(filter: &TransactionFilter) -> TxFilterParts {
    let mut where_clause = String::from(" WHERE 1=1");
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(ref account_id) = filter.account_id {
        where_clause.push_str(" AND t.account_id = ?");
        params.push(Box::new(account_id.clone()));
    }
    if let Some(ref date_from) = filter.date_from {
        where_clause.push_str(" AND t.date >= ?");
        params.push(Box::new(date_from.clone()));
    }
    if let Some(ref date_to) = filter.date_to {
        where_clause.push_str(" AND t.date <= ?");
        params.push(Box::new(date_to.clone()));
    }
    if let Some(ref payee) = filter.payee {
        where_clause.push_str(" AND lower(p.name) LIKE ?");
        params.push(Box::new(format!("%{}%", payee.to_lowercase())));
    }
    if let Some(ref category_id) = filter.category_id {
        where_clause.push_str(" AND t.category_id = ?");
        params.push(Box::new(category_id.clone()));
    }
    if let Some(amount_min) = filter.amount_min {
        where_clause.push_str(" AND t.amount >= ?");
        params.push(Box::new(amount_min));
    }
    if let Some(amount_max) = filter.amount_max {
        where_clause.push_str(" AND t.amount <= ?");
        params.push(Box::new(amount_max));
    }
    if let Some(ref memo) = filter.memo {
        where_clause.push_str(" AND lower(t.memo) LIKE ?");
        params.push(Box::new(format!("%{}%", memo.to_lowercase())));
    }
    if let Some(cleared) = filter.cleared {
        where_clause.push_str(" AND t.cleared = ?");
        params.push(Box::new(cleared as i32));
    }

    TxFilterParts {
        where_clause,
        params,
    }
}

fn count_transactions_internal(conn: &Connection, filter: &TransactionFilter) -> Result<i64, String> {
    let parts = build_tx_filter_parts(filter);
    let sql = format!(
        "SELECT COUNT(*) FROM transactions t
         LEFT JOIN payees p ON t.payee_id = p.id
         LEFT JOIN categories c ON t.category_id = c.id{}",
        parts.where_clause
    );
    let params_ref: Vec<&dyn rusqlite::types::ToSql> =
        parts.params.iter().map(|p| p.as_ref()).collect();
    conn.query_row(&sql, params_ref.as_slice(), |r| r.get(0))
        .map_err(db_err)
}

fn sum_amounts_before_offset(
    conn: &Connection,
    filter: &TransactionFilter,
    offset: i64,
) -> Result<f64, String> {
    if offset <= 0 {
        return Ok(0.0);
    }
    let parts = build_tx_filter_parts(filter);
    let sql = format!(
        "SELECT COALESCE(SUM(sub.amount), 0) FROM (
            SELECT t.amount FROM transactions t
            LEFT JOIN payees p ON t.payee_id = p.id
            LEFT JOIN categories c ON t.category_id = c.id
            {} ORDER BY t.date ASC, t.id ASC LIMIT ?
         ) sub",
        parts.where_clause
    );
    let mut params = parts.params;
    params.push(Box::new(offset));
    let params_ref: Vec<&dyn rusqlite::types::ToSql> =
        params.iter().map(|p| p.as_ref()).collect();
    conn.query_row(&sql, params_ref.as_slice(), |r| r.get(0))
        .map_err(db_err)
}

fn list_transactions_internal(
    conn: &Connection,
    filter: TransactionFilter,
) -> Result<Vec<Transaction>, String> {
    let parts = build_tx_filter_parts(&filter);
    let mut sql = format!(
        "SELECT t.id, t.account_id, t.date, t.payee_id, p.name, t.category_id, c.name,
                t.amount, t.memo, t.cleared, t.reconciled, t.transfer_id
         FROM transactions t
         LEFT JOIN payees p ON t.payee_id = p.id
         LEFT JOIN categories c ON t.category_id = c.id
         {} ORDER BY t.date ASC, t.id ASC",
        parts.where_clause
    );
    let mut params = parts.params;
    if let Some(limit) = filter.limit {
        sql.push_str(" LIMIT ?");
        params.push(Box::new(limit));
    }
    if let Some(offset) = filter.offset {
        sql.push_str(" OFFSET ?");
        params.push(Box::new(offset));
    }

    let params_ref: Vec<&dyn rusqlite::types::ToSql> =
        params.iter().map(|p| p.as_ref()).collect();
    let mut stmt = conn.prepare(&sql).map_err(db_err)?;
    let rows: Vec<Transaction> = stmt
        .query_map(params_ref.as_slice(), |row| {
            row_to_transaction(conn, row, None).map_err(to_sqlite_err)
        })
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)?;

    if let Some(ref account_id) = filter.account_id {
        let opening: f64 = conn
            .query_row(
                "SELECT opening_balance FROM accounts WHERE id = ?1",
                [account_id],
                |r| r.get(0),
            )
            .map_err(db_err)?;
        let prior_sum = sum_amounts_before_offset(conn, &filter, filter.offset.unwrap_or(0))?;
        let mut balance = opening + prior_sum;
        let mut result = Vec::with_capacity(rows.len());
        for mut tx in rows {
            balance += tx.amount;
            tx.running_balance = Some(balance);
            result.push(tx);
        }
        Ok(result)
    } else {
        Ok(rows)
    }
}

#[tauri::command]
pub fn list_transactions(
    state: State<AppState>,
    filter: TransactionFilter,
) -> Result<Vec<Transaction>, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    list_transactions_internal(&conn, filter)
}

#[tauri::command]
pub fn count_transactions(
    state: State<AppState>,
    filter: TransactionFilter,
) -> Result<i64, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    count_transactions_internal(&conn, &filter)
}

#[tauri::command]
pub fn get_account_register(
    state: State<AppState>,
    account_id: String,
    filter: TransactionFilter,
) -> Result<AccountRegister, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let account = get_account_internal(&conn, &account_id)?;
    let mut tx_filter = filter;
    tx_filter.account_id = Some(account_id.clone());
    let total_count = count_transactions_internal(&conn, &tx_filter)?;
    let transactions = list_transactions_internal(&conn, tx_filter)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, name, account_id, filter_json FROM saved_filters
             WHERE account_id IS NULL OR account_id = ?1 ORDER BY name",
        )
        .map_err(db_err)?;
    let saved_filters = stmt
        .query_map([&account_id], |row| {
            Ok(SavedFilter {
                id: row.get(0)?,
                name: row.get(1)?,
                account_id: row.get(2)?,
                filter_json: row.get(3)?,
            })
        })
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)?;
    Ok(AccountRegister {
        account,
        transactions,
        total_count,
        saved_filters,
    })
}

#[tauri::command]
pub fn get_transaction(state: State<AppState>, id: String) -> Result<Transaction, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    get_transaction_internal(&conn, &id)
}

#[tauri::command]
pub fn create_transaction(
    state: State<AppState>,
    input: CreateTransaction,
) -> Result<Transaction, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    create_transaction_internal(&conn, &input)
}

#[tauri::command]
pub fn update_transaction(
    state: State<AppState>,
    id: String,
    input: CreateTransaction,
) -> Result<Transaction, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let payee_id = if let Some(ref name) = input.payee_name {
        Some(ensure_payee(&conn, name).map_err(db_err)?)
    } else {
        None
    };
    let category_id = resolve_category(&conn, &input.payee_name, &input.memo, &input.category_id)?;
    let updated = conn
        .execute(
            "UPDATE transactions SET account_id = ?2, date = ?3, payee_id = ?4, category_id = ?5,
             amount = ?6, memo = ?7, cleared = ?8 WHERE id = ?1",
            params![
                id,
                input.account_id,
                input.date,
                payee_id,
                if input.splits.is_empty() {
                    category_id
                } else {
                    None::<String>
                },
                input.amount,
                input.memo,
                input.cleared as i32,
            ],
        )
        .map_err(db_err)?;
    if updated == 0 {
        return Err("Transaction not found".into());
    }
    delete_transaction_children(&conn, &id)?;
    if !input.splits.is_empty() {
        insert_splits(&conn, &id, &input.splits)?;
    }
    insert_tags(&conn, &id, &input.tag_ids)?;
    get_transaction_internal(&conn, &id)
}

#[tauri::command]
pub fn delete_transaction(state: State<AppState>, id: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let transfer_id: Option<String> = conn
        .query_row(
            "SELECT transfer_id FROM transactions WHERE id = ?1",
            [&id],
            |r| r.get(0),
        )
        .ok()
        .flatten();
    if let Some(ref tid) = transfer_id {
        let pair: Option<(String, String)> = conn
            .query_row(
                "SELECT from_transaction_id, to_transaction_id FROM transfers WHERE id = ?1",
                [tid],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .ok();
        if let Some((from_id, to_id)) = pair {
            let other = if from_id == id { to_id } else { from_id };
            delete_transaction_children(&conn, &other)?;
            conn.execute("DELETE FROM transactions WHERE id = ?1", [&other])
                .map_err(db_err)?;
            conn.execute("DELETE FROM transfers WHERE id = ?1", [tid])
                .map_err(db_err)?;
        }
    }
    delete_transaction_children(&conn, &id)?;
    conn.execute("DELETE FROM transactions WHERE id = ?1", [&id])
        .map_err(db_err)?;
    Ok(())
}

#[tauri::command]
pub fn bulk_delete_transactions(
    state: State<AppState>,
    ids: Vec<String>,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    for id in ids {
        let transfer_id: Option<String> = conn
            .query_row(
                "SELECT transfer_id FROM transactions WHERE id = ?1",
                [&id],
                |r| r.get(0),
            )
            .ok()
            .flatten();
        if let Some(ref tid) = transfer_id {
            if let Ok((from_id, to_id)) = conn.query_row(
                "SELECT from_transaction_id, to_transaction_id FROM transfers WHERE id = ?1",
                [tid],
                |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)),
            ) {
                let other = if from_id == id { to_id } else { from_id };
                delete_transaction_children(&conn, &other)?;
                conn.execute("DELETE FROM transactions WHERE id = ?1", [&other])
                    .map_err(db_err)?;
                conn.execute("DELETE FROM transfers WHERE id = ?1", [tid])
                    .map_err(db_err)?;
            }
        }
        delete_transaction_children(&conn, &id)?;
        conn.execute("DELETE FROM transactions WHERE id = ?1", [&id])
            .map_err(db_err)?;
    }
    Ok(())
}

#[tauri::command]
pub fn duplicate_transaction(state: State<AppState>, id: String) -> Result<Transaction, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let original = get_transaction_internal(&conn, &id)?;
    let splits: Vec<CreateSplit> = original
        .splits
        .iter()
        .map(|s| CreateSplit {
            category_id: s.category_id.clone(),
            amount: s.amount,
            memo: s.memo.clone(),
        })
        .collect();
    let tag_ids: Vec<String> = if original.tags.is_empty() {
        Vec::new()
    } else {
        let mut ids = Vec::new();
        for name in &original.tags {
            if let Ok(tag_id) = conn.query_row(
                "SELECT id FROM tags WHERE name = ?1",
                [name],
                |r| r.get::<_, String>(0),
            ) {
                ids.push(tag_id);
            }
        }
        ids
    };
    let input = CreateTransaction {
        account_id: original.account_id,
        date: original.date,
        payee_name: original.payee_name,
        category_id: original.category_id,
        amount: original.amount,
        memo: original.memo,
        cleared: false,
        splits,
        tag_ids,
    };
    create_transaction_internal(&conn, &input)
}

#[tauri::command]
pub fn set_transaction_cleared(
    state: State<AppState>,
    id: String,
    cleared: bool,
) -> Result<Transaction, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let updated = conn
        .execute(
            "UPDATE transactions SET cleared = ?2 WHERE id = ?1",
            params![id, cleared as i32],
        )
        .map_err(db_err)?;
    if updated == 0 {
        return Err("Transaction not found".into());
    }
    get_transaction_internal(&conn, &id)
}

// ── TRANSFERS ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn create_transfer(
    state: State<AppState>,
    input: CreateTransfer,
) -> Result<Vec<Transaction>, String> {
    if input.from_account_id == input.to_account_id {
        return Err("Cannot transfer to the same account".into());
    }
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let transfer_id = new_id();
    let from_tx_id = new_id();
    let to_tx_id = new_id();
    let transfer_cat: Option<String> = conn
        .query_row(
            "SELECT id FROM categories WHERE name = 'Transfer' LIMIT 1",
            [],
            |r| r.get(0),
        )
        .ok();
    conn.execute(
        "INSERT INTO transactions
         (id, account_id, date, payee_id, category_id, amount, memo, cleared, reconciled, transfer_id)
         VALUES (?1, ?2, ?3, NULL, ?4, ?5, ?6, ?7, 0, ?8)",
        params![
            from_tx_id,
            input.from_account_id,
            input.date,
            transfer_cat,
            -input.amount.abs(),
            input.memo,
            input.cleared as i32,
            transfer_id,
        ],
    )
    .map_err(db_err)?;
    conn.execute(
        "INSERT INTO transactions
         (id, account_id, date, payee_id, category_id, amount, memo, cleared, reconciled, transfer_id)
         VALUES (?1, ?2, ?3, NULL, ?4, ?5, ?6, ?7, 0, ?8)",
        params![
            to_tx_id,
            input.to_account_id,
            input.date,
            transfer_cat,
            input.amount.abs(),
            input.memo,
            input.cleared as i32,
            transfer_id,
        ],
    )
    .map_err(db_err)?;
    conn.execute(
        "INSERT INTO transfers (id, from_transaction_id, to_transaction_id)
         VALUES (?1, ?2, ?3)",
        params![transfer_id, from_tx_id, to_tx_id],
    )
    .map_err(db_err)?;
    Ok(vec![
        get_transaction_internal(&conn, &from_tx_id)?,
        get_transaction_internal(&conn, &to_tx_id)?,
    ])
}

#[tauri::command]
pub fn update_transfer_amount(
    state: State<AppState>,
    transfer_id: String,
    amount: f64,
) -> Result<Vec<Transaction>, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let (from_id, to_id): (String, String) = conn
        .query_row(
            "SELECT from_transaction_id, to_transaction_id FROM transfers WHERE id = ?1",
            [&transfer_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .map_err(|e| format!("Transfer not found: {e}"))?;
    conn.execute(
        "UPDATE transactions SET amount = ?2 WHERE id = ?1",
        params![from_id, -amount.abs()],
    )
    .map_err(db_err)?;
    conn.execute(
        "UPDATE transactions SET amount = ?2 WHERE id = ?1",
        params![to_id, amount.abs()],
    )
    .map_err(db_err)?;
    Ok(vec![
        get_transaction_internal(&conn, &from_id)?,
        get_transaction_internal(&conn, &to_id)?,
    ])
}

// ── RECONCILIATION ────────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_reconciliation_status(
    state: State<AppState>,
    account_id: String,
    statement_date: String,
    statement_balance: f64,
) -> Result<ReconciliationSession, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let opening: f64 = conn
        .query_row(
            "SELECT opening_balance FROM accounts WHERE id = ?1",
            [&account_id],
            |r| r.get(0),
        )
        .map_err(db_err)?;
    let cleared_total: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM transactions
             WHERE account_id = ?1 AND cleared = 1 AND date <= ?2",
            params![account_id, statement_date],
            |r| r.get(0),
        )
        .map_err(db_err)?;
    let book_balance = opening + cleared_total;
    Ok(ReconciliationSession {
        account_id,
        statement_date,
        statement_balance,
        cleared_total: book_balance,
        difference: statement_balance - book_balance,
    })
}

#[tauri::command]
pub fn finish_reconciliation(state: State<AppState>, account_id: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    conn.execute(
        "UPDATE transactions SET reconciled = 1
         WHERE account_id = ?1 AND cleared = 1",
        [&account_id],
    )
    .map_err(db_err)?;
    Ok(())
}

// ── BUDGETS ───────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn list_budgets(state: State<AppState>, period: String) -> Result<Vec<Budget>, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let mut stmt = conn
        .prepare(
            "SELECT b.id, b.category_id, c.name, b.period, b.amount
             FROM budgets b
             INNER JOIN categories c ON c.id = b.category_id
             WHERE b.period = ?1
             ORDER BY c.name",
        )
        .map_err(db_err)?;
    let budgets = stmt
        .query_map([&period], |row| row_to_budget(&conn, row, &period).map_err(to_sqlite_err))
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)?;
    Ok(budgets)
}

#[tauri::command]
pub fn create_budget(
    state: State<AppState>,
    category_id: String,
    period: String,
    amount: f64,
) -> Result<Budget, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let id = new_id();
    conn.execute(
        "INSERT INTO budgets (id, category_id, period, amount) VALUES (?1, ?2, ?3, ?4)",
        params![id, category_id, period, amount],
    )
    .map_err(db_err)?;
    let category_name: String = conn
        .query_row(
            "SELECT name FROM categories WHERE id = ?1",
            [&category_id],
            |r| r.get(0),
        )
        .map_err(db_err)?;
    let (from, to) = period_range(&period)?;
    let spent = category_spent(&conn, &category_id, &from, &to)?;
    Ok(Budget {
        id,
        category_id,
        category_name,
        period,
        amount,
        spent,
    })
}

#[tauri::command]
pub fn update_budget(
    state: State<AppState>,
    id: String,
    amount: f64,
) -> Result<Budget, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let updated = conn
        .execute("UPDATE budgets SET amount = ?2 WHERE id = ?1", params![id, amount])
        .map_err(db_err)?;
    if updated == 0 {
        return Err("Budget not found".into());
    }
    let row = conn.query_row(
        "SELECT b.id, b.category_id, c.name, b.period, b.amount
         FROM budgets b INNER JOIN categories c ON c.id = b.category_id
         WHERE b.id = ?1",
        [&id],
        |r| Ok((r.get::<_, String>(2)?, r.get::<_, String>(3)?, r.get::<_, String>(1)?)),
    );
    match row {
        Ok((category_name, period, category_id)) => {
            let (from, to) = period_range(&period)?;
            let spent = category_spent(&conn, &category_id, &from, &to)?;
            Ok(Budget {
                id,
                category_id,
                category_name,
                period,
                amount,
                spent,
            })
        }
        Err(e) => Err(db_err(e)),
    }
}

#[tauri::command]
pub fn delete_budget(state: State<AppState>, id: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    conn.execute("DELETE FROM budgets WHERE id = ?1", [&id])
        .map_err(db_err)?;
    Ok(())
}

// ── RECURRING ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn list_recurring(state: State<AppState>) -> Result<Vec<RecurringTransaction>, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let mut stmt = conn
        .prepare(
            "SELECT id, account_id, payee_name, category_id, amount, memo,
                    frequency, next_date, auto_enter, reminder_days
             FROM recurring_transactions ORDER BY next_date",
        )
        .map_err(db_err)?;
    let items = stmt
        .query_map([], |row| {
            Ok(RecurringTransaction {
                id: row.get(0)?,
                account_id: row.get(1)?,
                payee_name: row.get(2)?,
                category_id: row.get(3)?,
                amount: row.get(4)?,
                memo: row.get(5)?,
                frequency: row.get(6)?,
                next_date: row.get(7)?,
                auto_enter: bool_from_i(row.get(8)?),
                reminder_days: row.get(9)?,
            })
        })
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)?;
    Ok(items)
}

#[tauri::command]
pub fn create_recurring(
    state: State<AppState>,
    account_id: String,
    payee_name: Option<String>,
    category_id: Option<String>,
    amount: f64,
    memo: Option<String>,
    frequency: String,
    next_date: String,
    auto_enter: bool,
    reminder_days: i32,
) -> Result<RecurringTransaction, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let id = new_id();
    conn.execute(
        "INSERT INTO recurring_transactions
         (id, account_id, payee_name, category_id, amount, memo, frequency, next_date, auto_enter, reminder_days)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            id,
            account_id,
            payee_name,
            category_id,
            amount,
            memo,
            frequency,
            next_date,
            auto_enter as i32,
            reminder_days,
        ],
    )
    .map_err(db_err)?;
    Ok(RecurringTransaction {
        id,
        account_id,
        payee_name,
        category_id,
        amount,
        memo,
        frequency,
        next_date,
        auto_enter,
        reminder_days,
    })
}

#[tauri::command]
pub fn update_recurring(
    state: State<AppState>,
    id: String,
    account_id: String,
    payee_name: Option<String>,
    category_id: Option<String>,
    amount: f64,
    memo: Option<String>,
    frequency: String,
    next_date: String,
    auto_enter: bool,
    reminder_days: i32,
) -> Result<RecurringTransaction, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let updated = conn
        .execute(
            "UPDATE recurring_transactions SET account_id = ?2, payee_name = ?3, category_id = ?4,
             amount = ?5, memo = ?6, frequency = ?7, next_date = ?8, auto_enter = ?9, reminder_days = ?10
             WHERE id = ?1",
            params![
                id,
                account_id,
                payee_name,
                category_id,
                amount,
                memo,
                frequency,
                next_date,
                auto_enter as i32,
                reminder_days,
            ],
        )
        .map_err(db_err)?;
    if updated == 0 {
        return Err("Recurring transaction not found".into());
    }
    Ok(RecurringTransaction {
        id,
        account_id,
        payee_name,
        category_id,
        amount,
        memo,
        frequency,
        next_date,
        auto_enter,
        reminder_days,
    })
}

#[tauri::command]
pub fn delete_recurring(state: State<AppState>, id: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    conn.execute("DELETE FROM recurring_transactions WHERE id = ?1", [&id])
        .map_err(db_err)?;
    Ok(())
}

#[tauri::command]
pub fn enter_due_recurring(
    state: State<AppState>,
    ids: Vec<String>,
) -> Result<Vec<Transaction>, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let today = Utc::now().format("%Y-%m-%d").to_string();
    let mut created = Vec::new();
    for id in ids {
        let rec: RecurringTransaction = conn
            .query_row(
                "SELECT id, account_id, payee_name, category_id, amount, memo,
                        frequency, next_date, auto_enter, reminder_days
                 FROM recurring_transactions WHERE id = ?1",
                [&id],
                |row| {
                    Ok(RecurringTransaction {
                        id: row.get(0)?,
                        account_id: row.get(1)?,
                        payee_name: row.get(2)?,
                        category_id: row.get(3)?,
                        amount: row.get(4)?,
                        memo: row.get(5)?,
                        frequency: row.get(6)?,
                        next_date: row.get(7)?,
                        auto_enter: bool_from_i(row.get(8)?),
                        reminder_days: row.get(9)?,
                    })
                },
            )
            .map_err(|e| format!("Recurring transaction not found: {e}"))?;
        if rec.next_date > today {
            continue;
        }
        let input = CreateTransaction {
            account_id: rec.account_id,
            date: rec.next_date.clone(),
            payee_name: rec.payee_name.clone(),
            category_id: rec.category_id.clone(),
            amount: rec.amount,
            memo: rec.memo.clone(),
            cleared: false,
            splits: Vec::new(),
            tag_ids: Vec::new(),
        };
        let tx = create_transaction_internal(&conn, &input)?;
        let next = advance_recurring_date(&rec.next_date, &rec.frequency)?;
        conn.execute(
            "UPDATE recurring_transactions SET next_date = ?2 WHERE id = ?1",
            params![id, next],
        )
        .map_err(db_err)?;
        created.push(tx);
    }
    Ok(created)
}

// ── SETTINGS ──────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_setting(state: State<AppState>, key: String) -> Result<Option<String>, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let val = conn
        .query_row(
            "SELECT value FROM settings WHERE key = ?1",
            [&key],
            |r| r.get(0),
        )
        .ok();
    Ok(val)
}

#[tauri::command]
pub fn set_setting(state: State<AppState>, key: String, value: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )
    .map_err(db_err)?;
    Ok(())
}

#[tauri::command]
pub fn get_all_settings(state: State<AppState>) -> Result<HashMap<String, String>, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let mut stmt = conn
        .prepare("SELECT key, value FROM settings")
        .map_err(db_err)?;
    let mut map = HashMap::new();
    let rows = stmt
        .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
        .map_err(db_err)?;
    for row in rows {
        let (k, v) = row.map_err(db_err)?;
        map.insert(k, v);
    }
    Ok(map)
}

// ── ATTACHMENTS ───────────────────────────────────────────────────────────────

#[tauri::command]
pub fn add_attachment(
    state: State<AppState>,
    transaction_id: String,
    file_path: String,
    mime_type: Option<String>,
) -> Result<Attachment, String> {
    validate_file_path(&file_path)?;
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let id = new_id();
    let path = file_path.clone();
    conn.execute(
        "INSERT INTO attachments (id, transaction_id, file_path, mime_type)
         VALUES (?1, ?2, ?3, ?4)",
        params![id, transaction_id, file_path, mime_type],
    )
    .map_err(db_err)?;
    Ok(Attachment {
        id,
        transaction_id,
        file_path: path,
        mime_type,
    })
}

#[tauri::command]
pub fn list_attachments(
    state: State<AppState>,
    transaction_id: String,
) -> Result<Vec<Attachment>, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let mut stmt = conn
        .prepare(
            "SELECT id, transaction_id, file_path, mime_type
             FROM attachments WHERE transaction_id = ?1",
        )
        .map_err(db_err)?;
    let items = stmt
        .query_map([&transaction_id], |row| {
            Ok(Attachment {
                id: row.get(0)?,
                transaction_id: row.get(1)?,
                file_path: row.get(2)?,
                mime_type: row.get(3)?,
            })
        })
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)?;
    Ok(items)
}

#[tauri::command]
pub fn delete_attachment(state: State<AppState>, id: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    conn.execute("DELETE FROM attachments WHERE id = ?1", [&id])
        .map_err(db_err)?;
    Ok(())
}

// ── TAGS ──────────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn list_tags(state: State<AppState>) -> Result<Vec<Tag>, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let mut stmt = conn
        .prepare("SELECT id, name, color FROM tags ORDER BY name")
        .map_err(db_err)?;
    let tags = stmt
        .query_map([], |row| {
            Ok(Tag {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
            })
        })
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)?;
    Ok(tags)
}

#[tauri::command]
pub fn create_tag(
    state: State<AppState>,
    name: String,
    color: Option<String>,
) -> Result<Tag, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let id = new_id();
    conn.execute(
        "INSERT INTO tags (id, name, color) VALUES (?1, ?2, ?3)",
        params![id, name, color],
    )
    .map_err(db_err)?;
    Ok(Tag { id, name, color })
}

#[tauri::command]
pub fn delete_tag(state: State<AppState>, id: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    conn.execute("DELETE FROM tags WHERE id = ?1", [&id])
        .map_err(db_err)?;
    Ok(())
}

// ── AUTO CATEGORIZE ───────────────────────────────────────────────────────────

#[tauri::command]
pub fn list_auto_rules(state: State<AppState>) -> Result<Vec<AutoCategorizeRule>, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let mut stmt = conn
        .prepare(
            "SELECT r.id, r.pattern, r.category_id, c.name, r.target_field, r.match_type,
                    r.priority, r.enabled
             FROM auto_categorize_rules r
             INNER JOIN categories c ON c.id = r.category_id
             ORDER BY r.enabled DESC, r.priority ASC, r.pattern ASC",
        )
        .map_err(db_err)?;
    let rules = stmt
        .query_map([], |row| {
            Ok(AutoCategorizeRule {
                id: row.get(0)?,
                pattern: row.get(1)?,
                category_id: row.get(2)?,
                category_name: row.get(3)?,
                target_field: row.get(4)?,
                match_type: row.get(5)?,
                priority: row.get(6)?,
                enabled: bool_from_i(row.get(7)?),
            })
        })
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)?;
    Ok(rules)
}

#[tauri::command]
pub fn create_auto_rule(
    state: State<AppState>,
    pattern: String,
    category_id: String,
    target_field: String,
    match_type: String,
    priority: i32,
    enabled: bool,
) -> Result<AutoCategorizeRule, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let id = new_id();
    conn.execute(
        "INSERT INTO auto_categorize_rules
         (id, pattern, category_id, target_field, match_type, priority, enabled)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![id, pattern, category_id, target_field, match_type, priority, enabled as i32],
    )
    .map_err(db_err)?;
    let category_name: String = conn
        .query_row(
            "SELECT name FROM categories WHERE id = ?1",
            [&category_id],
            |r| r.get(0),
        )
        .map_err(db_err)?;
    Ok(AutoCategorizeRule {
        id,
        pattern,
        category_id,
        category_name,
        target_field,
        match_type,
        priority,
        enabled,
    })
}

#[tauri::command]
pub fn delete_auto_rule(state: State<AppState>, id: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    conn.execute("DELETE FROM auto_categorize_rules WHERE id = ?1", [&id])
        .map_err(db_err)?;
    Ok(())
}

fn apply_auto_rules_internal(conn: &Connection, overwrite: bool) -> Result<i64, String> {
    let mut rule_stmt = conn
        .prepare(
            "SELECT pattern, category_id, target_field, match_type
             FROM auto_categorize_rules
             WHERE enabled = 1
             ORDER BY priority ASC, pattern ASC",
        )
        .map_err(db_err)?;
    let rules = rule_stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
            ))
        })
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)?;

    let mut tx_stmt = conn
        .prepare(
            "SELECT t.id, COALESCE(p.name, ''), t.memo, t.category_id
             FROM transactions t
             LEFT JOIN payees p ON p.id = t.payee_id
             WHERE NOT EXISTS (SELECT 1 FROM transaction_splits s WHERE s.transaction_id = t.id)",
        )
        .map_err(db_err)?;
    let transactions = tx_stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Option<String>>(3)?,
            ))
        })
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)?;

    let mut updated = 0;
    for (tx_id, payee_name, memo, current_category) in transactions {
        if !overwrite && current_category.is_some() {
            continue;
        }
        for (pattern, category_id, target_field, match_type) in &rules {
            if auto_rule_matches(&target_field, &match_type, pattern, &payee_name, memo.as_deref()) {
                conn.execute(
                    "UPDATE transactions SET category_id = ?1 WHERE id = ?2",
                    params![category_id, tx_id],
                )
                .map_err(db_err)?;
                updated += 1;
                break;
            }
        }
    }
    Ok(updated)
}

#[tauri::command]
pub fn apply_auto_rules_to_transactions(state: State<AppState>, overwrite: bool) -> Result<i64, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    apply_auto_rules_internal(&conn, overwrite)
}

// ── SAVED FILTERS ─────────────────────────────────────────────────────────────

#[tauri::command]
pub fn list_saved_filters(state: State<AppState>) -> Result<Vec<SavedFilter>, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let mut stmt = conn
        .prepare("SELECT id, name, account_id, filter_json FROM saved_filters ORDER BY name")
        .map_err(db_err)?;
    let filters = stmt
        .query_map([], |row| {
            Ok(SavedFilter {
                id: row.get(0)?,
                name: row.get(1)?,
                account_id: row.get(2)?,
                filter_json: row.get(3)?,
            })
        })
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)?;
    Ok(filters)
}

#[tauri::command]
pub fn create_saved_filter(
    state: State<AppState>,
    name: String,
    account_id: Option<String>,
    filter_json: String,
) -> Result<SavedFilter, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let id = new_id();
    conn.execute(
        "INSERT INTO saved_filters (id, name, account_id, filter_json) VALUES (?1, ?2, ?3, ?4)",
        params![id, name, account_id, filter_json],
    )
    .map_err(db_err)?;
    Ok(SavedFilter {
        id,
        name,
        account_id,
        filter_json,
    })
}

#[tauri::command]
pub fn delete_saved_filter(state: State<AppState>, id: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    conn.execute("DELETE FROM saved_filters WHERE id = ?1", [&id])
        .map_err(db_err)?;
    Ok(())
}

// ── TEMPLATES ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn list_templates(state: State<AppState>) -> Result<Vec<TransactionTemplate>, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let mut stmt = conn
        .prepare(
            "SELECT id, name, payee_name, category_id, amount, memo
             FROM transaction_templates ORDER BY name",
        )
        .map_err(db_err)?;
    let templates = stmt
        .query_map([], |row| {
            Ok(TransactionTemplate {
                id: row.get(0)?,
                name: row.get(1)?,
                payee_name: row.get(2)?,
                category_id: row.get(3)?,
                amount: row.get(4)?,
                memo: row.get(5)?,
            })
        })
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)?;
    Ok(templates)
}

#[tauri::command]
pub fn create_template(
    state: State<AppState>,
    name: String,
    payee_name: Option<String>,
    category_id: Option<String>,
    amount: Option<f64>,
    memo: Option<String>,
) -> Result<TransactionTemplate, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let id = new_id();
    conn.execute(
        "INSERT INTO transaction_templates (id, name, payee_name, category_id, amount, memo)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, name, payee_name, category_id, amount, memo],
    )
    .map_err(db_err)?;
    Ok(TransactionTemplate {
        id,
        name,
        payee_name,
        category_id,
        amount,
        memo,
    })
}

#[tauri::command]
pub fn delete_template(state: State<AppState>, id: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    conn.execute("DELETE FROM transaction_templates WHERE id = ?1", [&id])
        .map_err(db_err)?;
    Ok(())
}

// ── INVESTMENTS ───────────────────────────────────────────────────────────────

#[tauri::command]
pub fn list_holdings(
    state: State<AppState>,
    account_id: String,
) -> Result<Vec<InvestmentHolding>, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let mut stmt = conn
        .prepare(
            "SELECT id, account_id, symbol, shares, cost_basis, current_price
             FROM investment_holdings WHERE account_id = ?1 ORDER BY symbol",
        )
        .map_err(db_err)?;
    let holdings = stmt
        .query_map([&account_id], |row| {
            Ok(InvestmentHolding {
                id: row.get(0)?,
                account_id: row.get(1)?,
                symbol: row.get(2)?,
                shares: row.get(3)?,
                cost_basis: row.get(4)?,
                current_price: row.get(5)?,
            })
        })
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)?;
    Ok(holdings)
}

#[tauri::command]
pub fn upsert_holding(
    state: State<AppState>,
    account_id: String,
    symbol: String,
    shares: f64,
    cost_basis: f64,
    current_price: Option<f64>,
) -> Result<InvestmentHolding, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let existing: Option<String> = conn
        .query_row(
            "SELECT id FROM investment_holdings WHERE account_id = ?1 AND symbol = ?2",
            params![account_id, symbol],
            |r| r.get(0),
        )
        .ok();
    let id = if let Some(existing_id) = existing {
        conn.execute(
            "UPDATE investment_holdings SET shares = ?3, cost_basis = ?4, current_price = ?5
             WHERE account_id = ?1 AND symbol = ?2",
            params![account_id, symbol, shares, cost_basis, current_price],
        )
        .map_err(db_err)?;
        existing_id
    } else {
        let new_id = new_id();
        conn.execute(
            "INSERT INTO investment_holdings (id, account_id, symbol, shares, cost_basis, current_price)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![new_id, account_id, symbol, shares, cost_basis, current_price],
        )
        .map_err(db_err)?;
        new_id
    };
    Ok(InvestmentHolding {
        id,
        account_id,
        symbol,
        shares,
        cost_basis,
        current_price,
    })
}

#[tauri::command]
pub fn delete_holding(state: State<AppState>, id: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    conn.execute("DELETE FROM investment_holdings WHERE id = ?1", [&id])
        .map_err(db_err)?;
    Ok(())
}

// ── LOANS ─────────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_loan_details(
    state: State<AppState>,
    account_id: String,
) -> Result<Option<LoanDetails>, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let result = conn.query_row(
        "SELECT account_id, principal, interest_rate, term_months, start_date
         FROM loan_details WHERE account_id = ?1",
        [&account_id],
        |row| {
            Ok(LoanDetails {
                account_id: row.get(0)?,
                principal: row.get(1)?,
                interest_rate: row.get(2)?,
                term_months: row.get(3)?,
                start_date: row.get(4)?,
            })
        },
    );
    match result {
        Ok(d) => Ok(Some(d)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(db_err(e)),
    }
}

#[tauri::command]
pub fn set_loan_details(
    state: State<AppState>,
    details: LoanDetails,
) -> Result<LoanDetails, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    conn.execute(
        "INSERT INTO loan_details (account_id, principal, interest_rate, term_months, start_date)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(account_id) DO UPDATE SET
           principal = excluded.principal,
           interest_rate = excluded.interest_rate,
           term_months = excluded.term_months,
           start_date = excluded.start_date",
        params![
            details.account_id,
            details.principal,
            details.interest_rate,
            details.term_months,
            details.start_date,
        ],
    )
    .map_err(db_err)?;
    Ok(details)
}

#[tauri::command]
pub fn calculate_loan_payment(
    state: State<AppState>,
    account_id: String,
) -> Result<f64, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let (principal, interest_rate, term_months): (f64, f64, i32) = conn
        .query_row(
            "SELECT principal, interest_rate, term_months FROM loan_details WHERE account_id = ?1",
            [&account_id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .map_err(|e| format!("Loan details not found: {e}"))?;
    let n = term_months as f64;
    if n <= 0.0 {
        return Err("Invalid loan term".into());
    }
    let monthly_rate = interest_rate / 100.0 / 12.0;
    if monthly_rate.abs() < f64::EPSILON {
        return Ok(principal / n);
    }
    let factor = (1.0 + monthly_rate).powf(n);
    Ok(principal * monthly_rate * factor / (factor - 1.0))
}

// ── EXCHANGE RATES ────────────────────────────────────────────────────────────

#[tauri::command]
pub fn list_exchange_rates(state: State<AppState>) -> Result<Vec<ExchangeRate>, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let mut stmt = conn
        .prepare(
            "SELECT id, from_currency, to_currency, rate, effective_date
             FROM exchange_rates ORDER BY effective_date DESC",
        )
        .map_err(db_err)?;
    let rates = stmt
        .query_map([], |row| {
            Ok(ExchangeRate {
                id: row.get(0)?,
                from_currency: row.get(1)?,
                to_currency: row.get(2)?,
                rate: row.get(3)?,
                effective_date: row.get(4)?,
            })
        })
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)?;
    Ok(rates)
}

#[tauri::command]
pub fn set_exchange_rate(
    state: State<AppState>,
    from: String,
    to: String,
    rate: f64,
    date: String,
) -> Result<ExchangeRate, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let existing: Option<String> = conn
        .query_row(
            "SELECT id FROM exchange_rates
             WHERE from_currency = ?1 AND to_currency = ?2 AND effective_date = ?3",
            params![from, to, date],
            |r| r.get(0),
        )
        .ok();
    let id = if let Some(eid) = existing {
        conn.execute(
            "UPDATE exchange_rates SET rate = ?4
             WHERE from_currency = ?1 AND to_currency = ?2 AND effective_date = ?3",
            params![from, to, date, rate],
        )
        .map_err(db_err)?;
        eid
    } else {
        let new_id = new_id();
        conn.execute(
            "INSERT INTO exchange_rates (id, from_currency, to_currency, rate, effective_date)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![new_id, from, to, rate, date],
        )
        .map_err(db_err)?;
        new_id
    };
    Ok(ExchangeRate {
        id,
        from_currency: from,
        to_currency: to,
        rate,
        effective_date: date,
    })
}

// ── REPORTS ───────────────────────────────────────────────────────────────────

fn current_month_bounds() -> (String, String) {
    let now = Utc::now().date_naive();
    let start = format!("{}-{:02}-01", now.year(), now.month());
    let end = if now.month() == 12 {
        format!("{}-01-01", now.year() + 1)
    } else {
        format!("{}-{:02}-01", now.year(), now.month() + 1)
    };
    (start, end)
}

#[tauri::command]
pub fn get_dashboard_summary(state: State<AppState>) -> Result<DashboardSummary, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let account_ids: Vec<String> = conn
        .prepare("SELECT id FROM accounts WHERE is_archived = 0")
        .map_err(db_err)?
        .query_map([], |r| r.get(0))
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)?;
    let mut net_worth = 0.0;
    for aid in &account_ids {
        net_worth += account_balance(&conn, aid)?;
    }
    let (month_start, month_end) = current_month_bounds();
    let monthly_income: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(t.amount), 0) FROM transactions t
             LEFT JOIN categories c ON c.id = t.category_id
             WHERE t.date >= ?1 AND t.date < ?2 AND t.amount > 0
             AND (c.category_type = 'income' OR c.id IS NULL)",
            params![month_start, month_end],
            |r| r.get(0),
        )
        .map_err(db_err)?;
    let monthly_spending: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(CASE WHEN t.amount < 0 THEN -t.amount ELSE 0 END), 0)
             FROM transactions t
             LEFT JOIN categories c ON c.id = t.category_id
             WHERE t.date >= ?1 AND t.date < ?2
             AND (c.category_type = 'expense' OR c.id IS NULL)",
            params![month_start, month_end],
            |r| r.get(0),
        )
        .map_err(db_err)?;
    let mut recent_stmt = conn
        .prepare(
            "SELECT t.id, t.account_id, t.date, t.payee_id, p.name, t.category_id, c.name,
                    t.amount, t.memo, t.cleared, t.reconciled, t.transfer_id
             FROM transactions t
             LEFT JOIN payees p ON t.payee_id = p.id
             LEFT JOIN categories c ON t.category_id = c.id
             ORDER BY t.date DESC, t.id DESC LIMIT 10",
        )
        .map_err(db_err)?;
    let recent_transactions = recent_stmt
        .query_map([], |row| row_to_transaction(&conn, row, None).map_err(to_sqlite_err))
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)?;
    let today = Utc::now().format("%Y-%m-%d").to_string();
    let mut rec_stmt = conn
        .prepare(
            "SELECT id, account_id, payee_name, category_id, amount, memo,
                    frequency, next_date, auto_enter, reminder_days
             FROM recurring_transactions
             WHERE next_date >= ?1
             ORDER BY next_date LIMIT 10",
        )
        .map_err(db_err)?;
    let upcoming_recurring = rec_stmt
        .query_map([&today], |row| {
            Ok(RecurringTransaction {
                id: row.get(0)?,
                account_id: row.get(1)?,
                payee_name: row.get(2)?,
                category_id: row.get(3)?,
                amount: row.get(4)?,
                memo: row.get(5)?,
                frequency: row.get(6)?,
                next_date: row.get(7)?,
                auto_enter: bool_from_i(row.get(8)?),
                reminder_days: row.get(9)?,
            })
        })
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)?;
    let period = format!("{}-{:02}", Utc::now().year(), Utc::now().month());
    let mut budget_stmt = conn
        .prepare(
            "SELECT b.id, b.category_id, c.name, b.period, b.amount
             FROM budgets b INNER JOIN categories c ON c.id = b.category_id
             WHERE b.period = ?1",
        )
        .map_err(db_err)?;
    let all_budgets = budget_stmt
        .query_map([&period], |row| row_to_budget(&conn, row, &period).map_err(to_sqlite_err))
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)?;
    let budget_alerts: Vec<Budget> = all_budgets
        .into_iter()
        .filter(|b| b.spent > b.amount)
        .collect();
    Ok(DashboardSummary {
        net_worth,
        monthly_income,
        monthly_spending,
        recent_transactions,
        upcoming_recurring,
        budget_alerts,
    })
}

#[tauri::command]
pub fn get_spending_by_category(
    state: State<AppState>,
    date_from: String,
    date_to: String,
) -> Result<Vec<CategorySpending>, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let mut stmt = conn
        .prepare(
            "SELECT c.id, c.name,
                    COALESCE(SUM(CASE WHEN t.amount < 0 THEN -t.amount ELSE 0 END), 0)
                    + COALESCE((
                        SELECT SUM(CASE WHEN s.amount < 0 THEN -s.amount ELSE s.amount END)
                        FROM transaction_splits s
                        INNER JOIN transactions t2 ON t2.id = s.transaction_id
                        WHERE s.category_id = c.id AND t2.date >= ?1 AND t2.date <= ?2
                    ), 0) AS total
             FROM categories c
             LEFT JOIN transactions t ON t.category_id = c.id AND t.date >= ?1 AND t.date <= ?2
             WHERE c.category_type = 'expense'
             GROUP BY c.id, c.name
             HAVING total > 0
             ORDER BY total DESC",
        )
        .map_err(db_err)?;
    let rows = stmt
        .query_map(params![date_from, date_to], |row| {
            Ok(CategorySpending {
                category_id: row.get(0)?,
                category_name: row.get(1)?,
                amount: row.get(2)?,
            })
        })
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)?;
    Ok(rows)
}

#[tauri::command]
pub fn get_income_vs_expense(
    state: State<AppState>,
    months: i32,
) -> Result<Vec<MonthlyFlow>, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let mut flows = Vec::new();
    for i in (0..months).rev() {
        let d = Utc::now()
            .date_naive()
            .checked_sub_months(Months::new(i as u32))
            .unwrap_or_else(|| Utc::now().date_naive());
        let label = format!("{}-{:02}", d.year(), d.month());
        let (from, to) = period_range(&label)?;
        let income: f64 = conn
            .query_row(
                "SELECT COALESCE(SUM(t.amount), 0) FROM transactions t
                 LEFT JOIN categories c ON c.id = t.category_id
                 WHERE t.date >= ?1 AND t.date < ?2 AND t.amount > 0
                 AND (c.category_type = 'income' OR c.id IS NULL)",
                params![from, to],
                |r| r.get(0),
            )
            .map_err(db_err)?;
        let expenses: f64 = conn
            .query_row(
                "SELECT COALESCE(SUM(CASE WHEN t.amount < 0 THEN -t.amount ELSE 0 END), 0)
                 FROM transactions t
                 LEFT JOIN categories c ON c.id = t.category_id
                 WHERE t.date >= ?1 AND t.date < ?2
                 AND (c.category_type = 'expense' OR c.id IS NULL)",
                params![from, to],
                |r| r.get(0),
            )
            .map_err(db_err)?;
        flows.push(MonthlyFlow {
            month: label,
            income,
            expenses,
        });
    }
    Ok(flows)
}

#[tauri::command]
pub fn get_cash_flow(
    state: State<AppState>,
    date_from: String,
    date_to: String,
) -> Result<Vec<MonthlyFlow>, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let mut stmt = conn
        .prepare(
            "SELECT substr(date, 1, 7) AS month,
                    COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0),
                    COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END), 0)
             FROM transactions
             WHERE date >= ?1 AND date <= ?2
             GROUP BY month ORDER BY month",
        )
        .map_err(db_err)?;
    let flows = stmt
        .query_map(params![date_from, date_to], |row| {
            Ok(MonthlyFlow {
                month: row.get(0)?,
                income: row.get(1)?,
                expenses: row.get(2)?,
            })
        })
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)?;
    Ok(flows)
}

#[tauri::command]
pub fn get_balance_history(
    state: State<AppState>,
    account_id: String,
    months: i32,
) -> Result<Vec<BalancePoint>, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let opening: f64 = conn
        .query_row(
            "SELECT opening_balance FROM accounts WHERE id = ?1",
            [&account_id],
            |r| r.get(0),
        )
        .map_err(db_err)?;
    let mut points = Vec::new();
    for i in (0..months).rev() {
        let d = Utc::now()
            .date_naive()
            .checked_sub_months(Months::new(i as u32))
            .unwrap_or_else(|| Utc::now().date_naive());
        let end_of_month = if d.month() == 12 {
            format!("{}-12-31", d.year())
        } else {
            let next = add_months(
                NaiveDate::from_ymd_opt(d.year(), d.month(), 1).unwrap(),
                1,
            )
            .unwrap();
            (next - chrono::Duration::days(1))
                .format("%Y-%m-%d")
                .to_string()
        };
        let tx_sum: f64 = conn
            .query_row(
                "SELECT COALESCE(SUM(amount), 0) FROM transactions
                 WHERE account_id = ?1 AND date <= ?2",
                params![account_id, end_of_month],
                |r| r.get(0),
            )
            .map_err(db_err)?;
        points.push(BalancePoint {
            date: end_of_month,
            balance: opening + tx_sum,
        });
    }
    Ok(points)
}

#[tauri::command]
pub fn get_net_worth_history(
    state: State<AppState>,
    months: i32,
) -> Result<Vec<BalancePoint>, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let account_ids: Vec<String> = conn
        .prepare("SELECT id FROM accounts WHERE is_archived = 0")
        .map_err(db_err)?
        .query_map([], |r| r.get(0))
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)?;
    let mut points = Vec::new();
    for i in (0..months).rev() {
        let d = Utc::now()
            .date_naive()
            .checked_sub_months(Months::new(i as u32))
            .unwrap_or_else(|| Utc::now().date_naive());
        let end_of_month = if d.month() == 12 {
            format!("{}-12-31", d.year())
        } else {
            let next = add_months(
                NaiveDate::from_ymd_opt(d.year(), d.month(), 1).unwrap(),
                1,
            )
            .unwrap();
            (next - chrono::Duration::days(1))
                .format("%Y-%m-%d")
                .to_string()
        };
        let mut total = 0.0;
        for aid in &account_ids {
            let opening: f64 = conn
                .query_row(
                    "SELECT opening_balance FROM accounts WHERE id = ?1",
                    [aid],
                    |r| r.get(0),
                )
                .map_err(db_err)?;
            let tx_sum: f64 = conn
                .query_row(
                    "SELECT COALESCE(SUM(amount), 0) FROM transactions
                     WHERE account_id = ?1 AND date <= ?2",
                    params![aid, end_of_month],
                    |r| r.get(0),
                )
                .map_err(db_err)?;
            total += opening + tx_sum;
        }
        points.push(BalancePoint {
            date: end_of_month,
            balance: total,
        });
    }
    Ok(points)
}

#[tauri::command]
pub fn get_tax_summary(state: State<AppState>, year: i32) -> Result<Vec<TaxSummaryRow>, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let from = format!("{year}-01-01");
    let to = format!("{year}-12-31");
    let mut stmt = conn
        .prepare(
            "SELECT c.name,
                    COALESCE(SUM(CASE WHEN t.amount < 0 THEN -t.amount ELSE 0 END), 0)
                    + COALESCE((
                        SELECT SUM(CASE WHEN s.amount < 0 THEN -s.amount ELSE s.amount END)
                        FROM transaction_splits s
                        INNER JOIN transactions t2 ON t2.id = s.transaction_id
                        WHERE s.category_id = c.id AND t2.date >= ?1 AND t2.date <= ?2
                    ), 0) AS total
             FROM categories c
             LEFT JOIN transactions t ON t.category_id = c.id AND t.date >= ?1 AND t.date <= ?2
             WHERE c.is_tax_related = 1
             GROUP BY c.id, c.name
             HAVING total > 0
             ORDER BY c.name",
        )
        .map_err(db_err)?;
    let rows = stmt
        .query_map(params![from, to], |row| {
            Ok(TaxSummaryRow {
                category_name: row.get(0)?,
                amount: row.get(1)?,
            })
        })
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)?;
    Ok(rows)
}

// ── IMPORT / EXPORT ───────────────────────────────────────────────────────────

fn escape_csv(value: &str) -> String {
    if value.contains(',') || value.contains('"') || value.contains('\n') {
        format!("\"{}\"", value.replace('"', "\"\""))
    } else {
        value.to_string()
    }
}

fn build_import_preview(
    conn: &Connection,
    account_id: &str,
    rows: Vec<ImportRow>,
) -> Result<ImportPreview, String> {
    let mut preview_rows = Vec::new();
    let mut duplicate_count = 0usize;
    for mut row in rows {
        row.is_duplicate = is_duplicate(conn, account_id, &row.date, row.amount, &row.payee)?;
        if row.is_duplicate {
            duplicate_count += 1;
        }
        preview_rows.push(row);
    }
    let total_rows = preview_rows.len();
    Ok(ImportPreview {
        rows: preview_rows,
        total_rows,
        duplicate_count,
    })
}

fn commit_import_rows(
    conn: &Connection,
    account_id: &str,
    rows: &[ImportRow],
) -> Result<i32, String> {
    let mut count = 0i32;
    for row in rows {
        if row.is_duplicate {
            continue;
        }
        let category_id = if let Some(ref cat_name) = row.category {
            conn.query_row(
                "SELECT id FROM categories WHERE lower(name) = lower(?1) LIMIT 1",
                [cat_name],
                |r| r.get::<_, String>(0),
            )
            .ok()
        } else {
            None
        };
        let input = CreateTransaction {
            account_id: account_id.to_string(),
            date: row.date.clone(),
            payee_name: row.payee.clone(),
            category_id,
            amount: row.amount,
            memo: row.memo.clone(),
            cleared: false,
            splits: Vec::new(),
            tag_ids: Vec::new(),
        };
        create_transaction_internal(conn, &input)?;
        count += 1;
    }
    Ok(count)
}

#[tauri::command]
pub fn export_transactions_csv(
    state: State<AppState>,
    account_id: Option<String>,
) -> Result<String, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let mut sql = String::from(
        "SELECT t.date, t.amount, p.name, t.memo, c.name, t.cleared, t.reconciled
         FROM transactions t
         LEFT JOIN payees p ON t.payee_id = p.id
         LEFT JOIN categories c ON t.category_id = c.id",
    );
    let mut params_vec: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    if let Some(ref aid) = account_id {
        sql.push_str(" WHERE t.account_id = ?");
        params_vec.push(Box::new(aid.clone()));
    }
    sql.push_str(" ORDER BY t.date, t.id");
    let params_ref: Vec<&dyn rusqlite::types::ToSql> =
        params_vec.iter().map(|p| p.as_ref()).collect();
    let mut stmt = conn.prepare(&sql).map_err(db_err)?;
    let mut csv = String::from("date,amount,payee,memo,category,cleared,reconciled\n");
    let rows = stmt
        .query_map(params_ref.as_slice(), |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, f64>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, Option<String>>(4)?,
                row.get::<_, i32>(5)?,
                row.get::<_, i32>(6)?,
            ))
        })
        .map_err(db_err)?;
    for row in rows {
        let (date, amount, payee, memo, category, cleared, reconciled) = row.map_err(db_err)?;
        csv.push_str(&format!(
            "{},{},{},{},{},{},{}\n",
            escape_csv(&date),
            amount,
            escape_csv(&payee.unwrap_or_default()),
            escape_csv(&memo.unwrap_or_default()),
            escape_csv(&category.unwrap_or_default()),
            cleared,
            reconciled,
        ));
    }
    Ok(csv)
}

#[tauri::command]
pub fn export_accounts_csv(state: State<AppState>) -> Result<String, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let mut csv = String::from("name,type,currency,opening_balance,institution,archived\n");
    let mut stmt = conn
        .prepare(
            "SELECT name, account_type, currency, opening_balance, institution, is_archived
             FROM accounts ORDER BY name",
        )
        .map_err(db_err)?;
    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, f64>(3)?,
                row.get::<_, Option<String>>(4)?,
                row.get::<_, i32>(5)?,
            ))
        })
        .map_err(db_err)?;
    for row in rows {
        let (name, atype, currency, opening, institution, archived) = row.map_err(db_err)?;
        csv.push_str(&format!(
            "{},{},{},{},{},{}\n",
            escape_csv(&name),
            escape_csv(&atype),
            escape_csv(&currency),
            opening,
            escape_csv(&institution.unwrap_or_default()),
            archived,
        ));
    }
    Ok(csv)
}

#[tauri::command]
pub fn export_categories_csv(state: State<AppState>) -> Result<String, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let mut csv = String::from("name,type,parent,tax_related\n");
    let mut stmt = conn
        .prepare(
            "SELECT c.name, c.category_type, p.name, c.is_tax_related
             FROM categories c
             LEFT JOIN categories p ON p.id = c.parent_id
             ORDER BY c.name",
        )
        .map_err(db_err)?;
    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, i32>(3)?,
            ))
        })
        .map_err(db_err)?;
    for row in rows {
        let (name, ctype, parent, tax) = row.map_err(db_err)?;
        csv.push_str(&format!(
            "{},{},{},{}\n",
            escape_csv(&name),
            escape_csv(&ctype),
            escape_csv(&parent.unwrap_or_default()),
            tax,
        ));
    }
    Ok(csv)
}

#[tauri::command]
pub fn preview_csv_import(
    state: State<AppState>,
    csv_content: String,
    account_id: String,
) -> Result<ImportPreview, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let rows = parse_csv_content(&csv_content);
    build_import_preview(&conn, &account_id, rows)
}

#[tauri::command]
pub fn commit_csv_import(
    state: State<AppState>,
    rows: Vec<ImportRow>,
    account_id: String,
) -> Result<i32, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    commit_import_rows(&conn, &account_id, &rows)
}

#[tauri::command]
pub fn preview_qif_import(
    state: State<AppState>,
    qif_content: String,
    account_id: String,
) -> Result<ImportPreview, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let rows = parse_qif_content(&qif_content);
    build_import_preview(&conn, &account_id, rows)
}

#[tauri::command]
pub fn commit_qif_import(
    state: State<AppState>,
    qif_content: String,
    account_id: String,
) -> Result<i32, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let rows = parse_qif_content(&qif_content);
    commit_import_rows(&conn, &account_id, &rows)
}

#[tauri::command]
pub fn preview_ofx_import(
    state: State<AppState>,
    ofx_content: String,
    account_id: String,
) -> Result<ImportPreview, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let rows = parse_ofx_content(&ofx_content);
    build_import_preview(&conn, &account_id, rows)
}

#[tauri::command]
pub fn commit_ofx_import(
    state: State<AppState>,
    ofx_content: String,
    account_id: String,
) -> Result<i32, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let rows = parse_ofx_content(&ofx_content);
    commit_import_rows(&conn, &account_id, &rows)
}

// ── BACKUP ────────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn backup_database(app: tauri::AppHandle, dest_path: String) -> Result<(), String> {
    let dest = validate_file_path(&dest_path)?;
    let src = crate::db::db_path(&app)?;
    crate::db::backup_database_file(&src, &dest)?;
    log::info!("Database backed up to {}", dest.display());
    Ok(())
}

#[tauri::command]
pub fn restore_database(app: tauri::AppHandle, src_path: String) -> Result<(), String> {
    let src = validate_file_path(&src_path)?;
    let dest = crate::db::db_path(&app)?;
    crate::db::restore_database_file(&src, &dest)?;
    log::warn!("Database restored from {}", src.display());
    Ok(())
}

// ── SECURITY ──────────────────────────────────────────────────────────────────

const MASTER_HASH_KEY: &str = "master_password_hash";
const MASTER_SALT_KEY: &str = "master_password_salt";

fn verify_password_internal(conn: &Connection, password: &str) -> Result<bool, String> {
    let hash: Option<String> = conn
        .query_row(
            "SELECT value FROM settings WHERE key = ?1",
            [MASTER_HASH_KEY],
            |r| r.get(0),
        )
        .ok();
    let salt: Option<String> = conn
        .query_row(
            "SELECT value FROM settings WHERE key = ?1",
            [MASTER_SALT_KEY],
            |r| r.get(0),
        )
        .ok();
    match (hash, salt) {
        (Some(stored), Some(salt)) => Ok(hash_password(password, &salt) == stored),
        _ => Ok(false),
    }
}

#[tauri::command]
pub fn set_master_password(state: State<AppState>, password: String) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let salt = new_id();
    let hash = hash_password(&password, &salt);
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![MASTER_SALT_KEY, salt],
    )
    .map_err(db_err)?;
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![MASTER_HASH_KEY, hash],
    )
    .map_err(db_err)?;
    Ok(())
}

#[tauri::command]
pub fn has_master_password(state: State<AppState>) -> Result<bool, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    let exists: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM settings WHERE key = ?1",
            [MASTER_HASH_KEY],
            |r| r.get(0),
        )
        .map_err(db_err)?;
    Ok(exists > 0)
}

#[tauri::command]
pub fn lock_app(state: State<AppState>) -> Result<(), String> {
    let mut locked = state.is_locked.lock().map_err(|e| format!("Lock error: {e}"))?;
    *locked = true;
    Ok(())
}

#[tauri::command]
pub fn unlock_app(state: State<AppState>, password: String) -> Result<bool, String> {
    let conn = state.db.lock().map_err(|e| format!("Lock error: {e}"))?;
    if !verify_password_internal(&conn, &password)? {
        return Ok(false);
    }
    drop(conn);
    let mut locked = state.is_locked.lock().map_err(|e| format!("Lock error: {e}"))?;
    *locked = false;
    Ok(true)
}

#[tauri::command]
pub fn is_app_locked(state: State<AppState>) -> Result<bool, String> {
    let locked = state.is_locked.lock().map_err(|e| format!("Lock error: {e}"))?;
    Ok(*locked)
}

#[cfg(test)]
mod integration_tests {
    use super::*;
    use crate::db::open_test_connection;

    fn create_test_account(conn: &Connection) -> String {
        let id = new_id();
        conn.execute(
            "INSERT INTO accounts (id, name, account_type, currency, opening_balance, is_archived, created_at)
             VALUES (?1, 'Test', 'checking', 'USD', 100.0, 0, '2024-01-01')",
            [&id],
        )
        .unwrap();
        id
    }

    #[test]
    fn transaction_lifecycle() {
        let conn = open_test_connection();
        let account_id = create_test_account(&conn);
        let input = CreateTransaction {
            account_id: account_id.clone(),
            date: "2024-02-01".into(),
            payee_name: Some("Store".into()),
            category_id: None,
            amount: -25.0,
            memo: None,
            cleared: false,
            splits: vec![],
            tag_ids: vec![],
        };
        let tx = create_transaction_internal(&conn, &input).unwrap();
        assert!((tx.amount + 25.0).abs() < 0.01);

        conn.execute(
            "UPDATE transactions SET amount = -30.0, memo = 'Updated' WHERE id = ?1",
            [&tx.id],
        )
        .unwrap();
        let tx2 = get_transaction_internal(&conn, &tx.id).unwrap();
        assert!((tx2.amount + 30.0).abs() < 0.01);

        delete_transaction_children(&conn, &tx.id).unwrap();
        conn.execute("DELETE FROM transactions WHERE id = ?1", [&tx.id])
            .unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM transactions WHERE id = ?1", [&tx.id], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn transfer_syncs_both_accounts() {
        let conn = open_test_connection();
        let from_id = create_test_account(&conn);
        let to_id = create_test_account(&conn);
        let transfer_id = new_id();
        let from_tx = new_id();
        let to_tx = new_id();
        conn.execute(
            "INSERT INTO transactions (id, account_id, date, amount, cleared, reconciled, transfer_id)
             VALUES (?1, ?2, '2024-03-01', -50.0, 0, 0, ?3)",
            params![from_tx, from_id, transfer_id],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO transactions (id, account_id, date, amount, cleared, reconciled, transfer_id)
             VALUES (?1, ?2, '2024-03-01', 50.0, 0, 0, ?3)",
            params![to_tx, to_id, transfer_id],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO transfers (id, from_transaction_id, to_transaction_id) VALUES (?1, ?2, ?3)",
            params![transfer_id, from_tx, to_tx],
        )
        .unwrap();
        let from_bal = account_balance(&conn, &from_id).unwrap();
        let to_bal = account_balance(&conn, &to_id).unwrap();
        assert!((from_bal - 50.0).abs() < 0.01);
        assert!((to_bal - 150.0).abs() < 0.01);
    }

    #[test]
    fn import_duplicate_detection() {
        let conn = open_test_connection();
        let account_id = create_test_account(&conn);
        let input = CreateTransaction {
            account_id: account_id.clone(),
            date: "2024-04-01".into(),
            payee_name: Some("Coffee".into()),
            category_id: None,
            amount: -5.0,
            memo: None,
            cleared: false,
            splits: vec![],
            tag_ids: vec![],
        };
        create_transaction_internal(&conn, &input).unwrap();
        let rows = parse_csv_content("2024-04-01,-5.00,Coffee,,");
        let preview = build_import_preview(&conn, &account_id, rows).unwrap();
        assert_eq!(preview.duplicate_count, 1);
        assert!(preview.rows[0].is_duplicate);
    }

    #[test]
    fn paginated_register_running_balance() {
        let conn = open_test_connection();
        let account_id = create_test_account(&conn);
        for i in 1..=5 {
            let input = CreateTransaction {
                account_id: account_id.clone(),
                date: format!("2024-05-{i:02}"),
                payee_name: None,
                category_id: None,
                amount: -10.0,
                memo: None,
                cleared: false,
                splits: vec![],
                tag_ids: vec![],
            };
            create_transaction_internal(&conn, &input).unwrap();
        }
        let filter = TransactionFilter {
            account_id: Some(account_id),
            limit: Some(2),
            offset: Some(2),
            ..Default::default()
        };
        let page = list_transactions_internal(&conn, filter).unwrap();
        assert_eq!(page.len(), 2);
        assert!((page[0].running_balance.unwrap() - 70.0).abs() < 0.01);
    }

    fn first_category_id(conn: &Connection) -> String {
        conn.query_row("SELECT id FROM categories LIMIT 1", [], |r| r.get(0))
            .unwrap()
    }

    #[test]
    fn auto_rules_apply_by_priority_and_skip_categorized() {
        let conn = open_test_connection();
        let account_id = create_test_account(&conn);
        let groceries = conn
            .query_row(
                "SELECT id FROM categories WHERE name = 'Groceries' LIMIT 1",
                [],
                |r| r.get::<_, String>(0),
            )
            .unwrap();
        let restaurants = conn
            .query_row(
                "SELECT id FROM categories WHERE name = 'Restaurants' LIMIT 1",
                [],
                |r| r.get::<_, String>(0),
            )
            .unwrap();

        conn.execute(
            "INSERT INTO auto_categorize_rules (id, pattern, category_id, target_field, match_type, priority, enabled)
             VALUES ('rule-low', 'starbucks', ?1, 'payee', 'contains', 200, 1)",
            [&restaurants],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO auto_categorize_rules (id, pattern, category_id, target_field, match_type, priority, enabled)
             VALUES ('rule-high', 'starbucks', ?1, 'payee', 'contains', 10, 1)",
            [&groceries],
        )
        .unwrap();

        let tx_id = new_id();
        let payee_id = new_id();
        conn.execute(
            "INSERT INTO payees (id, name) VALUES (?1, 'Starbucks')",
            [&payee_id],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO transactions (id, account_id, date, payee_id, amount, cleared, reconciled)
             VALUES (?1, ?2, '2024-06-01', ?3, -5.0, 0, 0)",
            params![tx_id, account_id, payee_id],
        )
        .unwrap();

        let updated = apply_auto_rules_internal(&conn, false).unwrap();
        assert_eq!(updated, 1);
        let cat: String = conn
            .query_row(
                "SELECT category_id FROM transactions WHERE id = ?1",
                [&tx_id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(cat, groceries);

        let updated_again = apply_auto_rules_internal(&conn, false).unwrap();
        assert_eq!(updated_again, 0);
    }

    #[test]
    fn auto_rules_match_memo_field() {
        let conn = open_test_connection();
        let account_id = create_test_account(&conn);
        let category_id = first_category_id(&conn);
        conn.execute(
            "INSERT INTO auto_categorize_rules (id, pattern, category_id, target_field, match_type, priority, enabled)
             VALUES ('rule-memo', 'reimbursement', ?1, 'memo', 'contains', 100, 1)",
            [&category_id],
        )
        .unwrap();
        let tx_id = new_id();
        conn.execute(
            "INSERT INTO transactions (id, account_id, date, amount, memo, cleared, reconciled)
             VALUES (?1, ?2, '2024-06-02', 100.0, 'Travel reimbursement', 0, 0)",
            params![tx_id, account_id],
        )
        .unwrap();
        assert_eq!(apply_auto_rules_internal(&conn, false).unwrap(), 1);
    }

    #[test]
    fn master_password_verify_round_trip() {
        let conn = open_test_connection();
        assert!(!verify_password_internal(&conn, "secret").unwrap());
        let salt = new_id();
        let hash = hash_password("secret", &salt);
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)",
            params![MASTER_SALT_KEY, salt],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)",
            params![MASTER_HASH_KEY, hash],
        )
        .unwrap();
        assert!(verify_password_internal(&conn, "secret").unwrap());
        assert!(!verify_password_internal(&conn, "wrong").unwrap());
    }

    #[test]
    fn attachment_lifecycle() {
        let conn = open_test_connection();
        let account_id = create_test_account(&conn);
        let tx = create_transaction_internal(
            &conn,
            &CreateTransaction {
                account_id,
                date: "2024-06-03".into(),
                payee_name: Some("Store".into()),
                category_id: None,
                amount: -12.0,
                memo: None,
                cleared: false,
                splits: vec![],
                tag_ids: vec![],
            },
        )
        .unwrap();
        let attachment_id = new_id();
        let file_path = if cfg!(windows) {
            "C:\\temp\\kwiken-receipt.pdf".to_string()
        } else {
            "/tmp/kwiken-receipt.pdf".to_string()
        };
        validate_file_path(&file_path).expect("valid path");
        conn.execute(
            "INSERT INTO attachments (id, transaction_id, file_path, mime_type)
             VALUES (?1, ?2, ?3, 'application/pdf')",
            params![attachment_id, tx.id, file_path],
        )
        .unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM attachments WHERE transaction_id = ?1",
                [&tx.id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
        conn.execute("DELETE FROM attachments WHERE id = ?1", [&attachment_id])
            .unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM attachments WHERE transaction_id = ?1",
                [&tx.id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn paginated_register_handles_ten_thousand_transactions() {
        use std::time::Instant;

        let conn = open_test_connection();
        let account_id = create_test_account(&conn);
        conn.execute("BEGIN", []).unwrap();
        for i in 0..10_000 {
            conn.execute(
                "INSERT INTO transactions (id, account_id, date, amount, cleared, reconciled)
                 VALUES (?1, ?2, ?3, -1.0, 0, 0)",
                params![format!("tx-{i}"), account_id, format!("2024-01-{:02}", (i % 28) + 1)],
            )
            .unwrap();
        }
        conn.execute("COMMIT", []).unwrap();

        let filter = TransactionFilter {
            account_id: Some(account_id),
            limit: Some(100),
            offset: Some(9900),
            ..Default::default()
        };
        let start = Instant::now();
        let page = list_transactions_internal(&conn, filter).unwrap();
        let elapsed = start.elapsed();
        assert_eq!(page.len(), 100);
        assert!(
            elapsed.as_millis() < 3000,
            "pagination over 10k rows took too long: {:?}",
            elapsed
        );
    }
}
