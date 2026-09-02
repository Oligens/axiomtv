const ZAKAPRO_SDK_URL = "https://cdn.zakapro.ht/sdk/v3/zaka.min.js";
const ZAKAPRO_APP_KEY = "zk_pub_9n3mf66bwlheofoiex7j";
const ZAKAPRO_HUB_URL = "https://zakapro.vercel.app/#/hub/app_mhtv3pfj/plan_49vqav0l";

interface ZakaCheckoutOptions {
  amount: number;
  currency: "HTG";
  label: string;
  methods: string[];
  customer?: { email?: string };
  onSuccess?: (tx: { reference?: string; amount?: number }) => void;
  onCancel?: () => void;
}

interface ZakaInstance {
  checkout: { open: (options: ZakaCheckoutOptions) => Promise<unknown> };
}

declare global {
  interface Window {
    ZakaPro?: { init: (options: { appKey: string; webhookUrl: string; locale: "ht"; theme: "dark" }) => ZakaInstance };
    __axiomZakaPromise?: Promise<ZakaInstance>;
  }
}

function webhookUrl(): string {
  return (import.meta.env.VITE_ZAKAPRO_WEBHOOK_URL as string | undefined)?.replace(/\/$/, "") || `${window.location.origin}/api/webhooks/zakapro`;
}

export function loadZakaPro(): Promise<ZakaInstance> {
  if (window.__axiomZakaPromise) return window.__axiomZakaPromise;

  window.__axiomZakaPromise = new Promise((resolve, reject) => {
    if (window.ZakaPro) {
      resolve(window.ZakaPro.init({ appKey: ZAKAPRO_APP_KEY, webhookUrl: webhookUrl(), locale: "ht", theme: "dark" }));
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${ZAKAPRO_SDK_URL}"]`);
    const script = existing ?? document.createElement("script");
    script.src = ZAKAPRO_SDK_URL;
    script.async = true;
    script.onload = () => {
      if (!window.ZakaPro) {
        reject(new Error("SDK ZakaPro chargé mais indisponible."));
        return;
      }
      resolve(window.ZakaPro.init({ appKey: ZAKAPRO_APP_KEY, webhookUrl: webhookUrl(), locale: "ht", theme: "dark" }));
    };
    script.onerror = () => reject(new Error("Impossible de charger le SDK ZakaPro."));
    if (!existing) document.head.appendChild(script);
  });

  return window.__axiomZakaPromise;
}

export async function openAgweCheckout(email: string, handlers: Pick<ZakaCheckoutOptions, "onSuccess" | "onCancel"> = {}) {
  const zaka = await loadZakaPro();
  return zaka.checkout.open({
    amount: 70,
    currency: "HTG",
    label: "ACTIVER AGWE STREAM",
    methods: ["moncash", "natcash"],
    customer: { email },
    ...handlers,
  });
}

export const AGWE_ZAKAPRO_HUB_URL = ZAKAPRO_HUB_URL;
