export class MemoryManager {
  async cleanup(): Promise<void> {
    // Do not force GC: Node may not expose it and it can stall rendering.
    // Clearing references is left to the renderer/FFmpeg lifecycle.
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}
