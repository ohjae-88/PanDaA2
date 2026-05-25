@echo off
title A2 Tauri Diag
setlocal
cd /d "%~dp0"
set "LOG=%~dp0diag\tauri-dev.log"
if not exist "%~dp0diag" mkdir "%~dp0diag"

echo === diag start === > "%LOG%"
echo Date: %DATE% %TIME% >> "%LOG%"
echo cwd: %CD% >> "%LOG%"
echo. >> "%LOG%"

echo --- versions --- >> "%LOG%"
node --version >> "%LOG%" 2>&1
npm --version >> "%LOG%" 2>&1
cargo --version >> "%LOG%" 2>&1
where link.exe >> "%LOG%" 2>&1
echo. >> "%LOG%"

echo --- tauri info --- >> "%LOG%"
call npm run tauri -- info >> "%LOG%" 2>&1
echo. >> "%LOG%"

echo --- tauri:dev --- >> "%LOG%"
echo Running tauri:dev. This may take 1-5 min.
echo Output saved to: %LOG%
echo Press Ctrl+C to stop.
echo.
call npm run tauri:dev >> "%LOG%" 2>&1

echo.
echo === done === >> "%LOG%"
echo.
echo Log: %LOG%
echo.
echo --- last 80 lines ---
powershell -NoProfile -Command "Get-Content -LiteralPath \ -Tail 80"
echo ---------------------
pause