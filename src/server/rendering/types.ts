export type RenderEmotion = 'neutral' | 'happy' | 'angry' | 'sad' | 'surprised';

export interface ScriptSegment {
  id: number;
  text: string;
  character: string;
  emotion: RenderEmotion;
  duration?: number;
  backgroundImage?: string;
  backgroundMusic?: string;
  musicVolume?: number;
}

export interface Phoneme {
  start: number;
  end: number;
  value: string;
}

export interface WordTiming {
  word: string;
  start: number;
  end: number;
}

export interface ElevenLabsResponse {
  audio: Buffer;
  wordTimings: WordTiming[];
  phonemes: Phoneme[];
}

export interface RenderConfig {
  width: number;
  height: number;
  fps: number;
  quality: 'low' | 'medium' | 'high';
  outputFormat: 'mp4' | 'webm';
  backgroundMusic?: string;
  musicVolume?: number;
  maxMemoryMB?: number;
  gcInterval?: number;
}

export interface FrameData {
  index: number;
  timestamp: number;
  segment: ScriptSegment;
  phoneme: Phoneme | null;
  wordTiming?: WordTiming | null;
}

export interface VideoMetadata {
  duration: number;
  totalFrames: number;
  size: number;
  fps: number;
  width: number;
  height: number;
}
