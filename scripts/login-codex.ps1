$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$runtimePath = Join-Path $projectRoot ".balcao-runtime\codex.exe"

if (-not (Test-Path -LiteralPath $runtimePath)) {
  throw "Runtime não encontrado. Execute npm run codex:setup primeiro."
}

& $runtimePath login

if ($LASTEXITCODE -ne 0) {
  throw "O login do Codex não foi concluído."
}

& $runtimePath login status
