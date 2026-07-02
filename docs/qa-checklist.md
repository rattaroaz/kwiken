# Kwiken Manual QA Checklist

Use this checklist before each release.

## Fresh install

- [ ] Install from GitHub Release `.exe` on a clean Windows VM
- [ ] Setup wizard creates first account successfully
- [ ] Dashboard loads with zero or seeded data

## Upgrade path

- [ ] Install previous release, add transactions, then upgrade to new version
- [ ] Database migrations run without errors
- [ ] Existing accounts, transactions, and settings are preserved

## Performance

- [ ] Account register with 10,000+ transactions: pagination works, UI stays responsive
- [ ] Import 5,000-row CSV: preview and commit complete in reasonable time
- [ ] Reports load without blocking the main thread (charts lazy-load)

## Keyboard and accessibility

- [ ] Tab navigation works in transaction form and settings
- [ ] Escape closes modals
- [ ] Dark and light themes are consistent on all pages

## Backup and recovery

- [ ] Backup creates a valid `.db` file
- [ ] Restore from backup replaces data and app reloads correctly
- [ ] Unclean shutdown shows recovery notice on next launch

## Updater

- [ ] Help → Check for updates shows correct state (up to date / available / error)
- [ ] Update installs and app restarts on new version

## Security

- [ ] Master password lock/unlock works
- [ ] Auto-lock triggers after idle timeout
- [ ] Privacy mode hides balances across views
