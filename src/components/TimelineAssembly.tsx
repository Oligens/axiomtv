/**
 * Pilier 5 — Synchronisation des répliques & assemblage de la timeline.
 * Chronologie multi-pistes (scène/action, dialogues, énergie audio),
 * lecture vocale du scénario avec les tons, alertes de noms non liés.
 */
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Clapperboard, Download, Eye, MessageSquare, Pause, Play, Square } from "lucide-react";
import { toneById, type Timeline } from "../data/content";
import { formatTime, speakLine } from "../lib/scenario";
import { Note } from "./ui";

interface Props {
  timeline: Timeline;
  onExport: () => void;
}

const PPS = 30; // pixels par seconde

export default function TimelineAssembly({ timeline, onExport }: Props) {
  const [playing, setPlaying] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [clock, setClock] = useState(0);
  const cancelRef = useRef(false);
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    cancelRef.current = true;
    setPlaying(false);
    setCurrentId(null);
    setClock(0);
  }, [timeline]);

  const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  const playAll = async () => {
    if (playing) return;
    cancelRef.current = false;
    setPlaying(true);
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();

    for (const e of timeline.entries) {
      if (cancelRef.current) break;
      setCurrentId(e.id);
      setClock(e.start);
      /* faire défiler la bande jusqu'au bloc courant */
      stripRef.current?.scrollTo({ left: Math.max(0, e.start * PPS - 120), behavior: "smooth" });

      if (e.kind === "dialogue" && e.label) {
        const tone = toneById(e.tone ?? "calme");
        /* vitesse d'aperçu : on compresse légèrement pour garder le rythme */
        await speakLine(e.label, { ...tone, rate: tone.rate * 1.12 }, Math.min(e.duration * 1000, 5200));
      } else {
        await wait(Math.min(e.duration * 380, 1500));
      }
    }
    if (!cancelRef.current) setClock(timeline.total);
    setCurrentId(null);
    setPlaying(false);
  };

  const stop = () => {
    cancelRef.current = true;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setPlaying(false);
    setCurrentId(null);
  };

  const width = Math.max(640, timeline.total * PPS);
  const scenes = timeline.entries.filter((e) => e.kind !== "dialogue");
  const dialogues = timeline.entries.filter((e) => e.kind === "dialogue");
  const ticks: number[] = [];
  for (let s = 0; s <= Math.ceil(timeline.total); s += 5) ticks.push(s);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45 }}
      className="panel overflow-hidden"
    >
      {/* barre de contrôle */}
      <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.06] px-4 py-3">
        <button
          onClick={playing ? stop : () => void playAll()}
          disabled={timeline.entries.length === 0}
          className={`flex items-center gap-2 rounded-md px-4 py-2 font-display text-[11.5px] font-bold uppercase tracking-wider transition-all ${
            playing ? "bg-coral/15 text-coral shadow-[0_0_16px_rgba(255,93,115,0.25)]" : "btn-neon"
          }`}
        >
          {playing ? <Square size={13} /> : <Play size={13} />}
          {playing ? "Arrêter la lecture" : "Lire le scénario assemblé"}
        </button>
        <span className="font-mono rounded-md border border-white/10 bg-abyss px-3 py-1.5 text-[13px] font-bold tabular-nums text-cyan">
          {formatTime(clock)} <span className="text-fog/50">/ {formatTime(timeline.total)}</span>
        </span>
        <span className="text-[11px] font-semibold text-fog/70">
          {dialogues.length} réplique{dialogues.length > 1 ? "s" : ""} · {scenes.length} bloc{scenes.length > 1 ? "s" : ""} visuel{scenes.length > 1 ? "s" : ""}
        </span>
        <button onClick={onExport} disabled={timeline.entries.length === 0} className="btn-ghost ml-auto flex items-center gap-2 rounded-md px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider text-fog">
          <Download size={13} /> Exporter la timeline (JSON)
        </button>
      </div>

      {timeline.unassigned.length > 0 && (
        <div className="border-b border-white/[0.06] px-4 py-2.5">
          <Note kind="warn">
            Noms du scénario sans clone correspondant : <b>{timeline.unassigned.join(", ")}</b>. Renommez une carte de casting avec exactement ce nom pour lier les répliques.
          </Note>
        </div>
      )}

      {timeline.entries.length === 0 ? (
        <p className="px-6 py-10 text-center text-[12px] font-semibold text-fog/60">Écrivez un scénario pour assembler la chronologie finale.</p>
      ) : (
        <div className="p-4">
          <div ref={stripRef} className="no-scrollbar overflow-x-auto rounded-lg border border-white/[0.07] bg-abyss/80">
            <div className="relative" style={{ width, minWidth: "100%" }}>
              {/* règle */}
              <div className="relative h-7 border-b border-white/[0.07]">
                {ticks.map((s) => (
                  <span key={s} className="absolute top-0 h-full border-l border-white/[0.08]" style={{ left: s * PPS }}>
                    <span className="font-mono absolute left-1 top-1 text-[9px] font-semibold text-fog/60">{formatTime(s)}</span>
                  </span>
                ))}
              </div>

              {/* piste scène / action */}
              <div className="relative h-9 border-b border-white/[0.05]">
                <span className="font-mono absolute left-1.5 top-1/2 z-10 -translate-y-1/2 text-[8.5px] font-bold uppercase tracking-widest text-fog/50">V1</span>
                {scenes.map((e) => (
                  <div
                    key={e.id}
                    title={e.label}
                    className={`absolute top-[7px] flex h-[22px] items-center gap-1.5 overflow-hidden rounded-[4px] border px-2 transition-all duration-200 ${
                      currentId === e.id ? "z-10 scale-y-110" : ""
                    }`}
                    style={{
                      left: e.start * PPS,
                      width: Math.max(34, e.duration * PPS - 3),
                      borderColor: e.kind === "scene" ? "rgba(245,197,66,0.45)" : "rgba(139,152,171,0.3)",
                      background: e.kind === "scene" ? "rgba(245,197,66,0.1)" : "rgba(139,152,171,0.07)",
                      boxShadow: currentId === e.id ? "0 0 14px rgba(245,197,66,0.35)" : "none",
                    }}
                  >
                    {e.kind === "scene" ? <Clapperboard size={10} className="shrink-0 text-gold" /> : <Eye size={10} className="shrink-0 text-fog/70" />}
                    <span className={`truncate text-[9px] font-bold uppercase tracking-wide ${e.kind === "scene" ? "text-gold/90" : "text-fog/80"}`}>{e.label}</span>
                  </div>
                ))}
              </div>

              {/* piste dialogues */}
              <div className="relative h-[52px] border-b border-white/[0.05]">
                <span className="font-mono absolute left-1.5 top-1/2 z-10 -translate-y-1/2 text-[8.5px] font-bold uppercase tracking-widest text-fog/50">VO</span>
                {dialogues.map((e) => (
                  <div
                    key={e.id}
                    title={`${e.characterName ?? "?"} · ${e.label}`}
                    className={`absolute top-[8px] flex h-[36px] flex-col justify-center overflow-hidden rounded-[5px] border px-2 transition-all duration-200 ${currentId === e.id ? "z-10 scale-y-110" : ""}`}
                    style={{
                      left: e.start * PPS,
                      width: Math.max(56, e.duration * PPS - 3),
                      borderColor: `${e.color}66`,
                      background: `linear-gradient(180deg, ${e.color}24, ${e.color}0d)`,
                      boxShadow: currentId === e.id ? `0 0 18px ${e.color}55` : "none",
                      borderLeftWidth: 3,
                    }}
                  >
                    <span className="flex items-center gap-1 truncate text-[9px] font-bold uppercase tracking-wide" style={{ color: e.color }}>
                      <MessageSquare size={9} className="shrink-0" />
                      {e.characterName}
                      {e.crossed && <span className="rounded-sm bg-white/10 px-1 text-[7.5px] text-frost">croisé</span>}
                    </span>
                    <span className="truncate text-[9.5px] font-semibold text-frost/85">« {e.label} »</span>
                  </div>
                ))}
              </div>

              {/* piste énergie audio */}
              <div className="relative h-10">
                <span className="font-mono absolute left-1.5 top-1/2 z-10 -translate-y-1/2 text-[8.5px] font-bold uppercase tracking-widest text-fog/50">A1</span>
                {dialogues.map((e) => {
                  const tone = toneById(e.tone ?? "calme");
                  const bars = Math.max(3, Math.floor((e.duration * PPS) / 7));
                  return (
                    <div key={e.id} className="absolute top-[6px] flex h-[28px] items-center gap-[2px] overflow-hidden" style={{ left: e.start * PPS, width: e.duration * PPS - 3 }}>
                      {Array.from({ length: bars }).map((_, i) => {
                        const h = 18 + ((i * 37 + e.id * 13) % 62) * tone.energy;
                        return <span key={i} className="w-[3px] shrink-0 rounded-full" style={{ height: `${Math.min(100, h * 0.42)}%`, background: e.color, opacity: currentId === e.id ? 1 : 0.55 }} />;
                      })}
                    </div>
                  );
                })}
              </div>

              {/* tête de lecture */}
              <div className="pointer-events-none absolute inset-y-0 z-20 w-[2px] bg-cyan shadow-[0_0_12px_rgba(0,229,255,0.8)] transition-[left] duration-150" style={{ left: Math.min(clock, timeline.total) * PPS }}>
                <span className="absolute -left-[5px] top-0 h-3 w-3 rotate-45 bg-cyan" />
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5">
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-fog/70">
              <span className="h-2.5 w-2.5 rounded-[3px] border border-gold/50 bg-gold/15" /> Scène
            </span>
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-fog/70">
              <span className="h-2.5 w-2.5 rounded-[3px] border border-fog/40 bg-fog/10" /> Action
            </span>
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-fog/70">
              <span className="h-2.5 w-2.5 rounded-[3px] border border-cyan/50 bg-cyan/15" /> Dialogue (couleur = clone)
            </span>
            <span className="ml-auto font-mono text-[10px] font-semibold text-fog/50">
              durée totale {formatTime(timeline.total)} · dialogues croisés gérés · zéro décalage à l'assemblage
            </span>
          </div>
        </div>
      )}

      {timeline.unassigned.length > 0 && (
        <div className="flex items-center gap-2 border-t border-white/[0.06] px-4 py-2.5 text-[10.5px] font-semibold text-gold/90">
          <AlertTriangle size={12} /> {timeline.unassigned.length} nom{timeline.unassigned.length > 1 ? "s" : ""} non lié{timeline.unassigned.length > 1 ? "s" : ""} au casting — l'export JSON les signale.
        </div>
      )}
      <span className="hidden">
        <Pause size={10} />
      </span>
    </motion.div>
  );
}
