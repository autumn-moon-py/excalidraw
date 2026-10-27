/**
 * 桌面端（Electron）原生文件读写。
 *
 * 纯文件模式：画布不再依赖浏览器本地缓存，所有状态来自磁盘上的
 * `.excalidraw` 文件；保存直接写回当前文件。
 */
import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import { loadFromBlob } from "@excalidraw/excalidraw/data/blob";
import { serializeAsJSON } from "@excalidraw/excalidraw/data/json";
import { t } from "@excalidraw/excalidraw/i18n";

import type {
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";

export const isDesktopApp = () =>
  typeof window !== "undefined" && !!window.electronAPI;

let excalidrawAPI: ExcalidrawImperativeAPI | null = null;
let currentFilePath: string | null = null;

export const setExcalidrawAPI = (api: ExcalidrawImperativeAPI | null) => {
  excalidrawAPI = api;
};

const getFileName = (filePath: string) =>
  filePath.split(/[\\/]/).pop() || filePath;

const stripExtension = (fileName: string) =>
  fileName.replace(/\.excalidraw$/i, "");

const createFileFromPayload = (payload: { name: string; content: string }) =>
  new File([payload.content], payload.name, { type: "application/json" });

const parseSceneFromPayload = (payload: { name: string; content: string }) =>
  loadFromBlob(createFileFromPayload(payload), null, null);

/** 启动时若带文件（双击打开），把它作为初始画布内容 */
export const getSceneFromLaunchFile =
  async (): Promise<ExcalidrawInitialDataState | null> => {
    if (!isDesktopApp()) {
      return null;
    }
    const filePath = await window.electronAPI!.getLaunchFile();
    if (!filePath) {
      return null;
    }
    const payload = await window.electronAPI!.readFile(filePath);
    const data = await parseSceneFromPayload(payload);
    currentFilePath = payload.path;
    document.title = payload.name;
    return {
      elements: data.elements,
      appState: data.appState,
      files: data.files,
    };
  };

const applyScene = async (payload: {
  path: string;
  name: string;
  content: string;
}) => {
  const api = excalidrawAPI;
  if (!api) {
    return;
  }
  const data = await parseSceneFromPayload(payload);
  api.updateScene({
    elements: data.elements,
    appState: {
      ...data.appState,
      isLoading: false,
      name: stripExtension(payload.name),
      fileHandle: null,
    },
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  api.addFiles(Object.values(data.files));
  currentFilePath = payload.path;
  document.title = payload.name;
};

/** 弹出原生打开对话框并加载所选文件 */
export const openFileFromDisk = async () => {
  if (!isDesktopApp() || !excalidrawAPI) {
    return;
  }
  try {
    const payload = await window.electronAPI!.openFile();
    if (payload) {
      await applyScene(payload);
    }
  } catch (error) {
    excalidrawAPI.setToast({ message: (error as Error).message });
  }
};

/** 保存到当前文件；尚未关联文件时弹出另存为对话框 */
export const saveToCurrentFile = async (): Promise<boolean> => {
  const api = excalidrawAPI;
  if (!isDesktopApp() || !api) {
    return false;
  }

  let targetPath = currentFilePath;
  if (!targetPath) {
    targetPath = await window.electronAPI!.saveFileDialog(
      `${api.getName() || "未命名"}.excalidraw`,
    );
    if (!targetPath) {
      return false;
    }
  }

  const content = serializeAsJSON(
    api.getSceneElementsIncludingDeleted(),
    api.getAppState(),
    api.getFiles(),
    "local",
  );
  await window.electronAPI!.writeFile(targetPath, content);
  currentFilePath = targetPath;
  document.title = getFileName(targetPath);
  api.setToast({
    message: t("toast.fileSavedToFilename").replace(
      "{filename}",
      `"${getFileName(targetPath)}"`,
    ),
  });
  return true;
};
