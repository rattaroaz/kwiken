# Install Kwiken on Windows

Kwiken ships as a Windows desktop app built with Tauri. Two installer formats are available from [GitHub Releases](https://github.com/rattaroaz/kwiken/releases):

| Format | File | Best for |
|--------|------|----------|
| **NSIS** | `Kwiken_*_x64-setup.exe` | Most users — guided setup wizard |
| **MSI** | `Kwiken_*_x64_en-US.msi` | IT / enterprise deployment via Group Policy or Intune |

## System requirements

- Windows 10 or later (64-bit)
- [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/) (installed automatically by the NSIS installer if missing)
- ~50 MB disk space for the app; additional space for your database and backups

## Install from the NSIS installer (.exe)

1. Download `Kwiken_*_x64-setup.exe` from the [latest release](https://github.com/rattaroaz/kwiken/releases/latest).
2. Run the installer. Windows SmartScreen may show a warning for unsigned or newly signed builds — see [code-signing-windows.md](code-signing-windows.md).
3. Follow the setup wizard. Kwiken installs for the **current user** by default (no administrator rights required).
4. Launch **Kwiken** from the Start Menu under **Kwiken**.

On first launch, the **account setup wizard** guides you through creating your first account.

## Install from the MSI (.msi)

1. Download the `.msi` from GitHub Releases.
2. Double-click to install, or deploy silently:

```powershell
msiexec /i "Kwiken_2.0.0_x64_en-US.msi" /quiet
```

3. The app appears in Start Menu → **Kwiken**.

MSI is preferred when your organization manages software through centralized deployment tools.

## Update Kwiken

Updates are **manual** (no auto-check on startup):

1. Open **Help → Check for updates**.
2. If a newer version is available, follow the prompt to download and install.
3. The app restarts automatically after a successful update.

Updates require a signed release with `latest.json` on GitHub. See [publish-update.md](publish-update.md) for the maintainer workflow.

You can also download and run a newer `.exe` installer over an existing installation.

## Uninstall

### NSIS (.exe) install

- **Settings → Apps → Installed apps** → find **Kwiken** → Uninstall  
- Or **Start Menu → Kwiken → Uninstall**

### MSI install

```powershell
msiexec /x "Kwiken_2.0.0_x64_en-US.msi" /quiet
```

Or remove via **Settings → Apps**.

### Your data after uninstall

Kwiken stores your database in the Windows app data folder:

```
%APPDATA%\com.kwiken.desktop\
```

Uninstalling the app **does not** delete this folder. To remove all data, delete that directory after uninstalling. Back up first — see [backup-restore.md](backup-restore.md).

## Troubleshooting

| Issue | What to try |
|-------|-------------|
| SmartScreen blocks install | Publisher not yet trusted; see [code-signing-windows.md](code-signing-windows.md) |
| App won't start / blank window | Install or repair [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/) |
| Database error on startup | Use **Restore from backup** on the error screen, or see [backup-restore.md](backup-restore.md) |
| Update says "up to date" but a release exists | Only **published** GitHub Releases with `latest.json` trigger updates |

For logs: **Settings → View logs** (export and share with support if needed).
