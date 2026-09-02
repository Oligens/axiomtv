import fs from 'fs-extra';
import path from 'path';
import { AudioEngine } from './AudioEngine';
import { FrameGenerator } from './FrameGenerator';
import { VideoAssembler, type AudioMixOptions } from './VideoAssembler';
import { MemoryManager } from './MemoryManager';
import type { FrameData, Phoneme, RenderConfig, ScriptSegment, WordTiming } from './types';

export class SciFiRenderer {
  private readonly audioEngine: AudioEngine;
  private readonly frameGenerator: FrameGenerator;
  private readonly videoAssembler = new VideoAssembler();
  private readonly memoryManager = new MemoryManager();
  private isRendering = false;
  private cancelRequested = false;
  private renderProgress = 0;

  constructor(private readonly outputDir: string, private readonly config: RenderConfig, apiKey: string, voiceId: string) {
    this.audioEngine = new AudioEngine(outputDir, apiKey, voiceId);
    this.frameGenerator = new FrameGenerator(config.width, config.height);
  }

  async initialize(): Promise<void> {
    await Promise.all([
      fs.ensureDir(path.join(this.outputDir, 'frames')),
      fs.ensureDir(path.join(this.outputDir, 'audio')),
      fs.ensureDir(path.join(this.outputDir, 'logs')),
    ]);
  }

  async render(script: ScriptSegment[]): Promise<string> {
    if (this.isRendering) throw new Error('Render already in progress');
    if (!script.length) throw new Error('Cannot render an empty script');
    await this.initialize();
    this.isRendering = true; this.cancelRequested = false; this.renderProgress = 0;
    const startTime = Date.now();
    const framesDir = path.join(this.outputDir, 'frames');
    try {
      const text = script.map((s) => s.text.trim()).filter(Boolean).join(' ');
      if (!text) throw new Error('Script contains no renderable text');
      this.renderProgress = 10;
      const { audioPath, wordTimings, phonemes } = await this.audioEngine.generateAudioWithElevenLabs(text);
      const audioDuration = await this.audioEngine.getAudioDuration(audioPath);
      if (!(audioDuration > 0)) throw new Error('Generated audio has no measurable duration');
      this.renderProgress = 25;

      const totalFrames = Math.ceil(audioDuration * this.config.fps);
      const frameData = this.generateFrameData(script, phonemes, wordTimings, totalFrames, audioDuration);
      const batchSize = 50;
      for (let i = 0; i < frameData.length; i += batchSize) {
        if (this.cancelRequested) throw new Error('Render cancelled by user');
        const batch = frameData.slice(i, i + batchSize);
        for (const frame of batch) await this.frameGenerator.generateFrame(frame, framesDir);
        this.renderProgress = 25 + ((i + batch.length) / totalFrames) * 50;
        if (this.config.maxMemoryMB && process.memoryUsage().rss / 1024 / 1024 > this.config.maxMemoryMB) await this.memoryManager.cleanup();
      }

      const ext = this.config.outputFormat === 'webm' ? 'webm' : 'mp4';
      const outputPath = path.join(this.outputDir, `output_${Date.now()}.${ext}`);
      const audioOptions: AudioMixOptions = {
        backgroundMusic: this.config.backgroundMusic,
        musicVolume: this.config.musicVolume ?? 0.3,
        voiceVolume: 1,
        fadeIn: 0.5,
        fadeOut: 0.5,
      };
      await this.videoAssembler.assembleVideo(framesDir, audioPath, outputPath, this.config, audioOptions, { outputFormat: this.config.outputFormat });
      this.renderProgress = 95;
      const size = (await fs.stat(outputPath)).size;
      this.renderProgress = 100;
      console.log(`Sci-Fi render complete: ${outputPath} (${(size / 1024 / 1024).toFixed(2)} MB, ${(Date.now() - startTime) / 1000}s)`);
      return outputPath;
    } finally {
      await fs.remove(framesDir).catch(() => undefined);
      await this.videoAssembler.cleanup();
      await this.frameGenerator.cleanup();
      await this.memoryManager.cleanup();
      this.isRendering = false;
    }
  }

  private generateFrameData(script: ScriptSegment[], phonemes: Phoneme[], wordTimings: WordTiming[], totalFrames: number, audioDuration: number): FrameData[] {
    const result: FrameData[] = [];
    for (let i = 0; i < totalFrames; i++) {
      const timestamp = i / this.config.fps;
      let accumulated = 0; let segment = script[script.length - 1];
      for (const candidate of script) {
        const duration = candidate.duration ?? audioDuration / script.length;
        if (timestamp < accumulated + duration) { segment = candidate; break; }
        accumulated += duration;
      }
      result.push({ index: i, timestamp, segment, phoneme: findTiming(phonemes, timestamp), wordTiming: findTiming(wordTimings, timestamp) });
    }
    return result;
  }

  async cancel(): Promise<void> { if (this.isRendering) { this.cancelRequested = true; this.videoAssembler.cancel(); await this.cleanup(); } }
  getProgress(): number { return this.renderProgress; }
  isRenderingVideo(): boolean { return this.isRendering; }
  private async cleanup(): Promise<void> { await fs.remove(path.join(this.outputDir, 'frames')).catch(() => undefined); await this.videoAssembler.cleanup(); await this.memoryManager.cleanup(); }
}

function findTiming<T extends { start: number; end: number }>(items: T[], timestamp: number): T | null {
  // Timings are normally ordered; binary search avoids O(frames × timings).
  let low = 0; let high = items.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1; const item = items[mid];
    if (timestamp < item.start) high = mid - 1;
    else if (timestamp >= item.end) low = mid + 1;
    else return item;
  }
  return null;
}
