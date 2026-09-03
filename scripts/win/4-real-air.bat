@echo off
REM Point ASSAY at the real ASU AIR gateway.
REM Requires: ASU VPN connected, and your key in ASSAY_API_KEY.
cd /d "%~dp0..\.."

if "%ASSAY_API_KEY%"=="" (
  echo.
  echo   Set your AIR key first, in this window:
  echo     set ASSAY_API_KEY=sk-...
  echo.
  echo   Get one from https://voyager.rc.asu.edu  ^(AI LLM tab, Create Key^)
  echo   You must be on the ASU VPN.
  echo.
  pause
  exit /b 1
)

start "Pet Rice" cmd /k "cd pet && npm start"
timeout /t 3 /nobreak >nul

node assay\server.js --upstream https://openai.rc.asu.edu/v1 --port 4141 --events-port 4599 --workdir demo\work\project --protocol demo\protocol.json
pause
