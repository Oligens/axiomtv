/**
 * Timeline diagnostique (§21) — 6 pistes + marqueurs d'anomalies cliquables.
 * Chaque anomalie ouvre son détail : [RÉPARER] [IGNORER] [VOIR LA FRAME].
 */
import { motion } from "framer-motion";
import { AlertTriangle, Eye, RotateCw, X } from "lucide-react";
import { formatTime } from "../../lib/scenario";
import type { Anomaly, QASettings, QualityReport } from "../../agwe/models";

const TRACKS = [
  { id: "video", label: "VIDEO", color: "#00e5ff" },
  { id: "audio", label: "AUDIO", color: "#9d4edd" },
  { id: "lipsync", label: "LIPSYNC", color: "#f5c542" },
  { id: "character", label: "CHARACTER", color: "#34d399" },
  { id: "objects", label: "OBJECTS", color: "#60a5fa" },
  { id: "quality", label: "QUALITY", color: "#ff5d73" },
];

const ENGINE_TO_TRACK: Record<string, string> = {
  character: "character", face: "character", anatomy: "character", clothing: "character",
  objects: "objects", motion: "video", physics: "video", lighting: "video", camera: "video", text: "video",
  temporal: "quality", lipsync: "lipsync", audio: "audio",
};

const SEV_STYLE: Record<Anomaly["severity"], { bg: string; label: string }> = {
  CRITICAL: { bg: "#ff5d73", label: "Critical" },
  HIGH: { bg: "#f59e0b", label: "High" },
  MEDIUM: { bg: "#f5c542", label: "Medium" },
  LOW: { bg: "#8b98ab", label: "Low" },
};

