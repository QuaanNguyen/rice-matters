@echo off
cd /d "%~dp0..\.."
echo Installing pet dependencies (this takes a minute the first time)...
cd pet
call npm install
if errorlevel 1 goto fail
cd ..
echo Installing the Rice plugin for every OpenCode project on this machine...
node scripts\install-plugin.js
if errorlevel 1 goto fail
echo.
echo Done. Demo: 2-demo.bat   Your own project: 4-real-air.bat
pause
exit /b 0
:fail
echo.
echo Setup failed. Check that Node.js is installed: node -v
pause
exit /b 1
