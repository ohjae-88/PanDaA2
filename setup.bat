@echo off
title A2 Ver.5.2.0 - Setup and Check
setlocal enabledelayedexpansion
cd /d "%~dp0"

set FAIL=0
set NEEDS_NEW_SHELL=0

echo.
echo ============================================================
echo   Panda A2 Ver.5.2.0 -- Setup ^& Verification
echo ============================================================
echo.
echo This script checks required tools and installs any missing.
echo Steps:
echo   [1] Node.js LTS ^(v22.13+^)
echo   [2] npm
echo   [3] Rust toolchain ^(cargo, rustup^)
echo   [4] Visual Studio Build Tools ^(MSVC linker for Tauri^)
echo   [5] WebView2 Runtime
echo   [6] npm install ^(project deps^)
echo.
echo UAC prompts will appear for system installs - click Yes.
echo Total time on fresh machine: 20-40 min ^(downloads ~3 GB^).
echo.
pause

REM Verify project structure
if not exist "package.json" (
  echo.
  echo [FATAL] package.json not found in this directory.
  echo         This script must be run from the project root.
  echo         Current dir: %CD%
  echo.
  pause
  exit /b 1
)
if not exist "src-tauri\Cargo.toml" (
  echo.
  echo [FATAL] src-tauri\Cargo.toml not found.
  echo         Project structure invalid.
  echo.
  pause
  exit /b 1
)

REM ============================================================
REM  [1/6] Node.js
REM ============================================================
echo.
echo ============================================================
echo  [1/6] Node.js
echo ============================================================
where node >nul 2>nul
if errorlevel 1 (
  echo   [INSTALL] Node.js not found.
  goto install_node
)
for /f "delims=" %%v in ('node --version 2^>nul') do set NODE_VER=%%v
echo   Found: Node.js !NODE_VER!
powershell -NoProfile -Command "$v = (node --version) -replace '^v',''; $parts = $v.Split('.'); $major = [int]$parts[0]; $minor = [int]$parts[1]; if ($major -gt 22 -or ($major -eq 22 -and $minor -ge 13) -or $major -ge 23) { exit 0 } else { exit 1 }"
if errorlevel 1 (
  echo   [WARN] Version below v22.13 - upgrading.
  goto install_node
)
echo   [OK] Node.js version sufficient.
goto check_npm

:install_node
set "NODE_MSI=%TEMP%\node-lts-x64.msi"
echo   Downloading Node.js v22.20.0...
powershell -NoProfile -Command "try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest 'https://nodejs.org/dist/v22.20.0/node-v22.20.0-x64.msi' -OutFile '%NODE_MSI%' -UseBasicParsing; exit 0 } catch { Write-Host $_.Exception.Message; exit 1 }"
if errorlevel 1 (
  echo   [ERROR] Download failed. Manual install: https://nodejs.org/
  set /a FAIL+=1
  goto check_npm
)
echo   Installing Node.js ^(UAC prompt incoming^)...
powershell -NoProfile -Command "$p = Start-Process msiexec.exe -ArgumentList '/i','%NODE_MSI%','/qn','/norestart' -Verb RunAs -Wait -PassThru; exit $p.ExitCode"
if errorlevel 1 (
  echo   [ERROR] msiexec failed.
  set /a FAIL+=1
) else (
  echo   [OK] Node.js installed.
  set NEEDS_NEW_SHELL=1
)
del "%NODE_MSI%" >nul 2>nul

:check_npm
REM ============================================================
REM  [2/6] npm
REM ============================================================
echo.
echo ============================================================
echo  [2/6] npm
echo ============================================================
where npm >nul 2>nul
if errorlevel 1 (
  if !NEEDS_NEW_SHELL! EQU 1 (
    echo   [INFO] npm not in current session PATH ^(just installed^).
    echo          Will appear after reopening cmd.
  ) else (
    echo   [ERROR] npm missing.
    set /a FAIL+=1
  )
) else (
  for /f "delims=" %%v in ('npm --version 2^>nul') do set NPM_VER=%%v
  echo   [OK] npm !NPM_VER!
)

REM ============================================================
REM  [3/6] Rust ^(cargo^)
REM ============================================================
echo.
echo ============================================================
echo  [3/6] Rust toolchain
echo ============================================================
where cargo >nul 2>nul
if errorlevel 1 goto install_rust
for /f "delims=" %%v in ('cargo --version 2^>nul') do set CARGO_VER=%%v
echo   [OK] !CARGO_VER!
goto check_msvc

