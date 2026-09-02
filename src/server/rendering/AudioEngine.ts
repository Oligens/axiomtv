import fs from 'fs-extra';
import path from 'path';
import { spawn } from 'child_process';
import type { ElevenLabsResponse, Phoneme, WordTiming } from './types';

export class AudioEngine {
  constructor(
    private readonly outputDir: string,
    private readonly apiKey: string,
    private readonly voiceId: string,
  ) {}

  async generateAudioWithElevenLabs(text: string): Promise<{
    audioPath: string;
    metadataPath: string;
    wordTimings: WordTiming[];
    phonemes: Phoneme[];
  }> {
    if (!this.apiKey) throw new Error('ELEVENLABS_API_KEY is required for server rendering');
    if (!this.voiceId) throw new Error('ELEVENLABS_VOICE_ID is required for server rendering');

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(this.voiceId)}/with-timestamps`, {
      method: 'POST',
      headers: { 'xi-api-key': this.apiKey, 'content-type': 'application/json' },
      body: JSON.stringify({ text, model_id: process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2' }),
    });
    if (!response.ok) throw new Error(`ElevenLabs request failed (${response.status}): ${await response.text()}`);

    const payload = await response.json() as {
      audio_base64?: string;
      alignment?: { characters?: string[]; character_start_times_seconds?: number[]; character_end_times_seconds?: number[] };
    };
    if (!payload.audio_base64) throw new Error('ElevenLabs returned no audio data');

    const audioPath = path.join(this.outputDir, 'audio', `voice_${Date.now()}.mp3`);
    const metadataPath = audioPath.replace(/\.mp3$/i, '.json');
    await fs.ensureDir(path.dirname(audioPath));
    const audio = Buffer.from(payload.audio_base64, 'base64');
    await fs.writeFile(audioPath, audio);

    const alignment = payload.alignment;
    const wordTimings = buildWordTimings(alignment);
    const phonemes = buildCharacterTimings(alignment);
    const metadata = { wordTimings, phonemes, generatedAt: new Date().toISOString() };
    await fs.writeJson(metadataPath, metadata, { spaces: 2 });
    return { audioPath, metadataPath, wordTimings, phonemes } satisfies ElevenLabsResponse & { audioPath: string; metadataPath: string } as never;
  }

  async getAudioDuration(audioPath: string): Promise<number> {
    return runProbe(audioPath);
  }
}

function buildCharacterTimings(alignment?: { characters?: string[]; character_start_times_seconds?: number[]; character_end_times_seconds?: number[] }): Phoneme[] {
  const chars = alignment?.characters ?? [];
  const starts = alignment?.character_start_times_seconds ?? [];
  const ends = alignment?.character_end_times_seconds ?? [];
  return chars.map((value, i) => ({ start: starts[i] ?? 0, end: ends[i] ?? starts[i] ?? 0, value })).filter((p) => p.end > p.start);
}

function buildWordTimings(alignment?: { characters?: string[]; character_start_times_seconds?: number[]; character_end_times_seconds?: number[] }): WordTiming[] {
  const chars = alignment?.characters ?? [];
  const starts = alignment?.character_start_times_seconds ?? [];
  const ends = alignment?.character_end_times_seconds ?? [];
  const result: WordTiming[] = [];
  let word = '';
  let start = 0;
  let end = 0;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (!word && /\S/.test(ch)) start = starts[i] ?? 0;
    if (/\s/.test(ch)) {
      if (word) result.push({ word, start, end });
      word = '';
      continue;
    }
    word += ch;
    end = ends[i] ?? end;
  }
  if (word) result.push({ word, start, end });
  return result;
}

function runProbe(file: string): Promise<number> {
  const binary = process.env.FFPROBE_PATH || 'ffprobe';
  return new Promise((resolve, reject) => {
    const child = spawn(binary, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', file]);
    let out = '';
    let err = '';
    child.stdout.on('data', (d: Buffer) => { out += d.toString(); });
    child.stderr.on('data', (d: Buffer) => { err += d.toString(); });
    child.on('error', (e) => reject(new Error(`ffprobe unavailable: ${e.message}`)));
    child.on('close', (code) => code === 0 ? resolve(Number.parseFloat(out.trim()) || 0) : reject(new Error(`ffprobe failed (${code}): ${err}`)));
  });
}
