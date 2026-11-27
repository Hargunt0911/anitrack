@echo off
set "BOT_DIR=%~dp0"
set "STARTUP_VBS=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\AniTrack-WA-Bot.vbs"

(
echo Set fso = CreateObject("Scripting.FileSystemObject"^)
echo Set WshShell = CreateObject("WScript.Shell"^)
echo WshShell.CurrentDirectory = "%BOT_DIR:~0,-1%"
echo nodeExe = "C:\Program Files\nodejs\node.exe"
echo If Not fso.FileExists(nodeExe^) Then nodeExe = "node"
echo WshShell.Run """" ^& nodeExe ^& """ index.js", 0, False
) > "%STARTUP_VBS%"

echo.
echo ============================================================
echo  Auto-Start Background SENYAP BERHASIL dipasang!
echo  - Tidak membuka jendela CMD
echo  - Tidak membuka browser / tab WhatsApp Web
echo  - Otomatis jalan tersembunyi setiap PC kantor menyala
echo ============================================================
echo.
pause
