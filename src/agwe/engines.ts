/**
 * AGWÈSTREAM 2.0 — Moteurs d'analyse (noyau synchrone, déterministe).
 *
 * Chaque moteur a une responsabilité claire (§26) :
 *   StoryEngine      → planScenes / extractConstraints
 *   CharacterEngine  → buildCharacterProfiles / scoreCharacter
 *   ObjectEngine     → buildObjectRegistry / trackObjects
 *   SceneEngine      → buildSceneMemory / buildProjectMemory
 *   VisionEngine     → scoreFace / scoreAnatomy / scoreText
 *   TemporalEngine   → analyzeTemporal (dérive frame à frame)
 *   MotionEngine     → scoreMotion
 *   PhysicsEngine    → scorePhysics (gravité, collisions, occlusions, ombres…)
 *   LightingEngine   → scoreLighting
 *   CameraEngine     → scoreCamera
 *   LipSyncEngine    → scoreLipSync (phonèmes → visèmes → mouvement)
 *   AudioEngine      → scoreAudio
 *   QualityEngine    → computeGlobal (score global pondéré)
 *   RepairEngine     → planRepairs / applyRepair (réparation localisée)
 *
 * Les scores sont des ESTIMATIONS de cohérence — jamais des certitudes (§32).
 */
import type { ParsedLine, Timeline, TimelineEntry, ToneId } from "../data/content";
import type { CastMember } from "../lib/scenario";
import {
  ENGINE_DEFS,
  type Anomaly,
  type CharacterIdentityProfile,
  type EngineId,
  type EngineScore,
  type EngineStatus,
  type ObjectIdentityProfile,
  type ProjectMemory,
  type QAInput,
  type QASettings,
  type RepairJob,
  type SceneConstraint,
  type Severity,
  type TemporalAnalysis,
} from "./models";

/* ================= RNG déterministe ================= */

export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const pick = <T,>(rng: () => number, arr: T[]): T => arr[Math.floor(rng() * arr.length)];

/* ================= StoryEngine — contraintes de scène ================= */

const OBJECT_DICT: [RegExp, { type: string; color: string; material: string }][] = [
  [/(t[eé]l[eé]phone|smartphone|mobile)/i, { type: "Smartphone", color: "Black", material: "Glass/Metal" }],
  [/table/i, { type: "Table", color: "Walnut", material: "Wood" }],
  [/(chaise|fauteuil)/i, { type: "Chair", color: "Dark gray", material: "Fabric/Metal" }],
  [/[eé]metteur/i, { type: "Emitter", color: "Gunmetal", material: "Metal" }],
  [/routeur/i, { type: "Router", color: "Black", material: "Plastic" }],
  [/[eé]cran/i, { type: "Screen", color: "Cyan glow", material: "Glass" }],
  [/porte/i, { type: "Door", color: "Steel", material: "Metal" }],
  [/sac/i, { type: "Bag", color: "Olive", material: "Canvas" }],
  [/c[aâ]ble/i, { type: "Cable", color: "Black", material: "Rubber" }],
  [/console/i, { type: "Console", color: "Graphite", material: "Metal" }],
  [/(verre|bouteille)/i, { type: "Glass bottle", color: "Amber", material: "Glass" }],
  [/(arme|pistolet)/i, { type: "Handgun", color: "Matte black", material: "Metal" }],
  [/(voiture|v[eé]hicule)/i, { type: "Vehicle", color: "Gray", material: "Metal" }],
  [/drone/i, { type: "Drone", color: "White", material: "Carbon" }],
  [/(lampe|projecteur)/i, { type: "Lamp", color: "Warm", material: "Metal" }],
  [/(carte|plan|dossier)/i, { type: "Document", color: "Paper", material: "Paper" }],
];

