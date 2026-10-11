const fs = require("fs");
const path = require("path");

const { app, BrowserWindow, dialog, ipcMain } = require("electron");

const FILE_EXTENSION = ".excalidraw";

/** 通过双击文件 / 命令行参数传入的待打开文件路径 */
let pendingFilePath = null;
/** 当前窗口引用，供第二实例、对话框使用 */
let mainWindow = null;

const isExcalidrawFile = (filePath) => {
  if (!filePath || typeof filePath !== "string" || filePath.startsWith("-")) {
    return false;
  }
  return (
    filePath.toLowerCase().endsWith(FILE_EXTENSION) && fs.existsSync(filePath)
  );
};

/** 从启动参数里取出要打开的 .excalidraw 文件（跳过 exe 路径、开发模式的应用目录、开关参数） */
const extractFilePathFromArgv = (argv) =>
  argv.slice(1).find(isExcalidrawFile) || null;

const readFilePayload = async (filePath) => {
  const content = await fs.promises.readFile(filePath, "utf-8");
  return { path: filePath, name: path.basename(filePath), content };
};

const withExcalidrawExtension = (filePath) =>
  filePath.toLowerCase().endsWith(FILE_EXTENSION)
    ? filePath
    : `${filePath}${FILE_EXTENSION}`;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  const devServerUrl = process.env.ELECTRON_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    const indexPath = path.join(__dirname, "..", "build", "index.html");
    mainWindow.loadFile(indexPath);
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Show window when ready to avoid white flash
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });
};

const registerIpcHandlers = () => {
  // 启动时带文件路径（双击文件打开），渲染进程初始化时取用
  ipcMain.handle("excalidraw:get-launch-file", () => pendingFilePath);

  ipcMain.handle("excalidraw:read-file", (_event, filePath) =>
    readFilePayload(filePath),
  );

  ipcMain.handle("excalidraw:write-file", async (_event, filePath, content) => {
    await fs.promises.writeFile(filePath, content, "utf-8");
    return { path: filePath, name: path.basename(filePath) };
  });

  ipcMain.handle("excalidraw:open-dialog", async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: "打开 Excalidraw 文件",
      filters: [{ name: "Excalidraw", extensions: ["excalidraw"] }],
      properties: ["openFile"],
    });
    if (canceled || !filePaths.length) {
      return null;
    }
    return readFilePayload(filePaths[0]);
  });

  ipcMain.handle("excalidraw:save-dialog", async (_event, defaultName) => {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: "另存为",
      defaultPath: defaultName || "未命名.excalidraw",
      filters: [{ name: "Excalidraw", extensions: ["excalidraw"] }],
    });
    if (canceled || !filePath) {
      return null;
    }
    return withExcalidrawExtension(filePath);
  });
};

// 单实例：已打开时把新传入的文件转交给现有窗口
const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  pendingFilePath = extractFilePathFromArgv(process.argv);

  app.on("second-instance", (_event, argv) => {
    const filePath = extractFilePathFromArgv(argv);
    if (!mainWindow) {
      return;
    }
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
    if (filePath) {
      mainWindow.webContents.send("excalidraw:open-file", filePath);
    }
  });

  app.whenReady().then(() => {
    registerIpcHandlers();
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
