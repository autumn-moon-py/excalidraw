@echo off
cd /d "%~dp0"
call yarn --cwd ./excalidraw-app electron:pack
pause
