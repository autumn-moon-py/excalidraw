import { Sidebar } from "@excalidraw/excalidraw";

import React, { useState } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { LayerPanel } from "./LayerPanel";

export const LAYERS_SIDEBAR_NAME = "layers";
export const LAYERS_TAB = "layers";

export const layersIcon = (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <path
      d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** 顶部右上角入口按钮 */
export const LayerSidebarTrigger: React.FC = () => (
  <Sidebar.Trigger
    name={LAYERS_SIDEBAR_NAME}
    tab={LAYERS_TAB}
    title="图层"
    icon={layersIcon}
  />
);

/** 图层面板侧栏，默认停靠右侧、可切到左侧 */
export const LayerSidebar: React.FC<{
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}> = ({ excalidrawAPI }) => {
  const [docked, setDocked] = useState(false);

  return (
    <Sidebar
      name={LAYERS_SIDEBAR_NAME}
      className="layer-sidebar"
      docked={docked}
      onDock={setDocked}
    >
      <Sidebar.Header />
      {excalidrawAPI ? <LayerPanel excalidrawAPI={excalidrawAPI} /> : null}
    </Sidebar>
  );
};
