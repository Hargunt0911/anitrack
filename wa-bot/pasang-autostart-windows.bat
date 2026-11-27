@echo off
set "BOT_DIR=%~dp0"
set "STARTUP_VBS=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\AniTrack-WA-Bot.vbs"

(
echo Set WshShell = CreateObject("WScript.Shell"^)
echo WshShell.CurrentDirectory = "%BOT_DIR:~0,-1%"
echo WshShell.Run """C:\Program Files\nodejs\node.exe"" index.js", 0, False
) > "%STARTUP_VBS%"

echo.
echo ============================================================
echo  Auto-Start Windows BERHASIL dipasang!
echo  File: %STARTUP_VBS%
echo  Setiap PC restart, AniTrack WA Bot otomatis aktif di background.
echo  Buka http://127.0.0.1:3001 di browser kapan saja untuk cek status.
echo ============================================================
echo.
pause
