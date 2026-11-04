@echo off
title GPT MoE 3D Explainer - Production Preview
cd /d "%~dp0"

rem Ensure dependencies exist
if not exist "node_modules" (
    echo Installing dependencies (first run)...
    call npm install
    if errorlevel 1 (
        echo npm install failed.
        pause
        exit /b 1
    )
)

echo Building production bundle...
call npm run build
if errorlevel 1 (
    echo Build failed.
    pause
    exit /b 1
)

echo Serving dist\ on http://localhost:4173  (Vite preview)
echo Press Ctrl+C to stop.
echo.

call npm run preview -- --host 127.0.0.1 --port 4173

pause
