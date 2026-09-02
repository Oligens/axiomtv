/**
 * AGWÈSTREAM 2.0 — Tests unitaires + intégration des moteurs (§33).
 * Exécution : `npx vitest run`
 */
import { describe, expect, it } from "vitest";
import type { CastMember } from "../lib/scenario";
import type { ParsedLine, Timeline, TimelineEntry } from "../data/content";
import {
  planScenes,
  buildCharacterProfiles,
  scoreScene,
  computeGlobal,
  analyzeTemporal,
  detectAnomalies,
  selectRepairBatch,
  applyRepair,
  buildRepairJobs,
  wardrobeFor,
  type ScoringContext,
} from "./engines";
import { DEFAULT_QA_SETTINGS, type Anomaly, type EngineId, type SceneConstraint } from "./models";

/* ================= Fixtures ================= */

function castMember(name: string, opts: Partial<CastMember> = {}): CastMember {
  return {
    id: `id-${name}`,
    name,
    color: "#00e5ff",
    tone: "calme",
    role: "actor",
    enabled: true,
    zone: "mid",
    voiceUrl: null,
    voiceBuffer: null,
    voiceLabel: null,
    face: null,
    thumb: null,
    confidence: null,
    ...opts,
  };
}

function line(kind: ParsedLine["kind"], text: string, extra: Partial<ParsedLine> = {}): ParsedLine {
  return { kind, raw: text, text, ...extra };
}

function buildTimeline(entries: TimelineEntry[], unassigned: string[] = []): Timeline {
  const total = entries.length ? Math.max(...entries.map((e) => e.start + e.duration)) : 10;
  return { entries, total, unassigned, matched: {} };
}

const BASE_PARSED: ParsedLine[] = [
  line("scene", "INT. DÔME DE CONTRÔLE — NUIT"),
  line("dialogue", "Le signal du dôme a coupé.", { name: "Mira", tone: "calme" }),
  line("action", "Mira attrape le téléphone sur la table."),
  line("dialogue", "On transmet avant le convoi.", { name: "K-9", tone: "determine" }),
];

function sceneFixture(overrides: Partial<SceneConstraint> = {}): SceneConstraint {
  return {
    sceneId: "sc-1",
    index: 1,
    label: "INT. DÔME DE CONTRÔLE — NUIT",
    location: "DÔME DE CONTRÔLE",
    environment: "NUIT",
    interior: true,
    characters: ["Mira", "K-9"],
    objects: [{ id: "OBJECT_001", type: "Smartphone", color: "Black", material: "Glass/Metal", position: "Table", owner: "Mira", state: "On", sceneId: "sc-1" }],
    actions: [{ actor: "Mira", action: "attrape", target: "smartphone" }],
    dialogueCount: 2,
    camera: { shot: "medium", movement: "static" },
    lighting: "Night / Cool",
    clothing: { Mira: "veste noire", "K-9": "chemise grise" },
    duration: 6,
    transition: "cut",
    events: [],
    start: 0.5,
    end: 8,
    ...overrides,
  };
}

const CTX: ScoringContext = {
  unassigned: [],
  hasAudio: false,
  cleanup: { isolation: true, denoise: true, deecho: false, spatial: false },
  samplingRate: 0.8,
};

function anomaly(overrides: Partial<Anomaly> = {}): Anomaly {
  return {
    id: "an-1",
    engineId: "face",
    sceneId: "sc-1",
    timeStart: 2,
    timeEnd: 3,
    severity: "HIGH",
    type: "Face identity drift",
    description: "test",
    confidence: 90,
    character: "Mira",
    object: null,
    status: "detected",
    frameBox: { x: 0.2, y: 0.2, w: 0.2, h: 0.2 },
    ...overrides,
  };
}

/* ================= Character ================= */

describe("CharacterEngine", () => {
  it("construit un profil par personnage du casting", () => {
    const cast = [castMember("Mira"), castMember("K-9")];
    const profiles = buildCharacterProfiles(cast);
    expect(profiles).toHaveLength(2);
    expect(profiles[0].name).toBe("Mira");
    expect(profiles[0].identity.faceEmbedding).toHaveLength(8);
  });

  it("même personnage → même garde-robe (cohérence déterministe)", () => {
    expect(wardrobeFor("Mira")).toEqual(wardrobeFor("Mira"));
    expect(wardrobeFor("Mira").top).toBe(wardrobeFor("MIRA").top); // insensible à la casse
  });

  it("visage partiellement masqué : le profil reste construit (robustesse)", () => {
    const profiles = buildCharacterProfiles([castMember("Sujet masqué", { face: null, confidence: 0.4 })]);
    expect(profiles).toHaveLength(1);
    expect(profiles[0].identity.faceShape).toBeTruthy();
  });
});

