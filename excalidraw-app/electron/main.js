const fs = require("fs");
const http = require("http");
const path = require("path");

const { app, BrowserWindow, dialog, ipcMain } = require("electron");

const FILE_EXTENSION = ".excalidraw";

/** 与 gm_hub 约定的本地桥接端口，仅监听回环地址 */
const DICE_OUTPUT_PORT = 45870;
const DICE_OUTPUT_MAX_MESSAGES = 100;

/** 主进程持有输出消息，渲染进程重载后可重新取回 */
let diceOutputMessages = [];

/** ready 之前收到的待打开文件（启动参数 / 冷启动期间的再次双击），就绪后逐个开窗 */
const pendingOpenFiles = [];
/** 当前打开的所有窗口 */
const windows = new Set();
/** 每个窗口各自的启动文件，按 webContents id 隔离，避免多窗口互相覆盖 */
const launchFiles = new Map();
/** 最近获得焦点的窗口，供无文件参数时聚焦 */
let lastFocusedWindow = null;

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

const sendDiceOutput = () => {
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send("excalidraw:dice-output", diceOutputMessages);
    }
  }
};

const readJsonBody = (request) =>
  new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("payload too large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });

/** 接收 gm_hub 推送的骰子输出，转交渲染进程展示 */
const startDiceOutputServer = () => {
  const server = http.createServer(async (request, response) => {
    const respond = (status, payload) => {
      response.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
      });
      response.end(JSON.stringify(payload));
    };

    if (request.method === "GET" && request.url === "/dice-output/health") {
      return respond(200, { ok: true, count: diceOutputMessages.length });
    }

    if (request.method === "POST" && request.url === "/dice-output/clear") {
      diceOutputMessages = [];
      sendDiceOutput();
      return respond(200, { ok: true });
    }

    if (request.method === "POST" && request.url === "/dice-output/message") {
      try {
        const payload = await readJsonBody(request);
        const text = typeof payload.text === "string" ? payload.text.trim() : "";
        if (!text) {
          return respond(400, { ok: false, error: "empty text" });
        }
        diceOutputMessages.push({
          id: typeof payload.id === "string" ? payload.id : String(Date.now()),
          text: text.slice(0, 2000),
          colorValue: Number.isFinite(payload.colorValue)
            ? payload.colorValue
            : 0xffffffff,
        });
        if (diceOutputMessages.length > DICE_OUTPUT_MAX_MESSAGES) {
          diceOutputMessages = diceOutputMessages.slice(
            -DICE_OUTPUT_MAX_MESSAGES,
          );
        }
        sendDiceOutput();
        return respond(200, { ok: true });
      } catch {
        return respond(400, { ok: false, error: "invalid json" });
      }
    }

    return respond(404, { ok: false, error: "not found" });
  });

  server.on("error", (error) => {
    console.error("[dice-output] 本地桥接服务启动失败:", error);
  });

  server.listen(DICE_OUTPUT_PORT, "127.0.0.1", () => {
    console.log(`[dice-output] 监听 http://127.0.0.1:${DICE_OUTPUT_PORT}`);
  });
};

const createWindow = (filePath = null) => {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  const webContentsId = win.webContents.id;

  windows.add(win);
  launchFiles.set(webContentsId, filePath);
  lastFocusedWindow = win;

  const devServerUrl = process.env.ELECTRON_DEV_SERVER_URL;
  if (devServerUrl) {
    win.loadURL(devServerUrl);
  } else {
    const indexPath = path.join(__dirname, "..", "build", "index.html");
    win.loadFile(indexPath);
  }

  win.on("focus", () => {
    lastFocusedWindow = win;
  });

  win.on("closed", () => {
    launchFiles.delete(webContentsId);
    windows.delete(win);
    if (lastFocusedWindow === win) {
      lastFocusedWindow = null;
    }
  });

  // 渲染进程每次加载完成后补发当前输出，保证重载后展示不丢
  win.webContents.on("did-finish-load", () => {
    win.webContents.send("excalidraw:dice-output", diceOutputMessages);
  });

  // Show window when ready to avoid white flash
  win.once("ready-to-show", () => {
    win.show();
  });

  return win;
};

/** 当前窗口无文件参数时的聚焦目标 */
const getFocusWindow = () =>
  lastFocusedWindow && !lastFocusedWindow.isDestroyed()
    ? lastFocusedWindow
    : [...windows].find((win) => !win.isDestroyed()) || null;

const registerIpcHandlers = () => {
  // 启动时带文件路径（双击文件打开），渲染进程初始化时按窗口取用
  ipcMain.handle(
    "excalidraw:get-launch-file",
    (event) => launchFiles.get(event.sender.id) ?? null,
  );

  ipcMain.handle("excalidraw:read-file", (_event, filePath) =>
    readFilePayload(filePath),
  );

  ipcMain.handle("excalidraw:write-file", async (_event, filePath, content) => {
    await fs.promises.writeFile(filePath, content, "utf-8");
    return { path: filePath, name: path.basename(filePath) };
  });

  ipcMain.handle("excalidraw:open-dialog", async (event) => {
    const parentWindow = BrowserWindow.fromWebContents(event.sender);
    const options = {
      title: "打开 Excalidraw 文件",
      filters: [{ name: "Excalidraw", extensions: ["excalidraw"] }],
      properties: ["openFile"],
    };
    const { canceled, filePaths } = parentWindow
      ? await dialog.showOpenDialog(parentWindow, options)
      : await dialog.showOpenDialog(options);
    if (canceled || !filePaths.length) {
      return null;
    }
    return readFilePayload(filePaths[0]);
  });

  ipcMain.handle("excalidraw:save-dialog", async (event, defaultName) => {
    const parentWindow = BrowserWindow.fromWebContents(event.sender);
    const options = {
      title: "另存为",
      defaultPath: defaultName || "未命名.excalidraw",
      filters: [{ name: "Excalidraw", extensions: ["excalidraw"] }],
    };
    const { canceled, filePath } = parentWindow
      ? await dialog.showSaveDialog(parentWindow, options)
      : await dialog.showSaveDialog(options);
    if (canceled || !filePath) {
      return null;
    }
    return withExcalidrawExtension(filePath);
  });
};

// 单实例：已打开时，双击文件新建窗口打开，避免覆盖当前窗口内容
const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  const launchFilePath = extractFilePathFromArgv(process.argv);
  if (launchFilePath) {
    pendingOpenFiles.push(launchFilePath);
  }

  app.on("second-instance", (_event, argv) => {
    const filePath = extractFilePathFromArgv(argv);
    if (filePath) {
      if (app.isReady()) {
        createWindow(filePath);
      } else {
        pendingOpenFiles.push(filePath);
      }
      return;
    }
    const win = getFocusWindow();
    if (!win) {
      return;
    }
    if (win.isMinimized()) {
      win.restore();
    }
    win.focus();
  });

  app.whenReady().then(() => {
    registerIpcHandlers();
    startDiceOutputServer();
    if (pendingOpenFiles.length) {
      pendingOpenFiles.splice(0).forEach((filePath) => createWindow(filePath));
    } else {
      createWindow();
    }

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
