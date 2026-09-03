@echo off
REM Run the demo against several models and report what the gate caught.
REM Needs the ASU VPN and ASSAY_API_KEY (put it in .env, which is gitignored).
cd /d "%~dp0..\.."
node demo\multi.js %*
pause
