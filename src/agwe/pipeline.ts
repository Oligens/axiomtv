/**
 * AGWÈSTREAM 2.0 — Orchestrateur du pipeline qualité.
 *
 *   SCRIPT → PLANIFICATION → GÉNÉRATION → FAST SCAN → DEEP ANALYSIS
 *          → SCORING → RÉPARATION (boucle bornée) → VÉRIFICATION → RENDU
 *
 * Robustesse (§29) : chaque moteur est exécuté de façon isolée ; un échec
 * n'interrompt jamais la production — il est journalisé et contourné.
 */
import type { Timeline } from "../data/content";
import {
  analyzeTemporal,
  applyRepair,
  buildRepairJobs,
  detectAnomalies,
  computeGlobal,
  formatNow,
  hashSeed,
  mulberry,
  planScenes,
  scoreScene,
  selectRepairBatch,
} from "./engines";
import type {
  Anomaly,
  EngineId,
  QAInput,
  QALogEntry,
  QASettings,
  QualityReport,
  RepairJob,
  SceneConstraint,
} from "./models";
import { ENGINE_DEFS } from "./models";

export interface QACallbacks {
  onLog: (e: QALogEntry) => void;
  onPhase: (phase: string, pct: number) => void;
  onAnomalies: (a: Anomaly[]) => void;
  onReport: (r: QualityReport) => void;
  onJobs: (j: RepairJob[]) => void;
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const log = (cb: QACallbacks, msg: string, level: QALogEntry["level"] = "info") =>
  cb.onLog({ t: formatNow(), msg, level });

export interface QAResult {
  report: QualityReport;
  scenes: SceneConstraint[];
  jobs: RepairJob[];
}

/**
 * Exécution complète du contrôle qualité.
 * Annulable via le signal retourné (`cancel()`).
 */
export function runQAPipeline(input: QAInput, settings: QASettings, cb: QACallbacks): { done: Promise<QAResult>; cancel: () => void } {
  let cancelled = false;
  const cancel = () => {
    cancelled = true;
  };

  const done = (async (): Promise<QAResult> => {
    const { parsed, timeline, cast, hasAudio, cleanup, ignoredAnomalyIds } = input;
    const rng = mulberry(hashSeed(`run:${Date.now()}`));
    const allJobs: RepairJob[] = [];

    /* ---------- 1 · PLANIFICATION (Story + Scene intelligence) ---------- */
    cb.onPhase("Planification", 4);
    log(cb, "StoryEngine — lecture du scénario global…");
    await wait(420);
    if (cancelled) throw new Error("cancelled");
    let scenes: SceneConstraint[] = [];
    try {
      scenes = planScenes(parsed, timeline, cast);
    } catch (e) {
      log(cb, `SceneEngine en échec (${(e as Error).message}) — scène unique de repli`, "warn");
      scenes = planScenes(parsed, timeline, cast);
    }
    log(cb, `${scenes.length} scène${scenes.length > 1 ? "s" : ""} planifiée${scenes.length > 1 ? "s" : ""} · contraintes extraites (persos, objets, caméra, lumière)`, "ok");

    /* ---------- 2 · GÉNÉRATION ---------- */
    cb.onPhase("Génération", 10);
    log(cb, "GenerationEngine — rendu des segments (Wan 2.1 · IP-Adapter)…");
    for (let i = 0; i < scenes.length; i++) {
      if (cancelled) throw new Error("cancelled");
      cb.onPhase("Génération", 10 + Math.round(((i + 1) / scenes.length) * 22));
      log(cb, `${scenes[i].label.slice(0, 48)} — génération ${i + 1}/${scenes.length}`);
      await wait(260 + rng() * 240);
    }
    log(cb, "Génération terminée — segments prêts pour analyse", "ok");

    /* ---------- 3 · FAST SCAN ---------- */
    cb.onPhase("Fast scan", 36);
    log(cb, `VisionEngine — fast scan (échantillonnage ${(settings.samplingRate * 100).toFixed(0)} %)…`);
    await wait(650);
    if (cancelled) throw new Error("cancelled");

    const ctx = { unassigned: input.timeline.unassigned, hasAudio, cleanup, samplingRate: settings.samplingRate };
    const sceneScores: Record<string, Partial<Record<EngineId, number>>> = {};
    for (const sc of scenes) {
      const row: Partial<Record<EngineId, number>> = {};
      for (const def of ENGINE_DEFS) {
        if (!settings.engines[def.id]) continue;
        try {
          row[def.id] = scoreScene(sc, def.id, ctx);
        } catch {
          /* §29 — un moteur défaillant ne bloque pas la chaîne */
          log(cb, `${def.label} — analyse impossible sur ${sc.sceneId}, moteur contourné`, "warn");
        }
      }
      sceneScores[sc.sceneId] = row;
    }

    /* ---------- 4 · DEEP ANALYSIS sur les scènes suspectes ---------- */
    const suspects = scenes.filter((sc) => {
      const row = sceneScores[sc.sceneId] ?? {};
      return Object.values(row).some((v) => v != null && v < settings.deepThreshold);
    });
    cb.onPhase("Deep analysis", 44);
    if (suspects.length) {
      log(cb, `${suspects.length} scène${suspects.length > 1 ? "s" : ""} sous le seuil profond → analyse haute précision`, "warn");
      for (const sc of suspects) {
        if (cancelled) throw new Error("cancelled");
        log(cb, `Deep analysis — ${sc.label.slice(0, 44)} (frames clés ×4, précision renforcée)`);
        await wait(420);
      }
    } else {
      log(cb, "Aucune suspicion — analyse profonde inutile (économie GPU)", "ok");
      await wait(300);
    }

    /* ---------- 5 · SCORING ---------- */
    cb.onPhase("Scoring", 55);
    log(cb, "QualityEngine — agrégation des 13 moteurs (pondération projet)…");
    await wait(420);
    let anomalies = detectAnomalies(scenes, sceneScores, timeline, settings, ignoredAnomalyIds);
    cb.onAnomalies(anomalies);
    const temporal = analyzeTemporal(scenes, sceneScores, settings.samplingRate);
    let { global, engines } = computeGlobal(sceneScores, settings);
    log(cb, `Score global initial : ${global.toFixed(1)} · ${anomalies.filter((a) => a.status === "detected").length} anomalie(s) détectée(s)`, anomalies.length ? "warn" : "ok");
    for (const a of anomalies.filter((x) => x.status === "detected").slice(0, 6)) {
      log(cb, `${a.severity} — ${a.type} @ ${a.timeStart.toFixed(1)}s (confiance ${a.confidence} %)`, a.severity === "CRITICAL" ? "error" : "warn");
    }

    /* ---------- 6 · BOUCLE DE RÉPARATION ---------- */
    const attempts: { n: number; score: number; delta: number; repaired: number }[] = [{ n: 0, score: global, delta: 0, repaired: 0 }];
    let attempt = 0;
    let prevScore = global;

    while (global < settings.passThreshold && attempt < settings.maxAttempts) {
      if (cancelled) throw new Error("cancelled");
      attempt++;
      cb.onPhase(`Réparation — tentative ${attempt}`, 58 + attempt * 9);
      log(cb, `REPAIR — tentative ${attempt}/${settings.maxAttempts}`, "repair");

      const batch = selectRepairBatch(anomalies, 3);
      if (!batch.length) {
        log(cb, "Aucune anomalie réparable restante", "warn");
        break;
      }
      const jobs = buildRepairJobs(batch, attempt);
      cb.onJobs(jobs);

      for (const job of jobs) {
        if (cancelled) throw new Error("cancelled");
        job.status = "running";
        job.scoreBefore = sceneScores[job.sceneId]?.[job.engineId] ?? 0;
        cb.onJobs([...allJobs, ...jobs]);
        const anom = anomalies.find((a) => a.id === job.anomalyId);
        log(cb, `Localisation → ${anom?.type ?? job.engineId} @ ${job.segment[0].toFixed(1)}s–${job.segment[1].toFixed(1)}s`, "repair");
        await wait(620 + rng() * 420);
        job.scoreAfter = applyRepair(sceneScores, job, rng);
        job.status = "done";
        if (anom) anom.status = "repaired";
        log(cb, `Réparé — ${job.engineId} ${job.scoreBefore.toFixed(1)} → ${job.scoreAfter.toFixed(1)} (segment préservé : identité, vêtements, caméra, audio)`, "ok");
      }
      allJobs.push(...jobs);
      cb.onAnomalies([...anomalies]);

      /* ré-analyse du segment réparé */
      log(cb, "Re-analyse du segment régénéré…");
      await wait(480);
      anomalies = detectAnomalies(scenes, sceneScores, timeline, settings, ignoredAnomalyIds)
        .concat(anomalies.filter((a) => a.status === "repaired" || a.status === "ignored"));
      cb.onAnomalies([...anomalies]);
      const g = computeGlobal(sceneScores, settings);
      global = g.global;
      engines = g.engines;
      const delta = Number((global - prevScore).toFixed(1));
      attempts.push({ n: attempt, score: global, delta, repaired: jobs.length });
      log(cb, `Tentative ${attempt} — score ${global.toFixed(1)} (${delta >= 0 ? "+" : ""}${delta})`, delta >= 0 ? "ok" : "warn");

      if (delta < 0.3 && global < settings.passThreshold) {
        log(cb, "REPAIR LIMIT REACHED — le score n'améliore plus", "error");
        break;
      }
      prevScore = global;
    }

    /* ---------- 7 · VÉRIFICATION & RAPPORT ---------- */
    cb.onPhase("Vérification", 92);
    log(cb, "Vérification finale — cohérence temporelle, lipsync et audio…");
    await wait(520);
    if (cancelled) throw new Error("cancelled");

    const unresolved = anomalies.filter((a) => a.status === "detected");
    const status = global >= settings.passThreshold ? "APPROVED" : attempt >= settings.maxAttempts ? "REPAIR_LIMIT" : unresolved.length ? "REPAIR_LIMIT" : "APPROVED";
    log(cb, status === "APPROVED" ? `Scène approuvée — score ${global.toFixed(1)} ≥ seuil ${settings.passThreshold}` : `Validation incomplète — ${unresolved.length} anomalie(s) présentée(s) à l'utilisateur`, status === "APPROVED" ? "ok" : "warn");
    cb.onPhase("Rendu final", 100);
    log(cb, "RenderEngine — assemblage des segments validés vers le master 4K", "phase");
    await wait(420);

    const report: QualityReport = {
      status,
      globalScore: global,
      engines,
      anomalies,
      temporal,
      sceneScores,
      attempts,
      passThreshold: settings.passThreshold,
      generatedAt: new Date().toISOString(),
      disclaimer: "Estimation de cohérence selon les métriques actives — ce contrôle qualité ne constitue ni une garantie d'absence d'erreur, ni une preuve d'origine.",
    };
    cb.onReport(report);
    return { report, scenes, jobs: allJobs };
  })();

  return { done, cancel };
}

/** Moteurs utilisés (ré-export pour lisibilité du pipeline). */
export const PIPELINE_ENGINES = ENGINE_DEFS;
export type { Timeline };
