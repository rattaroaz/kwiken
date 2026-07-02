use rusqlite::{Connection, Result as SqlResult};
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;

pub const MIGRATIONS: &[(&str, &str)] = &[
    (
        "001_initial",
        r#"
        CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL);
        INSERT OR IGNORE INTO schema_version (rowid, version) VALUES (1, 0);

        CREATE TABLE IF NOT EXISTS accounts (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            account_type TEXT NOT NULL,
            currency TEXT NOT NULL DEFAULT 'USD',
            opening_balance REAL NOT NULL DEFAULT 0,
            institution TEXT,
            is_archived INTEGER NOT NULL DEFAULT 0,
            minimum_payment REAL,
            payment_due_day INTEGER,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS categories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            parent_id TEXT REFERENCES categories(id),
            category_type TEXT NOT NULL,
            is_tax_related INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS payees (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            default_category_id TEXT REFERENCES categories(id)
        );

        CREATE TABLE IF NOT EXISTS transactions (
            id TEXT PRIMARY KEY,
            account_id TEXT NOT NULL REFERENCES accounts(id),
            date TEXT NOT NULL,
            payee_id TEXT REFERENCES payees(id),
            category_id TEXT REFERENCES categories(id),
            amount REAL NOT NULL,
            memo TEXT,
            cleared INTEGER NOT NULL DEFAULT 0,
            reconciled INTEGER NOT NULL DEFAULT 0,
            transfer_id TEXT
        );

        CREATE TABLE IF NOT EXISTS transaction_splits (
            id TEXT PRIMARY KEY,
            transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
            category_id TEXT REFERENCES categories(id),
            amount REAL NOT NULL,
            memo TEXT
        );

        CREATE TABLE IF NOT EXISTS transfers (
            id TEXT PRIMARY KEY,
            from_transaction_id TEXT NOT NULL REFERENCES transactions(id),
            to_transaction_id TEXT NOT NULL REFERENCES transactions(id)
        );

        CREATE TABLE IF NOT EXISTS budgets (
            id TEXT PRIMARY KEY,
            category_id TEXT NOT NULL REFERENCES categories(id),
            period TEXT NOT NULL,
            amount REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS recurring_transactions (
            id TEXT PRIMARY KEY,
            account_id TEXT NOT NULL REFERENCES accounts(id),
            payee_name TEXT,
            category_id TEXT REFERENCES categories(id),
            amount REAL NOT NULL,
            memo TEXT,
            frequency TEXT NOT NULL,
            next_date TEXT NOT NULL,
            auto_enter INTEGER NOT NULL DEFAULT 0,
            reminder_days INTEGER NOT NULL DEFAULT 3
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS attachments (
            id TEXT PRIMARY KEY,
            transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
            file_path TEXT NOT NULL,
            mime_type TEXT
        );

        CREATE TABLE IF NOT EXISTS tags (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            color TEXT
        );

        CREATE TABLE IF NOT EXISTS transaction_tags (
            transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
            tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
            PRIMARY KEY (transaction_id, tag_id)
        );

        CREATE TABLE IF NOT EXISTS auto_categorize_rules (
            id TEXT PRIMARY KEY,
            pattern TEXT NOT NULL,
            category_id TEXT NOT NULL REFERENCES categories(id)
        );

        CREATE TABLE IF NOT EXISTS saved_filters (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            account_id TEXT,
            filter_json TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS transaction_templates (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            payee_name TEXT,
            category_id TEXT,
            amount REAL,
            memo TEXT
        );

        CREATE TABLE IF NOT EXISTS investment_holdings (
            id TEXT PRIMARY KEY,
            account_id TEXT NOT NULL REFERENCES accounts(id),
            symbol TEXT NOT NULL,
            shares REAL NOT NULL,
            cost_basis REAL NOT NULL,
            current_price REAL
        );

        CREATE TABLE IF NOT EXISTS loan_details (
            account_id TEXT PRIMARY KEY REFERENCES accounts(id),
            principal REAL NOT NULL,
            interest_rate REAL NOT NULL,
            term_months INTEGER NOT NULL,
            start_date TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS exchange_rates (
            id TEXT PRIMARY KEY,
            from_currency TEXT NOT NULL,
            to_currency TEXT NOT NULL,
            rate REAL NOT NULL,
            effective_date TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
        CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
        CREATE INDEX IF NOT EXISTS idx_transactions_payee ON transactions(payee_id);
        CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
        CREATE INDEX IF NOT EXISTS idx_splits_transaction ON transaction_splits(transaction_id);
        CREATE INDEX IF NOT EXISTS idx_splits_category ON transaction_splits(category_id);
        "#,
    ),
];

pub fn db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Could not resolve app data directory: {e}"))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("Could not create app data directory: {e}"))?;
    Ok(dir.join("kwiken.db"))
}

pub fn open_connection(app: &AppHandle) -> Result<Connection, String> {
    let path = db_path(app)?;
    let conn = Connection::open(&path).map_err(|e| format!("Database open failed: {e}"))?;
    conn.execute("PRAGMA foreign_keys = ON", [])
        .map_err(|e| format!("Database pragma failed: {e}"))?;
    run_migrations(&conn)?;
    Ok(conn)
}

fn run_migrations(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL);
         INSERT OR IGNORE INTO schema_version (rowid, version) VALUES (1, 0);",
    )
    .map_err(|e| format!("Migration setup failed: {e}"))?;

    let current: i32 = conn
        .query_row("SELECT version FROM schema_version LIMIT 1", [], |r| r.get(0))
        .map_err(|e| format!("Could not read schema version: {e}"))?;

    for (i, (_, sql)) in MIGRATIONS.iter().enumerate() {
        let version = (i + 1) as i32;
        if current < version {
            conn.execute_batch(sql)
                .map_err(|e| format!("Migration {version} failed: {e}"))?;
            conn.execute(
                "UPDATE schema_version SET version = ?1",
                [version],
            )
            .map_err(|e| format!("Could not update schema version: {e}"))?;
        }
    }
    Ok(())
}

pub fn new_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

pub fn now_iso() -> String {
    chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string()
}

pub fn validate_file_path(path: &str) -> Result<PathBuf, String> {
    if path.contains("..") {
        return Err("Invalid file path".into());
    }
    let p = PathBuf::from(path);
    if !p.is_absolute() {
        return Err("File path must be absolute".into());
    }
    Ok(p)
}

pub fn ensure_payee(conn: &Connection, name: &str) -> SqlResult<String> {
    if let Ok(id) = conn.query_row(
        "SELECT id FROM payees WHERE lower(name) = lower(?1)",
        [name],
        |r| r.get::<_, String>(0),
    ) {
        return Ok(id);
    }
    let id = new_id();
    conn.execute(
        "INSERT INTO payees (id, name) VALUES (?1, ?2)",
        rusqlite::params![id, name],
    )?;
    Ok(id)
}

pub fn account_balance(conn: &Connection, account_id: &str) -> Result<f64, String> {
    let opening: f64 = conn
        .query_row(
            "SELECT opening_balance FROM accounts WHERE id = ?1",
            [account_id],
            |r| r.get(0),
        )
        .map_err(|e| format!("Account not found: {e}"))?;
    let tx_sum: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE account_id = ?1",
            [account_id],
            |r| r.get(0),
        )
        .map_err(|e| format!("Balance query failed: {e}"))?;
    Ok(opening + tx_sum)
}

pub fn seed_default_categories(conn: &Connection) -> Result<(), String> {
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM categories", [], |r| r.get(0))
        .map_err(|e| format!("Category count failed: {e}"))?;
    if count > 0 {
        return Ok(());
    }

    let defaults: &[(&str, &str, &str)] = &[
        ("Food & Dining", "expense", "0"),
        ("Groceries", "expense", "Food & Dining"),
        ("Restaurants", "expense", "Food & Dining"),
        ("Housing", "expense", "0"),
        ("Rent/Mortgage", "expense", "Housing"),
        ("Utilities", "expense", "Housing"),
        ("Transportation", "expense", "0"),
        ("Gas", "expense", "Transportation"),
        ("Public Transit", "expense", "Transportation"),
        ("Healthcare", "expense", "0"),
        ("Entertainment", "expense", "0"),
        ("Shopping", "expense", "0"),
        ("Personal", "expense", "0"),
        ("Education", "expense", "0"),
        ("Salary", "income", "0"),
        ("Freelance", "income", "0"),
        ("Investment Income", "income", "0"),
        ("Other Income", "income", "0"),
        ("Transfer", "transfer", "0"),
        ("Taxes", "expense", "0"),
    ];

    let mut parent_ids: std::collections::HashMap<String, String> =
        std::collections::HashMap::new();

    for (name, cat_type, parent) in defaults {
        let id = new_id();
        let parent_id = if *parent == "0" {
            None
        } else {
            parent_ids.get(*parent).cloned()
        };
        let tax = if *name == "Taxes" { 1 } else { 0 };
        conn.execute(
            "INSERT INTO categories (id, name, parent_id, category_type, is_tax_related) VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![id, name, parent_id, cat_type, tax],
        )
        .map_err(|e| format!("Seed category failed: {e}"))?;
        if *parent == "0" {
            parent_ids.insert(name.to_string(), id);
        }
    }
    Ok(())
}

pub fn apply_auto_category(conn: &Connection, payee_name: &str) -> Option<String> {
    let lower = payee_name.to_lowercase();
    let mut stmt = conn
        .prepare(
            "SELECT r.category_id FROM auto_categorize_rules r
             WHERE lower(?1) LIKE '%' || lower(r.pattern) || '%'",
        )
        .ok()?;
    let mut rows = stmt.query([&lower]).ok()?;
    if let Ok(Some(row)) = rows.next() {
        return row.get(0).ok();
    }
    conn.query_row(
        "SELECT default_category_id FROM payees WHERE lower(name) = lower(?1)",
        [payee_name],
        |r| r.get::<_, Option<String>>(0),
    )
    .ok()
    .flatten()
}
