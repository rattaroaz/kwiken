use crate::models::AppInitStatus;
use rusqlite::Connection;
use std::sync::{Mutex, MutexGuard};
use tauri::AppHandle;

pub struct AppState {
    pub db: Mutex<Connection>,
    pub is_locked: Mutex<bool>,
    /// Cached result of the first `init_app` in this process (HMR/remount safe).
    pub init_status: Mutex<Option<AppInitStatus>>,
    pub app: AppHandle,
}

impl AppState {
    pub fn new(conn: Connection, start_locked: bool, app: AppHandle) -> Self {
        Self {
            db: Mutex::new(conn),
            is_locked: Mutex::new(start_locked),
            init_status: Mutex::new(None),
            app,
        }
    }

    pub fn ensure_unlocked(&self) -> Result<(), String> {
        let locked = self
            .is_locked
            .lock()
            .map_err(|e| format!("Lock error: {e}"))?;
        if *locked {
            return Err("App is locked".into());
        }
        Ok(())
    }

    /// Database access for normal data commands — blocked while locked.
    pub fn require_db(&self) -> Result<MutexGuard<'_, Connection>, String> {
        self.ensure_unlocked()?;
        self.db.lock().map_err(|e| format!("Lock error: {e}"))
    }

    /// Database access that works even when locked (security, init, logging).
    pub fn db_unlocked_access(&self) -> Result<MutexGuard<'_, Connection>, String> {
        self.db.lock().map_err(|e| format!("Lock error: {e}"))
    }

    pub fn set_locked(&self, locked: bool) -> Result<(), String> {
        let mut flag = self
            .is_locked
            .lock()
            .map_err(|e| format!("Lock error: {e}"))?;
        *flag = locked;
        Ok(())
    }

    pub fn is_locked(&self) -> Result<bool, String> {
        let flag = self
            .is_locked
            .lock()
            .map_err(|e| format!("Lock error: {e}"))?;
        Ok(*flag)
    }
}
