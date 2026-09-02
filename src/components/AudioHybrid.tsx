/**
 * Pilier 4 — Gestion intelligente de l'audio (mode hybride).
 * Vidéo sonorisée  → chaîne de Nettoyage Cinématique appliquée à la voix d'origine.
 * Photo / muet     → synthèse TTS par réplique, modulée par le ton de chaque clone.
 */
import { motion } from "framer-motion";
import { AudioLines, ChevronRight, Orbit, Play, Repeat, Volume2, Waves } from "lucide-react";
import { TONES, type ToneDef } from "../data/content";
import type { CleanupOptions } from "../data/content";
import { Switch } from "./ui";

interface Props {
  hasAudio: boolean;
  cleanup: CleanupOptions;
  onCleanup: (k: keyof CleanupOptions) => void;
  onPreviewTone: (tone: ToneDef) => void;
}

const CHAIN: { key: keyof CleanupOptions; label: string; desc: string; icon: React.ReactNode }[] = [
  { key: "isolation", label: "Isolation vocale", desc: "Séparation voix / fond (source splitting)", icon: <AudioLines size={16} /> },
  { key: "denoise", label: "Suppression des bruits", desc: "Réduction broadband & hum 50/60 Hz", icon: <Waves size={16} /> },
  { key: "deecho", label: "Élimination des échos", desc: "Déréverbération des prises en intérieur", icon: <Repeat size={16} /> },
  { key: "spatial", label: "Spatialisation", desc: "Panoramique & profondeur salle de mix", icon: <Orbit size={16} /> },
];

const SAMPLE_LINE = "Le signal du dôme a coupé il y a quatre minutes.";

export default function AudioHybrid({ hasAudio, cleanup, onCleanup, onPreviewTone }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45 }}
      className="panel overflow-hidden"
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.06] px-4 py-3">
        <span className="eyebrow text-volt">Pipeline audio adaptatif</span>
        <span
          className="rounded-md px-2.5 py-1 font-mono text-[10.5px] font-bold uppercase tracking-wider"
          style={
            hasAudio
              ? { color: "#34d399", background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.35)" }
              : { color: "#00e5ff", background: "rgba(0,229,255,0.08)", border: "1px solid rgba(0,229,255,0.35)" }
          }
        >
          {hasAudio ? "Mode A · voix d'origine conservée" : "Mode B · synthèse vocale (lipsync)"}
        </span>
        <span className="text-[11px] font-semibold text-fog/70">
          {hasAudio
            ? "Les doublages laissés vides conservent la prise originale, nettoyée et spatialisée."
            : "Chaque réplique du scénario est synthétisée avec la voix et le ton du clone."}
        </span>
      </div>

      {hasAudio ? (
        /* ---- Chaîne de nettoyage cinématique ---- */
        <div className="p-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch">
            <div className="panel-raised flex shrink-0 items-center gap-2 px-3.5 py-3">
              <Volume2 size={16} className="text-fog" />
              <div>
                <p className="text-[11.5px] font-bold text-frost">Source</p>
                <p className="font-mono text-[9.5px] font-semibold text-fog/60">piste originale</p>
              </div>
            </div>
            {CHAIN.map((node) => {
              const on = cleanup[node.key];
              return (
                <div key={node.key} className="flex flex-1 items-center gap-2">
                  <ChevronRight size={14} className="hidden shrink-0 text-fog/40 lg:block" />
                  <div
                    className={`flex flex-1 items-center justify-between gap-3 rounded-lg border px-3.5 py-3 transition-all duration-300 ${
                      on ? "border-mint/45 bg-mint/[0.06] shadow-[0_0_20px_rgba(52,211,153,0.1)]" : "border-white/[0.09] bg-white/[0.02]"
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className={on ? "text-mint" : "text-fog/60"}>{node.icon}</span>
                      <div className="min-w-0">
                        <p className={`truncate text-[11.5px] font-bold ${on ? "text-frost" : "text-fog"}`}>{node.label}</p>
                        <p className="truncate text-[9.5px] font-semibold text-fog/60">{node.desc}</p>
                      </div>
                    </div>
                    <Switch on={on} onChange={() => onCleanup(node.key)} label={node.label} accent="#34d399" />
                  </div>
                </div>
              );
            })}
            <ChevronRight size={14} className="hidden shrink-0 text-fog/40 lg:block" />
            <div className="panel-raised flex shrink-0 items-center gap-2 border-cyan/30 px-3.5 py-3">
              <AudioLines size={16} className="text-cyan" />
              <div>
                <p className="text-[11.5px] font-bold text-frost">Master</p>
                <p className="font-mono text-[9.5px] font-semibold text-fog/60">−14 LUFS · 48 kHz</p>
              </div>
            </div>
          </div>
          <p className="mt-3 font-mono text-[10px] font-semibold text-fog/60">
            {Object.values(cleanup).filter(Boolean).length}/4 nœuds actifs · la chaîne s'applique en temps réel au lecteur du média source.
          </p>
        </div>
      ) : (
        /* ---- Synthèse par ton ---- */
        <div className="p-4">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {TONES.map((t) => (
              <div key={t.id} className="panel-raised flex items-center gap-3 px-3.5 py-3 transition-colors hover:border-white/[0.18]">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: t.accent, boxShadow: `0 0 8px ${t.accent}` }} />
                    <p className="text-[12px] font-bold text-frost">{t.label}</p>
                    <span className="ml-auto font-mono text-[9.5px] font-semibold text-fog/60">×{t.rate.toFixed(2)} · pitch ×{t.pitch.toFixed(2)}</span>
                  </div>
                  <div className="mt-2 h-[5px] overflow-hidden rounded-full bg-white/[0.06]">
                    <div className="h-full rounded-full" style={{ width: `${t.energy * 100}%`, background: t.accent, boxShadow: `0 0 8px ${t.accent}` }} />
                  </div>
                </div>
                <button
                  onClick={() => onPreviewTone(t)}
                  className="btn-ghost grid h-9 w-9 shrink-0 place-items-center rounded-md text-fog"
                  aria-label={`Prévisualiser le ton ${t.label}`}
                  title={`Écouter : « ${SAMPLE_LINE} »`}
                >
                  <Play size={14} />
                </button>
              </div>
            ))}
          </div>
          <p className="mt-3 font-mono text-[10px] font-semibold text-fog/60">
            Aperçu : « {SAMPLE_LINE} » — le rendu final lipsync est recalé image par image sur le visage du clone (LivePortrait).
          </p>
        </div>
      )}
    </motion.div>
  );
}
