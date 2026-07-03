$ErrorActionPreference = "Stop"

$llvmBinDir = "C:\Program Files\LLVM\bin"
$clang = Join-Path $llvmBinDir "clang.exe"

if (Test-Path $clang) {
  Write-Host "LLVM already installed at $llvmBinDir"
  Add-Content -Path $env:GITHUB_PATH -Value $llvmBinDir
  exit 0
}

$archSuffix = if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") { "woa64" } else { "win64" }
$version = "18.1.8"
$url = "https://github.com/llvm/llvm-project/releases/download/llvmorg-$version/LLVM-$version-$archSuffix.exe"
$installer = Join-Path $env:RUNNER_TEMP "LLVM-$version-$archSuffix.exe"

Write-Host "Downloading LLVM $version ($archSuffix) from $url"
Invoke-WebRequest -Uri $url -OutFile $installer

Write-Host "Installing LLVM silently"
$process = Start-Process -FilePath $installer -ArgumentList "/S" -Wait -PassThru
if ($process.ExitCode -ne 0) {
  throw "LLVM installer exited with code $($process.ExitCode)"
}

if (-not (Test-Path $clang)) {
  throw "LLVM install failed; clang not found at $clang"
}

Add-Content -Path $env:GITHUB_PATH -Value $llvmBinDir
Write-Host "LLVM installed successfully"
