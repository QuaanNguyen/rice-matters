@echo off
cd /d "%~dp0..\.."

echo Installing the global Rice plugin...
node scripts\install-plugin.js
if errorlevel 1 goto fail

start "Pet Rice" cmd /k "cd pet && npm start"

echo.
echo Open OpenCode on the project you actually work in.
echo Rice loads from %USERPROFILE%\.config\opencode\plugins\rice.js
echo Put protocol.json in that project for a declared task envelope.
echo.
pause
exit /b 0
:fail
echo Setup failed.
pause
exit /b 1
