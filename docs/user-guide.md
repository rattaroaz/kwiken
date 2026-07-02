# Kwiken user guide

Kwiken is a personal finance manager for tracking accounts, transactions, budgets, and reports — similar to Quicken, with data stored locally on your computer.

## Getting started

### First launch

1. Complete the **account setup wizard** to create your first account (e.g. Checking).
2. An **opening balance** transaction is created automatically if you enter a starting balance.
3. The **Dashboard** shows net worth, recent activity, and budget summary.

### Main navigation

| Section | Purpose |
|---------|---------|
| **Dashboard** | Overview cards, recent transactions, upcoming bills |
| **Accounts** | List and manage all accounts |
| **Budgets** | Monthly category budgets and progress |
| **Reports** | Charts and tables; export to CSV |
| **Import / Export** | Import bank files, export data, backup database |
| **Settings** | Currency, theme, security, backups |

Press **Ctrl+K** (or **Cmd+K**) to open the **command palette** for quick navigation.

## Accounts

### Account types

Checking, Savings, Credit Card, Investment, Loan, and Cash.

### Account register

Open an account to see its **transaction register** — a spreadsheet-style list with date, payee, category, payment, deposit, and running balance.

- **Add transaction** — click **New transaction** or use the keyboard shortcut.
- **Edit** — click a row or use inline editing.
- **Filter** — search by payee, category, memo, or amount; set a date range.
- **Bulk actions** — select multiple rows to edit or delete.
- **Pagination** — large registers load 100 transactions per page.

### Transfers

To move money between accounts, create a **transfer**. Kwiken links both sides so edits stay in sync.

### Reconciliation

1. Open an account → **Reconcile**.
2. Enter your statement ending balance and date.
3. Check off cleared transactions that match your bank statement.
4. **Finish** when the difference is zero.

## Transactions

### Single-line transactions

Record income (deposit) or expenses (payment) with a payee, category, date, and optional memo.

### Split transactions

One transaction can be split across multiple categories (e.g. a store receipt with groceries and household items).

### Cleared status

Mark transactions **cleared** when they appear on your bank statement. Used during reconciliation.

### Recurring transactions

**Settings** and account tools support scheduled transactions (daily, weekly, monthly, yearly). Kwiken can remind you or auto-enter on the due date.

### Tags and attachments

Add **tags** for custom grouping and attach receipt images or PDFs to transactions.

## Categories and payees

- Categories are organized in a **tree** (Food, Housing, Income, etc.).
- **Payees** autocomplete from history as you type.
- **Auto-categorize rules** assign a category when a payee name contains specific text.

Manage categories under **Settings** or the dedicated categories view.

## Budgets

1. Go to **Budgets**.
2. Set a monthly amount per expense category.
3. Progress bars show spending vs budget; over-budget categories are highlighted.

## Reports

Available reports include:

- **Net worth** over time
- **Spending by category** (pie chart + table)
- **Income vs expense** by month
- **Cash flow**
- **Account balance history**
- **Tax summary** (categories tagged for taxes)

Select a date range, then **Export CSV** or print/save as PDF from the browser print dialog.

## Security

| Feature | How to use |
|---------|------------|
| **Master password** | Settings → Security → Set master password |
| **Auto-lock** | Locks after idle timeout (configurable in Settings) |
| **Privacy mode** | Hides balances until you unlock |
| **Lock now** | Settings → Lock now |

## Settings

Configure:

- **Currency** and **date format**
- **Theme** — light, dark, or system
- **Default account** for new transactions
- **Backup folder** and **auto-backup frequency**
- **Fiscal year start** for reports

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+K | Command palette |
| Ctrl+N | New transaction (on account page) |
| Ctrl+S | Save (in forms) |
| Escape | Close modal / dialog |

## Getting help

- **Help → Check for updates** — in-app updater
- **Help → Documentation** — opens guides on GitHub
- **Settings → View logs** — diagnostic log panel
- **Settings → About** — version and license

See also: [import-guide.md](import-guide.md) | [backup-restore.md](backup-restore.md) | [install-windows.md](install-windows.md)
