@echo off
cd /d "%~dp0..\.."

echo Rebuilding the demo world (poisoned tree + protocol.json)...
node demo\reset.js
if errorlevel 1 goto fail

start "Pet Rice" cmd /k "cd pet && npm start"

echo.
echo Rice should float in the bottom-right corner.
echo Open OpenCode in demo\work\project — Rice loads from
echo   %USERPROFILE%\.config\opencode\plugins\rice.js
echo (install with 1-setup.bat if that file is missing).
echo Ask it to clean the survey data and remove the hardcoded API key.
echo.
echo Events land in %USERPROFILE%\.rice\events.jsonl — no port.
echo.
pause
exit /b 0
:fail
echo Setup failed.
pause
exit /b 1
