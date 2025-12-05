# Script for copying backend to server
# Usage: .\copy-backend.ps1

$ServerIP = "95.163.230.61"
$ServerUser = "root"
$ServerPath = "/opt/civilx-backend"
$BackendPath = "C:\Projects\CivilX\Site\civilx-website\backend"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Copying Backend to Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if backend directory exists
if (-not (Test-Path $BackendPath)) {
    Write-Host "ERROR: Backend directory not found: $BackendPath" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path "$BackendPath\app")) {
    Write-Host "ERROR: app directory not found in $BackendPath" -ForegroundColor Red
    exit 1
}

Write-Host "[1/3] Copying app directory..." -ForegroundColor Yellow
$appResult = scp -r "$BackendPath\app" "${ServerUser}@${ServerIP}:${ServerPath}/" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "OK: app directory copied" -ForegroundColor Green
} else {
    Write-Host "ERROR: Failed to copy app:" -ForegroundColor Red
    Write-Host $appResult -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[2/3] Copying requirements.txt..." -ForegroundColor Yellow
if (Test-Path "$BackendPath\requirements.txt") {
    $reqResult = scp "$BackendPath\requirements.txt" "${ServerUser}@${ServerIP}:${ServerPath}/" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "OK: requirements.txt copied" -ForegroundColor Green
    } else {
        Write-Host "WARNING: Failed to copy requirements.txt" -ForegroundColor Yellow
        Write-Host $reqResult -ForegroundColor Yellow
    }
} else {
    Write-Host "WARNING: requirements.txt not found, skipping" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[3/3] Next steps on server:" -ForegroundColor Yellow
Write-Host "  cd /opt/civilx-backend" -ForegroundColor White
Write-Host "  ls -la app/" -ForegroundColor White
Write-Host "  source venv/bin/activate" -ForegroundColor White
Write-Host "  uvicorn app.main:app --host 0.0.0.0 --port 8000" -ForegroundColor White
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   Copy completed!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
