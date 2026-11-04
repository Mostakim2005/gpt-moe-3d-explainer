@echo off
title GPT MoE 3D Explainer - Dev Server
cd /d "%~dp0"

echo ============================================
echo   GPT MoE 3D Explainer - starting dev server
echo ============================================
echo.

where node >nul 2>&1
if errorlevel 1 goto :nonode
goto :have_node
:nonode
echo ERROR: node.exe not found on PATH.
pause
exit /b 1
:have_node

where npm >nul 2>&1
if errorlevel 1 goto :nonpm
goto :have_npm
:nonpm
echo ERROR: npm not found on PATH.
pause
exit /b 1
:have_npm

node --version
call npm --version
echo.

echo MARK-A: checking node_modules
if exist "node_modules" goto :depsok
echo MARK-C: need install
echo Installing dependencies - first run, may take a minute...
call npm install
if errorlevel 1 goto :installfail
goto :depsok
:installfail
echo.
echo ERROR: npm install failed.
pause
exit /b 1
:depsok
echo MARK-D: deps ok

echo.
echo Opening http://localhost:5173 in your browser...
echo Press Ctrl+C to stop the server. Close this window to stop it too.
echo.

start "" /min cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:5173"

call npm run dev -- --host 127.0.0.1 --port 5173

echo.
echo Server stopped.
pause