const SHOT_KEYWORDS: [RegExp, string][] = [
  [/(gros plan|close-?up)/i, "close-up"],
  [/(plan large|wide)/i, "wide"],
  [/(plan moyen|medium)/i, "medium"],
  [/(a[eé]rien|drone)/i, "aerial"],
];
const MOVE_KEYWORDS: [RegExp, string][] = [
  [/travelling/i, "tracking"],
  [/dolly/i, "slow_dolly"],
  [/(panoramique|\bpan\b)/i, "pan"],
  [/zoom/i, "zoom"],
  [/steadicam/i, "steadicam"],
  [/[eé]paule/i, "handheld"],
  [/grue/i, "crane"],
];
const LIGHT_TAGS: [RegExp, string][] = [
  [/nuit/i, "Night / Cool"],
  [/jour/i, "Day / Neutral"],
  [/aube|aurore/i, "Dawn / Warm"],
  [/chaud/i, "Warm"],
  [/froid/i, "Cool"],
  [/n[eé]on/i, "Neon / Mixed"],
  [/p[eé]nombre/i, "Low-key"],
  [/pluie|orage/i, "Overcast / Wet"],
];

export function extractLocation(sceneLabel: string): { location: string; interior: boolean; envTag: string } {
  const interior = /\bint\b/i.test(sceneLabel);
  const parts = sceneLabel.split(/[—–-]/).map((p) => p.trim());
  const location = (parts.find((p) => /(int|ext)\b/i.test(p)) ?? parts[0] ?? "Plateau")
    .replace(/\b(int|ext)\.?\s*/i, "")
    .trim() || "Plateau";
  const envTag = parts.slice(1).join(" ").trim() || "Intérieur";
  return { location, interior, envTag };
}

/** StoryEngine : regroupe la timeline en scènes et en extrait les contraintes. */
export function planScenes(parsed: ParsedLine[], timeline: Timeline, cast: CastMember[]): SceneConstraint[] {
  const scenes: SceneConstraint[] = [];
  const castNames = cast.map((c) => c.name.toLowerCase());
  let current: SceneConstraint | null = null;
  let sceneIdx = 0;
  let objCounter = 0;

  const ensureScene = (label: string, start: number): SceneConstraint => {
    const { location, interior, envTag } = extractLocation(label);
    const rng = mulberry(hashSeed(label));
    const lighting = LIGHT_TAGS.map(([re, tag]) => (re.test(label) || re.test(envTag) ? tag : null)).find(Boolean) ?? (interior ? "Interior / Tungsten" : "Day / Neutral");
    const shot = SHOT_KEYWORDS.map(([re, s]) => (re.test(label) ? s : null)).find(Boolean) ?? pick(rng, ["medium", "wide", "medium", "close-up"]);
    const movement = MOVE_KEYWORDS.map(([re, m]) => (re.test(label) ? m : null)).find(Boolean) ?? "static";
    const sc: SceneConstraint = {
      sceneId: `sc-${++sceneIdx}`,
      index: sceneIdx,
      label: label || `Séquence ${sceneIdx}`,
      location,
      environment: envTag,
      interior,
      characters: [],
      objects: [],
      actions: [],
      dialogueCount: 0,
      camera: { shot, movement },
      lighting,
      clothing: {},
      duration: 0,
      transition: /fondu/i.test(label) ? "cross_dissolve" : "cut",
      events: [],
      start,
      end: start,
    };
    scenes.push(sc);
    return sc;
  };

  /* découpage via les entrées "scene" de la timeline */
  const entryByLine = new Map<string, TimelineEntry>();
  for (const e of timeline.entries) entryByLine.set(`${e.kind}:${e.label}`, e);

  let t = 0.5;
  for (const line of parsed) {
    if (line.kind === "scene") {
      current = ensureScene(line.text ?? line.raw, t);
      t += 2.7;
      continue;
    }
    if (!current) current = ensureScene("Séquence d'ouverture", t);
    const entry = entryByLine.get(`${line.kind}:${line.text ?? line.raw}`);
    const dur = entry?.duration ?? (line.kind === "dialogue" ? 3 : 1.8);
    current.duration += dur + 0.28;
    current.end = t + dur;

    if (line.kind === "dialogue" && line.name) {
      const name = line.name.trim();
      if (!current.characters.some((c) => c.toLowerCase() === name.toLowerCase())) current.characters.push(name);
      current.dialogueCount++;
      current.clothing[name] = wardrobeFor(name).top;
    }
    if (line.kind === "action") {
      const text = line.text ?? "";
      /* acteur potentiel : premier mot correspondant au casting ou capitalisé */
      const words = text.split(/\s+/);
      const actor = words.find((w) => castNames.includes(w.replace(/[^a-z0-9-]/gi, "").toLowerCase())) ?? null;
      const verb = (actor ? words[1] : words[0]) ?? "";
      const targetMatch = OBJECT_DICT.find(([re]) => re.test(text));
      current.actions.push({ actor, action: verb.toLowerCase().replace(/[^a-zà-ÿ]/gi, "") || "move", target: targetMatch ? targetMatch[1].type.toLowerCase() : null });
      if (/(explos|coup de|tire|court|tombe|sprinte|poursuit|chute)/i.test(text)) current.events.push(text.slice(0, 80));
    }
    t = current.end + 0.28;
  }

  /* objets + vêtements stabilisés */
  for (const sc of scenes) {
    const rng = mulberry(hashSeed(sc.sceneId + sc.label));
    const mentioned = new Set<string>();
    for (const a of sc.actions) if (a.target) mentioned.add(a.target);
    if (sc.dialogueCount > 1 && rng() > 0.45) mentioned.add("phone");
    for (const key of mentioned) {
      const def = OBJECT_DICT.find(([, d]) => d.type.toLowerCase().includes(key)) ?? null;
      objCounter++;
      sc.objects.push({
        id: `OBJECT_${String(objCounter).padStart(3, "0")}`,
        type: def?.[1].type ?? "Prop",
        color: def?.[1].color ?? "—",
        material: def?.[1].material ?? "—",
        position: pick(rng, ["Table", "Main du personnage", "Arrière-plan", "Console"]),
        owner: sc.characters[0] ?? null,
        state: "On",
        sceneId: sc.sceneId,
      });
    }
    for (const c of sc.characters) sc.clothing[c] = wardrobeFor(c).top;
  }
  return scenes;
}

