export type RenderEmotion = 'neutral' | 'happy' | 'angry' | 'sad' | 'surprised';
export type ShotType = 'extreme-wide' | 'wide' | 'medium' | 'close-up' | 'extreme-close-up';
export type CameraMovement = 'static' | 'slow-push' | 'slow-pull' | 'pan-left' | 'pan-right' | 'tilt-up' | 'tilt-down';

export interface ScriptSegment {
  id: number;
  text: string;
  character: string;
  emotion: RenderEmotion;
  duration?: number;
  backgroundImage?: string;
  backgroundMusic?: string;
  musicVolume?: number;
  sceneDescription?: string;
  shotType?: ShotType;
  cameraMovement?: CameraMovement;
  vfxElements?: string[];
  visualMotifs?: string[];
}

export interface Phoneme { start: number; end: number; value: string; }
export interface WordTiming { word: string; start: number; end: number; }
export interface ElevenLabsResponse { audio: Buffer; wordTimings: WordTiming[]; phonemes: Phoneme[]; }

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
  cinematic?: boolean;
  cinematicIntensity?: number;
  letterbox?: boolean;
  sourceVideo?: string;
}

export interface FrameData {
  index: number;
  timestamp: number;
  segment: ScriptSegment;
  phoneme: Phoneme | null;
  wordTiming?: WordTiming | null;
  shot?: {
    segmentId: number;
    shotType: ShotType;
    cameraMovement: CameraMovement;
    intensity: number;
    lighting: string;
    transition: 'cut' | 'fade' | 'dissolve';
    vfx: string[];
    pacing: 'slow' | 'normal' | 'fast';
    dramaticBeat: boolean;
    visualMotifs: string[];
  };
}

export interface VideoMetadata { duration: number; totalFrames: number; size: number; fps: number; width: number; height: number; }
export interface BackgroundCache { image: unknown; path: string; lastUsed: number; size: number; }

export interface CloudProcessOptions {
  service: 'replicate' | 'fal' | 'runway' | 'custom';
  apiKey: string;
  endpoint: string;
  model?: string;
  webhookUrl?: string;
}

export interface ProcessedVideoResult {
  outputPath: string;
  metadata: { duration: number; size: number; processingTime: number; resolution: string };
}

export interface VisualPrompt {
  segmentId: number;
  description: string;
  shotType: ShotType;
  cameraMovement: CameraMovement;
  lighting: string;
  mood: string;
  colorPalette: string[];
  vfxElements: string[];
  aiPrompt: string;
}
