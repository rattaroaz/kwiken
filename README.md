# Kwiken

A personal finance manager — a Quicken-style desktop app built with **TypeScript**, **Tauri 2**, and **SQLite**.

## Features

- **Accounts** — Checking, savings, credit card, investment, loan, and cash accounts
- **Transactions** — Register with splits, tags, transfers, filters, and bulk actions
- **Reconciliation** — Match cleared transactions against bank statements
- **Categories & payees** — Nested categories with auto-categorize rules
- **Budgets** — Monthly budgets with progress tracking and over-budget alerts
- **Reports** — Spending, income vs expense, cash flow, net worth, balance history, tax summary
- **Import/Export** — CSV, QIF, and OFX import; CSV export; database backup/restore
- **Advanced** — Recurring transactions, templates, investment holdings, loan amortization, exchange rates
- **Security** — Master password, auto-lock, privacy mode, path validation

## Prerequisites

- [Node.js](https://nodejs.org/) 22+
- [Rust](https://rustup.rs/) stable
- Windows (primary target; builds NSIS + MSI installers)

## Development

```bash
npm install
npm run tauri dev
```

## Build

```bash
npm run tauri build
```

Installers are produced in `src-tauri/target/release/bundle/`.

## Project Structure

```
src/                  React + TypeScript frontend
  components/         UI components (layout, common, security, transactions)
  pages/              Route pages (dashboard, accounts, reports, etc.)
  services/db.ts      Tauri invoke wrappers
  stores/             Zustand state (UI, security, data)
  shared/types.ts     TypeScript types mirroring Rust models
src-tauri/            Rust backend
  src/db/             SQLite schema, migrations, helpers
  src/commands/       Tauri command handlers
  src/models.rs       Serde data models
```

## Database

SQLite database is stored in the OS app data directory (`kwiken.db`). Schema migrations run automatically on startup. Default categories are seeded on first launch.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server only |
| `npm run tauri dev` | Full desktop app in dev mode |
| `npm run build` | Build frontend |
| `npm run tauri build` | Production build + installers |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm run test` | Vitest unit tests |
| `npm run test:e2e` | Playwright browser E2E (updater flow) |
| `npm run build:win` | Unsigned Windows build (no updater artifacts) |
| `npm run build:win:signed` | Signed Windows build with updater artifacts |

## Updates

Manual check only: **Help → Check for updates**. See [docs/publish-update.md](docs/publish-update.md) for release workflow.

## Version

Current version: **0.1.0** (synced across `package.json`, `Cargo.toml`, `tauri.conf.json`).

## License

MIT
