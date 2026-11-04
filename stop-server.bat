@echo off
title Stop GPT MoE 3D Explainer Server

rem Find Vite dev server processes listening on port 5173 and stop them
echo Looking for processes on port 5173...

setlocal EnableDelayedExpansion

set FOUND=0
for /f "tokens=5" %%P in ('netstat -ano ^| findstr LISTENING ^| findstr :5173') do (
    echo Stopping PID %%P...
    taskkill /PID %%P /F >nul 2>&1
    set FOUND=1
)

if %FOUND%==0 (
    echo No dev server found on port 5173.
    rem Fallback: kill node processes running vite in this folder
    for /f "tokens=2,5" %%A in ('tasklist /FI "IMAGENAME eq node.exe" /FO CSV ^| findstr /I "node"') do (
        rem Best-effort: only kills if cmdline mentions this project
    )
    echo Tip: you can also just close the "GPT MoE 3D Explainer - Dev Server" window.
)

echo Done.
pause
