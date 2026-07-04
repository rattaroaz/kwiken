param(
  [ValidateSet("x64", "arm64")]
  [string]$Arch = "x64"
)

$ErrorActionPreference = "Stop"

$sdkIncludeRoot = "${env:ProgramFiles(x86)}\Windows Kits\10\Include"
if (-not (Test-Path $sdkIncludeRoot)) {
  throw "Windows SDK include directory not found at $sdkIncludeRoot"
}

$sdkVersion = Get-ChildItem $sdkIncludeRoot -Directory |
  Sort-Object Name -Descending |
  Select-Object -First 1
if (-not $sdkVersion) {
  throw "No Windows SDK include versions found under $sdkIncludeRoot"
}

$includeSegments = @("ucrt", "shared", "um") | ForEach-Object {
  Join-Path $sdkVersion.FullName $_
}
$includePrefix = $includeSegments -join ";"
$include = if ($env:INCLUDE) { "$includePrefix;$env:INCLUDE" } else { $includePrefix }
"INCLUDE=$include" >> $env:GITHUB_ENV
Write-Host "Added Windows SDK includes from $($sdkVersion.Name)"

$sdkLibRoot = Join-Path "${env:ProgramFiles(x86)}\Windows Kits\10\Lib" $sdkVersion.Name
$archDir = if ($Arch -eq "arm64") { "arm64" } else { "x64" }
$libSegments = @(
  (Join-Path $sdkLibRoot "ucrt\$archDir"),
  (Join-Path $sdkLibRoot "um\$archDir")
) | Where-Object { Test-Path $_ }

if ($libSegments.Count -gt 0) {
  $libPrefix = $libSegments -join ";"
  $lib = if ($env:LIB) { "$libPrefix;$env:LIB" } else { $libPrefix }
  "LIB=$lib" >> $env:GITHUB_ENV
  Write-Host "Added Windows SDK libs for $archDir"
}
