/**
 * AGWÈ QUALITY CONTROL — tableau de bord du contrôle qualité.
 * Trois niveaux utilisateur (§31) : SIMPLE · PRO · EXPERT.
 */
import { motion } from "framer-motion";
import { AlertTriangle, Check, Loader2, RotateCw, Settings2, X } from "lucide-react";
import { ENGINE_DEFS, type QASettings, type QualityReport, type UserMode } from "../../agwe/models";
import { StatusDot } from "../ui";

const MODES: { id: UserMode; label: string; desc: string }[] = [
  { id: "simple", label: "Simple", desc: "AgwèStream analyse et corrige automatiquement" },
  { id: "pro", label: "Pro", desc: "Scores, erreurs, timeline et réparations visibles" },
  { id: "expert", label: "Expert", desc: "Seuils, moteurs, sampling et pondération" },
];

function statusGlyph(status: string) {
  switch (status) {
    case "pass":
      return { icon: <Check size={12} />, cls: "text-mint" };
    case "warning":
      return { icon: <AlertTriangle size={12} />, cls: "text-gold" };
    default:
      return { icon: <X size={12} />, cls: "text-coral" };
  }
}

const PHASE_COLOR: Record<string, string> = {
  APPROVED: "#34d399",
  REPAIR_LIMIT: "#f5c542",
  FAILED: "#ff5d73",
};

