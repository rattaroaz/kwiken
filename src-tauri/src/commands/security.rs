use crate::crypto::{
    hash_password_argon2, hash_password_sha256_legacy, verify_password_argon2, ALGO_ARGON2,
    ALGO_SHA256_LEGACY, MASTER_HASH_KEY, MASTER_SALT_KEY, PASSWORD_ALGO_KEY,
};
use crate::db::{db_path, enable_encryption, has_master_password_hash, is_encryption_enabled};
use crate::state::AppState;
use rusqlite::{params, Connection};
use tauri::State;

fn db_err(e: rusqlite::Error) -> String {
    format!("Database error: {e}")
}

const SENSITIVE_SETTING_KEYS: &[&str] = &[MASTER_HASH_KEY, MASTER_SALT_KEY, PASSWORD_ALGO_KEY];

pub fn is_sensitive_setting_key(key: &str) -> bool {
    SENSITIVE_SETTING_KEYS.contains(&key)
}

pub fn verify_password_internal(conn: &Connection, password: &str) -> Result<bool, String> {
    let hash: Option<String> = conn
        .query_row(
            "SELECT value FROM settings WHERE key = ?1",
            [MASTER_HASH_KEY],
            |r| r.get(0),
        )
        .ok();
    let Some(stored) = hash else {
        return Ok(false);
    };

    let algo: String = conn
        .query_row(
            "SELECT value FROM settings WHERE key = ?1",
            [PASSWORD_ALGO_KEY],
            |r| r.get(0),
        )
        .unwrap_or_else(|_| ALGO_SHA256_LEGACY.to_string());

    if algo == ALGO_ARGON2 || stored.starts_with("$argon2") {
        return verify_password_argon2(password, &stored);
    }

    // Legacy SHA-256
    let salt: Option<String> = conn
        .query_row(
            "SELECT value FROM settings WHERE key = ?1",
            [MASTER_SALT_KEY],
            |r| r.get(0),
        )
        .ok();
    let Some(salt) = salt else {
        return Ok(false);
    };
    let ok = hash_password_sha256_legacy(password, &salt) == stored;
    if ok {
        // Transparent upgrade to Argon2id on successful unlock
        upgrade_password_hash(conn, password)?;
    }
    Ok(ok)
}

fn upgrade_password_hash(conn: &Connection, password: &str) -> Result<(), String> {
    let phc = hash_password_argon2(password)?;
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![MASTER_HASH_KEY, phc],
    )
    .map_err(db_err)?;
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![PASSWORD_ALGO_KEY, ALGO_ARGON2],
    )
    .map_err(db_err)?;
    let _ = conn.execute("DELETE FROM settings WHERE key = ?1", [MASTER_SALT_KEY]);
    Ok(())
}

#[tauri::command]
pub fn set_master_password(state: State<AppState>, password: String) -> Result<(), String> {
    if password.len() < 4 {
        return Err("Password must be at least 4 characters".into());
    }
    // Allow first-time setup without unlock; require unlock to change later.
    let conn = {
        let has = {
            let c = state.db_unlocked_access()?;
            has_master_password_hash(&c)?
        };
        if has {
            state.require_db()?
        } else {
            state.db_unlocked_access()?
        }
    };
    let phc = hash_password_argon2(&password)?;
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![MASTER_HASH_KEY, phc],
    )
    .map_err(db_err)?;
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![PASSWORD_ALGO_KEY, ALGO_ARGON2],
    )
    .map_err(db_err)?;
    let _ = conn.execute("DELETE FROM settings WHERE key = ?1", [MASTER_SALT_KEY]);
    Ok(())
}

#[tauri::command]
pub fn has_master_password(state: State<AppState>) -> Result<bool, String> {
    let conn = state.db_unlocked_access()?;
    has_master_password_hash(&conn)
}

#[tauri::command]
pub fn lock_app(state: State<AppState>) -> Result<(), String> {
    state.set_locked(true)
}

#[tauri::command]
pub fn unlock_app(state: State<AppState>, password: String) -> Result<bool, String> {
    let conn = state.db_unlocked_access()?;
    if !verify_password_internal(&conn, &password)? {
        return Ok(false);
    }
    drop(conn);
    state.set_locked(false)?;
    Ok(true)
}

#[tauri::command]
pub fn is_app_locked(state: State<AppState>) -> Result<bool, String> {
    state.is_locked()
}

#[tauri::command]
pub fn is_database_encrypted(state: State<AppState>) -> Result<bool, String> {
    let path = db_path(&state.app)?;
    Ok(is_encryption_enabled(&path))
}

#[tauri::command]
pub fn enable_database_encryption(state: State<AppState>, password: String) -> Result<(), String> {
    let conn = state.require_db()?;
    if !verify_password_internal(&conn, &password)? {
        return Err("Incorrect password".into());
    }
    let path = db_path(&state.app)?;
    enable_encryption(&conn, &path)?;
    log::info!("Backup encryption enabled (ChaCha20-Poly1305 + OS keyring key)");
    Ok(())
}

#[tauri::command]
pub fn get_security_status(state: State<AppState>) -> Result<SecurityStatus, String> {
    let conn = state.db_unlocked_access()?;
    let path = db_path(&state.app)?;
    Ok(SecurityStatus {
        has_master_password: has_master_password_hash(&conn)?,
        is_locked: state.is_locked()?,
        database_encrypted: is_encryption_enabled(&path),
    })
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SecurityStatus {
    pub has_master_password: bool,
    pub is_locked: bool,
    pub database_encrypted: bool,
}
