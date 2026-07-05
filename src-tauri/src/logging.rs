use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use tauri::AppHandle;
use tauri::Manager;

const MAX_LOG_BYTES: u64 = 5 * 1024 * 1024;
const FRONTEND_LOG: &str = "kwiken-frontend.log";
const RUST_LOG: &str = "kwiken-rust.log";

pub fn logs_directory(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Could not resolve app data directory: {e}"))?
        .join("logs");
    fs::create_dir_all(&dir).map_err(|e| format!("Could not create logs directory: {e}"))?;
    Ok(dir)
}

pub fn frontend_log_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(logs_directory(app)?.join(FRONTEND_LOG))
}

pub fn rust_log_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(logs_directory(app)?.join(RUST_LOG))
}

fn rotate_if_needed(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Ok(());
    }
    let len = fs::metadata(path)
        .map_err(|e| format!("Could not stat log file: {e}"))?
        .len();
    if len <= MAX_LOG_BYTES {
        return Ok(());
    }
    let backup = path.with_extension("log.old");
    let _ = fs::remove_file(&backup);
    fs::rename(path, &backup).map_err(|e| format!("Could not rotate log file: {e}"))?;
    Ok(())
}

pub fn append_log_line(path: &Path, line: &str) -> Result<(), String> {
    rotate_if_needed(path)?;
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .map_err(|e| format!("Could not open log file: {e}"))?;
    writeln!(file, "{line}").map_err(|e| format!("Could not write log file: {e}"))?;
    Ok(())
}

pub fn read_log_tail(path: &Path, max_lines: usize) -> Result<String, String> {
    if !path.exists() {
        return Ok(String::new());
    }
    let content = fs::read_to_string(path).map_err(|e| format!("Could not read log file: {e}"))?;
    let lines: Vec<&str> = content.lines().collect();
    if lines.len() <= max_lines {
        return Ok(content);
    }
    Ok(lines[lines.len() - max_lines..].join("\n"))
}

pub fn init_rust_file_logging(app: &AppHandle) {
    let version = env!("CARGO_PKG_VERSION");
    log_rust_event(app, "INFO", &format!("Kwiken v{version} starting"));
}

pub fn log_rust_event(app: &AppHandle, level: &str, message: &str) {
    if let Ok(path) = rust_log_path(app) {
        let line = format!("{} [{level}] {message}", now_rfc3339());
        if let Err(e) = append_log_line(&path, &line) {
            log::warn!("File logging unavailable: {e}");
        }
    } else {
        log::warn!("File logging unavailable: could not resolve log path");
    }
}

pub fn log_command_timing(app: &AppHandle, command: &str, duration_ms: u128, ok: bool) {
    let level = if ok { "INFO" } else { "WARN" };
    let message = format!("command {command} duration_ms={duration_ms}");
    log::info!("{message}");
    if let Ok(path) = rust_log_path(app) {
        let line = format!("{} [{level}] {message}", now_rfc3339());
        let _ = append_log_line(&path, &line);
    }
}

fn now_rfc3339() -> String {
    chrono::Utc::now().to_rfc3339()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    #[test]
    fn read_log_tail_returns_last_lines() {
        let dir = env::temp_dir().join(format!("kwiken-log-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("test.log");
        fs::write(&path, "line1\nline2\nline3\n").unwrap();
        let tail = read_log_tail(&path, 2).unwrap();
        assert!(tail.contains("line2"));
        assert!(tail.contains("line3"));
        assert!(!tail.contains("line1"));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn rotate_creates_backup_when_over_limit() {
        let dir = env::temp_dir().join(format!("kwiken-rotate-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("big.log");
        let chunk = "x".repeat(1024);
        let lines = (MAX_LOG_BYTES / 1024 + 2) as usize;
        let content = (0..lines).map(|_| chunk.as_str()).collect::<Vec<_>>().join("\n");
        fs::write(&path, content).unwrap();
        append_log_line(&path, "new line").unwrap();
        assert!(path.with_extension("log.old").exists());
        let _ = fs::remove_dir_all(&dir);
    }
}
