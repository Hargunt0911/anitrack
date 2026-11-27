@echo off
title Hentikan AniTrack WA Bot
cd /d "%~dp0"

if exist ".bot.pid" (
    set /p BOT_PID=<.bot.pid
    echo Menghentikan AniTrack WA Bot (PID %BOT_PID%)...
    taskkill /PID %BOT_PID% /F >nul 2>&1
    del /q ".bot.pid" >nul 2>&1
    echo [OK] AniTrack WA Bot telah dihentikan.
) else (
    echo Mencari proses AniTrack WA Bot di background...
    powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -like '*index.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force; Write-Host ('[OK] Menghentikan PID ' + $_.ProcessId) }"
)
echo.
pause
