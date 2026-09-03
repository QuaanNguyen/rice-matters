@echo off
cd /d "%~dp0..\.."

echo Rebuilding the demo world...
node demo\reset.js
if errorlevel 1 goto fail

start "Pet Rice" cmd /k "cd pet && npm start"

echo.
echo Open OpenCode in demo\work\project.
echo The plugin is already wired by demo\reset.js.
echo.
pause
exit /b 0
:fail
echo Setup failed.
pause
exit /b 1
