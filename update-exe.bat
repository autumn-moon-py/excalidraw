@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

set "APP_DIR=excalidraw-app"
set "SETUP_DIR=%APP_DIR%\dist-electron"
set "INSTALL_EXE=%LOCALAPPDATA%\Programs\Excalidraw\Excalidraw.exe"
set "VERSION_TMP=%TEMP%\excalidraw-version.txt"

echo ==========================================
echo   Excalidraw 一键构建并更新本机已装程序
echo ==========================================
echo.

rem 递增 patch 版本号，确保安装器覆盖旧版本
echo [1/5] 递增版本号
node -e "const fs=require('fs');const p='excalidraw-app/package.json';const j=JSON.parse(fs.readFileSync(p,'utf8'));const s=j.version.split('.').map(Number);s[2]+=1;j.version=s.join('.');fs.writeFileSync(p,JSON.stringify(j,null,4)+'\n');fs.writeFileSync(process.env.TEMP+'\\excalidraw-version.txt',j.version)"
if errorlevel 1 goto :fail
set /p APP_VERSION=<"%VERSION_TMP%"
del /q "%VERSION_TMP%" >nul 2>nul
if not defined APP_VERSION goto :fail
echo     版本: %APP_VERSION%
echo.

echo [2/5] 构建前端（VITE_APP_PLATFORM=electron）
set "VITE_APP_PLATFORM=electron"
call yarn --cwd ./%APP_DIR% electron:build
if errorlevel 1 goto :fail

rem 相对资源路径缺失时 Electron 以 file:// 加载会白屏
findstr /c:"./assets/" "%APP_DIR%\build\index.html" >nul
if errorlevel 1 (
    echo     [错误] build/index.html 未使用相对资源路径，Electron 下会白屏
    goto :fail
)
echo.

echo [3/5] 打包安装包
call yarn --cwd ./%APP_DIR% electron:pack
if errorlevel 1 goto :fail

set "SETUP=%SETUP_DIR%\Excalidraw Setup %APP_VERSION%.exe"
if not exist "%SETUP%" (
    echo     [错误] 未找到安装包: %SETUP%
    goto :fail
)
echo.

echo [4/5] 关闭正在运行的 Excalidraw
taskkill /f /im Excalidraw.exe >nul 2>nul
pwsh -NoProfile -Command "Start-Sleep -Seconds 2"
echo.

echo [5/5] 静默安装 %APP_VERSION%
pwsh -NoProfile -Command "Start-Process -FilePath '%CD%\%SETUP%' -ArgumentList '/S' -Wait"
if errorlevel 1 goto :fail

pwsh -NoProfile -Command "$p='%INSTALL_EXE%'; if (Test-Path $p) { $v=(Get-Item $p).VersionInfo.ProductVersion; Write-Host ('已安装版本: ' + $v); if ($v -notlike '%APP_VERSION%*') { Write-Host '[提示] 已安装版本与安装包不一致'; exit 2 } } else { Write-Host '[提示] 未在默认目录找到已安装程序'; exit 3 }"
if errorlevel 1 goto :fail

echo.
echo 更新完成。
goto :end

:fail
echo.
echo [失败] 更新未完成，请查看上方输出。
pause
exit /b 1

:end
pause
exit /b 0
