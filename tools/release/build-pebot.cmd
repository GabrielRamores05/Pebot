@echo off
rem ---------------------------------------------------------------------------
rem  Build the Pebot installer and put it in the "Pebot 1.0" folder.
rem  Run on the seller's own PC, after `tools\pebot-keygen\pebot-keygen.cmd init`.
rem  Usage:  tools\release\build-pebot.cmd
rem ---------------------------------------------------------------------------
setlocal EnableExtensions
set "ROOT=%~dp0..\.."
pushd "%ROOT%" || exit /b 1
set "ROOT=%CD%"
set "OUT=%ROOT%\Pebot 1.0"

echo.
echo [1/5] Checking the license public key...
findstr /C:"const PUBLIC_KEY_PEM = null" "my-app\lib\license\public-key.js" >nul
if not errorlevel 1 (
  echo.
  echo   STOP: no seller public key yet. Every customer's key would be rejected.
  echo   Run this once on your own PC, then back up the PebotSeller folder:
  echo       tools\pebot-keygen\pebot-keygen.cmd init
  echo   Commit my-app\lib\license\public-key.js afterwards.
  popd & exit /b 1
)
if exist "my-app\PebotSeller" (
  echo   STOP: a PebotSeller folder is inside the app. The private key must never ship.
  popd & exit /b 1
)

echo [2/5] Installing packages...
pushd my-app
if exist node_modules (call npm install --no-audit --no-fund) else (call npm ci --no-audit --no-fund)
if errorlevel 1 goto :fail

echo [3/5] Running the tests...
call npm run test:unit
if errorlevel 1 goto :fail

echo [4/5] Building the installer (this takes a few minutes)...
call npm run electron:build:win
if errorlevel 1 goto :fail
popd

echo [5/5] Copying to "%OUT%"...
if not exist "%OUT%" mkdir "%OUT%"
set "FOUND="
for %%F in ("%ROOT%\dist-electron\*.exe") do (
  copy /Y "%%F" "%OUT%\" >nul
  certutil -hashfile "%%F" SHA256 | findstr /V /C:"hash" /C:"CertUtil" > "%OUT%\%%~nF.sha256.txt"
  echo   %%~nxF
  set "FOUND=1"
)
if not defined FOUND (
  echo   No installer was found in dist-electron.
  popd & exit /b 1
)

echo.
echo Done. Give customers the .exe in "%OUT%".
echo The .sha256.txt next to it lets you check a copy was not changed.
popd
exit /b 0

:fail
echo.
echo Build stopped. Read the messages above.
popd
popd
exit /b 1
