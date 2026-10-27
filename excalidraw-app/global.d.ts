import "@excalidraw/excalidraw/global";
import "@excalidraw/excalidraw/css";

/** 主进程读取到的文件内容 */
interface DesktopFilePayload {
  path: string;
  name: string;
  content: string;
}

/** gm_hub 骰子输出消息 */
export interface DesktopDiceOutputMessage {
  id: string;
  text: string;
  /** ARGB32，与 gm_hub 的 Color.toARGB32() 对应 */
  colorValue: number;
}

/** preload 通过 contextBridge 暴露的原生文件 API */
interface ElectronAPI {
  getLaunchFile: () => Promise<string | null>;
  readFile: (filePath: string) => Promise<DesktopFilePayload>;
  writeFile: (
    filePath: string,
    content: string,
  ) => Promise<{ path: string; name: string }>;
  openFile: () => Promise<DesktopFilePayload | null>;
  saveFileDialog: (defaultName?: string) => Promise<string | null>;
  onDiceOutput: (
    callback: (messages: DesktopDiceOutputMessage[]) => void,
  ) => () => void;
}

declare global {
  interface Window {
    __EXCALIDRAW_SHA__: string | undefined;
    electronAPI?: ElectronAPI;
  }
}