export default function DiagnosticTimeline({
  report,
  settings,
  selected,
  onSelect,
  onRepair,
  onIgnore,
  onInspect,
}: {
  report: QualityReport;
  settings: QASettings;
  selected: Anomaly | null;
  onSelect: (a: Anomaly | null) => void;
  onRepair: (a: Anomaly) => void;
  onIgnore: (a: Anomaly) => void;
  onInspect: (a: Anomaly) => void;
}) {
  const total = Math.max(1, ...Object.values(report.sceneScores).map(() => 0), report.anomalies.length ? Math.max(...report.anomalies.map((a) => a.timeEnd)) : 10);
  const pps = 100 / total;
  const ticks: number[] = [];
  for (let s = 0; s <= total; s += Math.max(1, Math.round(total / 8))) ticks.push(s);

  const temporalBad = new Set(report.temporal.filter((t) => t.drift > 0).map((t) => t.sceneId));

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.06] px-4 py-3">
        <span className="font-display text-[11px] font-bold uppercase tracking-[0.24em] text-gold">Timeline diagnostique</span>
        <span className="font-mono text-[9.5px] font-semibold text-fog/60">
          {report.anomalies.filter((a) => a.status === "detected").length} marker(s) actif(s) — cliquez pour examiner
        </span>
        <div className="ml-auto flex items-center gap-3">
          {(["detected", "repaired", "ignored"] as const).map((st) => (
            <span key={st} className="flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-wider text-fog/70">
              <span className={`h-2 w-2 rounded-full ${st === "detected" ? "bg-coral" : st === "repaired" ? "bg-mint" : "bg-fog/40"}`} />
              {st}
            </span>
          ))}
        </div>
      </div>

      <div className="no-scrollbar overflow-x-auto p-4">
        <div className="min-w-[720px]">
          {/* règle */}
          <div className="relative ml-[92px] h-6 border-b border-white/[0.07]">
            {ticks.map((s) => (
              <span key={s} className="absolute top-0 h-full border-l border-white/[0.08]" style={{ left: `${s * pps}%` }}>
                <span className="font-mono absolute left-1 top-0.5 text-[8.5px] font-semibold text-fog/60">{formatTime(s)}</span>
              </span>
            ))}
          </div>

          {/* pistes */}
          {TRACKS.map((track) => {
            const markers = report.anomalies.filter((a) => ENGINE_TO_TRACK[a.engineId] === track.id && a.status !== "ignored");
            return (
              <div key={track.id} className="flex items-center border-b border-white/[0.04]">
                <span className="font-mono w-[92px] shrink-0 py-2.5 pr-3 text-right text-[9px] font-bold tracking-widest text-fog/70">{track.label}</span>
                <div className="relative h-9 flex-1">
                  {/* barre de contenu */}
                  <div className="absolute inset-y-[11px] left-0 right-0 overflow-hidden rounded-[3px]" style={{ background: `${track.color}14`, border: `1px solid ${track.color}2e` }}>
                    <div className="h-full w-full" style={{ background: `repeating-linear-gradient(90deg, ${track.color}22 0 14px, transparent 14px 18px)` }} />
                  </div>
                  {/* alerte qualité dérivée de la dérive temporelle */}
                  {track.id === "quality" &&
                    report.temporal.filter((t) => t.drift > 0).map((t, i) => (
                      <span key={i} className="absolute top-0.5 text-[9px] text-gold" style={{ left: `${(i + 0.5) * (100 / Math.max(1, report.temporal.length))}%` }}>
                        ▲
                      </span>
                    ))}
                  {/* marqueurs */}
                  {markers.map((a) => {
                    const sev = SEV_STYLE[a.severity];
                    const isSel = selected?.id === a.id;
                    const repaired = a.status === "repaired";
                    return (
                      <motion.button
                        key={a.id}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 420, damping: 22 }}
                        onClick={() => onSelect(isSel ? null : a)}
                        title={`${a.type} @ ${formatTime(a.timeStart)}`}
                        className={`absolute top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full border-2 transition-all ${
                          isSel ? "z-10 scale-125" : "hover:scale-110"
                        }`}
                        style={{
                          left: `calc(${a.timeStart * pps}% - 10px)`,
                          background: repaired ? "#34d39922" : `${sev.bg}26`,
                          borderColor: repaired ? "#34d399" : sev.bg,
                          boxShadow: isSel ? `0 0 14px ${sev.bg}` : `0 0 8px ${sev.bg}66`,
                        }}
                      >
                        {repaired ? <span className="h-1.5 w-1.5 rounded-full bg-mint" /> : <AlertTriangle size={10} style={{ color: sev.bg }} />}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* détail d'anomalie */}
        {selected && (
          <motion.div
            key={selected.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="mt-4 rounded-lg border p-4"
            style={{ borderColor: `${SEV_STYLE[selected.severity].bg}55`, background: `${SEV_STYLE[selected.severity].bg}0a` }}
          >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <span className="font-mono text-[15px] font-bold tabular-nums text-frost">{formatTime(selected.timeStart)}</span>
              <span className="font-display text-[11px] font-bold uppercase tracking-wider" style={{ color: SEV_STYLE[selected.severity].bg }}>
                {selected.type}
              </span>
              <span className="font-mono text-[10px] font-semibold text-fog">
                {selected.character ? `Personnage : ${selected.character} · ` : ""}
                {selected.object ? `${selected.object} · ` : ""}
                Confiance {selected.confidence} % (estimée)
              </span>
              <span
                className="ml-auto rounded-md px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest"
                style={{ color: SEV_STYLE[selected.severity].bg, background: `${SEV_STYLE[selected.severity].bg}18` }}
              >
                {SEV_STYLE[selected.severity].label} · {selected.status}
              </span>
            </div>
            <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-fog">{selected.description}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {selected.status === "detected" && (
                <>
                  <button onClick={() => onRepair(selected)} className="btn-neon flex items-center gap-1.5 rounded-md px-4 py-2 font-display text-[10.5px] font-bold uppercase tracking-wider">
                    <RotateCw size={12} /> Réparer
                  </button>
                  <button onClick={() => onIgnore(selected)} className="btn-ghost flex items-center gap-1.5 rounded-md px-4 py-2 font-display text-[10.5px] font-bold uppercase tracking-wider text-fog">
                    <X size={12} /> Ignorer
                  </button>
                </>
              )}
              <button onClick={() => onInspect(selected)} className="btn-ghost flex items-center gap-1.5 rounded-md border-volt/40 px-4 py-2 font-display text-[10.5px] font-bold uppercase tracking-wider text-volt hover:border-volt">
                <Eye size={12} /> Voir la frame
              </button>
            </div>
          </motion.div>
        )}

        {temporalBad.size > 0 && !selected && (
          <p className="font-mono mt-3 text-[9.5px] font-semibold text-fog/60">
            ▲ dérive temporelle signalée sur {temporalBad.size} scène(s) — markers sur la piste QUALITY.
          </p>
        )}
      </div>
    </div>
  );
}
