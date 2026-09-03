@echo off
cd /d "%~dp0..\.."
node scripts\install-plugin.js
if errorlevel 1 exit /b 1
