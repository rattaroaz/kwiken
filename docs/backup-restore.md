# Backup and restore

Kwiken stores all data in a local **SQLite database**. Regular backups protect against hardware failure, accidental deletion, and bad imports.

## Where data is stored

On Windows:

```
%APPDATA%\com.kwiken.desktop\kwiken.db
```

The database is created on first launch and migrated automatically when you update the app.

## Manual backup

### From the app

1. Go to **Import / Export**.
2. Click **Backup database**.
3. Choose a location and filename (default: `kwiken-backup-YYYY-MM-DD.db`).
4. Confirm success toast.

### What is backed up

The backup is a full copy of `kwiken.db` including accounts, transactions, categories, settings, and attachments metadata.

## Manual restore

> **Warning:** Restore **replaces all current data** in the app. Back up first if you might need the current state.

1. Go to **Import / Export**.
2. Click **Restore database**.
3. Confirm the warning dialog.
4. Select a `.db` backup file.
5. **Restart Kwiken** when prompted — required for the app to reload the database.

If restore fails (corrupt file, permission error), your previous database may still be in place until restart. Check **Settings → View logs** for details.

## Automatic backup

Configure in **Settings**:

| Setting | Description |
|---------|-------------|
| **Backup location** | Folder for scheduled backups |
| **Auto-backup frequency** | Never, daily, weekly, or monthly |

When enabled, Kwiken copies the database to your chosen folder on the schedule.

## Restore from error screen

If Kwiken detects database corruption on startup, a **Database error** screen offers:

- **Restore from backup** — pick a `.db` file (same as manual restore)
- Copy error details for support

See also [install-windows.md](install-windows.md) for unclean shutdown recovery.

## Best practices

1. **Back up before** major imports, restores, or version upgrades.
2. Store backups on a **different drive** or cloud sync folder (OneDrive, etc.).
3. Keep **multiple dated backups** — e.g. `kwiken-backup-2026-03-01.db`.
4. Periodically **test restore** on a spare machine or after copying the file aside.

## Backup vs export

| Method | Contents | Use case |
|--------|----------|----------|
| **Database backup** (`.db`) | Complete app state | Disaster recovery, moving to new PC |
| **CSV export** | Transactions, accounts, or categories only | Spreadsheets, partial sharing |
| **QIF/OFX import** | One-way into an account | Bank statements, not full backup |

For a full migration to another computer: install Kwiken, copy your `.db` backup, and use **Restore database**.

## Uninstall note

Uninstalling Kwiken does **not** remove `%APPDATA%\com.kwiken.desktop\`. Your data remains until you delete that folder manually.
