@echo off
REM Just the pet, replaying a canned sequence. Nothing else needs to be running.
cd /d "%~dp0..\..\pet"
npm run start:demo
