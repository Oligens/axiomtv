import fs from 'fs-extra';
import os from 'os';

export interface MemorySnapshot {
  rssMB: number;
  heapUsedMB: number;
  heapTotalMB: number;
  externalMB: number;
  arrayBuffersMB: number;
  systemFreeMB: number;
  systemTotalMB: number;
}

/** Render-safe memory manager. Uses RSS because Sharp/FFmpeg use native memory outside V8 heap. */
export class MemoryManager {
  private readonly maxMemoryMB: number;
  private readonly cleanupIntervalMs: number;
  private readonly tempFiles = new Set<string>();
  private cleanupTimer: NodeJS.Timeout | null = null;
  private cleanupRunning = false;

  constructor(maxMemoryMB = 3800, cleanupIntervalMs = 5000) {
    this.maxMemoryMB = Math.max(256, maxMemoryMB);
    this.cleanupIntervalMs = Math.max(1000, cleanupIntervalMs);
    this.start();
  }

  private start(): void {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => void this.maintenance(), this.cleanupIntervalMs);
    this.cleanupTimer.unref?.();
  }

  registerTempFile(filepath: string): void { if (filepath) this.tempFiles.add(filepath); }
  unregisterTempFile(filepath: string): void { this.tempFiles.delete(filepath); }

  snapshot(): MemorySnapshot {
    const usage = process.memoryUsage();
    const total = os.totalmem();
    const free = os.freemem();
    return {
      rssMB: Math.round(usage.rss / 1024 / 1024),
      heapUsedMB: Math.round(usage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(usage.heapTotal / 1024 / 1024),
      externalMB: Math.round(usage.external / 1024 / 1024),
      arrayBuffersMB: Math.round(usage.arrayBuffers / 1024 / 1024),
      systemFreeMB: Math.round(free / 1024 / 1024),
      systemTotalMB: Math.round(total / 1024 / 1024),
    };
  }

  async checkMemory(): Promise<number> {
    const rssMB = this.snapshot().rssMB;
    if (rssMB >= this.maxMemoryMB) await this.maintenance();
    return rssMB;
  }

  getSystemMemory(): { total: number; free: number; used: number } {
    const total = os.totalmem();
    const free = os.freemem();
    return { total: Math.round(total / 1024 / 1024), free: Math.round(free / 1024 / 1024), used: Math.round((total - free) / 1024 / 1024) };
  }

  private async maintenance(): Promise<void> {
    if (this.cleanupRunning) return;
    this.cleanupRunning = true;
    try {
      if (this.snapshot().rssMB < this.maxMemoryMB * 0.85) return;
      await this.cleanTempFiles();
      this.tryForceGC();
    } finally { this.cleanupRunning = false; }
  }

  async cleanTempFiles(): Promise<void> {
    for (const file of [...this.tempFiles]) {
      try {
        if (await fs.pathExists(file)) await fs.remove(file);
        this.tempFiles.delete(file);
      } catch { /* keep locked files registered for the next pass */ }
    }
  }

  private tryForceGC(): void {
    const gc = (globalThis as typeof globalThis & { gc?: () => void }).gc;
    if (typeof gc === 'function') gc();
  }

  async cleanup(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    await this.cleanTempFiles();
    this.tryForceGC();
  }
}
