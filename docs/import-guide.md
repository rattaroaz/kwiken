# Import guide

Kwiken can import transactions from **CSV**, **QIF** (Quicken Interchange Format), and **OFX/QFX** bank files.

Go to **Import / Export** in the sidebar.

## Before you import

1. **Create or select the target account** — imports always go into one account at a time.
2. **Back up your database** — recommended before large imports. See [backup-restore.md](backup-restore.md).
3. **Review the preview** — Kwiken shows all rows before committing; duplicates are flagged.

## CSV import

### Expected columns

Kwiken maps common column headers automatically. Typical columns:

| Column | Required | Examples |
|--------|----------|----------|
| Date | Yes | `01/15/2026`, `2026-01-15` |
| Amount | Yes | `-45.00` (expense) or `100.00` (income) |
| Payee | Recommended | `Grocery Store` |
| Memo | Optional | `Weekly shopping` |
| Category | Optional | `Food` |

Some banks export separate **Payment** and **Deposit** columns instead of a single amount — Kwiken handles both layouts.

### Steps

1. Select the **account** and format **CSV**.
2. Click **Choose file** and select your `.csv` file.
3. Review the **preview table** — duplicates (same date + amount + payee) are marked.
4. Click **Import** to commit non-duplicate rows.

### Tips

- Open the CSV in a text editor first if preview fails — encoding should be UTF-8.
- Remove summary/total rows at the bottom of bank exports before importing.
- For split transactions, import as single-line entries and edit splits manually afterward.

## QIF import

QIF is the classic Quicken format. Kwiken parses standard `!Type:Bank` (and similar) transaction blocks.

### Supported fields

- `D` — date
- `T` / `U` — amount
- `P` — payee
- `M` — memo
- `L` — category
- `C` — cleared status

### Steps

1. Export QIF from Quicken or another app (**File → Export → QIF**).
2. In Kwiken: select account, format **QIF**, choose file.
3. Preview and import.

Incomplete transaction blocks in the file are skipped silently.

## OFX / QFX import

OFX and QFX are standard online banking formats.

### Steps

1. Download a statement from your bank as `.ofx` or `.qfx`.
2. In Kwiken: select account, format **OFX**, choose file.
3. Preview shows parsed `STMTTRN` entries.
4. Import.

### Notes

- Investment OFX files with only positions (no transactions) may show zero rows.
- Duplicate detection uses date, amount, and payee name.

## Duplicate detection

During preview, Kwiken flags rows that match an existing transaction on:

- **Date**
- **Amount**
- **Payee** (case-insensitive)

Duplicates are **excluded** from CSV import by default. QIF and OFX imports use the same detection at commit time.

## Export (related)

From **Import / Export** you can also:

| Export | Output |
|--------|--------|
| Transactions CSV | All or per-account transactions |
| Accounts CSV | Account list |
| Categories CSV | Category tree |

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Preview shows 0 rows | Wrong format selected; check file extension and content |
| Dates parse incorrectly | Adjust **date format** in Settings, or fix CSV date column |
| Many duplicates | Normal when re-importing the same statement; only new rows import |
| Import fails | Check **Settings → View logs** for details |

For database-level backup before import, see [backup-restore.md](backup-restore.md).
