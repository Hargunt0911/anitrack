@echo off
title AniTrack WhatsApp Bot (Jam 07:00 WIB)
cd /d "%~dp0"

set "NODE_BIN=node"
if exist "C:\Program Files\nodejs\node.exe" (
    set "PATH=C:\Program Files\nodejs;%PATH%"
    set "NODE_BIN=C:\Program Files\nodejs\node.exe"
)

if not exist "node_modules" (
    echo [AniTrack WA Bot] Memasang library pertama kali...
    call npm install
)

echo.
echo ============================================================
echo   AniTrack WhatsApp Bot — PC Lokal (Tanpa Docker)
echo   Panel Scan QR & Tes: http://127.0.0.1:3001
echo ============================================================
echo.

start "" "http://127.0.0.1:3001"

:loop
"%NODE_BIN%" index.js
echo.
echo [AniTrack WA Bot] Bot berhenti, menyalakan ulang dalam 5 detik...
timeout /t 5 /nobreak >nul
goto loop
