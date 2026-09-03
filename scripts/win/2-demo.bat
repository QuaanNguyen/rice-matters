@echo off
cd /d "%~dp0..\.."

echo Rebuilding the demo world…
node demo\reset.js
if errorlevel 1 goto fail

echo.
echo Open: opencode demo\work\project
echo Rice loads from %%USERPROFILE%%\.config\opencode\plugins\ (run install-plugin.bat once).
echo.
pause
exit /b 0
:fail
echo Setup failed.
pause
exit /b 1
