# 项目约定与踩坑记录

## 桌面端（Electron）构建

**必须带 `VITE_APP_PLATFORM=electron` 环境变量构建**，否则 `vite.config.mts` 会使用 `base: "/"`，产物 `build/index.html` 引用 `/assets/...` 绝对路径；Electron 以 `file://` 加载时会去系统盘根目录找资源，表现为**整窗白屏（一片空白）**。

正确流程（PowerShell）：

```powershell
$env:VITE_APP_PLATFORM="electron"
yarn --cwd ./excalidraw-app electron:build
yarn --cwd ./excalidraw-app electron:pack
```

注意：

- `electron:pack` 只执行 electron-builder 打包，**不会重新构建前端**；改完代码必须先 `electron:build`。
- 根目录 `build-exe.bat` 目前只调用 `electron:pack`，不能替代完整构建。
- 构建后校验 `excalidraw-app/build/index.html` 中的脚本路径必须是相对路径 `./assets/index-*.js`，出现 `/assets/...` 即说明缺少上述环境变量。
- 桌面端产物目录：`excalidraw-app/dist-electron/`。

## 版本号与静默安装

- 版本号只维护在 `excalidraw-app/package.json` 的 `version` 字段。
- 静默安装（NSIS）：

```powershell
Start-Process -FilePath "excalidraw-app\dist-electron\Excalidraw Setup <版本>.exe" -ArgumentList "/S" -Wait
```

- 安装位置：`%LOCALAPPDATA%\Programs\Excalidraw\Excalidraw.exe`，用 `VersionInfo.ProductVersion` 校验实际安装版本。
- 重新打包同一版本可能导致安装器跳过覆盖，修复重发时请递增版本号。

## 桌面端状态持久化

Electron 下 `LocalData.persistAppStateLocally = false`，`appState` **不会**写入 localStorage。新增 UI 偏好（折叠、筛选、面板状态等）若要跨会话记忆，需单独使用 localStorage 键，例如图层面板的 `excalidraw-layers-collapsed`。

## 提交前校验

- 类型检查：`yarn test:typecheck`
- 单文件风格检查：`npx eslint --max-warnings=0 <文件路径>`
- 未经用户明确授权，禁止执行任何 git 写操作。
