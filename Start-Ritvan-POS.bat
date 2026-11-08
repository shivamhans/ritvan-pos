@echo off
setlocal EnableExtensions
title Ritvan POS Launcher

REM Always run from the folder that contains this BAT file. This supports paths with spaces.
set "ROOT=%~dp0"

echo.
echo  ======================================
echo          RITVAN POS LAUNCHER
echo  ======================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js was not found. Install Node.js 20 or newer, then try again.
  echo https://nodejs.org/
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm was not found. Reinstall Node.js with npm included, then try again.
  pause
  exit /b 1
)

if not exist "%ROOT%server\package.json" (
  echo [ERROR] Could not find server\package.json.
  echo Put this BAT file in the Ritvan POS project root folder.
  pause
  exit /b 1
)

if not exist "%ROOT%client\package.json" (
  echo [ERROR] Could not find client\package.json.
  echo Put this BAT file in the Ritvan POS project root folder.
  pause
  exit /b 1
)

if not exist "%ROOT%server\.env" (
  echo [ERROR] server\.env was not found.
  echo Copy server\.env.example to server\.env, then set your MySQL details and JWT_SECRET.
  echo Do not put your passwords or secrets into this BAT file.
  pause
  exit /b 1
)

if not exist "%ROOT%server\node_modules\express\package.json" (
  echo [INFO] Installing API dependencies for the first run...
  pushd "%ROOT%server"
  call npm install
  if errorlevel 1 (
    popd
    echo [ERROR] API dependencies could not be installed. Check your internet connection and try again.
    pause
    exit /b 1
  )
  popd
)

if not exist "%ROOT%client\node_modules\vite\package.json" (
  echo [INFO] Installing frontend dependencies for the first run...
  pushd "%ROOT%client"
  call npm install
  if errorlevel 1 (
    popd
    echo [ERROR] Frontend dependencies could not be installed. Check your internet connection and try again.
    pause
    exit /b 1
  )
  popd
)

echo [INFO] Opening the API and frontend in separate terminal windows...
echo [INFO] Keep both terminal windows open while using Ritvan POS.
start "Ritvan POS API" /D "%ROOT%server" cmd.exe /k "npm run dev"
timeout /t 2 /nobreak >nul
start "Ritvan POS Frontend" /D "%ROOT%client" cmd.exe /k "npm run dev"
timeout /t 5 /nobreak >nul
start "" "http://localhost:5173"
echo.
echo [INFO] Frontend is usually at http://localhost:5173.
echo If Vite reports a different port, open the URL shown in the frontend terminal.
echo If the API cannot connect, check that MySQL is running and server\.env is correct.
timeout /t 4 /nobreak >nul
exit /b 0