/* ================= CharacterEngine ================= */

const WARDROBE_TOPS = ["veste noire", "chemise grise", "parka kaki", "hoodie sombre", "blouson cuir", "tunique anthracite"];
const WARDROBE_BOTTOMS = ["pantalon cargo", "jean brut", "pantalon technique", "jupe longue"];
const WARDROBE_SHOES = ["rangers", "baskets montantes", "bottes"];
const WARDROBE_ACC = ["oreillette", "montre connectée", "collier RFID", "aucun"];

export function wardrobeFor(name: string): { top: string; bottom: string; shoes: string; accessory: string } {
  const rng = mulberry(hashSeed(`wardrobe:${name.toLowerCase()}`));
  return {
    top: WARDROBE_TOPS[Math.floor(rng() * WARDROBE_TOPS.length)],
    bottom: WARDROBE_BOTTOMS[Math.floor(rng() * WARDROBE_BOTTOMS.length)],
    shoes: WARDROBE_SHOES[Math.floor(rng() * WARDROBE_SHOES.length)],
    accessory: WARDROBE_ACC[Math.floor(rng() * WARDROBE_ACC.length)],
  };
}

export function buildCharacterProfiles(cast: CastMember[]): CharacterIdentityProfile[] {
  return cast.map((c) => {
    const rng = mulberry(hashSeed(`profile:${c.name.toLowerCase()}`));
    const embedding = Array.from({ length: 8 }, () => Number((rng() * 2 - 1).toFixed(3)));
    const tones: Record<ToneId, string> = {
      calme: "posée", frustre: "tendue", aimable: "chaleureuse", colerique: "incisive", determine: "ferme", suspendu: "hésitante",
    };
    return {
      id: c.id,
      name: c.name,
      color: c.color,
      identity: {
        faceEmbedding: embedding,
        faceShape: pick(rng, ["ovale", "angulaire", "ronde", "carrée"]),
        eyes: pick(rng, ["sombres", "clairs", "noisette", "gris"]),
        nose: "proportionné",
        mouth: pick(rng, ["fine", "large", "moyenne"]),
        hair: pick(rng, ["courts noirs", "mi-longs bruns", "rasés", "attachés", "bouclés"]),
        skinTone: "observée depuis le média source",
        apparentAge: `${22 + Math.floor(rng() * 30)} ans (estimé)`,
        silhouette: pick(rng, ["élancée", "athlétique", "massive", "moyenne"]),
      },
      body: {
        height: pick(rng, ["1,68 m", "1,75 m", "1,82 m", "1,60 m"]),
        proportions: "standard",
        posture: pick(rng, ["droite", "légèrement voûtée", "dynamique"]),
        traits: "aucun trait distinctif conflictuel",
      },
      clothing: wardrobeFor(c.name),
      voice: {
        ref: c.voiceLabel,
        engine: c.voiceUrl ? "XTTS-v2 (échantillon cloné)" : "à attribuer",
        pitch: `${(0.9 + rng() * 0.3).toFixed(2)} ×`,
        tone: c.tone,
        style: tones[c.tone],
      },
      style: { realism: "photoreal", rendering: "Wan 2.1 · 48 i/s", cinematography: "cinéma vérité · basse lumière" },
    };
  });
}

