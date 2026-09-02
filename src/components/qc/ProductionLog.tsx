/**
 * Journal de production (§27) + historique des tentatives de réparation (§20).
 */
import { useEffect, useRef } from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { QALogEntry, QualityReport } from "../../agwe/models";

const LEVEL_STYLE: Record<QALogEntry["level"], string> = {
  info: "text-fog",
  ok: "text-mint",
  warn: "text-gold",
  error: "text-coral",
  repair: "text-volt",
  phase: "text-cyan",
};

const LEVEL_TAG: Record<QALogEntry["level"], string> = {
  info: "·",
  ok: "✓",
  warn: "⚠",
  error: "✕",
  repair: "↻",
  phase: "▶",
};

export default function ProductionLog({ logs, report }: { logs: QALogEntry[]; report: QualityReport | null }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs.length]);

  return (
    <div className="panel flex h-full min-h-[420px] flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <span className="font-display text-[11px] font-bold uppercase tracking-[0.24em] text-volt">Journal de production</span>
        <span className="font-mono text-[9.5px] font-semibold text-fog/60">{logs.length} événement(s)</span>
      </div>

      {/* tentatives de réparation */}
      {report && report.attempts.length > 1 && (
        <div className="border-b border-white/[0.06] px-4 py-3">
          <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-fog/70">Auto-regeneration loop</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {report.attempts.map((a) => (
              <span
                key={a.n}
                className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-mono text-[10.5px] font-bold tabular-nums ${
                  a.n === 0 ? "border-white/10 bg-white/[0.03] text-fog" : a.delta >= 0 ? "border-mint/40 bg-mint/[0.06] text-mint" : "border-coral/40 bg-coral/[0.06] text-coral"
                }`}
              >
                {a.n === 0 ? "Initial" : `T${a.n}`}
                <span className="text-frost">{a.score.toFixed(1)}</span>
                {a.n > 0 &&
                  (a.delta > 0 ? <ArrowUp size={10} /> : a.delta < 0 ? <ArrowDown size={10} /> : <Minus size={10} />)}
              </span>
            ))}
            {report.status === "REPAIR_LIMIT" && (
              <span className="rounded-md border border-gold/40 bg-gold/[0.08] px-2.5 py-1.5 font-mono text-[9.5px] font-bold uppercase tracking-wider text-gold">
                repair limit reached
              </span>
            )}
            {report.status === "APPROVED" && (
              <span className="rounded-md border border-mint/40 bg-mint/[0.08] px-2.5 py-1.5 font-mono text-[9.5px] font-bold uppercase tracking-wider text-mint">
                pass
              </span>
            )}
          </div>
        </div>
      )}

      {/* terminal */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3 font-mono text-[10.5px] leading-[1.7]" style={{ scrollbarWidth: "thin" }}>
        {logs.length === 0 && <p className="text-fog/50">En attente de génération — les événements du pipeline s'afficheront ici.</p>}
        {logs.map((l, i) => (
          <p key={i} className="flex gap-2">
            <span className="shrink-0 text-fog/40">[{l.t}]</span>
            <span className={`shrink-0 ${LEVEL_STYLE[l.level]}`}>{LEVEL_TAG[l.level]}</span>
            <span className={LEVEL_STYLE[l.level] === "text-fog" ? "text-fog/90" : LEVEL_STYLE[l.level]}>{l.msg}</span>
          </p>
        ))}
        <span className="mt-1 inline-block h-3 w-2 animate-pulse bg-cyan/70" />
      </div>
    </div>
  );
}
