/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_ZAKAPRO_SDK_URL?: string;
  readonly VITE_ZAKAPRO_APP_KEY?: string;
  readonly VITE_ZAKAPRO_HUB_URL?: string;
  readonly VITE_ZAKAPRO_WEBHOOK_URL?: string;
  readonly VITE_AGWE_OCEAN_AUDIO_URL?: string;
  readonly VITE_AGWE_LOCALE?: string;
  readonly VITE_AGWE_FPS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
