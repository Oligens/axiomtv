import { spawn } from 'child_process';
import fs from 'fs-extra';
import path from 'path';

export interface CinematicProcessOptions { input: string; output: string; fps: number; format: 'mp4' | 'webm'; letterbox?: boolean; intensity?: number; }

export class CinematicProcessor {
  private running = false;

  async process(options: CinematicProcessOptions): Promise<void> {
    if (this.running) throw new Error('Cinematic processor already running');
    if (!(await fs.pathExists(options.input))) throw new Error(`Input video not found: ${options.input}`);
    await fs.ensureDir(path.dirname(options.output));
    this.running = true;
    const intensity = Math.max(0, Math.min(1, options.intensity ?? 0.6));
    const filters = [
      `eq=contrast=${(1 + intensity * 0.12).toFixed(3)}:saturation=${(1 + intensity * 0.08).toFixed(3)}:brightness=${(-0.015 * intensity).toFixed(3)}`,
      `vignette=PI/${(3.0 - intensity).toFixed(2)}`,
      ...(options.letterbox === false ? [] : ['drawbox=x=0:y=0:w=iw:h=0.055*ih:color=black:t=fill', 'drawbox=x=0:y=0.945*ih:w=iw:h=0.055*ih:color=black:t=fill']),
    ].join(',');
    const codec = options.format === 'webm' ? ['-c:v', 'libvpx-vp9', '-crf', '32', '-b:v', '0', '-c:a', 'libopus'] : ['-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k'];
    try { await this.run(['-y', '-i', options.input, '-vf', filters, '-r', String(options.fps), '-map', '0:v:0', '-map', '0:a?', ...codec, options.output]); }
    finally { this.running = false; }
  }

  private run(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(process.env.FFMPEG_PATH || 'ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
      let stderr = ''; child.stderr.on('data', (b) => { stderr += b.toString(); });
      child.on('error', reject); child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`FFmpeg cinematic pass failed: ${stderr.slice(-3000)}`)));
    });
  }
}
