# Changelog

All notable changes to Kwiken are documented here. Version numbers follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [2.7.1] - 2026-08-03

### Fixed

- Transfer creation stored dollar amounts instead of cents (balances were off by 100×).
- Transaction and account CSV exports wrote raw cents; re-import would amplify by 100×.
- Account creation double-counted opening balance (field + synthetic transaction); migration `004` removes legacy Opening Balance rows.
- Category/tax spending reports counted positive split amounts inconsistently with budget spent.

## [2.7.0] - 2026-08-03

### Added

- Backend lock enforcement: data commands require an unlocked session when a master password is set.
- Argon2id master-password hashing with transparent upgrade from legacy SHA-256 hashes.
- Optional encrypted backups (ChaCha20-Poly1305 + OS keyring); live DB remains plaintext SQLite.
- Content Security Policy (`csp` / `devCsp`) in Tauri config.
- Security status / enable-encryption commands and Settings UI for backup encryption.

### Changed

- Money amounts are stored as integer cents in SQLite (migration `003_money_cents`); API still uses dollar floats.
- Upgraded to TypeScript 7 (native Go compiler) with TypeScript 6 side-by-side for `typescript-eslint` until the 7.1 compiler API lands.
- Extracted security Tauri commands into `commands/security.rs`.

## [2.6.0] - 2026-07-04

### Added

- Rust integration tests: auto-rules engine, master password verify, attachments, v1→v2 migration, and 10k-transaction pagination perf.
- 43 new frontend tests covering hooks (`useAutoBackup`, `useIdleLock`), db service, CommandPalette, CategoriesPage, TransactionForm, BudgetsPage, ReportsPage, ImportExportPage, and more.
- Modal dialogs replacing `prompt()` for saved filters and budget amount editing.

### Changed

- Vitest coverage raised from ~49% to ~61% statements; 137 tests passing.

## [2.2.4] - 2026-07-03

### Fixed

- ARM64 GitHub Actions builds export MSVC and Windows SDK headers so the `ring` crate can compile with clang.

## [2.2.3] - 2026-07-03

### Fixed

- GitHub Actions x64 builds no longer pick up Git's `link.exe` instead of the MSVC linker.
- CI x64 release builds skip the local dev toolchain wrapper; LLVM is only required for ARM64.

## [2.2.2] - 2026-07-03

### Fixed

- ARM64 CI/release workflows install LLVM without winget on GitHub runners.
- ARM64 installer verification matches Tauri `arm64` bundle naming and paths.

## [2.2.1] - 2026-07-03

### Added

- Windows ARM64 (`aarch64`) release and CI builds alongside existing x64 builds.
- `--target` flag support in `scripts/tauri-build.mjs` for cross-architecture local builds.

### Changed

- Release and CI smoke workflows use a matrix (`windows-latest` + `windows-11-arm`).
- Smoke test script respects `CARGO_BUILD_TARGET` for non-default Rust output paths.

## [2.2.0] - 2026-07-02

### Added

- Search everywhere in the command palette (pages, accounts, payees, categories, transactions).
- Transaction attachment support: add, open, reveal in folder, and remove receipts/documents.
- Expanded auto-categorize rules engine with match field/type, priority, enabled flag, and bulk apply.

### Changed

- Application log panel moved to the right side of the window.
- Native select and date inputs use dark backgrounds for readability.

## [2.1.0] - 2026-07-02

### Added

- E2E tests for CSV import and lock-screen flows; expanded Tauri plugin mocks.
- Page and component smoke tests; broader Vitest coverage thresholds.
- CI smoke job: build installers and verify real binary startup.
- Rust backup/restore round-trip tests; `open_connection_at_path` helper.
- `scripts/smoke-test.mjs` and `scripts/qa-automated.ps1`.

### Changed

- E2E init checks lock state; QA checklist marks automated vs manual items.

### Removed

- Unused lib modules (`balance`, `budget`, `categories`) and redundant API commands.
- Unused `date-fns` dependency.

## [2.0.2] - 2026-07-02

### Fixed

- App crash on Windows startup (flash and close) caused by incorrect `PRAGMA journal_mode = WAL` usage.

## [2.0.1] - 2026-07-01

### Fixed

- E2E update test reads app version from `package.json` instead of a hardcoded value.

## [2.0.0] - 2026-07-01

### Added

- Phase 10–12: testing suite (65 Vitest, 15 Rust, 6 E2E), CI workflow, coverage gates.
- Performance hardening: paginated registers, debounced filters, lazy-loaded charts, DB integrity checks.
- Structured logging with in-app log panel (search, export, error badge).
- Phase 12 packaging: branded icon set, NSIS/MSI installer metadata, user documentation.
- `CHANGELOG.md`, `LICENSE`, and release notes automation from changelog.
- Help menu documentation links.

### Changed

- Major version bump to 2.0.0 — production-ready release with full QA, docs, and distribution pipeline.

## [0.1.2] - 2026-03-01

### Added

- In-app log viewer (Settings → View logs) with search, copy, and export.
- Application logging across import, security, database, and update flows.
- Rust backend logging via `env_logger`.

### Fixed

- LogPanel source files no longer blocked by `.gitignore`.
- Updater and release workflow stability improvements.

## [0.1.1] - 2026-02-28

### Added

- In-app updater (Help → Check for updates) with signed release artifacts.
- GitHub Actions release workflow (NSIS + MSI + `latest.json`).
- Playwright E2E tests for core flows.

### Changed

- Version sync across `package.json`, `Cargo.toml`, and `tauri.conf.json`.

## [0.1.0] - 2026-02-27

### Added

- Initial release: accounts, transactions, categories, payees, transfers, reconciliation.
- Budgets, reports (spending, income vs expense, cash flow, net worth).
- CSV, QIF, and OFX import; CSV export; database backup and restore.
- Master password, auto-lock, and privacy mode.
- Light/dark theme, command palette, and keyboard shortcuts.

[Unreleased]: https://github.com/rattaroaz/kwiken/compare/v2.7.1...HEAD
[2.7.1]: https://github.com/rattaroaz/kwiken/releases/tag/v2.7.1
[2.7.0]: https://github.com/rattaroaz/kwiken/releases/tag/v2.7.0
[2.6.0]: https://github.com/rattaroaz/kwiken/releases/tag/v2.6.0
[2.2.4]: https://github.com/rattaroaz/kwiken/releases/tag/v2.2.4
[2.2.3]: https://github.com/rattaroaz/kwiken/releases/tag/v2.2.3
[2.2.2]: https://github.com/rattaroaz/kwiken/releases/tag/v2.2.2
[2.2.1]: https://github.com/rattaroaz/kwiken/releases/tag/v2.2.1
[2.2.0]: https://github.com/rattaroaz/kwiken/releases/tag/v2.2.0
[2.1.0]: https://github.com/rattaroaz/kwiken/releases/tag/v2.1.0
[2.0.2]: https://github.com/rattaroaz/kwiken/releases/tag/v2.0.2
[2.0.1]: https://github.com/rattaroaz/kwiken/releases/tag/v2.0.1
[2.0.0]: https://github.com/rattaroaz/kwiken/releases/tag/v2.0.0
[0.1.2]: https://github.com/rattaroaz/kwiken/releases/tag/v0.1.2
[0.1.1]: https://github.com/rattaroaz/kwiken/releases/tag/v0.1.1
[0.1.0]: https://github.com/rattaroaz/kwiken/releases/tag/v0.1.0
