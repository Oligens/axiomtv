/**
 * AGWÈ PREVIEW — zone de prévisualisation permanente du studio.
 * Assemble le Project, pilote le lecteur professionnel, la bande de scènes,
 * la timeline multi-pistes et les modes QUICK PREVIEW / FINAL RENDER.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Zap, Film, Info } from "lucide-react";
import {
  fmtClock,
  INTRO_MODES,
  makeThumbnail,
  type IntroMode,
  type Project,
  type RenderOpts,
} from "../../agwe/preview";
import type { Anomaly, QualityReport } from "../../agwe/models";
import type { RenderMode } from "../../agwe/vfx";
import PreviewPlayer, { type GeneratingState } from "./PreviewPlayer";
import TimelinePreview from "./TimelinePreview";

interface Props {
  project: Project;
  envId: string;
  fx: string[];
  dof: number;
  mode: RenderMode;
  report: QualityReport | null;
  introMode: IntroMode["id"];
  onIntroMode: (m: IntroMode["id"]) => void;
  onRepair: (a: Anomaly) => void;
  onIgnore: (a: Anomaly) => void;
  onOpenIntro: () => void;
  onReady: () => void;
  notify: (msg: string, kind?: "ok" | "warn" | "info") => void;
}

const BAR_LABELS = ["FRAME ANALYSIS", "CHARACTER CONSISTENCY", "TEMPORAL ANALYSIS", "AUDIO", "LIPSYNC"];

export default function PreviewSection({ project, envId, fx, dof, mode, report, introMode, onIntroMode, onRepair, onIgnore, onOpenIntro, onReady, notify }: Props) {
  const [generating, setGenerating] = useState<GeneratingState | null>(null);
  const [previewReady, setPreviewReady] = useState(false);
  const [renderMode, setRenderMode] = useState<"quick" | "final" | null>(null);
  const [playhead, setPlayhead] = useState(0);
  const [activeScene, setActiveScene] = useState(0);
  const timersRef = useRef<number[]>([]);

  useEffect(() => () => timersRef.current.forEach((t) => clearInterval(t)), []);

  const opts: RenderOpts = useMemo(() => ({ fx, dof, quality: 1, captions: true, envOverride: envId }), [fx, dof, envId]);

  /* miniatures de scènes */
  const thumbs = useMemo(
    () =>
      project.scenes.map((s) => ({
        id: s.sceneId,
        url: makeThumbnail(project, { source: "extract", time: (s.start + s.end) / 2, zoom: 1, offsetX: 0, offsetY: 0, uploadUrl: null }, opts, 320, 180),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [project, envId]
  );

  /* ---- simulation d'assemblage (quick / final) ---- */
  const startAssembly = (kind: "quick" | "final") => {
    if (generating) return;
    setRenderMode(kind);
    setPreviewReady(false);
    const steps = kind === "quick" ? 16 : 26;
    let step = 0;
    const target = project.globalScore ?? 95;
    const iv = window.setInterval(() => {
      step += 1;
      const p = Math.min(1, step / steps);
      setGenerating({
        label: kind === "quick" ? "QUICK PREVIEW" : "FINAL RENDER",
        sceneIndex: Math.min(project.scenes.length - 1, Math.floor(p * project.scenes.length)),
        bars: BAR_LABELS.map((label, i) => ({
          label,
          value: Math.min(100, Math.max(0, (p - i * 0.09) * 130)),
        })),
        score: target * Math.min(1, p * 1.25),
      });
      if (step >= steps) {
        clearInterval(iv);
        setGenerating(null);
        setPreviewReady(true);
        onReady();
        notify(
          kind === "quick"
            ? "Quick preview assemblée — lecture disponible (résolution adaptée)"
            : "Final render assemblé — paramètres définitifs du projet",
          "ok"
        );
      }
    }, kind === "quick" ? 170 : 240);
    timersRef.current.push(iv);
  };

  const seekScene = (i: number) => {
    const s = project.scenes[i];
    if (!s) return;
    setActiveScene(i);
    setPlayhead(s.start + 0.02);
  };

  const scene = project.scenes[activeScene];
  const genre = mode === "action" ? "Action / Science-Fiction" : "Drame intimiste";

  return (
    <div className="space-y-4">
      {/* barre d'actions preview */}
      <div className="panel flex flex-wrap items-center gap-3 px-4 py-3">
        <button
          onClick={() => startAssembly("quick")}
          disabled={!!generating || project.scenes.length === 0}
          className="btn-ghost flex items-center gap-2 rounded-md px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-wider text-fog"
          title="Assemblage rapide — priorité vitesse"
        >
          <Zap size={13} className="text-gold" /> Quick Preview
        </button>
        <button
          onClick={() => startAssembly("final")}
          disabled={!!generating || project.scenes.length === 0}
          className="btn-neon flex items-center gap-2 rounded-md px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-wider"
          title="Assemblage définitif — priorité qualité"
        >
          <Film size={13} /> Final Render
        </button>

        <span className={`flex items-center gap-2 rounded-md border px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wider ${previewReady ? "border-mint/45 bg-mint/[0.08] text-mint" : "border-white/10 text-fog"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${previewReady ? "bg-mint shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-fog/50"}`} />
          {previewReady ? (renderMode === "final" ? "MASTER PRÊT" : "PREVIEW PRÊTE") : "EN ATTENTE D'ASSEMBLAGE"}
        </span>

        {/* réglage intro */}
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[9.5px] font-bold uppercase tracking-wider text-fog">Intro</span>
          {INTRO_MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => onIntroMode(m.id)}
              className={`rounded-md border px-2.5 py-1.5 text-[10px] font-bold transition-all ${
                introMode === m.id ? "border-volt/60 bg-volt/[0.14] text-[#c78bf0] shadow-[0_0_12px_rgba(157,78,221,0.25)]" : "border-white/10 text-fog hover:text-frost"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        {/* colonne lecteur + timeline */}
        <div className="min-w-0 space-y-4">
          <PreviewPlayer
            project={project}
            generating={generating}
            envId={envId}
            fx={fx}
            dof={dof}
            mode={mode}
            report={report}
            onOpenIntro={onOpenIntro}
            externalPlayhead={playhead}
            onSeek={setPlayhead}
          />
          <TimelinePreview
            project={project}
            report={report}
            playhead={playhead}
            onSeek={(t) => setPlayhead(t)}
            onRepair={onRepair}
            onIgnore={onIgnore}
            onViewFrame={(a) => {
              setPlayhead(a.timeStart);
              notify(`Frame ${a.timeStart.toFixed(2)} s chargée — activez Visual QA pour l'inspecter`, "info");
            }}
          />
        </div>

        {/* colonne infos + scènes */}
        <div className="space-y-4">
          {/* PROJECT */}
          <div className="panel p-4">
            <p className="eyebrow flex items-center gap-2 text-cyan">
              <Info size={13} /> Project
            </p>
            <p className="font-cine mt-2 text-[19px] font-bold leading-tight text-frost">« {project.title} »</p>
            <dl className="mt-3 space-y-1.5">
              {(
                [
                  ["Genre", genre],
                  ["Durée", fmtClock(project.total)],
                  ["Scènes", String(project.scenes.length)],
                  ["Personnages", String(project.characters.filter((c) => c.role !== "extra").length)],
                  ["Figurants", String(project.characters.filter((c) => c.role === "extra").length)],
                  ["Langue", project.language],
                  ["Résolution", project.resolution],
                  ["Framerate", `${project.fps} fps`],
                  ["Audio", project.dialogues.length ? `${project.dialogues.length} répliques TTS` : "Muet"],
                  ["Quality", project.globalScore ? `${project.globalScore.toFixed(1)}%` : "—"],
                ] as [string, string][]
              ).map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3 border-b border-white/[0.05] pb-1.5">
                  <dt className="font-mono text-[9.5px] font-bold uppercase tracking-wider text-fog">{k}</dt>
                  <dd className={`font-mono text-[11.5px] font-bold ${k === "Quality" ? "text-mint" : "text-frost"}`}>{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* SCENES */}
          <div className="panel p-4">
            <p className="eyebrow text-volt">Scene Preview</p>
            <div className="mt-3 max-h-[430px] space-y-2.5 overflow-y-auto pr-1" style={{ scrollbarWidth: "thin" }}>
              {project.scenes.length === 0 && <p className="py-6 text-center text-[11.5px] font-semibold text-fog/60">Aucune scène — écrivez le scénario global.</p>}
              {project.scenes.map((s, i) => (
                <button
                  key={s.sceneId}
                  onClick={() => seekScene(i)}
                  className={`group flex w-full gap-3 rounded-lg border p-2 text-left transition-all ${
                    activeScene === i ? "border-cyan/55 bg-cyan/[0.06] shadow-[0_0_16px_rgba(0,229,255,0.12)]" : "border-white/[0.07] bg-white/[0.02] hover:border-white/20"
                  }`}
                >
                  <div className="relative h-[52px] w-[92px] shrink-0 overflow-hidden rounded-md border border-white/10">
                    {thumbs[i] && <img src={thumbs[i].url} alt={`Scene ${s.index + 1}`} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />}
                    <span className="font-mono absolute left-1 top-1 rounded-sm bg-abyss/85 px-1 text-[8px] font-bold text-cyan">SC {String(s.index + 1).padStart(2, "0")}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[11px] font-bold text-frost">{s.label}</span>
                      <span
                        className={`flex shrink-0 items-center gap-1 rounded-sm px-1.5 py-px font-mono text-[8.5px] font-bold uppercase ${
                          s.status === "READY" ? "bg-mint/12 text-mint" : s.status === "REVIEW" ? "bg-gold/12 text-gold" : "bg-coral/12 text-coral"
                        }`}
                      >
                        {s.status === "READY" ? "✓" : s.status === "REVIEW" ? "⚠" : "✕"} {s.status}
                      </span>
                    </div>
                    <p className="font-mono mt-1 text-[9px] font-semibold text-fog">
                      {fmtClock(s.end - s.start)} · {s.characters.slice(0, 2).join(", ") || "—"}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-[4px] flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${s.quality}%`,
                            background: s.quality >= 92 ? "#34d399" : s.quality >= 85 ? "#f5c542" : "#ff5d73",
                          }}
                        />
                      </div>
                      <span className="font-mono text-[9px] font-bold text-fog">{s.quality.toFixed(1)}%</span>
                    </div>
                    <p className="font-mono mt-1 truncate text-[8.5px] font-semibold text-fog/60">
                      objets : {s.objects.map((o) => o.type).slice(0, 3).join(", ") || "—"} · {s.dialogueCount} répl.
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      {scene && <span className="hidden">{scene.sceneId}</span>}
    </div>
  );
}
