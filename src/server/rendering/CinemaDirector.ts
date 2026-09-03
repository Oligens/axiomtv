import type { ScriptSegment, ShotType, CameraMovement } from './types';

export interface ShotPlan {
  segmentId: number;
  shotType: ShotType;
  cameraMovement: CameraMovement;
  intensity: number;
  lighting: 'low-key' | 'neutral' | 'high-key' | 'neon';
  transition: 'cut' | 'fade' | 'dissolve';
  vfx: string[];
  pacing: 'slow' | 'normal' | 'fast';
  dramaticBeat: boolean;
  visualMotifs: string[];
}

/**
 * Deterministic creative-director pass.
 * Converts screenplay semantics into reproducible cinematography decisions while
 * preserving explicit choices supplied by the creator.
 */
export class CinemaDirector {
  plan(script: ScriptSegment[]): ShotPlan[] {
    return script.map((segment, index) => {
      const text = normalize(segment.text);
      const previous = index > 0 ? normalize(script[index - 1].text) : '';
      const intense = hasAny(text, ['danger', 'attack', 'explosion', 'war', 'death', 'panic', 'urgent', 'combat', 'dangerous', 'fuite', 'attaque', 'explosion', 'guerre', 'mort', 'panique', 'urgence', 'combat']);
      const intimate = hasAny(text, ['whisper', 'secret', 'memory', 'love', 'fear', 'remember', 'souvenir', 'amour', 'peur', 'silence', 'murmure']);
      const spectacle = hasAny(text, ['galaxy', 'space', 'planet', 'city', 'ocean', 'storm', 'espace', 'galaxie', 'planete', 'ville', 'océan', 'orage']);
      const technology = hasAny(text, ['neon', 'cyber', 'technology', 'hologram', 'laser', 'robot', 'néon', 'technologie', 'hologramme', 'laser', 'robot']);
      const dialogue = Boolean(segment.character && segment.character.toLowerCase() !== 'narrator');

      const shotType: ShotType = segment.shotType ?? (
        intense ? 'wide' : intimate || dialogue ? 'close-up' : spectacle ? 'extreme-wide' : index % 4 === 0 ? 'wide' : 'medium'
      );
      const cameraMovement: CameraMovement = segment.cameraMovement ?? (
        intense ? 'slow-push' : intimate ? 'slow-pull' : spectacle ? (index % 2 ? 'pan-right' : 'pan-left') : 'static'
      );

      const intensity = clamp(
        (intense ? 0.9 : intimate ? 0.68 : spectacle ? 0.58 : 0.42) +
        (segment.emotion === 'angry' ? 0.08 : segment.emotion === 'sad' ? 0.03 : 0),
        0.2,
        1,
      );
      const pacing: ShotPlan['pacing'] = intense ? 'fast' : intimate ? 'slow' : 'normal';
      const dramaticBeat = intense || segment.emotion === 'surprised' || hasAny(text, ['but', 'however', 'yet', 'mais', 'pourtant', 'soudain', 'suddenly']);
      const lighting: ShotPlan['lighting'] = technology ? 'neon' : segment.emotion === 'sad' || segment.emotion === 'angry' ? 'low-key' : segment.emotion === 'happy' ? 'high-key' : 'neutral';
      const transition: ShotPlan['transition'] = index === 0 ? 'fade' : dramaticBeat ? 'cut' : 'dissolve';
      const vfx = unique([...inferVfx(text), ...(segment.vfxElements ?? [])]);

      // Reuse a visual motif when consecutive scenes share a subject/theme.
      const visualMotifs = inferMotifs(text);
      if (previous && visualMotifs.some((motif) => previous.includes(motif))) visualMotifs.push('continuity-match');

      return { segmentId: segment.id, shotType, cameraMovement, intensity, lighting, transition, vfx, pacing, dramaticBeat, visualMotifs };
    });
  }
}

function normalize(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function hasAny(text: string, terms: string[]): boolean { return terms.some((term) => text.includes(normalize(term))); }

function inferVfx(text: string): string[] {
  const vfx: string[] = [];
  if (hasAny(text, ['space', 'star', 'galaxy', 'nebula', 'espace', 'etoile', 'galaxie', 'nebuleuse'])) vfx.push('starfield', 'lens-flare');
  if (hasAny(text, ['rain', 'storm', 'pluie', 'orage', 'fog', 'brouillard'])) vfx.push('rain', 'atmospheric-haze');
  if (hasAny(text, ['fire', 'flame', 'explosion', 'feu', 'flamme', 'explosion'])) vfx.push('embers', 'screen-shake');
  if (hasAny(text, ['hologram', 'laser', 'neon', 'hologramme', 'néon'])) vfx.push('scanlines', 'light-streaks');
  if (hasAny(text, ['magic', 'energy', 'portal', 'magie', 'energie', 'portail'])) vfx.push('light-streaks', 'atmospheric-haze');
  return vfx;
}

function inferMotifs(text: string): string[] {
  const motifs: string[] = [];
  if (hasAny(text, ['space', 'galaxy', 'star', 'espace', 'galaxie', 'etoile'])) motifs.push('cosmic');
  if (hasAny(text, ['city', 'street', 'ville', 'rue'])) motifs.push('urban');
  if (hasAny(text, ['ocean', 'sea', 'water', 'océan', 'mer', 'eau'])) motifs.push('water');
  if (hasAny(text, ['technology', 'robot', 'hologram', 'technologie', 'robot', 'hologramme'])) motifs.push('technology');
  return motifs;
}

function unique(values: string[]): string[] { return [...new Set(values)]; }
function clamp(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, value)); }
