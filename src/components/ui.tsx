/**
 * AgwèStream — kit UI transversal.
 */
import type { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Info, AlertTriangle } from "lucide-react";

/* ---------- En-tête de section numérotée ---------- */
export function SectionHead({
  index,
  title,
  desc,
  right,
}: {
  index: string;
  title: string;
  desc: string;
  right?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4"
    >
      <div className="flex items-end gap-4">
        <span className="font-display pointer-events-none select-none text-[52px] font-bold leading-[0.8] text-white/[0.07] sm:text-[68px]">
          {index}
        </span>
        <div className="-ml-2">
          <h2 className="font-display text-[22px] font-bold tracking-tight text-frost sm:text-[27px]">{title}</h2>
          <p className="mt-1 max-w-xl text-[12.5px] leading-relaxed text-fog">{desc}</p>
        </div>
      </div>
      {right && <div className="flex items-center gap-2.5">{right}</div>}
    </motion.div>
  );
}

/* ---------- Pastille d'état ---------- */
export function StatusDot({ tone = "cyan", pulse = true }: { tone?: "cyan" | "volt" | "gold" | "mint" | "coral" | "fog"; pulse?: boolean }) {
  const c =
    tone === "cyan" ? "#00e5ff" : tone === "volt" ? "#9d4edd" : tone === "gold" ? "#f5c542" : tone === "mint" ? "#34d399" : tone === "coral" ? "#ff5d73" : "#8b98ab";
  return (
    <span className="relative inline-flex h-2 w-2 shrink-0">
      {pulse && <span className="absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: c, animation: "boxPing 1.6s cubic-bezier(0,0,0.2,1) infinite" }} />}
      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: c, boxShadow: `0 0 8px ${c}` }} />
    </span>
  );
}

/* ---------- Interrupteur ---------- */
export function Switch({ on, onChange, label, accent = "#00e5ff" }: { on: boolean; onChange: () => void; label: string; accent?: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className="relative h-6 w-11 shrink-0 rounded-full border transition-all duration-300"
      style={{
        borderColor: on ? accent : "rgba(255,255,255,0.15)",
        background: on ? `${accent}26` : "rgba(255,255,255,0.05)",
        boxShadow: on ? `0 0 14px ${accent}40` : "none",
      }}
    >
      <span
        className="absolute top-[3px] h-[16px] w-[16px] rounded-full transition-all duration-300"
        style={{ left: on ? 24 : 3, background: on ? accent : "#8b98ab", boxShadow: on ? `0 0 10px ${accent}` : "none" }}
      />
    </button>
  );
}

/* ---------- Alerte inline ---------- */
export function Note({ kind = "info", children }: { kind?: "info" | "warn" | "ok"; children: ReactNode }) {
  const cfg =
    kind === "warn"
      ? { icon: <AlertTriangle size={13} />, cls: "border-gold/40 bg-gold/[0.06] text-gold" }
      : kind === "ok"
        ? { icon: <Check size={13} />, cls: "border-mint/40 bg-mint/[0.06] text-mint" }
        : { icon: <Info size={13} />, cls: "border-cyan/35 bg-cyan/[0.05] text-cyan" };
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-[11.5px] font-semibold leading-relaxed ${cfg.cls}`}>
      <span className="mt-0.5 shrink-0">{cfg.icon}</span>
      <span>{children}</span>
    </div>
  );
}

/* ---------- Toasts ---------- */
export interface Toast {
  id: number;
  msg: string;
  kind: "ok" | "warn" | "info";
}

export function ToastStack({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[90] flex w-[min(92vw,380px)] flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            layout
            initial={{ opacity: 0, x: 46, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 34, scale: 0.96 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            onClick={() => onDismiss(t.id)}
            className="pointer-events-auto flex items-center gap-3 rounded-lg border border-white/10 bg-raised/95 px-4 py-3 text-left shadow-[0_18px_50px_rgba(0,0,0,0.6)] backdrop-blur-md"
            style={{ borderLeft: `3px solid ${t.kind === "ok" ? "#34d399" : t.kind === "warn" ? "#f5c542" : "#00e5ff"}` }}
          >
            <span className="text-[12.5px] font-semibold leading-snug text-frost">{t.msg}</span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
