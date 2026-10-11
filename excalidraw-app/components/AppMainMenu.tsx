import { getShortcutFromShortcutName } from "@excalidraw/excalidraw/actions/shortcuts";
import { useExcalidrawSetAppState } from "@excalidraw/excalidraw/components/App";
import DropdownMenuItem from "@excalidraw/excalidraw/components/dropdownMenu/DropdownMenuItem";
import { LoadIcon, save } from "@excalidraw/excalidraw/components/icons";
import { useUIAppState } from "@excalidraw/excalidraw/context/ui-appState";
import { useI18n } from "@excalidraw/excalidraw/i18n";
import { MainMenu } from "@excalidraw/excalidraw/index";
import React from "react";

import {
  isDesktopApp,
  openFileFromDisk,
  saveToCurrentFile,
} from "../native-file";

import {
  LAYERS_SIDEBAR_NAME,
  LAYERS_TAB,
  layersIcon,
} from "./LayerPanel/LayerSidebar";

export const AppMainMenu: React.FC = React.memo(() => {
  const { t } = useI18n();
  const setAppState = useExcalidrawSetAppState();
  const appState = useUIAppState();

  const toggleLayers = () =>
    setAppState({
      openSidebar:
        appState.openSidebar?.name === LAYERS_SIDEBAR_NAME
          ? null
          : { name: LAYERS_SIDEBAR_NAME, tab: LAYERS_TAB },
      openMenu: null,
    });

  return (
    <MainMenu>
      {isDesktopApp() ? (
        <>
          <DropdownMenuItem
            icon={LoadIcon}
            onSelect={() => openFileFromDisk()}
            data-testid="load-button"
            shortcut={getShortcutFromShortcutName("loadScene")}
          >
            {t("buttons.load")}
          </DropdownMenuItem>
          <DropdownMenuItem
            icon={save}
            onSelect={() => saveToCurrentFile()}
            data-testid="save-button"
            shortcut={getShortcutFromShortcutName("saveScene")}
          >
            {t("buttons.save")}
          </DropdownMenuItem>
        </>
      ) : (
        <>
          <MainMenu.DefaultItems.LoadScene />
          <MainMenu.DefaultItems.SaveToActiveFile />
        </>
      )}
      <DropdownMenuItem
        icon={layersIcon}
        onSelect={toggleLayers}
        data-testid="layers-button"
        shortcut="Ctrl+L"
      >
        图层
      </DropdownMenuItem>
      <MainMenu.DefaultItems.Export />
      <MainMenu.DefaultItems.SaveAsImage />
      <MainMenu.DefaultItems.SearchMenu />
      <MainMenu.DefaultItems.Help />
      <MainMenu.DefaultItems.ClearCanvas />
    </MainMenu>
  );
});
