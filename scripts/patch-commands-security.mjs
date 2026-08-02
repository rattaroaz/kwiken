import { readFileSync, writeFileSync } from "node:fs";

const path = "src-tauri/src/commands/mod.rs";
let s = readFileSync(path, "utf8");

s = s.replace(/fn hash_password\(password: &str, salt: &str\) -> String \{[\s\S]*?\n\}\n\n/, "");

const secStart = s.indexOf("// ── SECURITY");
const testStart = s.indexOf("#[cfg(test)]");
if (secStart === -1 || testStart === -1) {
  console.error("markers not found", secStart, testStart);
  process.exit(1);
}
s = s.slice(0, secStart) + s.slice(testStart);

s = s.replace(
  /state\.db\.lock\(\)\.map_err\(\|e\| format!\("Lock error: \{e\}"\)\)\?/g,
  "state.require_db()?",
);

const whitelist = [
  [/pub fn init_app\(state: State<AppState>\) -> Result<AppInitStatus, String> \{\r?\n(\s*)state\.require_db\(\)\?/, "pub fn init_app(state: State<AppState>) -> Result<AppInitStatus, String> {\n$1state.db_unlocked_access()?"],
  [/pub fn mark_clean_shutdown_cmd\(state: State<AppState>\) -> Result<(), String> \{\r?\n(\s*)state\.require_db\(\)\?/, "pub fn mark_clean_shutdown_cmd(state: State<AppState>) -> Result<(), String> {\n$1state.db_unlocked_access()?"],
];

for (const [re, rep] of whitelist) {
  s = s.replace(re, rep);
}

// Logging / diagnostics: replace require_db with unlocked inside those fns by name blocks
s = s.replace(
  /(pub fn get_logs_directory\([\s\S]*?\{)\r?\n(\s*)state\.require_db\(\)\?/,
  "$1\n$2state.db_unlocked_access()?",
);
s = s.replace(
  /(pub fn append_frontend_log\([\s\S]*?\{)\r?\n(\s*)state\.require_db\(\)\?/,
  "$1\n$2state.db_unlocked_access()?",
);
s = s.replace(
  /(pub fn read_frontend_log_tail\([\s\S]*?\{)\r?\n(\s*)state\.require_db\(\)\?/,
  "$1\n$2state.db_unlocked_access()?",
);
s = s.replace(
  /(pub fn get_diagnostic_snapshot\([\s\S]*?\{)\r?\n(\s*)state\.require_db\(\)\?/,
  "$1\n$2state.db_unlocked_access()?",
);

s = s.replace(
  /pub fn get_setting\(state: State<AppState>, key: String\) -> Result<Option<String>, String> \{\r?\n(\s*)let conn = state\.require_db\(\)\?;/,
  `pub fn get_setting(state: State<AppState>, key: String) -> Result<Option<String>, String> {
$1if security::is_sensitive_setting_key(&key) {
$1    return Ok(None);
$1}
$1let conn = state.require_db()?;`,
);

s = s.replace(
  /pub fn set_setting\(state: State<AppState>, key: String, value: String\) -> Result<(), String> \{\r?\n(\s*)let conn = state\.require_db\(\)\?;/,
  `pub fn set_setting(state: State<AppState>, key: String, value: String) -> Result<(), String> {
$1if security::is_sensitive_setting_key(&key) {
$1    return Err("Cannot modify security settings via set_setting".into());
$1}
$1let conn = state.require_db()?;`,
);

s = s.replace(
  /for row in rows \{\r?\n(\s*)let \(k, v\) = row\.map_err\(db_err\)\?;\r?\n(\s*)map\.insert\(k, v\);\r?\n(\s*)\}/,
  `for row in rows {
$1let (k, v) = row.map_err(db_err)?;
$1if !security::is_sensitive_setting_key(&k) {
$1    map.insert(k, v);
$1}
$3}`,
);

s = s.replace(/use sha2::\{Digest, Sha256\};\r?\n/, "");

if (!s.includes("mod security")) {
  s =
    `mod security;

pub use security::{
    enable_database_encryption, get_security_status, has_master_password, is_app_locked,
    is_database_encrypted, lock_app, set_master_password, unlock_app,
};

` + s;
}

if (!s.includes("use crate::money")) {
  s = s.replace(
    "use crate::state::AppState;",
    "use crate::money::{cents_to_dollars, dollars_to_cents};\nuse crate::state::AppState;",
  );
}

// Money: read amounts as i64 cents
s = s.replace(
  /amount: row\.get\((\d+)\)\.map_err\(db_err\)\?/g,
  "amount: cents_to_dollars(row.get::<_, i64>($1).map_err(db_err)?)",
);

writeFileSync(path, s);
console.log("Patched", path, "bytes", s.length);
