# Start the backend (single uvicorn process, no --reload for a clean stop).
#   Usage:  .\start.ps1            (port 8000)
#           .\start.ps1 -Port 8001
param([int]$Port = 8000)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$python = Join-Path $scriptDir ".venv\Scripts\python.exe"

if (-not (Test-Path $python)) {
    Write-Host "venv not found at $python"
    Write-Host "Create it first (from backend/):"
    Write-Host "  python -m venv .venv"
    Write-Host "  .venv\Scripts\python -m pip install -r requirements.txt"
    exit 1
}

Push-Location $scriptDir
try {
    & $python -m uvicorn main:app --host 127.0.0.1 --port $Port
} finally {
    Pop-Location
}
