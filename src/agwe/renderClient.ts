import { runtimeConfig } from "../config/runtime";
import type { ScifiRenderPlan } from "./scifi";

export interface RenderJob {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  progress: number;
  outputUrl?: string;
  error?: string;
}

const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_RETRIES = 2;

function endpoint(): string {
  return runtimeConfig.agwe.renderApiUrl || "/api/agwe/render";
}

async function request<T>(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(input, { ...init, signal: controller.signal, headers: { Accept: "application/json", "Content-Type": "application/json", ...init.headers } });
      const text = await response.text();
      const data = text ? JSON.parse(text) : null;
      if (!response.ok) throw new Error(data?.error || `Render API HTTP ${response.status}`);
      return data as T;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES) await new Promise((resolve) => window.setTimeout(resolve, 500 * 2 ** attempt));
    } finally {
      window.clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Render API indisponible");
}

export async function createRenderJob(plan: ScifiRenderPlan, sourceUrl: string): Promise<RenderJob> {
  return request<RenderJob>(endpoint(), { method: "POST", body: JSON.stringify({ plan, sourceUrl }) });
}

export async function getRenderJob(id: string): Promise<RenderJob> {
  return request<RenderJob>(`${endpoint().replace(/\/$/, "")}/${encodeURIComponent(id)}`, { method: "GET" });
}

export async function waitForRenderJob(id: string, options: { intervalMs?: number; timeoutMs?: number } = {}): Promise<RenderJob> {
  const interval = options.intervalMs ?? 1500;
  const deadline = Date.now() + (options.timeoutMs ?? 15 * 60_000);
  let last: RenderJob | null = null;
  while (Date.now() < deadline) {
    last = await getRenderJob(id);
    if (last.status === "completed" || last.status === "failed") return last;
    await new Promise((resolve) => window.setTimeout(resolve, interval));
  }
  throw new Error(`Render timeout${last ? ` · job ${last.id}` : ""}`);
}
