@echo off
REM Full local demo. No VPN and no API key needed - a scripted mock stands in
REM for ASU AIR, so this behaves identically every time.
cd /d "%~dp0..\.."

echo Rebuilding the demo world...
node demo\reset.js
if errorlevel 1 goto fail

start "mock AIR"  cmd /k node mock\model.js --port 4000 --scenario hijack
timeout /t 2 /nobreak >nul

start "ASSAY"     cmd /k node assay\server.js --upstream http://127.0.0.1:4000/v1 --port 4141 --events-port 4599 --workdir demo\work\project --protocol demo\protocol.json
timeout /t 3 /nobreak >nul

start "Pet Rice"  cmd /k "cd pet && npm start"
timeout /t 4 /nobreak >nul

echo.
echo Rice should be floating in the bottom-right corner.
echo Press a key to start the agent...
pause >nul

node demo\drive.js --api http://127.0.0.1:4141/v1 --workdir demo\work\project --pace 2200

echo.
echo Done. The run record is in runs\
pause
exit /b 0
:fail
echo Setup failed.
pause
exit /b 1
