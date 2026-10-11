import { LoadIcon } from "@excalidraw/excalidraw/components/icons";
import { useI18n } from "@excalidraw/excalidraw/i18n";
import { WelcomeScreen } from "@excalidraw/excalidraw/index";
import React from "react";

import { isDesktopApp, openFileFromDisk } from "../native-file";

export const AppWelcomeScreen: React.FC = React.memo(() => {
  const { t } = useI18n();

  return (
    <WelcomeScreen>
      <WelcomeScreen.Hints.MenuHint>
        {t("welcomeScreen.app.menuHint")}
      </WelcomeScreen.Hints.MenuHint>
      <WelcomeScreen.Hints.ToolbarHint />
      <WelcomeScreen.Hints.HelpHint />
      <WelcomeScreen.Center>
        <WelcomeScreen.Center.Logo />
        <WelcomeScreen.Center.Heading>
          {t("welcomeScreen.app.center_heading")}
          <br />
          {t("welcomeScreen.app.center_heading_line2")}
          <br />
          {t("welcomeScreen.app.center_heading_line3")}
        </WelcomeScreen.Center.Heading>
        <WelcomeScreen.Center.Menu>
          {isDesktopApp() ? (
            <WelcomeScreen.Center.MenuItem
              onSelect={() => openFileFromDisk()}
              shortcut="Ctrl+O"
              icon={LoadIcon}
            >
              {t("buttons.load")}
            </WelcomeScreen.Center.MenuItem>
          ) : (
            <WelcomeScreen.Center.MenuItemLoadScene />
          )}
          <WelcomeScreen.Center.MenuItemHelp />
        </WelcomeScreen.Center.Menu>
      </WelcomeScreen.Center>
    </WelcomeScreen>
  );
});
