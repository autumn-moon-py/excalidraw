@echo off
cd /d "%~dp0"
set VITE_APP_PLATFORM=electron
call yarn --cwd ./excalidraw-app electron:build
pause
