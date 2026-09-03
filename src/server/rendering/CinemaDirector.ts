import type { ScriptSegment } from './types';

export type ShotType = 'extreme-wide' | 'wide' | 'medium' | 'close-up' | 'extreme-close-up';
export type CameraMovement = 'static' | 'slow-push' | 'slow-pull' | 'pan-left' | 'pan-right' | 'tilt-up' | 'tilt-down';

export interface ShotPlan {
  segmentId: number;
  shotType: ShotType;
  cameraMovement: CameraMovement;
  intensity: number;
  lighting: 'low-key' | 'neutral' | 'high-key' | 'neon';
  transition: 'cut' | 'fade' | 'dissolve';
  vfx: string[];
}

/** Deterministic director pass: turns script semantics into a usable shot plan. */
export class CinemaDirector {
  plan(script: ScriptSegment[]): ShotPlan[] {
    return script.map((segment, index) => {
      const text = segment.text.toLowerCase();
      const emotion = segment.emotion;
      const intense = /danger|attack|explosion|war|death|panic|urgent|dangerous|combat|fuite|attaque|explosion|guerre|mort|panique/.test(text);
      const intimate = /whisper|secret|memory|love|fear|remember|secret|souvenir|amour|peur/.test(text);
      const shotType: ShotType = intense ? 'wide' : intimate ? 'close-up' : index % 4 === 0 ? 'extreme-wide' : 'medium';
      const cameraMovement: CameraMovement = intense ? 'slow-push' : intimate ? 'slow-pull' : index % 2 ? 'pan-right' : 'pan-left';
      const lighting = /neon|city|cyber|technology|hologram|néon|ville/.test(text) ? 'neon' : emotion === 'sad' || emotion === 'angry' ? 'low-key' : 'neutral';
      return {
        segmentId: segment.id,
        shotType,
        cameraMovement,
        intensity: intense ? 0.9 : intimate ? 0.7 : 0.45,
        lighting,
        transition: index === 0 ? 'fade' : intense ? 'cut' : 'dissolve',
        vfx: inferVfx(text),
      };
    });
  }
}

function inferVfx(text: string): string[] {
  const vfx: string[] = [];
  if (/space|star|galaxy|nebula|espace|étoile|galaxie|nébuleuse/.test(text)) vfx.push('starfield', 'lens-flare');
  if (/rain|storm|pluie|orage/.test(text)) vfx.push('rain', 'atmospheric-haze');
  if (/fire|flame|explosion|feu|flamme|explosion/.test(text)) vfx.push('embers', 'screen-shake');
  if (/hologram|laser|neon|hologramme|laser|néon/.test(text)) vfx.push('scanlines', 'light-streaks');
  return vfx;
}
