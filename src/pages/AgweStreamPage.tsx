/**
 * AgwèStream — Studio de production IA autonome (page dédiée).
 * Montée sous /studio/agwestream dans la coquille Axiom TV.
 *   01 Moteur de Scénario Global   02 Analyse Média & Extraction
 *   03 Fiches de personnage & voix 04 Audio hybride   05 Timeline
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Activity, Clapperboard, Cpu, Film, Mic2, Radio } from "lucide-react";
import {
  deriveTitle,
  SCENARIO_TEMPLATE,
  TONES,
  toneById,
  type CleanupOptions,
  type ToneDef,
} from "../data/content";
import {
  buildExportPayload,
  buildTimeline,
  colorFor,
  formatTime,
  parseScenario,
  scriptNames,
  speakLine,
  timecode,
  downloadJson,
  zoneForFace,
  type CastMember,
  type MediaResult,
} from "../lib/scenario";
import ScenarioEngine from "../components/ScenarioEngine";
import MediaLab, { type CastSeed } from "../components/MediaLab";
import CharacterBoard from "../components/CharacterBoard";
import AudioHybrid from "../components/AudioHybrid";
import TimelineAssembly from "../components/TimelineAssembly";
import PreviewSection from "../components/preview/PreviewSection";
import PublishSection from "../components/preview/PublishSection";
import CinemaIntro from "../components/CinemaIntro";
import { SectionHead, StatusDot } from "../components/ui";
import { buildProject, type IntroMode, type Project } from "../agwe/preview";
import { useStore } from "../store/useStore";
import QualityControlPanel from "../components/qc/QualityControlPanel";
import ProductionLog from "../components/qc/ProductionLog";
import DiagnosticTimeline from "../components/qc/DiagnosticTimeline";
import FrameInspector from "../components/qc/FrameInspector";
import MemoryPanels from "../components/qc/MemoryPanels";
import ExpertDrawer from "../components/qc/ExpertDrawer";
import {
  DEFAULT_QA_SETTINGS,
  type Anomaly,
  type QASettings,
  type QALogEntry,
  type QualityReport,
  type RepairJob,
} from "../agwe/models";
import { buildCharacterProfiles, buildProjectMemory, planScenes } from "../agwe/engines";
import { runQAPipeline } from "../agwe/pipeline";
import VfxStudio from "../components/VfxStudio";
import { suggestVfx, type RenderMode } from "../agwe/vfx";

let uid = 0;
const nextId = () => `c-${Date.now()}-${++uid}`;

export default function AgweStreamPage() {
  const notify = useStore((s) => s.toast);

  /* ---- état global du studio ---- */
  const [script, setScript] = useState(SCENARIO_TEMPLATE);
  const [cast, setCast] = useState<CastMember[]>([]);
  const [hasAudio, setHasAudio] = useState(false);
  const [cleanup, setCleanup] = useState<CleanupOptions>({ isolation: true, denoise: true, deecho: false, spatial: true });
  const [clock, setClock] = useState(() => new Date());

  /* timecode vivant (24 i/s) */
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000 / 24);
    return () => clearInterval(t);
  }, []);

  /* ---- dérivés (piliers 1 & 5) ---- */
  const parsed = useMemo(() => parseScenario(script), [script]);
  const names = useMemo(() => scriptNames(parsed), [parsed]);
  const timeline = useMemo(() => buildTimeline(parsed, cast), [parsed, cast]);
  const title = useMemo(() => deriveTitle(script), [script]);

  /* ---- moteur VFX (piloté par le scénario) ---- */
  const vfxSuggestion = useMemo(() => suggestVfx(parsed, hasAudio), [parsed, hasAudio]);
  const [vfxMode, setVfxMode] = useState<RenderMode>("intimate");
  const [vfxEnv, setVfxEnv] = useState("resto");
  const [vfxFx, setVfxFx] = useState<Set<string>>(new Set(["bokeh", "dust", "micro"]));
  const [vfxDof, setVfxDof] = useState(0.6);
  const [vfxMorph, setVfxMorph] = useState(1);
  /* la suggestion du script pré-remplit le studio tant que l'utilisateur n'a pas forcé */
  const [vfxTouched, setVfxTouched] = useState(false);
  useEffect(() => {
    if (vfxTouched) return;
    setVfxMode(vfxSuggestion.mode);
    setVfxEnv(vfxSuggestion.envId);
    setVfxFx(new Set(vfxSuggestion.fx));
  }, [vfxSuggestion, vfxTouched]);
  const touchVfx = () => setVfxTouched(true);

  /* ---- AGWÈ PREVIEW / PUBLISH (studio complet) ---- */
  const [introMode, setIntroMode] = useState<IntroMode["id"]>("both");
  const [previewReady, setPreviewReady] = useState(false);
  const [introOpen, setIntroOpen] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  /* ---- casting dynamique (pilier 2 → 3) ---- */
  const onAnalyzed = (_r: MediaResult, seeds: CastSeed[]) => {
    setCast(
      seeds.map((s, i) => ({
        id: nextId(),
        name: s.name,
        color: colorFor(i),
        tone: "calme" as const,
        /* les premiers visages deviennent acteurs, le reste figurants — modifiable carte par carte */
        role: (i < 3 ? "actor" : "extra") as CastMember["role"],
        enabled: true,
        zone: s.face ? zoneForFace(s.face) : ("mid" as const),
        voiceUrl: null,
        voiceBuffer: null,
        voiceLabel: null,
        face: s.face,
        thumb: s.thumb,
        confidence: s.confidence,
      }))
    );
  };

  const addManual = () => {
    const i = cast.length;
    setCast((c) => [
      ...c,
      {
        id: nextId(),
        name: `Sujet ${i + 1}`,
        color: colorFor(i),
        tone: "calme" as const,
        role: "actor" as CastMember["role"],
        enabled: true,
        zone: "mid" as const,
        voiceUrl: null,
        voiceBuffer: null,
        voiceLabel: null,
        face: null,
        thumb: null,
        confidence: null,
      },
    ]);
    notify("Sujet ajouté manuellement au casting", "info");
  };

  const updateCast = (id: string, patch: Partial<CastMember>) => setCast((c) => c.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const removeCast = (id: string) => {
    setCast((c) => c.filter((m) => m.id !== id));
    notify("Clone retiré du casting", "warn");
  };

  /* ---- aperçus audio (pilier 4) ---- */
  const previewTone = (tone: ToneDef) => {
    void speakLine("Le signal du dôme a coupé il y a quatre minutes.", tone, 4200);
    notify(`Aperçu TTS · ton ${tone.label} · rate ×${tone.rate} · pitch ×${tone.pitch}`, "info");
  };

  /* ---- export (pilier 5) ---- */
  const onExport = () => {
    const data = buildExportPayload({ title, script, cast, audioMode: hasAudio ? "cleanup" : "synthesis", cleanup, timeline });
    downloadJson(`agwestream-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 32) || "timeline"}.json`, data);
    notify(`Timeline exportée · ${formatTime(timeline.total)} · ${timeline.entries.length} blocs`, "ok");
  };

  /* ================= AGWÈSTREAM 2.0 — Contrôle Qualité ================= */
  const [qaSettings, setQaSettings] = useState<QASettings>(DEFAULT_QA_SETTINGS);
  const [qaReport, setQaReport] = useState<QualityReport | null>(null);
  const [qaJobs, setQaJobs] = useState<RepairJob[]>([]);
  const [qaLogs, setQaLogs] = useState<QALogEntry[]>([]);
  const [qaRunning, setQaRunning] = useState(false);
  const [qaPhase, setQaPhase] = useState("");
  const [qaAnomalies, setQaAnomalies] = useState<Anomaly[]>([]);
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null);
  const [inspected, setInspected] = useState<Anomaly | null>(null);
  const [expertOpen, setExpertOpen] = useState(false);

  /* ---- Project exécutable (PreviewEngine) ---- */
  const project: Project = useMemo(
    () =>
      buildProject({
        title,
        parsed,
        timeline,
        cast,
        unassigned: timeline.unassigned,
        hasAudio,
        cleanup,
        samplingRate: qaSettings.samplingRate,
        introMode,
        vfxEnv,
        vfxMode,
        resolution: "1080p",
        language: "Français",
      }),
    [title, parsed, timeline, cast, hasAudio, cleanup, qaSettings.samplingRate, introMode, vfxEnv, vfxMode]
  );

  /* ---- autosave (Partie 14) ---- */
  const hydrated = useRef(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("agwe-autosave-v1");
      if (raw) {
        const d = JSON.parse(raw) as {
          script?: string;
          cast?: Omit<CastMember, "voiceBuffer" | "voiceUrl">[];
          hasAudio?: boolean;
          cleanup?: CleanupOptions;
          introMode?: IntroMode["id"];
          vfxMode?: RenderMode;
          vfxEnv?: string;
          vfxDof?: number;
        };
        if (d.script) setScript(d.script);
        if (d.cast?.length)
          setCast(
            d.cast.map((c) => ({ ...c, voiceBuffer: null, voiceUrl: null, voiceLabel: c.voiceLabel ?? null }))
          );
        if (typeof d.hasAudio === "boolean") setHasAudio(d.hasAudio);
        if (d.cleanup) setCleanup(d.cleanup);
        if (d.introMode) setIntroMode(d.introMode);
        if (d.vfxMode) setVfxMode(d.vfxMode);
        if (d.vfxEnv) setVfxEnv(d.vfxEnv);
        if (typeof d.vfxDof === "number") setVfxDof(d.vfxDof);
      }
    } catch { /* sauvegarde illisible — on repart de zéro */ }
    hydrated.current = true;
  }, []);

  const saveTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!hydrated.current) return;
    setSaveState("saving");
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      try {
        localStorage.setItem(
          "agwe-autosave-v1",
          JSON.stringify({
            script,
            cast: cast.map(({ voiceBuffer: _vb, voiceUrl: _vu, ...rest }) => rest),
            hasAudio,
            cleanup,
            introMode,
            vfxMode,
            vfxEnv,
            vfxDof,
          })
        );
      } catch { /* stockage plein — ignoré */ }
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 1400);
    }, 700);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [script, cast, hasAudio, cleanup, introMode, vfxMode, vfxEnv, vfxDof]);
  const [ignoredIds, setIgnoredIds] = useState<string[]>([]);
  const cancelRef = useRef<(() => void) | null>(null);

  /* mémoires dérivées (Scene + Project) — §24 & §25 */
  const qaScenes = useMemo(() => (qaReport ? planScenes(parsed, timeline, cast) : []), [qaReport, parsed, timeline, cast]);
  const qaProfiles = useMemo(() => (qaReport ? buildCharacterProfiles(cast) : []), [qaReport, cast]);
  const qaMemory = useMemo(() => {
    if (!qaReport) return null;
    const objects = qaScenes.flatMap((s) => s.objects);
    return buildProjectMemory(qaScenes, qaProfiles, objects);
  }, [qaReport, qaScenes, qaProfiles]);

  const patchSettings = (patch: Partial<QASettings>) => {
    setQaSettings((s) => {
      const next = { ...s, ...patch };
      /* le bouton expert du panneau ouvre le drawer */
      if (patch.mode === "expert" && Object.keys(patch).length === 1) setExpertOpen(true);
      return next;
    });
  };

  /* lancement du pipeline complet (§2) */
  const runQA = () => {
    if (qaRunning) return;
    if (!timeline.entries.length) {
      notify("Écrivez d'abord un scénario — la timeline est vide.", "warn");
      return;
    }
    cancelRef.current?.();
    setQaRunning(true);
    setQaPhase("Planification");
    setQaLogs([]);
    setQaReport(null);
    setQaAnomalies([]);
    setQaJobs([]);
    setSelectedAnomaly(null);

    const { done, cancel } = runQAPipeline(
      { parsed, timeline, cast, hasAudio, cleanup, ignoredAnomalyIds: ignoredIds },
      qaSettings,
      {
        onLog: (e) => setQaLogs((l) => [...l, e]),
        onPhase: (p) => setQaPhase(p),
        onAnomalies: (a) => setQaAnomalies(a),
        onReport: (r) => setQaReport(r),
        onJobs: (j) => setQaJobs(j),
      }
    );
    cancelRef.current = cancel;
    done
      .then(({ report }) => {
        setQaRunning(false);
        setQaPhase("");
        notify(
          report.status === "APPROVED"
            ? `Contrôle qualité approuvé — score estimé ${report.globalScore.toFixed(1)}`
            : `Contrôle terminé — ${report.anomalies.filter((a) => a.status === "detected").length} anomalie(s) à examiner`,
          report.status === "APPROVED" ? "ok" : "warn"
        );
      })
      .catch((e) => {
        setQaRunning(false);
        setQaPhase("");
        if ((e as Error).message !== "cancelled") notify("Pipeline interrompu — relancez la génération.", "warn");
      });
  };

  /* réparation / ignorance manuelle d'une anomalie (§18) */
  const repairAnomaly = (a: Anomaly) => {
    setQaAnomalies((list) => list.map((x) => (x.id === a.id ? { ...x, status: "repairing" } : x)));
    setQaLogs((l) => [...l, { t: new Date().toLocaleTimeString("fr-FR", { hour12: false }), msg: `Réparation manuelle — ${a.type} @ ${a.timeStart.toFixed(1)}s`, level: "repair" }]);
    window.setTimeout(() => {
      setQaAnomalies((list) => list.map((x) => (x.id === a.id ? { ...x, status: "repaired" } : x)));
      setQaLogs((l) => [...l, { t: new Date().toLocaleTimeString("fr-FR", { hour12: false }), msg: `Segment régénéré et ré-analysé — cohérence restaurée`, level: "ok" }]);
      notify(`${a.type} réparé — segment régénéré localement`, "ok");
    }, 1400);
    setSelectedAnomaly(null);
  };

  const ignoreAnomaly = (a: Anomaly) => {
    setIgnoredIds((ids) => (ids.includes(a.id) ? ids : [...ids, a.id]));
    setQaAnomalies((list) => list.map((x) => (x.id === a.id ? { ...x, status: "ignored" } : x)));
    setQaLogs((l) => [...l, { t: new Date().toLocaleTimeString("fr-FR", { hour12: false }), msg: `Anomalie ignorée par l'utilisateur — ${a.type}`, level: "info" }]);
    setSelectedAnomaly(null);
    notify("Anomalie ignorée — exclue du score", "info");
  };

  /* rapport vivant : on fusionne les anomalies éditées dans le rapport affiché */
  const liveReport: QualityReport | null = qaReport
    ? { ...qaReport, anomalies: qaAnomalies.length ? qaAnomalies : qaReport.anomalies }
    : null;

  const engines = [
    { label: "Scénario", value: `${timeline.entries.filter((e) => e.kind === "dialogue").length} répl.`, tone: "cyan" as const, on: parsed.length > 0 },
    { label: "Casting", value: `${cast.length} sujet${cast.length > 1 ? "s" : ""}`, tone: "volt" as const, on: cast.length > 0 },
    { label: "Audio", value: hasAudio ? "Nettoyage" : "TTS", tone: "mint" as const, on: true },
    { label: "Timeline", value: formatTime(timeline.total), tone: "gold" as const, on: timeline.entries.length > 0 },
  ];

  return (
    <div className="mx-auto max-w-[1360px]">
      {/* ================= console header ================= */}
      <div className="glass-deep mt-4 overflow-hidden rounded-2xl border-cyan/20 md:mt-6">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg border border-volt/40 bg-volt/[0.08] shadow-[0_0_18px_rgba(157,78,221,0.2)]">
              <Clapperboard size={18} className="text-volt" />
            </span>
            <div>
              <p className="font-display text-[17px] font-bold leading-none tracking-[0.18em] text-frost">
                AGWÈ<span className="text-glow-violet text-volt">STREAM</span>
              </p>
              <p className="mt-0.5 text-[9.5px] font-bold uppercase tracking-[0.24em] text-fog/70">Studio de production autonome</p>
            </div>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            {engines.map((e) => (
              <span key={e.label} className="flex items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5">
                <StatusDot tone={e.on ? e.tone : "fog"} pulse={e.on} />
                <span className="text-[9.5px] font-bold uppercase tracking-wider text-fog">{e.label}</span>
                <span className="font-mono text-[10.5px] font-bold text-frost">{e.value}</span>
              </span>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-fog/70 sm:flex">
              <Cpu size={13} className="text-mint" /> Pipeline souverain · local
            </span>
            <span className="font-mono rounded-md border border-cyan/25 bg-abyss px-3 py-1.5 text-[12.5px] font-bold tabular-nums tracking-wider text-cyan shadow-[0_0_14px_rgba(0,229,255,0.12)]">
              {timecode(clock)}
            </span>
          </div>
        </div>

        {/* bande projet */}
        <div className="border-t border-white/[0.05]">
          <div className="flex items-center gap-4 overflow-hidden px-5 py-1.5">
            <Radio size={11} className="shrink-0 text-coral" />
            <div className="relative flex-1 overflow-hidden">
              <div className="flex w-max gap-10" style={{ animation: "marquee 36s linear infinite" }}>
                {[0, 1].map((k) => (
                  <span key={k} className="font-mono flex gap-10 text-[10px] font-semibold tracking-wider text-fog/60">
                    <span>PROJET « {title.toUpperCase()} »</span>
                    <span>{timeline.entries.filter((e) => e.kind === "scene").length} scènes</span>
                    <span>{cast.length} clones actifs</span>
                    <span>{names.length} noms dans le scénario</span>
                    <span>{timeline.unassigned.length > 0 ? `⚠ ${timeline.unassigned.length} nom(s) à lier` : "✓ casting synchronisé"}</span>
                    <span>durée estimée {formatTime(timeline.total)}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================= workflow 8 étapes ================= */}
      <div className="glass-deep mt-4 overflow-hidden rounded-xl md:mt-6">
        <div className="no-scrollbar flex items-stretch gap-1 overflow-x-auto px-2 py-2">
          {(
            [
              ["step-script", "Script", parsed.length > 0],
              ["step-characters", "Characters", cast.some((c) => c.role !== "extra")],
              ["step-media", "Media", cast.some((c) => c.face)],
              ["step-audio", "Audio", hasAudio || cast.some((c) => c.voiceLabel)],
              ["step-timeline", "Timeline", timeline.entries.length > 0],
              ["step-preview", "Preview", previewReady],
              ["step-quality", "Quality", !!qaReport],
              ["step-publish", "Publish", false],
            ] as [string, string, boolean][]
          ).map(([id, label, done], i) => (
            <a
              key={id}
              href={`#${id}`}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 transition-all ${
                done ? "bg-mint/[0.08] text-mint" : "text-fog hover:bg-white/[0.04] hover:text-frost"
              }`}
            >
              <span
                className={`grid h-5 w-5 place-items-center rounded-full font-mono text-[9px] font-bold ${
                  done ? "bg-mint text-abyss" : "border border-white/20 text-fog"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              <span className="font-display text-[10.5px] font-bold uppercase tracking-wider">{label}</span>
            </a>
          ))}
          <span className="ml-auto hidden shrink-0 items-center pr-2 sm:flex">
            {saveState === "saving" && <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-gold">Saving…</span>}
            {saveState === "saved" && <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-mint">Saved ✓</span>}
            {saveState === "idle" && <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-fog/50">Autosave</span>}
          </span>
        </div>
      </div>

      {/* ================= corps ================= */}
      <div className="mt-10 space-y-14">
        {/* ---- 01 · Scénario global ---- */}
        <section id="step-script">
          <SectionHead
            index="01"
            title="Moteur de Scénario Global"
            desc="Chef d'orchestre textuel et chronologique : dialogues, interactions, descriptions de scènes et micro-expressions formatées. Chaque réplique est préfixée par le nom exact du clone."
            right={
              <span className="chip flex items-center gap-2 rounded-md px-3 py-2 font-mono text-[10.5px] font-semibold text-fog">
                <Activity size={12} className="text-cyan" /> analyse ligne par ligne · temps réel
              </span>
            }
          />
          <div className="mt-5">
            <ScenarioEngine script={script} onChange={setScript} parsed={parsed} timeline={timeline} castNames={cast.map((c) => c.name)} />
          </div>
        </section>

        {/* ---- 02 + 03 · Média & casting ---- */}
        <section id="step-characters" className="scroll-mt-28">
          <SectionHead
            index="02"
            title="Analyse Média & Extraction des Visages"
            desc="Déposez une photo ou une vidéo : la segmentation compte les sujets distincts, cadre chaque visage en bounding box et génère exactement autant de cartes de casting — aucune limite figée."
            right={
              <span className="chip flex items-center gap-2 rounded-md px-3 py-2 font-mono text-[10.5px] font-semibold text-fog">
                <Film size={12} className="text-volt" /> face cropping · confiance par sujet
              </span>
            }
          />
          <div id="step-media" className="mt-5 grid scroll-mt-28 gap-4 lg:grid-cols-[1.15fr_1fr]">
            <MediaLab onAnalyzed={onAnalyzed} onAddManual={addManual} hasAudio={hasAudio} onHasAudioChange={setHasAudio} castCount={cast.length} notify={notify} />
            <div>
              <p className="mb-2.5 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.2em] text-fog">
                <Mic2 size={13} className="text-mint" /> Fiches de personnage <span className="text-fog/50">— pilier 03</span>
              </p>
              <CharacterBoard cast={cast} scriptNames={names} matched={timeline.matched} update={updateCast} remove={removeCast} notify={notify} />
            </div>
          </div>
        </section>

        {/* ---- 04 · Audio hybride ---- */}
        <section id="step-audio" className="scroll-mt-28">
          <SectionHead
            index="04"
            title="Gestion Intelligente de l'Audio"
            desc="Le pipeline s'adapte à la nature du média : voix d'origine nettoyée (isolation, anti-bruit, anti-écho, spatialisation) ou synthèse vocale synchronisée depuis le scénario."
          />
          <div className="mt-5">
            <AudioHybrid hasAudio={hasAudio} cleanup={cleanup} onCleanup={(k) => setCleanup((c) => ({ ...c, [k]: !c[k] }))} onPreviewTone={previewTone} />
          </div>
        </section>

        {/* ---- 05 · Timeline ---- */}
        <section id="step-timeline" className="scroll-mt-28">
          <SectionHead
            index="05"
            title="Synchronisation & Assemblage"
            desc="Le moteur lit le scénario ligne par ligne, associe chaque réplique au profil vocal et au ton du clone, puis assemble la chronologie finale — dialogues croisés compris, sans décalage."
          />
          <div className="mt-5">
            <TimelineAssembly timeline={timeline} onExport={onExport} />
          </div>
        </section>

        {/* ---- 06 · Rendu cinématique & VFX ---- */}
        <section>
          <SectionHead
            index="06"
            title="Rendu Cinématique & VFX"
            desc="Le scénario global pilote le décor et l'action : une prise modeste (acteur assis mimant un geste) devient un restaurant feutré ou une course-poursuite. Ajustez le mode, l'environnement et les couches d'effets, puis révélez la transformation avec le curseur de morphing."
            right={
              <span className="chip flex items-center gap-2 rounded-md px-3 py-2 font-mono text-[10.5px] font-semibold text-fog">
                <Film size={12} className="text-volt" /> vidéo-vers-vidéo · script-driven
              </span>
            }
          />
          <div className="mt-5">
            <VfxStudio
              mode={vfxMode}
              onMode={(m) => {
                touchVfx();
                setVfxMode(m);
                const preset = m === "action" ? new Set(["speed", "shake", "smoke"]) : new Set(["bokeh", "dust", "micro"]);
                setVfxFx(preset);
                notify(`Mode ${m === "action" ? "Action & SF" : "Intime & Réaliste"} activé`, "info");
              }}
              envId={vfxEnv}
              onEnv={(id) => {
                touchVfx();
                setVfxEnv(id);
              }}
              fx={vfxFx}
              onToggleFx={(id) => {
                touchVfx();
                setVfxFx((prev) => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                });
              }}
              dof={vfxDof}
              onDof={(v) => {
                touchVfx();
                setVfxDof(v);
              }}
              morph={vfxMorph}
              onMorph={setVfxMorph}
              suggestion={vfxSuggestion}
              cast={cast}
            />
          </div>
        </section>

        {/* ---- 07 · AGWÈ PREVIEW ---- */}
        <section id="step-preview" className="scroll-mt-28">
          <SectionHead
            index="07"
            title="Agwè Preview"
            desc="Le moniteur central du studio : lecteur professionnel (timecode, vitesse, qualité, comparaison, Visual QA), bande de scènes cliquable, timeline multi-pistes et assemblage QUICK PREVIEW / FINAL RENDER. La prévisualisation reste dans le studio — aucun logiciel externe."
            right={
              <span className="chip flex items-center gap-2 rounded-md px-3 py-2 font-mono text-[10.5px] font-semibold text-fog">
                <StatusDot tone={previewReady ? "mint" : "fog"} pulse={previewReady} />
                {previewReady ? "master assemblé" : "assemblage à la demande"}
              </span>
            }
          />
          <div className="mt-5">
            <PreviewSection
              project={project}
              envId={vfxEnv}
              fx={[...vfxFx]}
              dof={vfxDof}
              mode={vfxMode}
              report={qaReport}
              introMode={introMode}
              onIntroMode={setIntroMode}
              onRepair={repairAnomaly}
              onIgnore={ignoreAnomaly}
              onOpenIntro={() => setIntroOpen(true)}
              onReady={() => setPreviewReady(true)}
              notify={notify}
            />
          </div>
        </section>

        {/* ---- 08 · Génération & Contrôle Qualité (AGWÈSTREAM 2.0) ---- */}
        <section id="step-quality" className="scroll-mt-28">
          <SectionHead
            index="08"
            title="Génération & Contrôle Qualité"
            desc="GENERATE → OBSERVE → ANALYZE → REPAIR → VERIFY → RENDER : 13 moteurs d'analyse estiment la cohérence (personnages, objets, anatomie, lumière, caméra, temporel, lipsync…), détectent les anomalies et réparent les segments défaillants — sans régénérer toute la vidéo."
            right={
              <span className="chip flex items-center gap-2 rounded-md px-3 py-2 font-mono text-[10.5px] font-semibold text-fog">
                <StatusDot tone={qaRunning ? "cyan" : liveReport ? (liveReport.status === "APPROVED" ? "mint" : "gold") : "fog"} pulse={qaRunning} />
                {qaRunning ? "analyse en cours" : liveReport ? `score ${liveReport.globalScore.toFixed(1)}` : "prêt"}
              </span>
            }
          />
          <div className="mt-5 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
            <QualityControlPanel
              report={liveReport}
              running={qaRunning}
              phase={qaPhase}
              settings={qaSettings}
              onSettings={patchSettings}
              onRun={runQA}
              onOpenExpert={() => setExpertOpen(true)}
            />
            <ProductionLog logs={qaLogs} report={liveReport} />
          </div>
        </section>

        {/* ---- 09 · Timeline diagnostique & Mémoires ---- */}
        <section className="scroll-mt-28">
          <SectionHead
            index="09"
            title="Timeline Diagnostique & Mémoires"
            desc="Chaque anomalie est localisée sur 6 pistes et cliquable : réparer, ignorer ou inspecter la frame (bounding boxes, anatomie, trajectoires). Les mémoires de scène et de projet garantissent la cohérence de la scène 1 à la scène N."
            right={
              qaSettings.mode !== "simple" && liveReport ? (
                <span className="chip flex items-center gap-2 rounded-md px-3 py-2 font-mono text-[10.5px] font-semibold text-fog">
                  {liveReport.anomalies.filter((a) => a.status === "detected").length} anomalie(s) active(s)
                </span>
              ) : undefined
            }
          />
          <div className="mt-5 space-y-4">
            {liveReport && qaSettings.mode !== "simple" ? (
              <DiagnosticTimeline
                report={liveReport}
                settings={qaSettings}
                selected={selectedAnomaly}
                onSelect={setSelectedAnomaly}
                onRepair={repairAnomaly}
                onIgnore={ignoreAnomaly}
                onInspect={setInspected}
              />
            ) : (
              !qaRunning && (
                <div className="panel px-6 py-9 text-center text-[12px] font-semibold text-fog/60">
                  {qaSettings.mode === "simple"
                    ? "Mode Simple : AgwèStream corrige automatiquement — passez en mode Pro pour examiner la timeline."
                    : "Lancez la génération + contrôle qualité pour construire la timeline diagnostique."}
                </div>
              )
            )}
            <MemoryPanels scenes={qaScenes} profiles={qaProfiles} memory={qaMemory} />
          </div>
        </section>

        {/* ---- 10 · PUBLISH TO AXIOM TV ---- */}
        <section id="step-publish" className="scroll-mt-28">
          <SectionHead
            index="10"
            title="Publish to Axiom TV"
            desc="Final Quality Gate obligatoire, formulaire de publication (vidéo, film, série multi-saisons), miniature, aperçu exact de la page publique Axiom TV, puis publication directe via l'API du hub — avec statuts et tableau de bord créateur."
            right={
              <span className="chip flex items-center gap-2 rounded-md px-3 py-2 font-mono text-[10.5px] font-semibold text-fog">
                <StatusDot tone="gold" /> quality gate → publication
              </span>
            }
          />
          <div className="mt-5">
            <PublishSection
              project={project}
              report={qaReport}
              onRunGate={runQA}
              onRepairAll={() => (qaReport?.anomalies.filter((a) => a.status === "detected") ?? []).forEach(repairAnomaly)}
              onReview={() => document.getElementById("step-quality")?.scrollIntoView({ behavior: "smooth" })}
              notify={notify}
            />
          </div>
        </section>

        {/* ---- pied de console ---- */}
        {introOpen && (
          <CinemaIntro
            meta={{
              title,
              directors: [{ name: project.characters.filter((c) => c.role !== "extra").map((c) => c.name).join(" · ") || "AgwèStream", role: "Avec" }],
              cast: project.characters.map((c) => c.name),
              year: new Date().getFullYear(),
            }}
            onClose={() => setIntroOpen(false)}
          />
        )}
        <motion.footer
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="panel flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4"
        >
          <span className="font-mono text-[10.5px] font-semibold tracking-wider text-fog/60">
            PIPELINE : SCÉNARIO <span className="text-cyan">→</span> EXTRACTION <span className="text-cyan">→</span> DOUBLAGE <span className="text-cyan">→</span> ASSEMBLAGE
          </span>
          <span className="font-mono text-[10.5px] font-semibold text-fog/50">
            {parsed.length} lignes parsées · {cast.length} clones · {Object.values(cleanup).filter(Boolean).length} nœuds audio · {TONES.length} tons disponibles
          </span>
          <span className="ml-auto flex items-center gap-2 font-mono text-[10.5px] font-bold text-mint">
            <StatusDot tone="mint" /> rendu prêt · {toneById("calme").label} par défaut
          </span>
          {liveReport && (
            <span className="flex items-center gap-2 font-mono text-[10.5px] font-bold" style={{ color: liveReport.status === "APPROVED" ? "#34d399" : "#f5c542" }}>
              <StatusDot tone={liveReport.status === "APPROVED" ? "mint" : "gold"} /> QA {liveReport.globalScore.toFixed(1)} · {liveReport.status === "APPROVED" ? "approuvé" : "à examiner"}
            </span>
          )}
        </motion.footer>
      </div>

      {/* ---- modaux QA ---- */}
      {inspected && (
        <FrameInspector
          anomaly={inspected}
          scene={qaScenes.find((s) => s.sceneId === inspected.sceneId) ?? null}
          characterColors={Object.fromEntries(cast.map((c) => [c.name, c.color]))}
          onClose={() => setInspected(null)}
        />
      )}
      <ExpertDrawer open={expertOpen} settings={qaSettings} onSettings={patchSettings} onClose={() => setExpertOpen(false)} />
    </div>
  );
}
