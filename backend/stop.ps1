# Stop the backend listening on the given port (default 8000).
#   Usage:  .\stop.ps1            (port 8000)
#           .\stop.ps1 -Port 8001
param([int]$Port = 8000)

$conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if (-not $conns) {
    Write-Host "No backend listening on port $Port."
    return
}
foreach ($procId in ($conns.OwningProcess | Sort-Object -Unique)) {
    try {
        Stop-Process -Id $procId -Force -ErrorAction Stop
        Write-Host "Stopped backend (PID $procId) on port $Port."
    } catch {
        Write-Host "Could not stop PID ${procId}: $($_.Exception.Message)"
    }
}
