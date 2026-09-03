import { spawn } from 'child_process';
import fs from 'fs-extra';

export interface SourceVideoAnalysis { width: number; height: number; fps: number; duration: number; hasAudio: boolean; }

/** Lightweight camera/media analysis using ffprobe; no Python/OpenCV dependency. */
export class VideoAnalyzer {
  constructor(private readonly ffprobe = process.env.FFPROBE_PATH || 'ffprobe') {}

  async analyze(sourcePath: string): Promise<SourceVideoAnalysis> {
    if (!(await fs.pathExists(sourcePath))) throw new Error(`Source video not found: ${sourcePath}`);
    const raw = await this.run(['-v', 'error', '-show_streams', '-show_format', '-of', 'json', sourcePath]);
    const data = JSON.parse(raw) as { streams?: Array<Record<string, string>>; format?: Record<string, string> };
    const video = data.streams?.find((s) => s.codec_type === 'video');
    if (!video) throw new Error('No video stream found in source media');
    const [num, den] = String(video.r_frame_rate || '24/1').split('/').map(Number);
    return { width: Number(video.width || 0), height: Number(video.height || 0), fps: den ? num / den : 24, duration: Number(video.duration || data.format?.duration || 0), hasAudio: Boolean(data.streams?.some((s) => s.codec_type === 'audio')) };
  }

  private run(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.ffprobe, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = ''; let stderr = '';
      child.stdout.on('data', (b) => { stdout += b.toString(); }); child.stderr.on('data', (b) => { stderr += b.toString(); });
      child.on('error', (e) => reject(e)); child.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error(`ffprobe failed: ${stderr}`)));
    });
  }
}
