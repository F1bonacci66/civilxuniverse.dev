# Скрипт для проверки API в PowerShell

# Проверка health endpoint
Write-Host "Проверка API health endpoint..." -ForegroundColor Cyan

try {
    # Для PowerShell 6+ (Core)
    if ($PSVersionTable.PSVersion.Major -ge 6) {
        $response = Invoke-WebRequest -Uri "https://api.civilx.ru/api/datalab/health" -Method Get -SkipCertificateCheck
    } else {
        # Для PowerShell 5.1 и ниже - игнорируем ошибки SSL
        [System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}
        $response = Invoke-WebRequest -Uri "https://api.civilx.ru/api/datalab/health" -Method Get
    }
    
    Write-Host "✅ Статус: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Ответ: $($response.Content)" -ForegroundColor Green
} catch {
    Write-Host "❌ Ошибка: $($_.Exception.Message)" -ForegroundColor Red
    
    # Альтернативный способ через .NET
    Write-Host "`nПопытка через .NET HttpClient..." -ForegroundColor Yellow
    try {
        Add-Type @"
            using System;
            using System.Net;
            using System.Net.Security;
            using System.Security.Cryptography.X509Certificates;
            public class TrustAllCertsPolicy : ICertificatePolicy {
                public bool CheckValidationResult(
                    ServicePoint srvPoint, X509Certificate certificate,
                    WebRequest request, int certificateProblem) {
                    return true;
                }
            }
"@
        [System.Net.ServicePointManager]::CertificatePolicy = New-Object TrustAllCertsPolicy
        $webClient = New-Object System.Net.WebClient
        $result = $webClient.DownloadString("https://api.civilx.ru/api/datalab/health")
        Write-Host "✅ Ответ: $result" -ForegroundColor Green
    } catch {
        Write-Host "❌ Ошибка: $($_.Exception.Message)" -ForegroundColor Red
    }
}




