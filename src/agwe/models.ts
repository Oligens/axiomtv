/**
 * AGWÈSTREAM 2.0 — Modèles de données du moteur de contrôle qualité.
 *
 * Structures d'échange entre les moteurs (Story, Character, Object, Scene,
 * Generation, Vision, Temporal, Motion, Physics, Lighting, Camera, LipSync,
 * Audio, Quality, Repair, Render). Aucun score n'est une certitude : ce sont
 * des estimations de cohérence selon les métriques actives.
 */
import type { CleanupOptions, ParsedLine, Timeline, ToneId } from "../data/content";
import type { CastMember } from "../lib/scenario";

/* ================= Moteurs d'analyse ================= */

export type EngineId =
  | "character" | "face" | "anatomy" | "objects" | "clothing"
  | "motion" | "physics" | "lighting" | "camera"
  | "temporal" | "lipsync" | "audio" | "text";

export interface EngineDef {
  id: EngineId;
  label: string;
  /** Pondération par défaut dans le score global */
  weight: number;
}

export const ENGINE_DEFS: EngineDef[] = [
  { id: "character", label: "Character", weight: 12 },
  { id: "face", label: "Face", weight: 12 },
  { id: "anatomy", label: "Anatomy", weight: 9 },
  { id: "objects", label: "Objects", weight: 8 },
  { id: "clothing", label: "Clothing", weight: 7 },
  { id: "motion", label: "Motion", weight: 8 },
  { id: "physics", label: "Physics", weight: 7 },
  { id: "lighting", label: "Lighting", weight: 7 },
  { id: "camera", label: "Camera", weight: 6 },
  { id: "temporal", label: "Temporal", weight: 10 },
  { id: "lipsync", label: "LipSync", weight: 8 },
  { id: "audio", label: "Audio", weight: 7 },
  { id: "text", label: "Text", weight: 5 },
];

export type EngineStatus = "pass" | "warning" | "error";
export type AnomalyStatus = "detected" | "repairing" | "repaired" | "ignored" | "false_positive";
export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type UserMode = "simple" | "pro" | "expert";

/* ================= Story Intelligence ================= */

export interface SceneAction {
  actor: string | null;
  action: string;
  target: string | null;
}

export interface ObjectIdentityProfile {
  id: string;
  type: string;
  color: string;
  material: string;
  position: string;
  owner: string | null;
  state: string;
  sceneId: string;
}

export interface SceneConstraint {
  sceneId: string;
  index: number;
  label: string;
  location: string;
  environment: string;
  interior: boolean;
  characters: string[];
  objects: ObjectIdentityProfile[];
  actions: SceneAction[];
  dialogueCount: number;
  camera: { shot: string; movement: string };
  lighting: string;
  clothing: Record<string, string>;
  duration: number;
  transition: string;
  events: string[];
  /** Fenêtre temporelle sur la timeline */
  start: number;
  end: number;
}

/* ================= Character Consistency ================= */

export interface CharacterIdentityProfile {
  id: string;
  name: string;
  color: string;
  identity: {
    faceEmbedding: number[];
    faceShape: string;
    eyes: string;
    nose: string;
    mouth: string;
    hair: string;
    skinTone: string;
    apparentAge: string;
    silhouette: string;
  };
  body: { height: string; proportions: string; posture: string; traits: string };
  clothing: { top: string; bottom: string; shoes: string; accessory: string };
  voice: { ref: string | null; engine: string; pitch: string; tone: ToneId; style: string };
  style: { realism: string; rendering: string; cinematography: string };
}

/* ================= Mémoires ================= */

export interface ProjectMemory {
  characters: { name: string; color: string; wardrobe: string; voice: string | null }[];
  recurringObjects: { id: string; type: string; color: string }[];
  locations: string[];
  palette: string;
  cameraPrefs: string[];
  voices: string[];
  relations: string[];
  chronology: { sceneId: string; label: string; characters: string[] }[];
}

/* ================= Analyse temporelle ================= */

export interface TemporalSample {
  frame: string;
  score: number;
  anomaly: boolean;
}

export interface TemporalAnalysis {
  sceneId: string;
  samples: TemporalSample[];
  drift: number;
}

/* ================= Rapport qualité ================= */

export interface Anomaly {
  id: string;
  engineId: EngineId;
  sceneId: string;
  timeStart: number;
  timeEnd: number;
  severity: Severity;
  type: string;
  description: string;
  confidence: number;
  character: string | null;
  object: string | null;
  status: AnomalyStatus;
  frameBox: { x: number; y: number; w: number; h: number };
}

export interface EngineScore {
  engineId: EngineId;
  label: string;
  weight: number;
  score: number;
  status: EngineStatus;
}

export type ReportStatus = "IDLE" | "GENERATING" | "FAST_SCAN" | "DEEP_ANALYSIS" | "SCORING" | "REPAIRING" | "VERIFY" | "APPROVED" | "REPAIR_LIMIT" | "FAILED";

export interface RepairAttempt {
  n: number;
  score: number;
  delta: number;
  repaired: number;
}

export interface QualityReport {
  status: ReportStatus;
  globalScore: number;
  engines: EngineScore[];
  anomalies: Anomaly[];
  temporal: TemporalAnalysis[];
  /** sceneId → engineId → score estimé */
  sceneScores: Record<string, Partial<Record<EngineId, number>>>;
  attempts: RepairAttempt[];
  passThreshold: number;
  generatedAt: string;
  disclaimer: string;
}

export interface RepairJob {
  id: string;
  anomalyId: string;
  sceneId: string;
  engineId: EngineId;
  segment: [number, number];
  attempt: number;
  status: "queued" | "running" | "done" | "failed";
  scoreBefore: number;
  scoreAfter: number | null;
  note: string;
}

/* ================= Journal & réglages ================= */

export type LogLevel = "info" | "ok" | "warn" | "error" | "repair" | "phase";

export interface QALogEntry {
  t: string;
  msg: string;
  level: LogLevel;
}

export interface QASettings {
  mode: UserMode;
  /** Taux d'échantillonnage des frames (0.2 – 1) — analyse adaptative */
  samplingRate: number;
  maxAttempts: number;
  passThreshold: number;
  /** Score sous lequel une scène passe en analyse profonde */
  deepThreshold: number;
  engines: Record<EngineId, boolean>;
  weights: Record<EngineId, number>;
}

export const DEFAULT_QA_SETTINGS: QASettings = {
  mode: "pro",
  samplingRate: 0.6,
  maxAttempts: 3,
  passThreshold: 92,
  deepThreshold: 90,
  engines: Object.fromEntries(ENGINE_DEFS.map((e) => [e.id, true])) as Record<EngineId, boolean>,
  weights: Object.fromEntries(ENGINE_DEFS.map((e) => [e.id, e.weight])) as Record<EngineId, number>,
};

/* ================= Contexte d'entrée du pipeline ================= */

export interface QAInput {
  parsed: ParsedLine[];
  timeline: Timeline;
  cast: CastMember[];
  hasAudio: boolean;
  cleanup: CleanupOptions;
  ignoredAnomalyIds: string[];
}
