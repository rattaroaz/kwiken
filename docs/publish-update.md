# Publish an update

## Version sync

Before tagging, bump version in all of these files:

- `package.json`
- `package-lock.json` (root version)
- `src-tauri/Cargo.toml`
- `src-tauri/Cargo.lock` (crate version)
- `src-tauri/tauri.conf.json`

Git tag must match: `vX.Y.Z` (e.g. `v0.1.1`).

## GitHub secrets

Repository → Settings → Secrets → Actions:

| Secret | Value |
|--------|-------|
| `TAURI_SIGNING_PRIVATE_KEY` | Full contents of `scripts/tauri-signing.key` (single line, `--ci` format) |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password used when generating the key |

Verify locally before adding secrets:

```powershell
echo "test" > scripts/sign-test.txt
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content scripts/tauri-signing.key -Raw
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = "YOUR_PASSWORD"
npm run tauri signer sign -- scripts/sign-test.txt
```

## Publish procedure

1. Bump all version files to `X.Y.Z`
2. Commit and push to `main`
3. `git tag vX.Y.Z`
4. `git push origin vX.Y.Z`
5. Wait for the **Release** workflow to complete
6. Verify on GitHub → Releases:
   - Tag `vX.Y.Z` exists
   - Assets include `latest.json`, `.exe`, `.exe.sig`, `.msi`, `.msi.sig`

## Manual re-run

Actions → Release → Run workflow → enter tag `vX.Y.Z`

## Updater endpoint

Configured in `src-tauri/tauri.conf.json`:

```
https://github.com/kimri/kwiken/releases/latest/download/latest.json
```

Update `kimri/kwiken` if your GitHub org/repo differs.

## Local builds

| Command | Signing | Updater artifacts |
|---------|---------|-------------------|
| `npm run build:win` | No | Disabled |
| `npm run build:win:signed` | Yes (local key) | Enabled |

Signed local builds require `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` in the environment.

## User experience

Updates are **manual only**: Help → Check for updates. No auto-check on startup.
