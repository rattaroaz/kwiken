use rusqlite::Connection;
use std::sync::Mutex;
use tauri::AppHandle;

pub struct AppState {
    pub db: Mutex<Connection>,
    pub is_locked: Mutex<bool>,
    pub app: AppHandle,
}

impl AppState {
    pub fn new(conn: Connection, app: AppHandle) -> Self {
        Self {
            db: Mutex::new(conn),
            is_locked: Mutex::new(false),
            app,
        }
    }
}
