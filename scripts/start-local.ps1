# Inicio rápido en Windows (sin Docker)
# Uso: powershell -ExecutionPolicy Bypass -File scripts/start-local.ps1

Set-Location $PSScriptRoot\..

if (-not (Test-Path "certs\server.key")) {
    Write-Host "Generando certificado SSL..." -ForegroundColor Yellow
    npm run generate-cert
}

Write-Host ""
Write-Host "Iniciando Cloud File Share..." -ForegroundColor Cyan
Write-Host "  Web:   https://localhost:8443" -ForegroundColor Green
Write-Host "  Files: https://localhost:8443/files" -ForegroundColor Green
Write-Host "  SFTP:  sftp -P 2222 sftpuser@localhost" -ForegroundColor Green
Write-Host ""

npm start
