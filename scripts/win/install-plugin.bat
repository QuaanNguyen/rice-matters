@echo off
cd /d "%~dp0..\.."
echo Installing Rice (plugin + assay + pet dependencies)…
node scripts\install-plugin.js
if errorlevel 1 (
  echo Install failed.
  exit /b 1
)
echo.
echo Done. Open a project with: opencode ^<path^>
exit /b 0
