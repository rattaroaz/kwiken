import { readFileSync, writeFileSync } from "node:fs";

const path = "src-tauri/src/commands/mod.rs";
let s = readFileSync(path, "utf8");

// Force whitelist for init / shutdown
s = s.replace(
  /pub fn init_app\(state: State<AppState>\) -> Result<AppInitStatus, String> \{[\r\n]+(\s*)state\.require_db\(\)\?/,
  "pub fn init_app(state: State<AppState>) -> Result<AppInitStatus, String> {\n$1state.db_unlocked_access()?",
);
s = s.replace(
  /pub fn mark_clean_shutdown_cmd\(state: State<AppState>\) -> Result<(), String> \{[\r\n]+(\s*)state\.require_db\(\)\?/,
  "pub fn mark_clean_shutdown_cmd(state: State<AppState>) -> Result<(), String> {\n$1state.db_unlocked_access()?",
);

// load_splits amount
s = s.replace(
  /Ok\(TransactionSplit \{\n(\s*)id: row\.get\(0\)\?,\n(\s*)transaction_id: row\.get\(1\)\?,\n(\s*)category_id: row\.get\(2\)\?,\n(\s*)amount: row\.get\(3\)\?,\n(\s*)memo: row\.get\(4\)\?,\n(\s*)\}\)/,
  `Ok(TransactionSplit {
$1id: row.get(0)?,
$2transaction_id: row.get(1)?,
$3category_id: row.get(2)?,
$4amount: cents_to_dollars(row.get::<_, i64>(3)?),
$5memo: row.get(4)?,
$6})`,
);

// insert_splits — store cents
s = s.replace(
  /params!\[new_id\(\), transaction_id, split\.category_id, split\.amount, split\.memo\]/,
  "params![new_id(), transaction_id, split.category_id, dollars_to_cents(split.amount), split.memo]",
);

// create_transaction_internal amount
s = s.replace(
  /(None::<String>\n\s*\},\n\s*)input\.amount,/,
  "$1dollars_to_cents(input.amount),",
);

// category_spent — sums are in cents
s = s.replace(
  /let direct: f64 = conn\n\s*\.query_row\(\n\s*"SELECT COALESCE\(SUM\(CASE WHEN amount < 0 THEN -amount ELSE 0 END\), 0\)/,
  `let direct: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END), 0)`,
);
s = s.replace(
  /let split: f64 = conn\n\s*\.query_row\(\n\s*"SELECT COALESCE\(SUM\(CASE WHEN s\.amount < 0 THEN -s\.amount ELSE s\.amount END\), 0\)/,
  `let split: i64 = conn
        .query_row(
            "SELECT COALESCE(SUM(CASE WHEN s.amount < 0 THEN -s.amount ELSE 0 END), 0)`,
);
// Fix the split query - original had ELSE s.amount for positive which is wrong for expense; keep similar but cents
// Actually look at original again - for splits it was ELSE s.amount END which is odd. Keep logic, just i64.
s = s.replace(
  /Ok\(direct \+ split\)\n\}/,
  "Ok(cents_to_dollars(direct + split))\n}",
);

// Opening balance inserts — find create_account patterns
s = s.replace(
  /input\.opening_balance/g,
  "dollars_to_cents(input.opening_balance)",
);

// Budget create/update
s = s.replace(
  /params!\[id, category_id, period, amount\]/,
  "params![id, category_id, period, dollars_to_cents(amount)]",
);
s = s.replace(
  /\.execute\("UPDATE budgets SET amount = \?2 WHERE id = \?1", params!\[id, amount\]\)/,
  '.execute("UPDATE budgets SET amount = ?2 WHERE id = ?1", params![id, dollars_to_cents(amount)])',
);

// Transfer amount updates
s = s.replace(
  /params!\[from_id, -amount\.abs\(\)\]/,
  "params![from_id, -dollars_to_cents(amount.abs())]",
);
s = s.replace(
  /params!\[to_id, amount\.abs\(\)\]/,
  "params![to_id, dollars_to_cents(amount.abs())]",
);

// duplicate / filter amount reads that still use row.get(N)?
s = s.replace(
  /amount: row\.get\((\d+)\)\?/g,
  "amount: cents_to_dollars(row.get::<_, i64>($1)?)",
);

// Test helpers: opening 100.0 -> 10000 cents
s = s.replace(
  /'USD', 100\.0, 0,/,
  "'USD', 10000, 0,",
);

writeFileSync(path, s);
console.log("Money patch applied");
