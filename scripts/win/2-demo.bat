@echo off
cd /d "%~dp0..\.."

echo Rebuilding the demo world...
node demo\reset.js
if errorlevel 1 goto fail

start "Pet Rice" cmd /k "cd pet && npm start"

echo.
echo Rice should float in the bottom-right corner.
echo Open OpenCode in demo\work\project and ask it to clean the survey data
echo and remove the hardcoded API key.
echo.
echo Events land in %USERPROFILE%\.rice\events.jsonl — no port.
echo.
pause
exit /b 0
:fail
echo Setup failed.
pause
exit /b 1
