import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import type { RenderConfig } from './types';

export interface AudioMixOptions {
  backgroundMusic?: string;
  musicVolume?: number;
  voiceVolume?: number;
  fadeIn?: number;
  fadeOut?: number;
}

export interface VideoAssemblerOptions {
  outputFormat?: 'mp4' | 'webm';
  videoCodec?: string;
  audioCodec?: string;
  videoBitrate?: string;
  audioBitrate?: string;
  crf?: number;
  preset?: string;
  threads?: number;
  pixelFormat?: string;
  fastStart?: boolean;
}

export class VideoAssembler {
  private ffmpegProcess: ChildProcessWithoutNullStreams | null = null;
  private isAssembling = false;

  async assembleVideo(framesDir: string, voiceAudioPath: string, outputPath: string, config: RenderConfig, audioOptions: AudioMixOptions = {}, videoOptions: VideoAssemblerOptions = {}): Promise<void> {
    if (this.isAssembling) throw new Error('Video assembly already in progress');
    await this.validateInputs(framesDir, voiceAudioPath, outputPath);
    const music = audioOptions.backgroundMusic && await fs.pathExists(audioOptions.backgroundMusic) ? audioOptions.backgroundMusic : undefined;
    this.isAssembling = true;
    try {
      const args = this.buildArgs(framesDir, voiceAudioPath, music, outputPath, config, audioOptions, videoOptions);
      await this.runFFmpeg(args);
    } finally {
      this.isAssembling = false;
      this.ffmpegProcess = null;
    }
  }

  private async validateInputs(framesDir: string, voiceAudioPath: string, outputPath: string): Promise<void> {
    if (!await fs.pathExists(framesDir)) throw new Error(`Frames directory does not exist: ${framesDir}`);
    const frames = (await fs.readdir(framesDir)).filter((f) => /^frame_\d+\.png$/i.test(f));
    if (!frames.length) throw new Error(`No PNG frames found in: ${framesDir}`);
    if (!await fs.pathExists(voiceAudioPath)) throw new Error(`Voice audio file does not exist: ${voiceAudioPath}`);
    await fs.ensureDir(path.dirname(outputPath));
  }

  private buildArgs(framesDir: string, voice: string, music: string | undefined, output: string, config: RenderConfig, audio: AudioMixOptions, video: VideoAssemblerOptions): string[] {
    const args = ['-hide_banner', '-loglevel', 'warning', '-y', '-framerate', String(config.fps), '-i', path.join(framesDir, 'frame_%07d.png'), '-i', voice];
    if (music) args.push('-i', music);

    if (music) {
      const voiceVolume = audio.voiceVolume ?? 1;
      const musicVolume = audio.musicVolume ?? 0.3;
      const fadeIn = Math.max(0, audio.fadeIn ?? 0.5);
      const fadeOut = Math.max(0, audio.fadeOut ?? 0.5);
      args.push('-filter_complex', `[1:a]volume=${voiceVolume},afade=t=in:st=0:d=${fadeIn},afade=t=out:st=0:d=${fadeOut}[voice];[2:a]volume=${musicVolume},afade=t=in:st=0:d=${fadeIn},afade=t=out:st=0:d=${fadeOut}[music];[voice][music]amix=inputs=2:duration=longest:dropout_transition=2[aout]`, '-map', '0:v:0', '-map', '[aout]');
    } else {
      args.push('-map', '0:v:0', '-map', '1:a:0');
    }

    const format = video.outputFormat ?? config.outputFormat ?? 'mp4';
    args.push('-c:v', format === 'webm' ? 'libvpx-vp9' : (video.videoCodec ?? 'libx264'));
    if (format !== 'webm') args.push('-preset', video.preset ?? 'veryfast', '-crf', String(video.crf ?? 23), '-pix_fmt', video.pixelFormat ?? 'yuv420p');
    else args.push('-crf', String(video.crf ?? 30), '-b:v', '0');
    if (video.videoBitrate) args.push('-b:v', video.videoBitrate);
    args.push('-c:a', format === 'webm' ? 'libopus' : (video.audioCodec ?? 'aac'), '-b:a', video.audioBitrate ?? (music ? '192k' : '128k'));
    if (video.threads) args.push('-threads', String(video.threads));
    if (format === 'mp4' && video.fastStart !== false) args.push('-movflags', '+faststart');
    args.push('-shortest', output);
    return args;
  }

