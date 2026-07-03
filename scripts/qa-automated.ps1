# Run automated checks that mirror docs/qa-checklist.md

Write-Host "=== Kwiken automated QA ===" -ForegroundColor Cyan

$failed = $false

function Run-Step($name, $command) {
  Write-Host "`n>> $name" -ForegroundColor Yellow
  Invoke-Expression $command
  if ($LASTEXITCODE -ne 0) {
    Write-Host "FAILED: $name" -ForegroundColor Red
    $script:failed = $true
  } else {
    Write-Host "OK: $name" -ForegroundColor Green
  }
}

Run-Step "Lint" "npm run lint"
Run-Step "Unit tests + coverage" "npm run test:coverage"
Run-Step "Rust tests" "npm run test:rust"
Run-Step "Frontend build" "npm run build"
Run-Step "E2E tests" "npm run test:e2e"
Run-Step "Unsigned Windows installer build" "npm run build:win"
Run-Step "Smoke test (real exe startup)" "node scripts/smoke-test.mjs"

Write-Host "`n=== Manual QA still required ===" -ForegroundColor Cyan
Write-Host "- Fresh install on clean Windows VM"
Write-Host "- Upgrade from previous release version"
Write-Host "- 10k+ transaction performance"
Write-Host "- Keyboard shortcuts across all views"
Write-Host "- Dark/light theme on all pages"
Write-Host "See docs/qa-checklist.md"

if ($failed) { exit 1 }
Write-Host "`nAll automated QA checks passed." -ForegroundColor Green
