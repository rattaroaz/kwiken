# Changelog

All notable changes to Kwiken are documented here. Version numbers follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/rattaroaz/kwiken/compare/v2.0.2...HEAD
[2.0.2]: https://github.com/rattaroaz/kwiken/releases/tag/v2.0.2
[2.0.1]: https://github.com/rattaroaz/kwiken/releases/tag/v2.0.1
[2.0.0]: https://github.com/rattaroaz/kwiken/releases/tag/v2.0.0
[0.1.2]: https://github.com/rattaroaz/kwiken/releases/tag/v0.1.2
[0.1.1]: https://github.com/rattaroaz/kwiken/releases/tag/v0.1.1
[0.1.0]: https://github.com/rattaroaz/kwiken/releases/tag/v0.1.0
