# Kwiken Manual QA Checklist

Use this checklist before each release. Items marked **(CI)** are covered by automated tests in `.github/workflows/ci.yml` or `scripts/qa-automated.ps1`.

Run all automated checks locally:

```powershell
.\scripts\qa-automated.ps1
```

## Fresh install

- [x] NSIS and MSI installers build successfully **(CI)** — `npm run build:win`
- [ ] Install from GitHub Release `.exe` on a clean Windows VM *(manual)*
- [x] Setup wizard creates first account successfully **(CI)** — `e2e/tests/setup.spec.ts`
- [x] Dashboard loads with zero or seeded data **(CI)** — `e2e/tests/transaction.spec.ts`, smoke test
- [x] App starts without immediate exit **(CI)** — `scripts/smoke-test.mjs`

## Upgrade path

- [ ] Install previous release, add transactions, then upgrade to new version *(manual)*
- [x] Database migrations run without errors **(CI)** — Rust `open_connection_at_path` test
- [ ] Existing accounts, transactions, and settings are preserved *(manual upgrade test)*

## Performance

- [ ] Account register with 10,000+ transactions: pagination works, UI stays responsive *(manual)*
- [ ] Import 5,000-row CSV: preview and commit complete in reasonable time *(manual)*
- [x] Reports load without blocking the main thread **(CI)** — `e2e/tests/reports.spec.ts`

## Keyboard and accessibility

- [ ] Tab navigation works in transaction form and settings *(manual)*
- [ ] Escape closes modals *(manual)*
- [ ] Dark and light themes are consistent on all pages *(manual)*
- [x] Theme setting persists **(CI)** — `e2e/tests/settings.spec.ts`

## Backup and recovery

- [x] Backup file copy round-trip **(CI)** — Rust `backup_and_restore_round_trip`
- [ ] Restore from backup in installed app and reload *(manual)*
- [ ] Unclean shutdown shows recovery notice on next launch *(manual)*

## Import / security

- [x] CSV import preview and commit **(CI)** — `e2e/tests/import.spec.ts`
- [x] Lock screen unlock flow **(CI)** — `e2e/tests/lock.spec.ts`

## Updater

- [x] Help → Check for updates shows correct state **(CI)** — `e2e/tests/update.spec.ts`
- [ ] Update installs and app restarts on new version *(manual — requires published release)*

## Security

- [ ] Master password lock/unlock on real backend *(manual)*
- [ ] Auto-lock triggers after idle timeout *(manual)*
- [ ] Privacy mode hides balances across views *(manual)*
