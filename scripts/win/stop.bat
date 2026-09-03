@echo off
REM Close everything Rice Matters started.
taskkill /FI "WINDOWTITLE eq mock AIR*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq ASSAY*"    /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Pet Rice*" /T /F >nul 2>&1
taskkill /IM electron.exe /F >nul 2>&1
echo Stopped.
