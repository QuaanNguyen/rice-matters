@echo off
REM One-time setup. Installs Electron for the pet.
cd /d "%~dp0..\.."
echo Installing pet dependencies (this takes a minute the first time)...
cd pet
call npm install
if errorlevel 1 goto fail
echo.
echo Done. Next: run 2-demo.bat
pause
exit /b 0
:fail
echo.
echo npm install failed. Check that Node.js is installed: node -v
pause
exit /b 1