export default function QualityControlPanel({
  report,
  running,
  phase,
  settings,
  onSettings,
  onRun,
  onOpenExpert,
}: {
  report: QualityReport | null;
  running: boolean;
  phase: string;
  settings: QASettings;
  onSettings: (patch: Partial<QASettings>) => void;
  onRun: () => void;
  onOpenExpert?: () => void;
}) {
  const mode = settings.mode;
  const resolved = report && !running;
  const globalTone = !report ? "#8b98ab" : report.globalScore >= report.passThreshold ? "#34d399" : report.globalScore >= report.passThreshold - 6 ? "#f5c542" : "#ff5d73";

  return (
    <div className="panel flex h-full flex-col overflow-hidden">
      {/* header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.06] px-4 py-3">
        <span className="font-display text-[11px] font-bold uppercase tracking-[0.24em] text-cyan">Agwè Quality Control</span>
        <span className={`flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-wider ${running ? "border-cyan/40 bg-cyan/[0.07] text-cyan" : resolved ? "border-white/10 bg-white/[0.03] text-fog" : "border-white/10 text-fog/60"}`}>
          {running ? <Loader2 size={10} className="animate-spin" /> : <StatusDot tone={running ? "cyan" : report ? (report.status === "APPROVED" ? "mint" : "gold") : "fog"} pulse={running} />}
          {running ? phase || "Analyse…" : report ? report.status.replace("_", " ") : "Idle"}
        </span>

        {/* sélecteur de mode */}
        <div className="ml-auto flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
          {MODES.map((m) => (
            <button
              key={m.id}
              title={m.desc}
              onClick={() => onSettings({ mode: m.id })}
              className={`rounded-md px-3 py-1.5 font-display text-[10px] font-bold uppercase tracking-wider transition-all ${
                mode === m.id ? "bg-cyan/15 text-cyan shadow-[0_0_12px_rgba(0,229,255,0.2)]" : "text-fog hover:text-frost"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => onOpenExpert?.()}
          title="Réglages des moteurs (seuils, pondération, sampling)"
          className={`grid h-8 w-8 place-items-center rounded-md border transition-colors ${
            mode === "expert" ? "border-cyan/40 bg-cyan/10 text-cyan" : "border-white/10 text-fog hover:text-frost"
          }`}
          aria-label="Réglages expert"
        >
          <Settings2 size={14} />
        </button>
      </div>

      {/* corps */}
      <div className="flex-1 p-4">
        {!report && !running && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <p className="max-w-md text-[12.5px] leading-relaxed text-fog">
              Générez la vidéo : AgwèStream planifie les scènes, rend les segments, puis lance le
              contrôle qualité complet — <span className="text-frost">13 moteurs d'analyse</span>, détection
              d'anomalies et <span className="text-frost">réparation localisée automatique</span>.
            </p>
            <button onClick={onRun} className="btn-neon flex items-center gap-2 rounded-lg px-6 py-3 font-display text-[12px] font-bold uppercase tracking-wider">
              <RotateCw size={14} /> Générer + contrôle qualité
            </button>
          </div>
        )}

        {running && (
          <div className="flex h-full flex-col items-center justify-center gap-5">
            <div className="relative h-24 w-24">
              <span className="absolute inset-0 rounded-full border-2 border-white/[0.07]" />
              <span className="absolute inset-0 rounded-full border-2 border-transparent" style={{ borderTopColor: "#00e5ff", animation: "spin 1s linear infinite" }} />
              <span className="absolute inset-0 grid place-items-center font-mono text-[11px] font-bold text-cyan">●</span>
            </div>
            <div className="text-center">
              <p className="font-mono text-[12px] font-bold tracking-wider text-frost">{phase || "Initialisation…"}</p>
              <p className="mt-1 text-[10.5px] font-semibold text-fog">GENERATE → OBSERVE → ANALYZE → REPAIR → VERIFY → RENDER</p>
            </div>
            <div className="h-1.5 w-64 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="flowbar h-full rounded-full transition-[width] duration-500" style={{ width: `${runningPct(phase)}%` }} />
            </div>
          </div>
        )}

        {report && !running && (
          <div className="grid gap-4 md:grid-cols-[150px_1fr]">
            {/* jauge globale */}
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-white/[0.07] bg-abyss/60 py-4">
              <div className="relative h-[104px] w-[104px]">
                <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8" />
                  <motion.circle
                    cx="50" cy="50" r="42" fill="none" stroke={globalTone} strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 42}
                    initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
                    animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - report.globalScore / 100) }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    style={{ filter: `drop-shadow(0 0 6px ${globalTone})` }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <motion.span
                    key={report.globalScore}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="font-display text-[26px] font-bold leading-none"
                    style={{ color: globalTone }}
                  >
                    {report.globalScore.toFixed(1)}
                  </motion.span>
                  <span className="font-mono text-[8px] font-bold uppercase tracking-widest text-fog">global</span>
                </div>
              </div>
              <span className="font-mono rounded-md px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-widest" style={{ color: PHASE_COLOR[report.status] ?? "#8b98ab", background: `${PHASE_COLOR[report.status] ?? "#8b98ab"}14` }}>
                {report.status === "APPROVED" ? "✓ Ready" : report.status === "REPAIR_LIMIT" ? "⚠ Review" : report.status}
              </span>
              <span className="font-mono text-[9px] font-semibold text-fog/60">seuil {report.passThreshold}</span>
            </div>

            {/* les 13 moteurs */}
            <div>
              {mode === "simple" ? (
                <div className="flex h-full flex-col justify-center gap-3">
                  <p className="text-[13px] font-semibold text-frost">
                    {report.status === "APPROVED"
                      ? `Vidéo validée automatiquement — score estimé ${report.globalScore.toFixed(1)}.`
                      : "La vidéo nécessite votre attention — passez en mode Pro pour examiner les anomalies."}
                  </p>
                  <p className="text-[11.5px] leading-relaxed text-fog">
                    {report.anomalies.filter((a) => a.status === "repaired").length} anomalie(s) corrigée(s) automatiquement ·{" "}
                    {report.anomalies.filter((a) => a.status === "detected").length} restante(s) · {report.attempts.length - 1} tentative(s) de réparation.
                  </p>
                  <p className="font-mono text-[9.5px] font-semibold text-fog/60">{report.disclaimer}</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-x-5 gap-y-2 xl:grid-cols-2">
                  {report.engines.map((e, i) => {
                    const g = statusGlyph(e.status);
                    return (
                      <motion.div
                        key={e.engineId}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="flex items-center gap-2.5"
                      >
                        <span className={`shrink-0 ${g.cls}`}>{g.icon}</span>
                        <span className="w-[74px] shrink-0 font-mono text-[10px] font-bold uppercase tracking-wider text-fog">{e.label}</span>
                        <span className="h-[5px] flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                          <motion.span
                            className="block h-full rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${e.score}%` }}
                            transition={{ duration: 0.7, delay: i * 0.04, ease: "easeOut" }}
                            style={{ background: e.status === "pass" ? "#34d399" : e.status === "warning" ? "#f5c542" : "#ff5d73" }}
                          />
                        </span>
                        <span className={`w-9 shrink-0 text-right font-mono text-[11px] font-bold tabular-nums ${e.status === "pass" ? "text-frost" : e.status === "warning" ? "text-gold" : "text-coral"}`}>
                          {e.score.toFixed(1)}
                        </span>
                      </motion.div>
                    );
                  })}
                  <p className="col-span-full mt-1 font-mono text-[9.5px] font-semibold text-fog/60">{report.disclaimer}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* pied : action */}
      <div className="flex items-center gap-3 border-t border-white/[0.06] px-4 py-3">
        <button onClick={onRun} disabled={running} className="btn-neon flex items-center gap-2 rounded-lg px-5 py-2.5 font-display text-[11px] font-bold uppercase tracking-wider disabled:opacity-50">
          {running ? <Loader2 size={13} className="animate-spin" /> : <RotateCw size={13} />}
          {report ? "Relancer génération + QA" : "Générer + QA"}
        </button>
        {report && !running && (
          <span className="font-mono text-[10px] font-semibold text-fog/70">
            {report.anomalies.filter((a) => a.status === "detected").length} ouverte(s) · {report.anomalies.filter((a) => a.status === "repaired").length} réparée(s) · {report.attempts.length - 1} tentative(s)
          </span>
        )}
        <span className="ml-auto hidden font-mono text-[9.5px] font-semibold text-fog/50 sm:block">
          {ENGINE_DEFS.filter((e) => settings.engines[e.id]).length}/13 moteurs actifs
        </span>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function runningPct(phase: string): number {
  if (/planif/i.test(phase)) return 8;
  if (/g[ée]n[ée]ration/i.test(phase)) return 30;
  if (/fast/i.test(phase)) return 40;
  if (/deep/i.test(phase)) return 48;
  if (/scoring/i.test(phase)) return 56;
  if (/r[ée]paration/i.test(phase)) return 74;
  if (/v[ée]rif/i.test(phase)) return 92;
  if (/rendu/i.test(phase)) return 100;
  return 12;
}
