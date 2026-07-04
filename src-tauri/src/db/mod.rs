use rusqlite::{Connection, Result as SqlResult};
use std::path::{Path, PathBuf};
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
    (
        "002_auto_rule_engine",
        r#"
        ALTER TABLE auto_categorize_rules ADD COLUMN target_field TEXT NOT NULL DEFAULT 'payee';
        ALTER TABLE auto_categorize_rules ADD COLUMN match_type TEXT NOT NULL DEFAULT 'contains';
        ALTER TABLE auto_categorize_rules ADD COLUMN priority INTEGER NOT NULL DEFAULT 100;
        ALTER TABLE auto_categorize_rules ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1;
        CREATE INDEX IF NOT EXISTS idx_auto_rules_priority ON auto_categorize_rules(enabled, priority);
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
    open_connection_at_path(&path)
}

/// Opens (or creates) a SQLite database at `path`, applies pragmas and migrations.
pub fn open_connection_at_path(path: &Path) -> Result<Connection, String> {
    let conn = Connection::open(path).map_err(|e| format!("Database open failed: {e}"))?;
    conn.execute("PRAGMA foreign_keys = ON", [])
        .map_err(|e| format!("Database pragma failed: {e}"))?;
    // journal_mode returns a row; use pragma_update instead of execute.
    conn.pragma_update(None, "journal_mode", "WAL")
        .map_err(|e| format!("Database pragma failed: {e}"))?;
    run_migrations(&conn)?;
    Ok(conn)
}

pub fn backup_database_file(source: &Path, dest: &Path) -> Result<(), String> {
    if !source.exists() {
        return Err("Source database file not found".into());
    }
    std::fs::copy(source, dest)
        .map(|_| ())
        .map_err(|e| format!("Backup failed: {e}"))
}

pub fn restore_database_file(source: &Path, dest: &Path) -> Result<(), String> {
    if !source.exists() {
        return Err("Source database file not found".into());
    }
    std::fs::copy(source, dest)
        .map(|_| ())
        .map_err(|e| format!("Restore failed: {e}"))
}

pub fn check_integrity(conn: &Connection) -> bool {
    conn.query_row("PRAGMA integrity_check", [], |r| r.get::<_, String>(0))
        .map(|result| result == "ok")
        .unwrap_or(false)
}

const SHUTDOWN_KEY: &str = "last_shutdown_clean";

pub fn detect_unclean_shutdown(conn: &Connection) -> Result<bool, String> {
    let was_clean: Option<String> = conn
        .query_row(
            "SELECT value FROM settings WHERE key = ?1",
            [SHUTDOWN_KEY],
            |r| r.get(0),
        )
        .ok();
    let unclean = was_clean.as_deref() == Some("false");
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, 'false')
         ON CONFLICT(key) DO UPDATE SET value = 'false'",
        [SHUTDOWN_KEY],
    )
    .map_err(|e| format!("Could not record session start: {e}"))?;
    Ok(unclean)
}

pub fn mark_clean_shutdown(conn: &Connection) -> Result<(), String> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, 'true')
         ON CONFLICT(key) DO UPDATE SET value = 'true'",
        [SHUTDOWN_KEY],
    )
    .map_err(|e| format!("Could not mark clean shutdown: {e}"))?;
    Ok(())
}

