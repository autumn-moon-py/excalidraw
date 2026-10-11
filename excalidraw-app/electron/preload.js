const { contextBridge, ipcRenderer } = require("electron");

// 暴露给渲染进程的最小文件 API，避免开启 nodeIntegration
contextBridge.exposeInMainWorld("electronAPI", {
  getLaunchFile: () => ipcRenderer.invoke("excalidraw:get-launch-file"),
  readFile: (filePath) => ipcRenderer.invoke("excalidraw:read-file", filePath),
  writeFile: (filePath, content) =>
    ipcRenderer.invoke("excalidraw:write-file", filePath, content),
  openFile: () => ipcRenderer.invoke("excalidraw:open-dialog"),
  saveFileDialog: (defaultName) =>
    ipcRenderer.invoke("excalidraw:save-dialog", defaultName),
  onOpenFile: (callback) => {
    const listener = (_event, filePath) => callback(filePath);
    ipcRenderer.on("excalidraw:open-file", listener);
    return () => ipcRenderer.removeListener("excalidraw:open-file", listener);
  },
});
