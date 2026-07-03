param(
  [Parameter(Mandatory)]
  [string]$TargetTriple,
  [Parameter(Mandatory)]
  [string]$ArchLabel
)

$ErrorActionPreference = "Stop"

$candidates = @(
  "src-tauri/target/$TargetTriple/release/bundle",
  "src-tauri/target/release/bundle"
)

$bundleRoot = $null
foreach ($candidate in $candidates) {
  if (Test-Path $candidate) {
    $bundleRoot = $candidate
    break
  }
}

if (-not $bundleRoot) {
  throw "Bundle directory not found for target $TargetTriple"
}

Write-Host "Searching under $bundleRoot for $ArchLabel artifacts"

$nsis = Get-ChildItem -Path $bundleRoot -Recurse -File -Filter "*.exe" -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -match '\\nsis\\' -and $_.Name -match $ArchLabel }

$msi = Get-ChildItem -Path $bundleRoot -Recurse -File -Filter "*.msi" -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -match '\\msi\\' -and $_.Name -match $ArchLabel }

if (-not $nsis -or -not $msi) {
  Write-Host "Available bundle files:"
  Get-ChildItem -Path $bundleRoot -Recurse -File | ForEach-Object { Write-Host $_.FullName }
}

if (-not $nsis) {
  throw "NSIS installer not found for $ArchLabel"
}
if (-not $msi) {
  throw "MSI installer not found for $ArchLabel"
}

Write-Host "Found NSIS: $($nsis[0].FullName)"
Write-Host "Found MSI: $($msi[0].FullName)"