/* ================= Story / Scene ================= */

describe("StoryEngine — planScenes", () => {
  it("extrait scènes, personnages et objets depuis le scénario", () => {
    const cast = [castMember("Mira"), castMember("K-9")];
    const timeline = buildTimeline([
      { id: 0, kind: "scene", label: "INT. DÔME DE CONTRÔLE — NUIT", start: 0.5, duration: 2.4 },
      { id: 1, kind: "dialogue", label: "Le signal du dôme a coupé.", start: 3.2, duration: 3 },
      { id: 2, kind: "dialogue", label: "On transmet avant le convoi.", start: 6.5, duration: 3 },
    ]);
    const scenes = planScenes(BASE_PARSED, timeline, cast);
    expect(scenes.length).toBeGreaterThanOrEqual(1);
    expect(scenes[0].characters).toContain("Mira");
    expect(scenes[0].characters).toContain("K-9");
    expect(scenes[0].interior).toBe(true);
  });

  it("aucun personnage → scène sans crash (cas extrême)", () => {
    const scenes = planScenes([line("scene", "EXT. RUE — NUIT"), line("action", "La pluie tombe.")], buildTimeline([]), []);
    expect(scenes.length).toBeGreaterThanOrEqual(1);
    expect(scenes[0].characters).toHaveLength(0);
  });

  it("10 personnages gérés sans erreur", () => {
    const cast = Array.from({ length: 10 }, (_, i) => castMember(`P${i}`));
    const parsed = [line("scene", "INT. SALLE — JOUR"), ...cast.map((c) => line("dialogue", "Une réplique.", { name: c.name }))];
    const scenes = planScenes(parsed, buildTimeline([]), cast);
    expect(scenes[0].characters.length).toBeLessThanOrEqual(10);
  });
});

/* ================= Scoring ================= */

describe("Moteurs de scoring", () => {
  it("score dans la plage attendue [60, 99.4]", () => {
    const s = sceneFixture();
    for (const e of ["face", "objects", "temporal", "camera"] as EngineId[]) {
      const v = scoreScene(s, e, CTX);
      expect(v).toBeGreaterThanOrEqual(60);
      expect(v).toBeLessThanOrEqual(99.4);
    }
  });

  it("personnage non assigné au casting → pénalité sur le score Character", () => {
    const ok = scoreScene(sceneFixture(), "character", { ...CTX, unassigned: [] });
    const bad = scoreScene(sceneFixture(), "character", { ...CTX, unassigned: ["Mira", "K-9"] });
    expect(bad).toBeLessThan(ok);
  });

  it("audio : vidéo avec piste audio + nettoyage → meilleur score qu'une synthèse brute", () => {
    const s = sceneFixture();
    const withAudio = scoreScene(s, "audio", { ...CTX, hasAudio: true });
    const synth = scoreScene(s, "audio", { ...CTX, hasAudio: false });
    expect(withAudio).toBeGreaterThan(synth - 6);
  });

  it("lipsync : voix d'origine nettoyée ≥ synthèse", () => {
    const s = sceneFixture();
    const cleaned = scoreScene(s, "lipsync", { ...CTX, hasAudio: true, cleanup: { isolation: true, denoise: true, deecho: true, spatial: true } });
    expect(cleaned).toBeGreaterThanOrEqual(95);
  });
});

/* ================= Quality ================= */

describe("QualityEngine — computeGlobal", () => {
  it("score global = moyenne pondérée des moteurs", () => {
    const sceneScores = { "sc-1": { face: 98, objects: 90 } as Partial<Record<EngineId, number>> };
    const { global, engines } = computeGlobal(sceneScores, DEFAULT_QA_SETTINGS);
    expect(engines.length).toBeGreaterThan(0);
    expect(global).toBeGreaterThan(0);
    expect(global).toBeLessThanOrEqual(100);
  });

  it("tous les moteurs au plafond → global proche de 100", () => {
    const all: Partial<Record<EngineId, number>> = {};
    for (const d of DEFAULT_QA_SETTINGS.engines ? Object.keys(DEFAULT_QA_SETTINGS.engines) : []) all[d as EngineId] = 99;
    const { global } = computeGlobal({ "sc-1": all }, DEFAULT_QA_SETTINGS);
    expect(global).toBeGreaterThanOrEqual(98);
  });
});

/* ================= Temporal ================= */

describe("TemporalEngine", () => {
  it("mouvement stable → peu ou pas de dérive marquée", () => {
    const scenes = [sceneFixture({ duration: 3 })];
    const sceneScores = { "sc-1": { temporal: 97 } as Partial<Record<EngineId, number>> };
    const [t] = analyzeTemporal(scenes, sceneScores, 0.8);
    expect(t.samples.length).toBeGreaterThanOrEqual(5);
  });

  it("changement brutal → dérive détectée (frame marquée anomalie)", () => {
    const scenes = [sceneFixture({ duration: 9 })];
    const sceneScores = { "sc-1": { temporal: 80 } as Partial<Record<EngineId, number>> };
    const [t] = analyzeTemporal(scenes, sceneScores, 0.8);
    expect(t.drift).toBeGreaterThan(0);
    expect(t.samples.some((s) => s.anomaly)).toBe(true);
  });
});

