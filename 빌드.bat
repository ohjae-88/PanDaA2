@echo off
title Panda A2 Ver.5.2.0 - Production Build
setlocal

cd /d "%~dp0"

echo.
echo ============================================================
echo   Panda A2 - Ver.5.2.0  Production Build
echo ============================================================
echo.

where node >nul 2>nul
if errorlevel 1 goto :no_node

where cargo >nul 2>nul
if errorlevel 1 goto :no_rust

if not exist "node_modules\" goto :install
if not exist "node_modules\@tauri-apps\cli\package.json" goto :install
goto :build

:install
echo [INFO] Installing/updating dependencies for Tauri CLI...
echo.
call npm install
if errorlevel 1 goto :install_failed
echo.
goto :build

:build
echo [BUILD] Tauri release build (NSIS installer)...
echo         Output: src-tauri\target\release\bundle\nsis\
echo         May take 5-15 minutes on first build (Rust compilation).
echo.
call npm run tauri:build
if errorlevel 1 goto :build_failed
echo.
echo ============================================================
echo   Build complete!
echo ============================================================
echo   NSIS Installer: src-tauri\target\release\bundle\nsis\
echo   Standalone exe: src-tauri\target\release\
echo.
explorer "src-tauri\target\release\bundle\nsis"
pause
exit /b 0

:no_node
echo [ERROR] Node.js not installed. Run "Node.js install.bat" first.
pause
exit /b 1

:no_rust
echo [ERROR] Rust not installed. Run "Rust install.bat" first.
pause
exit /b 1

:install_failed
echo.
echo [ERROR] npm install failed.
pause
exit /b 1

:build_failed
echo.
echo [ERROR] Build failed.
pause
exit /b 1