#[cfg(test)]
pub fn open_test_connection() -> Connection {
    let conn = Connection::open_in_memory().expect("in-memory db");
    conn.execute("PRAGMA foreign_keys = ON", []).unwrap();
    run_migrations(&conn).expect("migrations");
    seed_default_categories(&conn).expect("seed");
    conn
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

pub fn auto_rule_matches(
    target_field: &str,
    match_type: &str,
    pattern: &str,
    payee_name: &str,
    memo: Option<&str>,
) -> bool {
    let needle = pattern.trim().to_lowercase();
    if needle.is_empty() {
        return false;
    }
    let payee = payee_name.to_lowercase();
    let memo = memo.unwrap_or_default().to_lowercase();
    let haystacks: Vec<&str> = match target_field {
        "memo" => vec![memo.as_str()],
        "payee_or_memo" => vec![payee.as_str(), memo.as_str()],
        _ => vec![payee.as_str()],
    };

    haystacks.iter().any(|value| match match_type {
        "starts_with" => value.starts_with(&needle),
        "equals" => value == &needle,
        _ => value.contains(&needle),
    })
}

pub fn apply_auto_category(conn: &Connection, payee_name: &str, memo: Option<&str>) -> Option<String> {
    let mut stmt = conn
        .prepare(
            "SELECT pattern, category_id, target_field, match_type
             FROM auto_categorize_rules
             WHERE enabled = 1
             ORDER BY priority ASC, pattern ASC",
        )
        .ok()?;
    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
            ))
        })
        .ok()?;
    for (pattern, category_id, target_field, match_type) in rows.flatten() {
        if auto_rule_matches(&target_field, &match_type, &pattern, payee_name, memo) {
            return Some(category_id);
        }
    }
    conn.query_row(
        "SELECT default_category_id FROM payees WHERE lower(name) = lower(?1)",
        [payee_name],
        |r| r.get::<_, Option<String>>(0),
    )
    .ok()
    .flatten()
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::params;

    #[test]
    fn integrity_check_passes_on_fresh_db() {
        let conn = open_test_connection();
        assert!(check_integrity(&conn));
    }

    #[test]
    fn unclean_shutdown_detection() {
        let conn = open_test_connection();
        assert!(!detect_unclean_shutdown(&conn).unwrap());
        mark_clean_shutdown(&conn).unwrap();
        assert!(!detect_unclean_shutdown(&conn).unwrap());
        conn.execute(
            "UPDATE settings SET value = 'false' WHERE key = ?1",
            [SHUTDOWN_KEY],
        )
        .unwrap();
        assert!(detect_unclean_shutdown(&conn).unwrap());
    }

    #[test]
    fn open_connection_at_path_applies_wal_and_migrations() {
        let path = std::env::temp_dir().join(format!("kwiken-open-test-{}.db", new_id()));
        let conn = open_connection_at_path(&path).expect("open at path");
        let mode: String = conn
            .query_row("PRAGMA journal_mode", [], |r| r.get(0))
            .expect("journal_mode");
        assert_eq!(mode.to_lowercase(), "wal");
        let version: i32 = conn
            .query_row("SELECT version FROM schema_version LIMIT 1", [], |r| r.get(0))
            .expect("schema version");
        assert!(version >= 1);
        drop(conn);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn backup_and_restore_round_trip() {
        let dir = std::env::temp_dir().join(format!("kwiken-backup-test-{}", new_id()));
        std::fs::create_dir_all(&dir).expect("temp dir");
        let live = dir.join("kwiken.db");
        let backup = dir.join("backup.db");
        let restored = dir.join("restored.db");

        {
            let conn = open_connection_at_path(&live).expect("open live db");
            conn.execute(
                "INSERT INTO accounts (id, name, account_type, currency, opening_balance, is_archived, created_at)
                 VALUES ('acct-1', 'Backup Test', 'checking', 'USD', 500.0, 0, '2024-01-01')",
                [],
            )
            .expect("seed account");
        }

        backup_database_file(&live, &backup).expect("backup");
        assert!(backup.exists());

        restore_database_file(&backup, &restored).expect("restore");
        let conn = Connection::open(&restored).expect("open restored");
        let name: String = conn
            .query_row("SELECT name FROM accounts WHERE id = 'acct-1'", [], |r| r.get(0))
            .expect("restored row");
        assert_eq!(name, "Backup Test");

        drop(conn);
        let _ = std::fs::remove_dir_all(dir);
    }

    #[test]
    fn validate_file_path_rejects_relative_paths() {
        assert!(validate_file_path("relative/path.db").is_err());
    }

    #[test]
    fn validate_file_path_rejects_traversal() {
        let bad = if cfg!(windows) {
            "C:\\Users\\..\\etc\\passwd"
        } else {
            "/tmp/../etc/passwd"
        };
        assert!(validate_file_path(bad).is_err());
    }

    #[test]
    fn auto_rule_matches_payee_contains_and_equals() {
        assert!(auto_rule_matches("payee", "contains", "star", "Starbucks", None));
        assert!(!auto_rule_matches("payee", "contains", "coffee", "Starbucks", None));
        assert!(auto_rule_matches("payee", "equals", "starbucks", "Starbucks", None));
        assert!(!auto_rule_matches("payee", "equals", "star", "Starbucks", None));
    }

    #[test]
    fn auto_rule_matches_memo_and_payee_or_memo() {
        assert!(auto_rule_matches("memo", "contains", "refund", "Store", Some("Partial refund")));
        assert!(auto_rule_matches(
            "payee_or_memo",
            "starts_with",
            "travel",
            "Employer",
            Some("Travel reimbursement"),
        ));
        assert!(!auto_rule_matches("memo", "contains", "", "Store", Some("note")));
    }

    #[test]
    fn migration_v1_to_v2_preserves_auto_rules() {
        let path = std::env::temp_dir().join(format!("kwiken-migrate-v2-{}.db", new_id()));
        let rule_id = new_id();
        let category_id: String;
        {
            let conn = Connection::open(&path).expect("open v1 db");
            conn.execute("PRAGMA foreign_keys = ON", []).expect("foreign keys");
            conn.execute_batch(MIGRATIONS[0].1).expect("migration 001");
            conn.execute("UPDATE schema_version SET version = 1", [])
                .expect("set version");
            seed_default_categories(&conn).expect("seed categories");
            category_id = conn
                .query_row("SELECT id FROM categories LIMIT 1", [], |r| r.get(0))
                .expect("category id");
            conn.execute(
                "INSERT INTO auto_categorize_rules (id, pattern, category_id) VALUES (?1, 'coffee', ?2)",
                params![rule_id, category_id],
            )
            .expect("insert rule");
        }

        {
            let conn = open_connection_at_path(&path).expect("upgrade to v2");
            let version: i32 = conn
                .query_row("SELECT version FROM schema_version LIMIT 1", [], |r| r.get(0))
                .expect("schema version");
            assert_eq!(version, 2);
            let (pattern, cat, target_field, match_type, priority, enabled): (
                String,
                String,
                String,
                String,
                i64,
                i64,
            ) = conn
                .query_row(
                    "SELECT pattern, category_id, target_field, match_type, priority, enabled
                     FROM auto_categorize_rules WHERE id = ?1",
                    [&rule_id],
                    |r| {
                        Ok((
                            r.get(0)?,
                            r.get(1)?,
                            r.get(2)?,
                            r.get(3)?,
                            r.get(4)?,
                            r.get(5)?,
                        ))
                    },
                )
                .expect("rule row");
            assert_eq!(pattern, "coffee");
            assert_eq!(cat, category_id);
            assert_eq!(target_field, "payee");
            assert_eq!(match_type, "contains");
            assert_eq!(priority, 100);
            assert_eq!(enabled, 1);
        }

        let _ = std::fs::remove_file(path);
    }
}