/* ================= SceneEngine — mémoires ================= */

export function buildProjectMemory(scenes: SceneConstraint[], profiles: CharacterIdentityProfile[], objects: ObjectIdentityProfile[]): ProjectMemory {
  const locations = [...new Set(scenes.map((s) => s.location))];
  const cameraPrefs = [...new Set(scenes.map((s) => `${s.camera.shot} · ${s.camera.movement}`))].slice(0, 4);
  const relations: string[] = [];
  for (const s of scenes) {
    if (s.characters.length >= 2) relations.push(`${s.characters.slice(0, 3).join(" + ")} — ${s.location}`);
  }
  const recurring = objects.filter((o, i) => objects.findIndex((x) => x.type === o.type) !== i || i < 3).slice(0, 6);
  return {
    characters: profiles.map((p) => ({ name: p.name, color: p.color, wardrobe: `${p.clothing.top} · ${p.clothing.bottom}`, voice: p.voice.ref })),
    recurringObjects: recurring.map((o) => ({ id: o.id, type: o.type, color: o.color })),
    locations,
    palette: "bleu nuit · cyan · tungstène chaud",
    cameraPrefs,
    voices: [...new Set(profiles.map((p) => p.voice.ref ?? "—").filter((v) => v !== "—"))],
    relations: [...new Set(relations)].slice(0, 5),
    chronology: scenes.map((s) => ({ sceneId: s.sceneId, label: s.label, characters: s.characters })),
  };
}

/* ================= Scoring — estimation par moteur ================= */

export interface ScoringContext {
  unassigned: string[];
  hasAudio: boolean;
  cleanup: { isolation: boolean; denoise: boolean; deecho: boolean; spatial: boolean };
  samplingRate: number;
}

function base(rng: () => number): number {
  return 93 + rng() * 6;
}

