/**
 * Réglages expert (§31) — seuils, pondération, sampling, tentatives, moteurs.
 */
import { motion } from "framer-motion";
import { Sliders, X } from "lucide-react";
import { ENGINE_DEFS, type EngineId, type QASettings } from "../../agwe/models";
import { Switch } from "../ui";

export default function ExpertDrawer({
  open,
  settings,
  onSettings,
  onClose,
}: {
  open: boolean;
  settings: QASettings;
  onSettings: (patch: Partial<QASettings>) => void;
  onClose: () => void;
}) {
  if (!open) return null;

  const totalW = ENGINE_DEFS.filter((e) => settings.engines[e.id]).reduce((a, e) => a + (settings.weights[e.id] ?? e.weight), 0);

  const slider = "w-full h-[5px] appearance-none rounded-full bg-white/[0.09] accent-[#00e5ff] cursor-pointer";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[75] flex justify-end bg-abyss/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.aside
        initial={{ x: 420 }}
        animate={{ x: 0 }}
        exit={{ x: 420 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="panel flex h-full w-full max-w-[400px] flex-col overflow-hidden rounded-none border-y-0 border-r-0"
      >
        <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-5 py-4">
          <Sliders size={15} className="text-cyan" />
          <div>
            <p className="font-display text-[12px] font-bold uppercase tracking-[0.22em] text-cyan">Réglages expert</p>
            <p className="text-[10px] font-semibold text-fog/60">Contrôle des moteurs d'analyse</p>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="btn-ghost ml-auto grid h-8 w-8 place-items-center rounded-md text-fog">
            <X size={14} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5" style={{ scrollbarWidth: "thin" }}>
          {/* pipeline */}
          <section>
            <p className="font-mono text-[9.5px] font-bold uppercase tracking-widest text-fog/70">Pipeline</p>
            <div className="mt-3 space-y-4">
              <label className="block">
                <span className="flex justify-between text-[11px] font-semibold text-fog">
                  Seuil d'approbation <b className="font-mono text-cyan">{settings.passThreshold}</b>
                </span>
                <input type="range" min={80} max={98} step={0.5} value={settings.passThreshold} onChange={(e) => onSettings({ passThreshold: Number(e.target.value) })} className={slider} />
              </label>
              <label className="block">
                <span className="flex justify-between text-[11px] font-semibold text-fog">
                  Seuil d'analyse profonde <b className="font-mono text-volt">{settings.deepThreshold}</b>
                </span>
                <input type="range" min={78} max={95} step={0.5} value={settings.deepThreshold} onChange={(e) => onSettings({ deepThreshold: Number(e.target.value) })} className={slider} />
              </label>
              <label className="block">
                <span className="flex justify-between text-[11px] font-semibold text-fog">
                  Échantillonnage frames <b className="font-mono text-mint">{Math.round(settings.samplingRate * 100)} %</b>
                </span>
                <input type="range" min={0.2} max={1} step={0.05} value={settings.samplingRate} onChange={(e) => onSettings({ samplingRate: Number(e.target.value) })} className={slider} />
                <span className="mt-1 block text-[9.5px] font-semibold text-fog/50">Bas = rapide + incertain · haut = précis + coûteux (GPU)</span>
              </label>
              <label className="block">
                <span className="flex justify-between text-[11px] font-semibold text-fog">
                  Tentatives de régénération max <b className="font-mono text-gold">{settings.maxAttempts}</b>
                </span>
                <input type="range" min={1} max={6} step={1} value={settings.maxAttempts} onChange={(e) => onSettings({ maxAttempts: Number(e.target.value) })} className={slider} />
              </label>
            </div>
          </section>

          {/* moteurs */}
          <section>
            <div className="flex items-baseline justify-between">
              <p className="font-mono text-[9.5px] font-bold uppercase tracking-widest text-fog/70">Moteurs & pondération</p>
              <span className="font-mono text-[9px] font-semibold text-fog/50">Σ poids = {totalW}</span>
            </div>
            <div className="mt-3 space-y-2.5">
              {ENGINE_DEFS.map((def) => {
                const on = settings.engines[def.id];
                const w = settings.weights[def.id] ?? def.weight;
                return (
                  <div key={def.id} className={`rounded-lg border px-3.5 py-2.5 transition-colors ${on ? "border-white/[0.09] bg-white/[0.02]" : "border-white/[0.05] opacity-50"}`}>
                    <div className="flex items-center gap-3">
                      <span className="font-mono w-[86px] shrink-0 text-[10px] font-bold uppercase tracking-wider text-frost">{def.label}</span>
                      <input
                        type="range" min={1} max={20} step={1} value={w} disabled={!on}
                        onChange={(e) => onSettings({ weights: { ...settings.weights, [def.id]: Number(e.target.value) } })}
                        className={slider}
                      />
                      <span className="font-mono w-6 shrink-0 text-right text-[10px] font-bold text-fog">{w}</span>
                      <Switch on={on} onChange={() => onSettings({ engines: { ...settings.engines, [def.id]: !on } })} label={`Moteur ${def.label}`} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <p className="border-t border-white/[0.06] pt-4 font-mono text-[9.5px] font-semibold leading-relaxed text-fog/60">
            Les scores affichés sont des estimations de cohérence selon ces métriques — jamais une
            garantie d'absence d'erreur ni une preuve d'origine (§32).
          </p>
        </div>
      </motion.aside>
    </motion.div>
  );
}

export type { EngineId };
