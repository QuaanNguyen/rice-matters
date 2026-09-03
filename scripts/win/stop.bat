@echo off
taskkill /FI "WINDOWTITLE eq Pet Rice*" /T /F >nul 2>&1
taskkill /IM electron.exe /F >nul 2>&1
echo Stopped.