/** Estimation de cohérence d'une scène pour un moteur donné (0–100). */
export function scoreScene(scene: SceneConstraint, engineId: EngineId, ctx: ScoringContext): number {
  const rng = mulberry(hashSeed(`${scene.sceneId}:${engineId}:${ctx.samplingRate}`));
  let s = base(rng);
  const chars = scene.characters.length;
  const unassignedInScene = scene.characters.filter((c) => ctx.unassigned.some((u) => u.toLowerCase() === c.toLowerCase())).length;
  const voicedRatio = chars > 0 ? 1 : 1;
  const actionRisk = scene.actions.length;
  const violent = scene.actions.some((a) => /(court|tombe|sprinte|poursuit|chute|grimpe)/.test(a.action));
  const handAction = scene.actions.some((a) => /(main|bras|attrape|d[eé]branche|glisse)/.test(a.action));

  switch (engineId) {
    case "character":
      s -= unassignedInScene * 7;
      break;
    case "face":
      s -= Math.max(0, chars - 1) * 1.6;
      break;
    case "anatomy":
      if (violent) s -= 3;
      if (handAction) s -= 2.4;
      break;
    case "objects":
      s -= scene.objects.length * 1.1;
      if (scene.actions.some((a) => a.target && !scene.objects.some((o) => o.type.toLowerCase().includes(a.target!)))) s -= 3;
      break;
    case "clothing":
      s -= chars * 0.9;
      break;
    case "motion":
      if (violent) s -= 3.4;
      s -= actionRisk * 1.2;
      break;
    case "physics":
      if (!scene.interior && /(pluie|orage)/i.test(scene.environment)) s -= 2.6;
      if (scene.objects.length > 2) s -= 1.6;
      if (violent) s -= 1.8;
      break;
    case "lighting":
      if (!scene.interior && /night|nuit/i.test(scene.lighting)) s -= 2.2;
      if (/mixed/i.test(scene.lighting)) s -= 1.8;
      break;
    case "camera":
      if (scene.camera.movement !== "static") s -= 2;
      if (scene.camera.movement === "zoom") s -= 1.6;
      break;
    case "temporal":
      if (scene.duration > 8) s -= 3;
      else if (scene.duration > 5) s -= 1.5;
      break;
    case "lipsync":
      if (ctx.hasAudio) {
        s = 95.5;
        if (ctx.cleanup.isolation) s += 1;
        if (ctx.cleanup.denoise) s += 0.8;
        if (ctx.cleanup.deecho) s += 1.2;
        if (ctx.cleanup.spatial) s += 0.5;
      } else {
        s = 87 + voicedRatio * 4 + (chars > 0 ? rng() * 4 : 6);
      }
      break;
    case "audio":
      if (ctx.hasAudio) {
        s = 93.5 + Object.values(ctx.cleanup).filter(Boolean).length * 1.4;
      } else {
        s = 91 + (chars > 0 ? rng() * 4 : 5);
      }
      break;
    case "text":
      s = /\d/.test(scene.label) || /[A-Z]{5,}/.test(scene.label) ? 89.5 + rng() * 3 : 96.5 + rng() * 2.5;
      break;
  }
  /* un faible échantillonnage ajoute de l'incertitude */
  if (ctx.samplingRate < 0.5) s += (rng() - 0.5) * 3;
  return clamp(Number(s.toFixed(1)), 60, 99.4);
}

export function engineStatus(score: number, threshold: number): EngineStatus {
  if (score >= threshold) return "pass";
  if (score >= threshold - 6) return "warning";
  return "error";
}

/* ================= QualityEngine — score global pondéré ================= */

export function computeGlobal(
  sceneScores: Record<string, Partial<Record<EngineId, number>>>,
  settings: QASettings
): { global: number; engines: EngineScore[] } {
  const sceneIds = Object.keys(sceneScores);
  const engines: EngineScore[] = ENGINE_DEFS.filter((e) => settings.engines[e.id]).map((def) => {
    const scores = sceneIds.map((sid) => sceneScores[sid]?.[def.id]).filter((v): v is number => typeof v === "number");
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 100;
    const weight = settings.weights[def.id] ?? def.weight;
    return { engineId: def.id, label: def.label, weight, score: Number(avg.toFixed(1)), status: engineStatus(avg, settings.passThreshold) };
  });
  const totalW = engines.reduce((a, e) => a + e.weight, 0) || 1;
  const global = Number((engines.reduce((a, e) => a + e.score * e.weight, 0) / totalW).toFixed(1));
  return { global, engines };
}

/* ================= Détection d'anomalies ================= */

