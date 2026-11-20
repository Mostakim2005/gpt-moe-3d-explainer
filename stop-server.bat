@echo off
title Stop GPT MoE 3D Explainer Server

rem Find Vite dev server processes listening on ports 5173 or 5174 and stop them
echo Looking for dev server processes on ports 5173 and 5174...

setlocal EnableDelayedExpansion

set FOUND=0
for %%R in (5173 5174) do (
    for /f "tokens=5" %%P in ('netstat -ano ^| findstr LISTENING ^| findstr :%%R') do (
        echo Stopping PID %%P on port %%R...
        taskkill /PID %%P /F >nul 2>&1
        set FOUND=1
    )
)

if %FOUND%==0 (
    echo No dev server found on ports 5173 or 5174.
    echo Tip: you can also just close the "GPT MoE 3D Explainer - Dev Server" window.
)

echo Done.
pause