:install_rust
set "RUSTUP=%TEMP%\rustup-init.exe"
echo   Downloading rustup-init.exe...
powershell -NoProfile -Command "try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest 'https://win.rustup.rs/x86_64' -OutFile '%RUSTUP%' -UseBasicParsing; exit 0 } catch { Write-Host $_.Exception.Message; exit 1 }"
if errorlevel 1 (
  echo   [ERROR] Download failed. Manual install: https://rustup.rs/
  set /a FAIL+=1
  goto check_msvc
)
echo   Running rustup-init ^(default toolchain stable, MSVC^)...
"%RUSTUP%" -y --default-toolchain stable --profile default
if errorlevel 1 (
  echo   [ERROR] rustup-init failed.
  set /a FAIL+=1
) else (
  echo   [OK] Rust installed.
  set NEEDS_NEW_SHELL=1
)
del "%RUSTUP%" >nul 2>nul

:check_msvc
REM ============================================================
REM  [4/6] MSVC Build Tools
REM ============================================================
echo.
echo ============================================================
echo  [4/6] MSVC Build Tools ^(VC Tools x86/x64^)
echo ============================================================
set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
set "VS_PATH="
if exist "!VSWHERE!" (
  for /f "usebackq tokens=*" %%i in (`"!VSWHERE!" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2^>nul`) do set "VS_PATH=%%i"
)
if defined VS_PATH (
  echo   [OK] !VS_PATH!
  goto check_webview2
)

echo   [INSTALL] VS Build Tools VCTools workload missing.
set "VS_BT=%TEMP%\vs_BuildTools.exe"
echo   Downloading vs_BuildTools.exe ^(stub, ~3 MB^)...
powershell -NoProfile -Command "try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest 'https://aka.ms/vs/17/release/vs_BuildTools.exe' -OutFile '%VS_BT%' -UseBasicParsing; exit 0 } catch { Write-Host $_.Exception.Message; exit 1 }"
if errorlevel 1 (
  echo   [ERROR] Download failed.
  set /a FAIL+=1
  goto check_webview2
)
echo   Running installer ^(silent, ~2 GB download, 10-20 min^)...
echo   UAC prompt incoming - click Yes.
powershell -NoProfile -Command "$p = Start-Process '%VS_BT%' -ArgumentList '--quiet','--wait','--norestart','--add','Microsoft.VisualStudio.Workload.VCTools','--add','Microsoft.VisualStudio.Component.Windows11SDK.22621','--includeRecommended' -Verb RunAs -Wait -PassThru; exit $p.ExitCode"
if errorlevel 1 (
  echo   [ERROR] Build Tools install failed.
  set /a FAIL+=1
) else (
  echo   [OK] Build Tools installed.
)
del "%VS_BT%" >nul 2>nul

:check_webview2
REM ============================================================
REM  [5/6] WebView2 Runtime
REM ============================================================
echo.
echo ============================================================
echo  [5/6] WebView2 Runtime
echo ============================================================
set WV2_FOUND=0
reg query "HKLM\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" >nul 2>nul
if not errorlevel 1 set WV2_FOUND=1
if !WV2_FOUND! EQU 0 (
  reg query "HKLM\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" >nul 2>nul
  if not errorlevel 1 set WV2_FOUND=1
)
if !WV2_FOUND! EQU 0 (
  reg query "HKCU\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" >nul 2>nul
  if not errorlevel 1 set WV2_FOUND=1
)
if !WV2_FOUND! EQU 1 (
  echo   [OK] WebView2 Runtime present.
) else (
  echo   [WARN] WebView2 Runtime not detected.
  echo          Windows 11 usually bundles it. If app fails to launch:
  echo          Download Evergreen Bootstrapper:
  echo          https://developer.microsoft.com/en-us/microsoft-edge/webview2/
)

REM ============================================================
REM  [6/6] npm install
REM ============================================================
echo.
echo ============================================================
echo  [6/6] npm install ^(project deps^)
echo ============================================================
if !NEEDS_NEW_SHELL! EQU 1 (
  echo   [SKIP] PATH was updated this session.
  echo          Close this window and re-run this script in NEW cmd.
  goto report
)
where npm >nul 2>nul
if errorlevel 1 (
  echo   [ERROR] npm not in PATH.
  set /a FAIL+=1
  goto report
)
if exist "node_modules\@tauri-apps\cli\package.json" (
  echo   [INFO] node_modules already exists - verifying/updating.
)
call npm install
if errorlevel 1 (
  echo   [ERROR] npm install failed.
  set /a FAIL+=1
) else (
  echo   [OK] Dependencies installed.
)

:report
echo.
echo ============================================================
if !FAIL! EQU 0 (
  if !NEEDS_NEW_SHELL! EQU 1 (
    echo   Setup partially complete - PATH was updated.
    echo   ^>^>^> Close this window and re-run setup.bat in NEW cmd.
  ) else (
    echo   All checks passed!
    echo.
    echo   Next steps:
    echo     Dev mode    :  ??.bat
    echo     Build .exe  :  ??.bat
    echo     Diagnostic  :  diag.bat
  )
) else (
  echo   !FAIL! item^(s^) failed. Review messages above.
)
echo ============================================================
echo.
pause
endlocal
exit /b 0
