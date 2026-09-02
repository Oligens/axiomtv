/**
 * AGWÈSTREAM — Chef d'orchestre Sci‑Fi.
 *
 * Ce module ne prétend pas encoder une vidéo côté navigateur. Il transforme le
 * scénario en contrat de rendu déterministe consommable par un vrai worker/GPU:
 * upscale, stabilisation caméra, remplacement d'environnement et VFX.
 */

export type ScifiEnvironment = "earth" | "space_station" | "cyberpunk" | "alien_world" | "orbital_city";
export type CameraTreatment = "none" | "stabilize" | "cinematic_smooth" | "handheld_controlled";
export type UpscaleMode = "native" | "2x" | "4x";

export interface ScifiRenderPlan {
  version: 1;
  intent: "scifi";
  environment: ScifiEnvironment;
  environmentPrompt: string;
  upscale: UpscaleMode;
  camera: { treatment: CameraTreatment; strength: number };
  vfx: string[];
  continuity: { preserveIdentity: boolean; preserveWardrobe: boolean; preserveVoice: boolean };
  source: { lineCount: number; hash: string };
}

const ENV_RE: Array<[RegExp, ScifiEnvironment]> = [
  [/station spatiale|station orbitale|vaisseau|pont du vaisseau|orbite/i, "space_station"],
  [/cyberpunk|ville futuriste|néon|megapole|m[eé]gapole/i, "cyberpunk"],
  [/plan[eè]te|monde extraterrestre|alien|lune lointaine/i, "alien_world"],
  [/cit[eé] orbitale|orbital city|colonie orbitale/i, "orbital_city"],
];

const VFX_RE: Array<[RegExp, string]> = [
  [/hologramme|holographique/i, "hologram"],
  [/laser|rayon laser/i, "laser_glow"],
  [/distorsion spatiale|faille|warp/i, "space_distortion"],
  [/portail|wormhole|trou de ver/i, "portal"],
  [/drone|robot|andro[iï]de/i, "robotic_elements"],
  [/plasma|bouclier|shield/i, "energy_field"],
  [/poussi[eè]re stellaire|cosmique|nebuleuse|n[eé]buleuse/i, "cosmic_particles"],
  [/gravité z[eé]ro|apesanteur/i, "zero_g"],
];

const UPSCALE_RE: Array<[RegExp, UpscaleMode]> = [
  [/4k|uhd|tr[eè]s haute qualit[eé]|ultra haute qualit[eé]/i, "4x"],
  [/2k|haute qualit[eé]|am[eé]lior[eé]e|enhance|upscal/i, "2x"],
];

const CAMERA_RE: Array<[RegExp, CameraTreatment]> = [
  [/stabilis|corrig[eé]e?|sans tremblement|anti.?shake/i, "stabilize"],
  [/cin[eé]matique|cin[eé]ma|smooth|fluide|travelling propre/i, "cinematic_smooth"],
  [/cam[eé]ra [aà] l'[eé]paule|handheld contr[oô]l[eé]/i, "handheld_controlled"],
];

const ENV_PROMPTS: Record<ScifiEnvironment, string> = {
  earth: "conserver le décor terrestre source, photoréaliste, continuité stricte",
  space_station: "transformer le décor en station spatiale crédible, métal, verre, systèmes lumineux, perspective physique cohérente",
  cyberpunk: "transformer le décor en mégapole cyberpunk, architecture futuriste, pluie, néons, profondeur atmosphérique",
  alien_world: "transformer le décor en monde extraterrestre cinématographique, terrain crédible, atmosphère et éclairage cohérents",
  orbital_city: "transformer le décor en cité orbitale monumentale, structures en anneau, trafic spatial et horizon planétaire",
};

function stableHash(value: string): string {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function buildScifiRenderPlan(lines: string[]): ScifiRenderPlan {
  const raw = lines.join(" ");
  const environment = ENV_RE.find(([re]) => re.test(raw))?.[1] ?? "earth";
  const vfx = [...new Set(VFX_RE.filter(([re]) => re.test(raw)).map(([, id]) => id))];
  const upscale = UPSCALE_RE.find(([re]) => re.test(raw))?.[1] ?? "native";
  const treatment = CAMERA_RE.find(([re]) => re.test(raw))?.[1] ?? (/(secousse|tremble|shake)/i.test(raw) ? "stabilize" : "none");
  const explicitStrength = raw.match(/stabilisation\s*(?:à|a|de)?\s*(\d{1,3})\s*%/i);
  const strength = explicitStrength ? Math.max(0, Math.min(1, Number(explicitStrength[1]) / 100)) : treatment === "stabilize" ? 0.72 : treatment === "cinematic_smooth" ? 0.58 : 0;

  return {
    version: 1,
    intent: "scifi",
    environment,
    environmentPrompt: ENV_PROMPTS[environment],
    upscale,
    camera: { treatment, strength },
    vfx,
    continuity: { preserveIdentity: true, preserveWardrobe: true, preserveVoice: true },
    source: { lineCount: lines.length, hash: stableHash(raw) },
  };
}

export function buildScifiCommandText(plan: ScifiRenderPlan): string {
  return [
    `SCI-FI ENVIRONMENT: ${plan.environment}`,
    `ENVIRONMENT: ${plan.environmentPrompt}`,
    `UPSCALE: ${plan.upscale}`,
    `CAMERA: ${plan.camera.treatment} (${Math.round(plan.camera.strength * 100)}%)`,
    `VFX: ${plan.vfx.length ? plan.vfx.join(", ") : "none"}`,
    "CONTINUITY: identity=preserve wardrobe=preserve voice=preserve",
  ].join("\n");
}