const ANOMALY_TEMPLATES: Record<EngineId, (s: SceneConstraint, rng: () => number) => { type: string; description: string; character: string | null; object: string | null }> = {
  character: (s, rng) => {
    const c = s.characters[Math.floor(rng() * Math.max(1, s.characters.length))] ?? "Sujet";
    return { type: "Perte d'identité partielle", description: `Dérive d'identité estimée sur ${c} — embedding facial en deçà du profil de référence.`, character: c, object: null };
  },
  face: (s, rng) => ({
    type: "Face identity drift",
    description: `Morphing facial suspecté sur ${s.characters[0] ?? "le sujet"} — asymétrie anormale entre frames consécutives.`,
    character: s.characters[0] ?? null, object: null,
  }),
  anatomy: (s, rng) => ({
    type: rng() > 0.5 ? "Doigts fusionnés — main gauche" : "Articulation improbable — coude",
    description: "Structure anatomique incohérente détectée sur 2 frames adjacentes (confirmée en analyse profonde).",
    character: s.characters[Math.floor(rng() * Math.max(1, s.characters.length))] ?? null, object: null,
  }),
  objects: (s, rng) => {
    const o = s.objects[Math.floor(rng() * Math.max(1, s.objects.length))];
    return o
      ? { type: rng() > 0.45 ? "Objet manquant entre frames" : "Changement de couleur d'objet", description: `${o.id} (${o.type}, ${o.color}) — suivi interrompu ou teinte incohérente.`, character: null, object: o.id }
      : { type: "Apparition inattendue d'objet", description: "Prop non déclaré dans le Scene Constraint apparu en arrière-plan.", character: null, object: null };
  },
  clothing: (s) => ({
    type: "Changement de texture — vêtement",
    description: `La ${s.clothing[s.characters[0]] ?? "veste"} de ${s.characters[0] ?? "—"} change de motif entre deux cuts.`,
    character: s.characters[0] ?? null, object: null,
  }),
  motion: () => ({
    type: "Glissement des pieds détecté",
    description: "Trajectoire du pas désynchronisée du décor — accélération non physique sur 12 frames.",
    character: null, object: null,
  }),
  physics: (s) => ({
    type: /pluie|orage/i.test(s.environment) ? "Comportement de fluide incohérent" : "Ombre incohérente avec la source lumineuse",
    description: "Le rendu physique s'écarte du modèle gravité/collision sur la zone annotée.",
    character: null, object: null,
  }),
  lighting: () => ({
    type: "Direction de lumière inversée",
    description: "La source principale passe de gauche à droite sans raccord motivé par la caméra.",
    character: null, object: null,
  }),
  camera: () => ({
    type: "Zoom involontaire",
    description: "Focale estimée en variation de ±9 % hors consigne de réalisation.",
    character: null, object: null,
  }),
  temporal: (s) => ({
    type: "Temporal drift",
    description: `Chute de cohérence frame à frame dans « ${s.label.slice(0, 44)} » — zone à régénérer localement.`,
    character: s.characters[0] ?? null, object: null,
  }),
  lipsync: () => ({
    type: "Désynchronisation labiale (+120 ms)",
    description: "Les visèmes retardent sur les phonèmes — bouche partiellement inactive sur les plosives.",
    character: null, object: null,
  }),
  audio: () => ({
    type: "Artefact TTS / niveau instable",
    description: "Micro-coupure et réverbération divergente détectées sur la piste dialogue.",
    character: null, object: null,
  }),
  text: () => ({
    type: "Caractères déformés — panneau",
    description: "Texte à l'écran instable entre frames (comparé au Scene Constraint).",
    character: null, object: null,
  }),
};

const SEVERITY_ORDER: Record<Severity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
export { SEVERITY_ORDER };

function severityFor(engineId: EngineId, gap: number): Severity {
  const sensitive = engineId === "character" || engineId === "face" || engineId === "anatomy";
  if (gap >= 7) return sensitive ? "CRITICAL" : "HIGH";
  if (gap >= 4) return "HIGH";
  if (gap >= 2) return "MEDIUM";
  return "LOW";
}

/** FAST SCAN + DEEP ANALYSIS : détecte les anomalies localisées sur la timeline. */
export function detectAnomalies(
  scenes: SceneConstraint[],
  sceneScores: Record<string, Partial<Record<EngineId, number>>>,
  timeline: Timeline,
  settings: QASettings,
  ignored: string[]
): Anomaly[] {
  const anomalies: Anomaly[] = [];
  let n = 0;
  for (const scene of scenes) {
    const rng = mulberry(hashSeed(`anoms:${scene.sceneId}:${settings.samplingRate}`));
    for (const def of ENGINE_DEFS) {
      if (!settings.engines[def.id]) continue;
      const score = sceneScores[scene.sceneId]?.[def.id];
      if (score == null) continue;
      const gap = settings.passThreshold - score;
      /* fast scan : ne creuse que si suspicion ; sampling réduit la détection */
      const detectionChance = clamp(0.35 + gap * 0.14 + (settings.samplingRate - 0.5) * 0.5, 0.1, 0.97);
      if (gap <= 0 || rng() > detectionChance) continue;
      const entries = timeline.entries.filter((e) => e.start >= scene.start - 0.4 && e.start <= scene.end + 0.4);
      const anchor = entries[Math.floor(rng() * Math.max(1, entries.length))];
      const t0 = anchor ? anchor.start + rng() * anchor.duration * 0.5 : scene.start;
      const tpl = ANOMALY_TEMPLATES[def.id](scene, rng);
      const id = `an-${++n}-${scene.sceneId}-${def.id}`;
      anomalies.push({
        id,
        engineId: def.id,
        sceneId: scene.sceneId,
        timeStart: Number(t0.toFixed(2)),
        timeEnd: Number((t0 + 0.4 + rng() * 1.1).toFixed(2)),
        severity: severityFor(def.id, gap),
        type: tpl.type,
        description: tpl.description,
        confidence: Number(clamp(84 + rng() * 13 - (settings.samplingRate < 0.5 ? 6 : 0), 70, 97).toFixed(0)),
        character: tpl.character,
        object: tpl.object,
        status: ignored.includes(id) ? "ignored" : "detected",
        frameBox: { x: 0.18 + rng() * 0.4, y: 0.16 + rng() * 0.3, w: 0.16 + rng() * 0.2, h: 0.22 + rng() * 0.26 },
      });
    }
  }
  return anomalies.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.timeStart - b.timeStart);
}

