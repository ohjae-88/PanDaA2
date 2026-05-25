@echo off
title Rust Auto Install (for Tauri)

echo.
echo ============================================================
echo   Rust Toolchain Auto Install
echo   (Required for Tauri native build)
echo ============================================================
echo.

where cargo >nul 2>nul
if not errorlevel 1 (
    echo [SKIP] Rust is already installed.
    cargo --version
    rustc --version
    echo.
    pause
    exit /b 0
)

echo [STEP 1/3] Rust not found. Starting install.
echo.

where winget >nul 2>nul
if errorlevel 1 (
    echo [STEP 2/3] winget not available. Falling back to rustup-init.
    goto :rustup
)

echo [STEP 2/3] Installing via winget...
echo            (UAC prompt may appear; please click Yes)
echo.
winget install -e --id Rustlang.Rustup --accept-source-agreements --accept-package-agreements
if errorlevel 1 (
    echo.
    echo [WARN] winget install failed. Falling back to rustup-init.
    echo.
    goto :rustup
)
goto :tools

:rustup
set "RUSTUP_URL=https://win.rustup.rs/x86_64"
set "RUSTUP_PATH=%TEMP%\rustup-init.exe"

echo [DOWNLOAD] rustup-init.exe
echo.
powershell -NoProfile -Command "try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%RUSTUP_URL%' -OutFile '%RUSTUP_PATH%' -UseBasicParsing } catch { Write-Host '[ERROR]' $_.Exception.Message; exit 1 }"
if errorlevel 1 (
    echo.
    echo [ERROR] Download failed. Opening manual download page...
    start "" https://rustup.rs/
    pause
    exit /b 1
)

echo [INSTALL] Running rustup-init... (will prompt for options)
echo           Recommended: press Enter for default install.
echo.
"%RUSTUP_PATH%" -y --default-toolchain stable --profile default
if errorlevel 1 (
    echo.
    echo [ERROR] Rustup install failed.
    pause
    exit /b 1
)
del "%RUSTUP_PATH%" >nul 2>nul

:tools
echo.
echo [STEP 3/3] Checking Visual Studio C++ Build Tools...
echo            Tauri requires MSVC linker for Windows builds.
echo.
where link.exe >nul 2>nul
if not errorlevel 1 (
    echo [OK] MSVC linker found.
    goto :done
)

echo [WARN] MSVC linker not found in PATH.
echo        You need "Visual Studio Build Tools" with
echo        "Desktop development with C++" workload.
echo.
echo        Install via winget:
echo          winget install Microsoft.VisualStudio.2022.BuildTools
echo        Or download from:
echo          https://visualstudio.microsoft.com/downloads/
echo.
echo        Try winget now? (Y/N)
choice /c YN /m "Install Build Tools via winget"
if errorlevel 2 goto :done

winget install -e --id Microsoft.VisualStudio.2022.BuildTools --override "--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended" --accept-source-agreements --accept-package-agreements
if errorlevel 1 (
    echo [WARN] Build Tools install failed. Please install manually.
)

:done
echo.
echo ============================================================
echo   Install complete
echo ============================================================
echo.
echo [IMPORTANT] PATH is updated only in NEW command windows.
echo             Please close this window before running ??.bat.
echo.
pause