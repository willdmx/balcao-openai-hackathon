$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$runtimeDirectory = Join-Path $projectRoot ".balcao-runtime"
$runtimePath = Join-Path $runtimeDirectory "codex.exe"
$codexCommand = Get-Command codex -ErrorAction Stop
$sourcePath = $codexCommand.Source

if (-not $sourcePath.EndsWith(".exe", [StringComparison]::OrdinalIgnoreCase)) {
  throw "O comando codex encontrado não aponta para um executável Windows."
}

$signature = Get-AuthenticodeSignature -LiteralPath $sourcePath

if ($signature.Status -ne "Valid") {
  throw "O executável Codex encontrado não possui assinatura válida."
}

New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null
Copy-Item -LiteralPath $sourcePath -Destination $runtimePath -Force

& $runtimePath --version

if ($LASTEXITCODE -ne 0) {
  throw "O runtime local do Codex não pôde ser validado."
}

Write-Host "Runtime local do Codex preparado em .balcao-runtime (ignorado pelo Git)."
