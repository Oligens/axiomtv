/**
 * AgwèStream — Modèle de données du studio de production.
 */

/* ================= Tons / émotions (pilier 3) ================= */
export type ToneId = "calme" | "frustre" | "aimable" | "colerique" | "determine" | "suspendu";

export interface ToneDef {
  id: ToneId;
  label: string;
  /** Modulation TTS : vitesse */
  rate: number;
  /** Modulation TTS : hauteur (demi-tons relatifs → ratio) */
  pitch: number;
  /** Énergie perçue 0..1 (pilote le waveform) */
  energy: number;
  accent: string;
}

export const TONES: ToneDef[] = [
  { id: "calme", label: "Calme", rate: 0.94, pitch: 1.0, energy: 0.35, accent: "#34d399" },
  { id: "frustre", label: "Frustré", rate: 1.08, pitch: 0.94, energy: 0.7, accent: "#f59e0b" },
  { id: "aimable", label: "Aimable", rate: 1.0, pitch: 1.08, energy: 0.5, accent: "#00e5ff" },
  { id: "colerique", label: "Colérique", rate: 1.14, pitch: 0.88, energy: 0.95, accent: "#ff5d73" },
  { id: "determine", label: "Déterminé", rate: 1.04, pitch: 0.98, energy: 0.8, accent: "#9d4edd" },
  { id: "suspendu", label: "Suspendu", rate: 0.88, pitch: 1.04, energy: 0.45, accent: "#60a5fa" },
];

export const toneById = (id: ToneId): ToneDef => TONES.find((t) => t.id === id) ?? TONES[0];

/* ================= Couleurs de casting ================= */
export const CAST_COLORS = ["#00e5ff", "#9d4edd", "#f5c542", "#34d399", "#ff5d73", "#60a5fa", "#f472b6", "#a3e635"];
export const colorFor = (i: number) => CAST_COLORS[i % CAST_COLORS.length];

/* ================= Scénario (pilier 1) ================= */
export type LineKind = "scene" | "dialogue" | "action";

export interface ParsedLine {
  kind: LineKind;
  raw: string;
  /** Nom du clone (dialogue uniquement) */
  name?: string;
  /** Indications scéniques entre parenthèses */
  directions?: string;
  /** Ton détecté dans les indications */
  tone?: ToneId;
  /** Texte de la réplique (dialogue uniquement) */
  text?: string;
}

export interface CloneConfig {
  id: string;
  faceId: string;
  /** Doit correspondre strictement au nom utilisé dans le scénario */
  name: string;
  voiceId: string | null;
  voiceLabel: string | null;
  tone: ToneId;
  inSeq: boolean;
  color: string;
}

export interface VoiceProfile {
  id: string;
  label: string;
  engine: "xtts" | "elevenlabs";
  sourceName: string;
}

/* ================= Timeline (pilier 5) ================= */
export interface TimelineEntry {
  id: number;
  kind: LineKind;
  characterId?: string;
  characterName?: string;
  color?: string;
  label: string;
  tone?: ToneId;
  start: number;
  duration: number;
  /** Dialogue croisé (chevauchement avec la réplique précédente) */
  crossed?: boolean;
}

export interface Timeline {
  entries: TimelineEntry[];
  total: number;
  /** Noms du scénario sans clone correspondant */
  unassigned: string[];
  /** Nombre de répliques liées par clone */
  matched: Record<string, number>;
}

/* ================= Analyse média (pilier 2) ================= */
export interface FaceBox {
  id: string;
  index: number;
  bbox: { x: number; y: number; w: number; h: number };
  thumb: string | null;
  confidence: number;
}

export interface MediaAnalysis {
  faces: FaceBox[];
  frame: string | null;
  hasAudioGuess: boolean;
  isVideo: boolean;
}

/* ================= Intro cinématique ================= */
export interface IntroMetadata {
  title: string;
  directors: { name: string; role: string }[];
  cast: string[];
  year: number;
}

export const DEFAULT_INTRO: IntroMetadata = {
  title: "Transmission",
  directors: [{ name: "", role: "Réalisation" }],
  cast: [],
  year: new Date().getFullYear(),
};

/* ================= Audio hybride (pilier 4) ================= */
export type AudioMode = "cleanup" | "synthesis" | "hybrid";

export interface CleanupOptions {
  isolation: boolean;
  denoise: boolean;
  deecho: boolean;
  spatial: boolean;
}

/* ================= Moteurs de voix ================= */
export const VOICE_ENGINES = [
  { id: "xtts" as const, label: "XTTS-v2 · Local", desc: "Souverain, GPU local" },
  { id: "elevenlabs" as const, label: "ElevenLabs · Cloud", desc: "Fallback haute fidélité" },
];

/* ================= Template de scénario ================= */
export const SCENARIO_TEMPLATE = `[SCÈNE 1 — INT. DÔME DE CONTRÔLE — NUIT]
(K-9 fixe l'écran principal, mâchoire serrée. Mira ajuste le routeur.)
K-9 (frustré, voix basse) : « Le signal du dôme a coupé il y a quatre minutes. »
Mira (calme) : « On a encore une fenêtre. Respire. »
K-9 (déterminé) : « On transmet avant le prochain passage du convoi. »
La porte coulisse. Cleef entre, trempé de pluie, essoufflé.
Cleef (suspendu) : « Ils savent qu'on émet. Il faut bouger. »
Mira (colérique) : « Tu étais où, bon sang ?! »
[SCÈNE 2 — EXT. PASSERELLE — NUIT, PLUIE]
Cleef (aimable) : « J'ai balisé une sortie. Suivez-moi. »
K-9 débranche l'émetteur et le glisse dans son sac.`;

/** Métadonnées dérivées (titre du film = première scène ou champ dédié) */
export function deriveTitle(scenario: string): string {
  const firstDialogue = scenario.split("\n").find((l) => l.trim().match(/^[^[(].*[:：]/));
  if (firstDialogue) {
    const m = firstDialogue.match(/[:：]\s*[«"]?(.{4,40}?)[»"]?\s*$/);
    if (m) return m[1];
  }
  return "Transmission";
}
