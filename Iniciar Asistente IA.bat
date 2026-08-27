@echo off
title Asistente de Estudio IA
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] No se encontro Node.js.
  echo Instala Node.js desde https://nodejs.org y vuelve a intentar.
  echo.
  pause
  exit /b 1
)

echo Iniciando Asistente de Estudio IA...
echo (Se abrira automaticamente en tu navegador)
echo.
start "" http://localhost:3000
node server.js

pause
