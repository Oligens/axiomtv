/** Runtime configuration. Public Vite values are safe for the browser; secrets stay server-side. */
export const runtimeConfig = {
  apiUrl: (import.meta.env.VITE_API_URL || "").replace(/\/$/, ""),
  zaka: {
    sdkUrl: import.meta.env.VITE_ZAKAPRO_SDK_URL || "https://cdn.zakapro.ht/sdk/v3/zaka.min.js",
    appKey: import.meta.env.VITE_ZAKAPRO_APP_KEY || "zk_pub_9n3mf66bwlheofoiex7j",
    hubUrl: import.meta.env.VITE_ZAKAPRO_HUB_URL || "https://zakapro.vercel.app/#/hub/app_mhtv3pfj/plan_49vqav0l",
    webhookUrl: import.meta.env.VITE_ZAKAPRO_WEBHOOK_URL || "",
  },
  agwe: {
    oceanAudioUrl: import.meta.env.VITE_AGWE_OCEAN_AUDIO_URL || "/sounds/ocean-waves.mp3",
    defaultLocale: import.meta.env.VITE_AGWE_LOCALE || "fr",
    defaultFps: Number(import.meta.env.VITE_AGWE_FPS || 24),
  },
} as const;
