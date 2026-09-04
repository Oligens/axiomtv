import type { CameraMovement, ScriptSegment, ShotType, VisualPrompt } from './types';

export type ProductionEngine = 'cloud-video' | 'image' | 'ffmpeg' | 'audio' | 'upscale' | 'vfx';

export interface SemanticAnalysis {
  segmentId: number;
  entities: string[];
  actions: string[];
  environment: string[];
  emotions: string[];
  keywords: string[];
  intensity: number;
  sciFi: boolean;
}

export interface ContinuityState {
  characters: string[];
  environments: string[];
  motifs: string[];
  palette: string[];
}

export interface ProductionShot {
  segmentId: number;
  shotType: ShotType;
  cameraMovement: CameraMovement;
  duration: number;
  intensity: number;
  environment: string;
  continuity: ContinuityState;
  engines: ProductionEngine[];
  vfx: string[];
  prompt: VisualPrompt;
}

export interface ProductionPlan {
  version: 1;
  generatedAt: string;
  shots: ProductionShot[];
  globalStyle: {
    genre: 'sci-fi';
    visualLanguage: string;
    palette: string[];
  };
}

/**
 * Lightweight, deterministic orchestration layer.
 * It is deliberately dependency-free: the expensive generation is delegated to
 * the configured cloud/video engines while Node remains responsible for planning,
 * continuity, timing and FFmpeg execution.
 */
export class ProductionIntelligence {
  plan(script: ScriptSegment[]): ProductionPlan {
    const shots: ProductionShot[] = [];
    const continuity: ContinuityState = { characters: [], environments: [], motifs: [], palette: ['deep-blue', 'cyan', 'black'] };

    for (let index = 0; index < script.length; index += 1) {
      const segment = script[index];
      const analysis = analyzeSegment(segment);
      const previous = shots[index - 1];
      const shotType = segment.shotType ?? chooseShot(analysis, index);
      const cameraMovement = segment.cameraMovement ?? chooseCamera(analysis, index);
      const environment = segment.sceneDescription?.trim() || inferEnvironment(analysis);
      const motifs = unique([...continuity.motifs, ...inferMotifs(analysis)]);
      const vfx = unique([...(segment.vfxElements ?? []), ...inferVfx(analysis)]);

      continuity.characters = unique([...continuity.characters, segment.character].filter(Boolean));
      continuity.environments = unique([...continuity.environments, environment]);
      continuity.motifs = motifs;

      if (analysis.sciFi || vfx.length > 0) continuity.palette = ['deep-blue', 'cyan', 'violet', 'black'];

      const duration = segment.duration && segment.duration > 0 ? segment.duration : 3;
      const prompt: VisualPrompt = {
        segmentId: segment.id,
        description: environment,
        shotType,
        cameraMovement,
        lighting: inferLighting(segment, analysis),
        mood: segment.emotion,
        colorPalette: continuity.palette,
        vfxElements: vfx,
        aiPrompt: buildPrompt(segment, environment, shotType, cameraMovement, vfx, continuity, previous),
      };

      shots.push({
        segmentId: segment.id,
        shotType,
        cameraMovement,
        duration,
        intensity: analysis.intensity,
        environment,
        continuity: { ...continuity, characters: [...continuity.characters], environments: [...continuity.environments], motifs: [...continuity.motifs], palette: [...continuity.palette] },
        engines: selectEngines(segment, analysis, vfx),
        vfx,
        prompt,
      });
    }

    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      shots,
      globalStyle: {
        genre: 'sci-fi',
        visualLanguage: 'cinematic science-fiction, coherent characters, motivated camera, volumetric atmosphere',
        palette: continuity.palette,
      },
    };
  }
}

function analyzeSegment(segment: ScriptSegment): SemanticAnalysis {
  const text = normalize([segment.text, segment.sceneDescription ?? '', ...(segment.vfxElements ?? [])].join(' '));
  const sciFi = hasAny(text, ['space', 'galaxy', 'planet', 'starship', 'robot', 'android', 'cyber', 'hologram', 'laser', 'portal', 'alien', 'station', 'espace', 'galaxie', 'planete', 'vaisseau', 'robot', 'androide', 'cyber', 'hologramme', 'laser', 'portail', 'extraterrestre', 'station']);
  const danger = hasAny(text, ['attack', 'explosion', 'war', 'combat', 'chase', 'danger', 'panic', 'attaque', 'explosion', 'guerre', 'combat', 'poursuite', 'danger', 'panique']);
  const spectacle = hasAny(text, ['galaxy', 'planet', 'city', 'storm', 'space', 'galaxie', 'planete', 'ville', 'orage', 'espace']);
  return {
    segmentId: segment.id,
    entities: segment.character ? [segment.character] : [],
    actions: danger ? ['high-action'] : spectacle ? ['environment-reveal'] : ['dialogue-or-observation'],
    environment: inferEnvironmentTokens(text),
    emotions: [segment.emotion],
    keywords: text.split(/\\s+/).filter((x) => x.length > 3).slice(0, 24),
    intensity: clamp((danger ? 0.9 : spectacle ? 0.65 : 0.4) + (segment.emotion === 'angry' ? 0.1 : 0), 0.2, 1),
    sciFi,
  };
}

