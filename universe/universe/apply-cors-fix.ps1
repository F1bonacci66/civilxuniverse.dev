# PowerShell script - CORS fix application instructions
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Applying CORS fix on server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$server = "root@95.163.230.61"
$password = "7LfOgcrTvZxbMR9Y"

Write-Host "STEP 1: Copy script to server" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray
Write-Host "Run in PowerShell:" -ForegroundColor White
Write-Host ""
Write-Host "  cd C:\Projects\CivilX\Site\civilx-website\universe\universe" -ForegroundColor Green
Write-Host "  scp apply-cors-fix-on-server.sh $server`:/tmp/" -ForegroundColor Green
Write-Host ""
Write-Host "  When prompted for password, enter: $password" -ForegroundColor Gray
Write-Host ""

Write-Host "STEP 2: Connect to server" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray
Write-Host "Run:" -ForegroundColor White
Write-Host ""
Write-Host "  ssh $server" -ForegroundColor Green
Write-Host "  (password: $password)" -ForegroundColor Gray
Write-Host ""

Write-Host "STEP 3: Execute script on server" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray
Write-Host "After connecting to server, run:" -ForegroundColor White
Write-Host ""
Write-Host "  chmod +x /tmp/apply-cors-fix-on-server.sh" -ForegroundColor Green
Write-Host "  bash /tmp/apply-cors-fix-on-server.sh" -ForegroundColor Green
Write-Host ""

Write-Host "STEP 4: Verify result" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray
Write-Host "Script will automatically verify that OPTIONS request returns status 204" -ForegroundColor White
Write-Host ""

Write-Host "Done! After execution, registration should work without CORS errors." -ForegroundColor Green
Write-Host ""
