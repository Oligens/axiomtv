/**
 * AGWÈ PREVIEW — Timeline interactive multi-pistes.
 * VIDEO · AUDIO · VOICE · MUSIC · LIPSYNC · SUBTITLES · EFFECTS · QUALITY.
 * Chaque bloc est cliquable (seek) ; chaque anomalie ouvre le panneau
 * QUALITY ISSUE avec REPAIR / IGNORE / VIEW DETAILS.
 */
import { useMemo, useState } from "react";
import { AlertTriangle, Wrench, EyeOff, ScanEye, X } from "lucide-react";
import { fmtTimecode, type Project } from "../../agwe/preview";
import type { Anomaly, QualityReport } from "../../agwe/models";

interface Props {
  project: Project;
  report: QualityReport | null;
  playhead: number;
  onSeek: (t: number) => void;
  onRepair: (a: Anomaly) => void;
  onIgnore: (a: Anomaly) => void;
  onViewFrame: (a: Anomaly) => void;
}

interface Block {
  start: number;
  duration: number;
  label: string;
  color: string;
  warn?: boolean;
}

const PPS = 14; // px par seconde

function Track({ name, blocks, accent, playhead, total, onSeek }: { name: string; blocks: Block[]; accent: string; playhead: number; total: number; onSeek: (t: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono w-[86px] shrink-0 text-[9.5px] font-bold uppercase tracking-widest text-fog">{name}</span>
      <div className="relative h-8 flex-1 overflow-hidden rounded-md border border-white/[0.06] bg-abyss/70">
        {/* graduations */}
        {Array.from({ length: Math.ceil(total / 5) + 1 }).map((_, i) => (
          <span key={i} className="absolute top-0 h-full w-px bg-white/[0.05]" style={{ left: i * 5 * PPS }} />
        ))}
        {blocks.map((b, i) => (
          <button
            key={i}
            onClick={() => onSeek(b.start)}
            title={`${b.label} · ${fmtTimecode(b.start)}`}
            className="absolute top-[5px] flex h-[22px] items-center gap-1 overflow-hidden rounded-[4px] border px-1.5 transition-all hover:brightness-125"
            style={{
              left: b.start * PPS,
              width: Math.max(26, b.duration * PPS - 2),
              borderColor: `${b.color}55`,
              background: `linear-gradient(180deg, ${b.color}2e, ${b.color}10)`,
            }}
          >
            {b.warn && <AlertTriangle size={9} className="shrink-0 text-gold" />}
            <span className="truncate text-[8.5px] font-bold uppercase tracking-wide" style={{ color: b.color }}>
              {b.label}
            </span>
          </button>
        ))}
        {playhead >= 0 && <span className="pointer-events-none absolute inset-y-0 w-[2px] bg-cyan shadow-[0_0_8px_rgba(0,229,255,0.8)]" style={{ left: playhead * PPS }} />}
      </div>
    </div>
  );
}

export default function TimelinePreview({ project, report, playhead, onSeek, onRepair, onIgnore, onViewFrame }: Props) {
  const [sel, setSel] = useState<Anomaly | null>(null);

  const anomalies = useMemo(() => (report?.anomalies ?? []).filter((a) => a.status === "detected"), [report]);
  const scenesIn = (s: (typeof project.scenes)[number]) => ({ start: s.start, duration: s.end - s.start, label: `SC ${String(s.index + 1).padStart(2, "0")}`, color: "#00e5ff" });

  const tracks: { name: string; accent: string; blocks: Block[] }[] = useMemo(() => {
    const dialogues: Block[] = project.dialogues.map((d) => ({ start: d.start, duration: d.duration, label: d.character, color: d.color }));
    const effects: Block[] = project.scenes.flatMap((s) => s.actions.map((a, i) => ({ start: s.start + (i * (s.end - s.start)) / Math.max(1, s.actions.length), duration: 1.6, label: a.action, color: "#f5c542" })));
    const quality: Block[] = project.scenes.map((s) => ({
      start: s.start,
      duration: s.end - s.start,
      label: `${s.quality.toFixed(0)}`,
      color: s.quality >= 92 ? "#34d399" : s.quality >= 85 ? "#f5c542" : "#ff5d73",
      warn: anomalies.some((a) => a.sceneId === s.sceneId),
    }));
    const audioBed: Block[] = [{ start: project.introOffset, duration: Math.max(0, project.total - project.introOffset), label: "BED −18 LUFS", color: "#8b98ab" }];
    const music: Block[] = project.scenes
      .filter((_, i) => i % 2 === 0)
      .map((s) => ({ start: s.start, duration: s.end - s.start, label: "SCORE", color: "#9d4edd" }));
    return [
      { name: "Video", accent: "#00e5ff", blocks: project.scenes.map(scenesIn) },
      { name: "Audio", accent: "#8b98ab", blocks: audioBed },
      { name: "Voice", accent: "#34d399", blocks: dialogues },
      { name: "Music", accent: "#9d4edd", blocks: music },
      { name: "Lipsync", accent: "#34d399", blocks: dialogues.map((d) => ({ ...d, label: `LS ${d.label}` })) },
      { name: "Subtitles", accent: "#e8eef7", blocks: dialogues.map((d) => ({ ...d, label: "CC" })) },
      { name: "Effects", accent: "#f5c542", blocks: effects },
      { name: "Quality", accent: "#ff5d73", blocks: quality },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, anomalies]);

  const width = Math.max(700, project.total * PPS + 130);

  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-2.5">
        <span className="eyebrow text-volt">Timeline de production</span>
        <span className="font-mono text-[10px] font-semibold text-fog">8 pistes · clic = seek · {anomalies.length} anomalie{anomalies.length > 1 ? "s" : ""} active{anomalies.length > 1 ? "s" : ""}</span>
        <span className="font-mono ml-auto rounded-md border border-coral/40 bg-coral/[0.08] px-2 py-1 text-[9.5px] font-bold uppercase tracking-wider text-coral">
          {anomalies.length} ⚠
        </span>
      </div>

      <div className="no-scrollbar overflow-x-auto p-4">
        <div style={{ width }} className="space-y-1.5">
          {tracks.map((tr) => (
            <Track key={tr.name} name={tr.name} blocks={tr.blocks} accent={tr.accent} playhead={playhead} total={project.total} onSeek={onSeek} />
          ))}

          {/* piste des anomalies */}
          <div className="flex items-center gap-3 pt-1">
            <span className="font-mono w-[86px] shrink-0 text-[9.5px] font-bold uppercase tracking-widest text-coral">Issues</span>
            <div className="relative h-9 flex-1 rounded-md border border-coral/25 bg-coral/[0.03]">
              {anomalies.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setSel(a)}
                  className="absolute top-[6px] flex h-[24px] items-center gap-1.5 rounded-[4px] border border-coral/60 bg-coral/[0.14] px-2 text-[8.5px] font-bold uppercase tracking-wide text-coral transition-all hover:bg-coral/[0.28] hover:shadow-[0_0_12px_rgba(255,93,115,0.4)]"
                  style={{ left: a.timeStart * PPS }}
                  title={`${a.type} · ${fmtTimecode(a.timeStart)}`}
                >
                  <AlertTriangle size={10} /> {a.severity}
                </button>
              ))}
              {playhead >= 0 && <span className="pointer-events-none absolute inset-y-0 w-[2px] bg-cyan" style={{ left: playhead * PPS }} />}
            </div>
          </div>

          {/* règle temporelle */}
          <div className="flex items-center gap-3">
            <span className="w-[86px] shrink-0" />
            <div className="relative h-4 flex-1">
              {Array.from({ length: Math.ceil(project.total / 5) + 1 }).map((_, i) => (
                <span key={i} className="font-mono absolute top-0 text-[8px] font-bold text-fog/50" style={{ left: i * 5 * PPS }}>
                  {fmtTimecode(i * 5).slice(3)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ---- QUALITY ISSUE ---- */}
      {sel && (
        <div className="fixed inset-0 z-[85] grid place-items-center bg-abyss/85 p-4 backdrop-blur-sm" onClick={() => setSel(null)}>
          <div className="panel panel-raised w-full max-w-[420px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-coral/30 bg-coral/[0.07] px-5 py-3">
              <p className="font-display flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.2em] text-coral">
                <AlertTriangle size={15} /> Quality Issue
              </p>
              <button onClick={() => setSel(null)} className="grid h-7 w-7 place-items-center rounded-md text-fog hover:text-frost" aria-label="Fermer">
                <X size={14} />
              </button>
            </div>
            <div className="space-y-3 px-5 py-4">
              {(
                [
                  ["Timecode", fmtTimecode(sel.timeStart)],
                  ["Type", sel.type],
                  ["Character", sel.character ?? "—"],
                  ["Severity", sel.severity],
                  ["Confidence", `${Math.round(sel.confidence * 100)}%`],
                ] as [string, string][]
              ).map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-4 border-b border-white/[0.05] pb-2">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-fog">{k}</span>
                  <span className={`font-mono text-[12.5px] font-bold ${k === "Severity" ? (sel.severity === "CRITICAL" || sel.severity === "HIGH" ? "text-coral" : "text-gold") : "text-frost"}`}>{v}</span>
                </div>
              ))}
              <p className="text-[12px] leading-relaxed text-fog">{sel.description}</p>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => {
                    onRepair(sel);
                    setSel(null);
                  }}
                  className="btn-neon flex flex-1 items-center justify-center gap-1.5 rounded-md py-2.5 text-[11px] font-bold uppercase tracking-wider"
                >
                  <Wrench size={12} /> Repair
                </button>
                <button
                  onClick={() => {
                    onIgnore(sel);
                    setSel(null);
                  }}
                  className="btn-ghost flex flex-1 items-center justify-center gap-1.5 rounded-md py-2.5 text-[11px] font-bold uppercase tracking-wider text-fog"
                >
                  <EyeOff size={12} /> Ignore
                </button>
                <button
                  onClick={() => {
                    onViewFrame(sel);
                    setSel(null);
                  }}
                  className="btn-ghost flex flex-1 items-center justify-center gap-1.5 rounded-md py-2.5 text-[11px] font-bold uppercase tracking-wider text-fog"
                >
                  <ScanEye size={12} /> View
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
