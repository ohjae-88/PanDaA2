@echo off
title Node.js Auto Install

echo.
echo ============================================================
echo   Node.js LTS Auto Install
echo ============================================================
echo.

where node >nul 2>nul
if not errorlevel 1 (
    echo [SKIP] Node.js is already installed.
    node --version
    npm --version
    echo.
    pause
    exit /b 0
)

echo [STEP 1/3] Node.js not found. Starting install.
echo.

where winget >nul 2>nul
if errorlevel 1 (
    echo [STEP 2/3] winget not available. Falling back to MSI download.
    goto :msi
)

echo [STEP 2/3] Installing via winget...
echo            (UAC prompt may appear; please click Yes)
echo.
winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
if errorlevel 1 (
    echo.
    echo [WARN] winget install failed. Falling back to MSI download.
    echo.
    goto :msi
)
goto :done

:msi
set "MSI_URL=https://nodejs.org/dist/v22.11.0/node-v22.11.0-x64.msi"
set "MSI_PATH=%TEMP%\node-lts-x64.msi"

echo [DOWNLOAD] %MSI_URL%
echo            -^> %MSI_PATH%
echo.
powershell -NoProfile -Command "try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%MSI_URL%' -OutFile '%MSI_PATH%' -UseBasicParsing } catch { Write-Host '[ERROR]' $_.Exception.Message; exit 1 }"
if errorlevel 1 (
    echo.
    echo [ERROR] Download failed. Opening manual download page...
    start "" https://nodejs.org/en/download/
    pause
    exit /b 1
)

echo [INSTALL] Running msiexec... (UAC prompt may appear; please click Yes)
echo.
msiexec /i "%MSI_PATH%" /qb
if errorlevel 1 (
    echo.
    echo [ERROR] Install failed. You can run the MSI manually:
    echo         %MSI_PATH%
    pause
    exit /b 1
)
del "%MSI_PATH%" >nul 2>nul

:done
echo.
echo ============================================================
echo   Install complete
echo ============================================================
echo.
echo [IMPORTANT] PATH is updated only in NEW command windows.
echo             Please close this window before continuing.
echo.
pause