# Asistente de Estudio IA - inicio rapido (PowerShell)
$ErrorActionPreference = "Stop"

# Ir a la carpeta del script
Set-Location -Path $PSScriptRoot

# Verificar Node.js
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Host "[ERROR] No se encontro Node.js." -ForegroundColor Red
    Write-Host "Instala Node.js desde https://nodejs.org y vuelve a intentar."
    Read-Host "Pulsa Enter para salir"
    exit 1
}

Write-Host "Iniciando Asistente de Estudio IA..." -ForegroundColor Cyan
Write-Host "(Se abrira en tu navegador)"
Start-Process "http://localhost:3000"
node server.js

Read-Host "Pulsa Enter para salir"