  private runFFmpeg(args: string[]): Promise<void> {
    const binary = process.env.FFMPEG_PATH || 'ffmpeg';
    return new Promise((resolve, reject) => {
      const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      this.ffmpegProcess = child;
      let stderr = '';
      child.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });
      child.on('error', (error) => reject(new Error(`FFmpeg unavailable: ${error.message}`)));
      child.on('close', (code, signal) => {
        if (code === 0) return resolve();
        reject(new Error(`FFmpeg failed (code=${code}, signal=${signal}): ${stderr.slice(-4000)}`));
      });
    });
  }

  async getVideoInfo(videoPath: string): Promise<unknown> {
    const binary = process.env.FFPROBE_PATH || 'ffprobe';
    return new Promise((resolve, reject) => {
      const child = spawn(binary, ['-v', 'error', '-show_entries', 'format=duration,size,bit_rate', '-show_entries', 'stream=width,height,codec_name,bit_rate,avg_frame_rate', '-of', 'json', videoPath]);
      let output = ''; let error = '';
      child.stdout.on('data', (d: Buffer) => { output += d.toString(); });
      child.stderr.on('data', (d: Buffer) => { error += d.toString(); });
      child.on('error', (e) => reject(new Error(`ffprobe unavailable: ${e.message}`)));
      child.on('close', (code) => code === 0 ? resolve(JSON.parse(output)) : reject(new Error(`ffprobe failed (${code}): ${error}`)));
    });
  }

  async getVideoDuration(videoPath: string): Promise<number> {
    const info = await this.getVideoInfo(videoPath) as { format?: { duration?: string } };
    return Number.parseFloat(info.format?.duration ?? '0') || 0;
  }

  async getVideoSize(videoPath: string): Promise<number> {
    const info = await this.getVideoInfo(videoPath) as { format?: { size?: string } };
    return Number.parseInt(info.format?.size ?? '0', 10) || 0;
  }

  async extractAudio(videoPath: string, outputPath: string): Promise<void> {
    await this.runUtilityFFmpeg(['-hide_banner', '-loglevel', 'error', '-y', '-i', videoPath, '-vn', '-c:a', 'copy', outputPath]);
  }

  async concatenateVideos(videoPaths: string[], outputPath: string): Promise<void> {
    if (!videoPaths.length) throw new Error('No videos to concatenate');
    await fs.ensureDir(path.dirname(outputPath));
    const listFile = path.join(path.dirname(outputPath), `.concat_${Date.now()}.txt`);
    await fs.writeFile(listFile, videoPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'));
    try { await this.runUtilityFFmpeg(['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', outputPath]); }
    finally { await fs.remove(listFile); }
  }

  async addWatermark(inputPath: string, watermarkPath: string, outputPath: string): Promise<void> {
    await this.runUtilityFFmpeg(['-hide_banner', '-loglevel', 'error', '-y', '-i', inputPath, '-i', watermarkPath, '-filter_complex', '[1:v]scale=200:200[wm];[0:v][wm]overlay=W-w-20:H-h-20', '-c:a', 'copy', outputPath]);
  }

  private runUtilityFFmpeg(args: string[]): Promise<void> {
    const binary = process.env.FFMPEG_PATH || 'ffmpeg';
    return new Promise((resolve, reject) => {
      const child = spawn(binary, args, { stdio: ['ignore', 'ignore', 'pipe'] });
      let error = ''; child.stderr.on('data', (d: Buffer) => { error += d.toString(); });
      child.on('error', (e) => reject(new Error(`FFmpeg unavailable: ${e.message}`)));
      child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`FFmpeg failed (${code}): ${error.slice(-4000)}`)));
    });
  }

  cancel(): void { if (this.ffmpegProcess && !this.ffmpegProcess.killed) this.ffmpegProcess.kill('SIGINT'); }
  async cleanup(): Promise<void> { this.cancel(); await new Promise((r) => setImmediate(r)); }
}
