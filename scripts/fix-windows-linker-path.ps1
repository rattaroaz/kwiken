$paths = $env:PATH -split ';' | Where-Object {
  $_ -and ($_ -notmatch '\\Git\\usr\\bin$')
}
$cleanPath = $paths -join ';'
"PATH=$cleanPath" >> $env:GITHUB_ENV
Write-Host "Removed Git usr\bin from PATH so MSVC link.exe takes precedence."