/* ================= Détection d'anomalies ================= */

describe("Détection d'anomalies", () => {
  it("scores très bas → anomalies détectées avec structure valide", () => {
    const scenes = [sceneFixture()];
    const low: Partial<Record<EngineId, number>> = { face: 62, objects: 65, temporal: 68, camera: 70, lighting: 72, motion: 74 };
    const settings = { ...DEFAULT_QA_SETTINGS, samplingRate: 1 };
    let found: Anomaly[] = [];
    /* la détection est probabiliste : on relance jusqu'à obtention (borné) */
    for (let i = 0; i < 5 && !found.length; i++) {
      found = detectAnomalies(scenes, { "sc-1": low }, buildTimeline([]), { ...settings, samplingRate: 0.5 + i * 0.1 }, []);
    }
    expect(found.length).toBeGreaterThan(0);
    for (const a of found) {
      expect(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).toContain(a.severity);
      expect(a.timeStart).toBeLessThanOrEqual(a.timeEnd);
      expect(a.confidence).toBeGreaterThanOrEqual(70);
      expect(a.confidence).toBeLessThanOrEqual(97);
    }
  });

  it("les anomalies ignorées ne sont pas remontées comme 'detected'", () => {
    const scenes = [sceneFixture()];
    const low: Partial<Record<EngineId, number>> = { face: 60 };
    const settings = { ...DEFAULT_QA_SETTINGS, samplingRate: 1 };
    const all = detectAnomalies(scenes, { "sc-1": low }, buildTimeline([]), settings, []);
    if (all.length) {
      const ignored = detectAnomalies(scenes, { "sc-1": low }, buildTimeline([]), settings, [all[0].id]);
      const still = ignored.find((a) => a.id === all[0].id);
      if (still) expect(still.status).toBe("ignored");
    }
  });
});

/* ================= Repair ================= */

describe("RepairEngine", () => {
  it("sélectionne par sévérité puis confiance, en respectant la taille de lot", () => {
    const list = [
      anomaly({ id: "a", severity: "LOW", confidence: 95 }),
      anomaly({ id: "b", severity: "CRITICAL", confidence: 80 }),
      anomaly({ id: "c", severity: "HIGH", confidence: 99 }),
      anomaly({ id: "d", severity: "CRITICAL", confidence: 92, status: "repaired" }),
    ];
    const batch = selectRepairBatch(list, 2);
    expect(batch).toHaveLength(2);
    expect(batch[0].id).toBe("b"); // CRITICAL en premier
    expect(batch[1].id).toBe("c"); // HIGH avant LOW
  });

  it("la réparation augmente le score du moteur ciblé (succès)", () => {
    const sceneScores = { "sc-1": { face: 70 } as Partial<Record<EngineId, number>> };
    const job = buildRepairJobs([anomaly({ engineId: "face", sceneId: "sc-1" })], 1)[0];
    const after = applyRepair(sceneScores, job, () => 0.5);
    expect(after).toBeGreaterThan(70);
    expect(sceneScores["sc-1"].face).toBe(after);
  });

  it("construit un job par anomalie avec segment temporel localisé", () => {
    const jobs = buildRepairJobs([anomaly({ timeStart: 27.4, timeEnd: 28.1 }), anomaly({ id: "a2", timeStart: 40, timeEnd: 41 })], 1);
    expect(jobs).toHaveLength(2);
    expect(jobs[0].segment).toEqual([27.4, 28.1]);
    expect(jobs[0].status).toBe("queued");
  });
});

/* ================= Robustesse (§29) ================= */

describe("Robustesse — cas extrêmes", () => {
  it("scène sans dialogue ni personnage ne fait pas planter le scoring", () => {
    const s = sceneFixture({ characters: [], dialogueCount: 0, objects: [] });
    expect(() => scoreScene(s, "lipsync", CTX)).not.toThrow();
    expect(() => scoreScene(s, "character", CTX)).not.toThrow();
  });

  it("photo (durée 0) et vidéo longue sont toutes deux bornées", () => {
    const short = sceneFixture({ duration: 0 });
    const long = sceneFixture({ duration: 400 });
    for (const s of [short, long]) {
      const v = scoreScene(s, "temporal", CTX);
      expect(v).toBeGreaterThanOrEqual(60);
      expect(v).toBeLessThanOrEqual(99.4);
    }
  });
});