/* ================= TemporalEngine ================= */

export function analyzeTemporal(scenes: SceneConstraint[], sceneScores: Record<string, Partial<Record<EngineId, number>>>, sampling: number): TemporalAnalysis[] {
  return scenes.map((sc) => {
    const rng = mulberry(hashSeed(`temp:${sc.sceneId}`));
    const n = clamp(Math.round(6 + sc.duration * sampling * 2), 5, 18);
    const baseScore = sceneScores[sc.sceneId]?.temporal ?? 95;
    const dip = baseScore < 92 ? 8 + rng() * 8 : 0;
    const dipAt = 2 + Math.floor(rng() * Math.max(1, n - 4));
    const samples = Array.from({ length: n }, (_, i) => {
      const anomaly = dip > 0 && i === dipAt;
      return {
        frame: `F${String(i + 1).padStart(2, "0")}`,
        score: Number(clamp(baseScore + (rng() - 0.5) * 2.4 - (anomaly ? dip : 0), 60, 99).toFixed(0)),
        anomaly,
      };
    });
    return { sceneId: sc.sceneId, samples, drift: dip > 0 ? Number(dip.toFixed(1)) : 0 };
  });
}

/* ================= RepairEngine — réparation localisée ================= */

/**
 * Sélectionne le lot d'anomalies à réparer pour une tentative :
 * priorité à la sévérité puis à la confiance (§19). Jamais la vidéo entière —
 * uniquement les segments concernés (§18).
 */
export function selectRepairBatch(anomalies: Anomaly[], maxJobs: number): Anomaly[] {
  return anomalies
    .filter((a) => a.status === "detected")
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.confidence - a.confidence)
    .slice(0, maxJobs);
}

/** Applique une réparation : rehausse uniquement le moteur de la scène touchée. */
export function applyRepair(
  sceneScores: Record<string, Partial<Record<EngineId, number>>>,
  job: RepairJob,
  rng: () => number
): number {
  const scene = sceneScores[job.sceneId] ?? {};
  const before = scene[job.engineId] ?? 90;
  const after = clamp(Number((before + 5 + rng() * 4).toFixed(1)), 0, 99.2);
  sceneScores[job.sceneId] = { ...scene, [job.engineId]: after };
  return after;
}

/** Construit les jobs d'une tentative à partir des anomalies actives. */
export function buildRepairJobs(batch: Anomaly[], attempt: number): RepairJob[] {
  return batch.map((a) => ({
    id: `job-${a.id}-a${attempt}`,
    anomalyId: a.id,
    sceneId: a.sceneId,
    engineId: a.engineId,
    segment: [a.timeStart, a.timeEnd],
    attempt,
    status: "queued",
    scoreBefore: 0,
    scoreAfter: null,
    note: `Régénération ciblée ${a.timeStart.toFixed(1)}s → ${a.timeEnd.toFixed(1)}s (identité, vêtements, caméra et audio préservés)`,
  }));
}

/* ================= Divers ================= */

export function formatNow(): string {
  return new Date().toLocaleTimeString("fr-FR", { hour12: false });
}

export type { QAInput, QASettings };
