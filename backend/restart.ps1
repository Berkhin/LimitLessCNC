# Stop any running backend on $Port, then start a fresh one (foreground).
#   Usage:  .\restart.ps1            (port 8000)
#           .\restart.ps1 -Port 8001
param([int]$Port = 8000)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
& (Join-Path $scriptDir "stop.ps1") -Port $Port
Start-Sleep -Seconds 1
& (Join-Path $scriptDir "start.ps1") -Port $Port
