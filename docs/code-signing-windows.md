# Windows code signing

Kwiken uses **two separate signing systems**:

| Purpose | Technology | When it applies |
|---------|------------|-----------------|
| **In-app updates** | Tauri/minisign | `latest.json`, `.exe.sig`, `.msi.sig` on GitHub Releases |
| **Installer trust (SmartScreen)** | Windows Authenticode | `.exe` and `.msi` installers users download |

## In-app updater signing (minisign)

Already configured for this project:

- Private key: `scripts/tauri-signing.key` (gitignored)
- Public key: `src-tauri/tauri.conf.json` → `plugins.updater.pubkey`
- CI secrets: `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`

See [publish-update.md](publish-update.md) for the release workflow.

This signature proves update packages were built by the project maintainer. It does **not** remove Windows SmartScreen warnings on the initial download.

## Windows Authenticode (installer signing)

To reduce **"Windows protected your PC"** SmartScreen warnings, sign installers with a code signing certificate from a trusted CA (e.g. DigiCert, Sectigo, SSL.com).

### Obtain a certificate

1. Purchase an **OV** or **EV** code signing certificate.
2. Complete identity verification with the CA.
3. Install the certificate in the Windows certificate store (or use a hardware token for EV).

EV certificates build SmartScreen reputation faster; OV certificates require enough downloads over time.

### Configure Tauri

Set the certificate thumbprint in `src-tauri/tauri.conf.json` under `bundle.windows`:

```json
{
  "bundle": {
    "windows": {
      "certificateThumbprint": "YOUR_CERT_SHA1_THUMBPRINT",
      "digestAlgorithm": "sha256",
      "timestampUrl": "http://timestamp.digicert.com"
    }
  }
}
```

Find the thumbprint:

```powershell
Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert | Format-List Subject, Thumbprint
```

### Sign in CI

For GitHub Actions, export the certificate as a base64 PFX and add secrets:

| Secret | Value |
|--------|-------|
| `WINDOWS_CERTIFICATE` | Base64-encoded `.pfx` file |
| `WINDOWS_CERTIFICATE_PASSWORD` | PFX password |

Example pre-build step (adjust for your workflow):

```yaml
- name: Import code signing certificate
  shell: pwsh
  env:
    CERT_BASE64: ${{ secrets.WINDOWS_CERTIFICATE }}
    CERT_PASSWORD: ${{ secrets.WINDOWS_CERTIFICATE_PASSWORD }}
  run: |
    $bytes = [Convert]::FromBase64String($env:CERT_BASE64)
    [IO.File]::WriteAllBytes("cert.pfx", $bytes)
    $pwd = ConvertTo-SecureString -String $env:CERT_PASSWORD -Force -AsPlainText
    Import-PfxCertificate -FilePath cert.pfx -CertStoreLocation Cert:\CurrentUser\My -Password $pwd
```

Tauri signs NSIS and MSI bundles automatically when `certificateThumbprint` is set.

### Custom sign command

If your pipeline uses `signtool` or Azure SignTool, set `bundle.windows.signCommand` instead. See [Tauri Windows config](https://v2.tauri.app/reference/config/#windowsconfig).

## Unsigned local builds

| Command | Signing | Updater artifacts |
|---------|---------|-------------------|
| `npm run build:win` | No | Disabled |
| `npm run build:win:signed` | minisign only (updater) | Enabled |
| CI Release workflow | minisign + optional Authenticode | Enabled |

Unsigned installers work but may trigger SmartScreen. Users can choose **More info → Run anyway**.

## Verification checklist

After signing with Authenticode:

```powershell
Get-AuthenticodeSignature ".\src-tauri\target\release\bundle\nsis\Kwiken_*_x64-setup.exe"
```

Status should be **Valid**. Publish to GitHub Releases and test on a clean VM.

## Related docs

- [install-windows.md](install-windows.md) — user-facing install and SmartScreen notes
- [publish-update.md](publish-update.md) — release and minisign workflow
