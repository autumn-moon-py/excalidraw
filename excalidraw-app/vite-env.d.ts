/// <reference types="vite-plugin-svgr/client" />
interface ImportMetaEnv {
  VITE_APP_PLATFORM: string;
  VITE_APP_GIT_SHA: string;
  VITE_APP_DISABLE_SENTRY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