function chooseShot(a: SemanticAnalysis, index: number): ShotType {
  if (a.intensity > 0.82) return 'wide';
  if (a.actions.includes('environment-reveal')) return 'extreme-wide';
  if (a.emotions[0] === 'sad' || a.emotions[0] === 'fear') return 'close-up';
  return index % 3 === 0 ? 'medium' : 'wide';
}

function chooseCamera(a: SemanticAnalysis, index: number): CameraMovement {
  if (a.intensity > 0.82) return 'slow-push';
  if (a.actions.includes('environment-reveal')) return index % 2 ? 'pan-right' : 'pan-left';
  return 'static';
}

function inferEnvironment(a: SemanticAnalysis): string {
  if (a.environment.includes('space')) return 'deep-space environment with stars and subtle nebulae';
  if (a.environment.includes('urban')) return 'futuristic urban environment with controlled neon lighting';
  if (a.environment.includes('water')) return 'cinematic ocean environment with atmospheric haze';
  if (a.sciFi) return 'cinematic futuristic interior with believable technology';
  return 'cinematic grounded environment';
}

function inferEnvironmentTokens(text: string): string[] {
  const result: string[] = [];
  if (hasAny(text, ['space', 'galaxy', 'planet', 'star', 'espace', 'galaxie', 'planete', 'etoile'])) result.push('space');
  if (hasAny(text, ['city', 'street', 'ville', 'rue', 'cyberpunk'])) result.push('urban');
  if (hasAny(text, ['ocean', 'sea', 'water', 'mer', 'eau'])) result.push('water');
  return result;
}

function inferMotifs(a: SemanticAnalysis): string[] {
  return unique([
    ...(a.sciFi ? ['technology', 'cinematic-sci-fi'] : []),
    ...(a.environment.includes('space') ? ['cosmic'] : []),
    ...(a.environment.includes('urban') ? ['urban'] : []),
    ...(a.environment.includes('water') ? ['water'] : []),
  ]);
}

function inferVfx(a: SemanticAnalysis): string[] {
  const result: string[] = [];
  if (a.environment.includes('space')) result.push('starfield', 'lens-flare');
  if (a.sciFi) result.push('atmospheric-haze');
  if (hasAny(a.keywords.join(' '), ['hologram', 'hologramme'])) result.push('hologram', 'scanlines');
  if (hasAny(a.keywords.join(' '), ['laser'])) result.push('laser-light');
  if (hasAny(a.keywords.join(' '), ['explosion', 'explosion'])) result.push('embers', 'screen-shake');
  return unique(result);
}

function inferLighting(segment: ScriptSegment, a: SemanticAnalysis): string {
  if (a.sciFi) return 'motivated cyan-blue neon with volumetric rim light';
  if (segment.emotion === 'sad' || segment.emotion === 'angry') return 'low-key cinematic lighting';
  return 'natural cinematic key light with controlled contrast';
}

function selectEngines(segment: ScriptSegment, a: SemanticAnalysis, vfx: string[]): ProductionEngine[] {
  const engines: ProductionEngine[] = [];
  if (segment.backgroundImage || segment.sceneDescription || a.sciFi) engines.push('image');
  engines.push('cloud-video');
  if (vfx.length) engines.push('vfx');
  if (segment.backgroundMusic) engines.push('audio');
  return unique(engines);
}

function buildPrompt(segment: ScriptSegment, environment: string, shotType: ShotType, camera: CameraMovement, vfx: string[], continuity: ContinuityState, previous?: ProductionShot): string {
  const continuityHint = previous ? 'Maintain exact character identity, wardrobe, environment geometry and lighting continuity from the previous shot.' : 'Establish the visual identity of the scene clearly.';
  return [
    'Cinematic science-fiction production shot.',
    segment.character ? `Character: ${segment.character}.` : '',
    `Scene: ${environment}.`,
    `Shot: ${shotType}; camera: ${camera}.`,
    `Emotion: ${segment.emotion}.`,
    vfx.length ? `VFX: ${vfx.join(', ')}.` : '',
    `Continuity motifs: ${continuity.motifs.join(', ') || 'none'}.`,
    continuityHint,
    'High visual coherence, physically motivated lighting, controlled depth of field, cinematic composition, no accidental text or logos.',
    `Action/dialogue: ${segment.text}`,
  ].filter(Boolean).join(' ');
}

function normalize(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '');
}
function hasAny(text: string, terms: string[]): boolean { return terms.some((term) => text.includes(normalize(term))); }
function unique<T>(values: T[]): T[] { return [...new Set(values)]; }
function clamp(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, value)); }
