/**
 * Pilier 3 — Fiches de personnage & liaison de voix.
 * Gestion illimitée des sujets : chaque visage extrait devient une carte avec
 * un RÔLE (Acteur principal → répliques + clonage vocal, ou Figurant →
 * peuple l'arrière-plan) et un interrupteur d'activation. Les figurants sont
 * affichés en mode compact pour ne pas surcharger les dialogues principaux.
 */
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clapperboard, Link2, Mic, MicOff, Play, Square, Trash2, Unlink, Upload, User, Users } from "lucide-react";
import { TONES, toneById } from "../data/content";
import type { CastMember } from "../lib/scenario";
import { decodeAudioFile, drawWaveform, playBufferWithTone } from "../lib/scenario";

type Filter = "all" | "actor" | "extra";

interface Props {
  cast: CastMember[];
  scriptNames: string[];
  matched: Record<string, number>;
  update: (id: string, patch: Partial<CastMember>) => void;
  remove: (id: string) => void;
  notify: (msg: string, kind?: "ok" | "warn" | "info") => void;
}

function Waveform({ buffer, color }: { buffer: AudioBuffer; color: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (ref.current) drawWaveform(ref.current, buffer, color);
  }, [buffer, color]);
  return <canvas ref={ref} width={230} height={42} className="h-[42px] w-full rounded-md bg-abyss/70" />;
}

export default function CharacterBoard({ cast, scriptNames, matched, update, remove, notify }: Props) {
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const uploadRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef<string | null>(null);

  const startRecording = async (id: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecordingId(null);
        try {
          const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
          const buffer = await decodeAudioFile(blob);
          update(id, {
            voiceUrl: URL.createObjectURL(blob),
            voiceBuffer: buffer,
            voiceLabel: `Micro · ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`,
          });
          notify("Empreinte vocale capturée — associée au clone", "ok");
        } catch {
          notify("Échantillon illisible — réessayez l'enregistrement", "warn");
        }
      };
      mr.start();
      recRef.current = mr;
      setRecordingId(id);
    } catch {
      notify("Accès au micro refusé — utilisez l'import de fichier", "warn");
    }
  };

  const stopRecording = () => {
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
  };

  const onUpload = async (file: File | undefined | null) => {
    const id = targetRef.current;
    if (!file || !id) return;
    try {
      const buffer = await decodeAudioFile(file);
      update(id, { voiceUrl: URL.createObjectURL(file), voiceBuffer: buffer, voiceLabel: file.name });
      notify(`Voix chargée depuis « ${file.name} »`, "ok");
    } catch {
      notify("Fichier audio illisible (WAV / MP3 / OGG recommandés)", "warn");
    }
  };

  const preview = (m: CastMember) => {
    if (!m.voiceBuffer) {
      notify("Aucun échantillon — enregistrez ou importez une voix d'abord", "warn");
      return;
    }
    const tone = toneById(m.tone);
    const dur = playBufferWithTone(m.voiceBuffer, tone);
    notify(`Aperçu « ${m.name} » · ton ${tone.label.toLowerCase()} · ${dur.toFixed(1)} s`, "info");
  };

  const toggleRole = (m: CastMember) => {
    const next = m.role === "actor" ? "extra" : "actor";
    update(m.id, { role: next });
    notify(
      next === "extra"
        ? `« ${m.name} » passe figurant — il peuplera l'arrière-plan sans réplique`
        : `« ${m.name} » passe acteur principal — liez son nom au scénario`,
      "info"
    );
  };

  const actors = cast.filter((m) => m.role === "actor");
  const extras = cast.filter((m) => m.role === "extra");
  const visible = cast.filter((m) => (filter === "all" ? true : m.role === filter));

  return (
    <div className="flex h-full flex-col gap-3">
      {/* -------- barre de filtrage & compteurs -------- */}
      {cast.length > 0 && (
        <div className="panel flex flex-wrap items-center gap-2 px-3 py-2.5">
          <div className="flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
            {(
              [
                ["all", `Tous · ${cast.length}`],
                ["actor", `Acteurs · ${actors.length}`],
                ["extra", `Figurants · ${extras.length}`],
              ] as [Filter, string][]
            ).map(([f, label]) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-md px-3 py-1 text-[10.5px] font-bold uppercase tracking-wider transition-all ${
                  filter === f ? "bg-cyan/15 text-cyan shadow-[0_0_10px_rgba(0,229,255,0.2)]" : "text-fog hover:text-frost"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="ml-auto font-mono text-[9.5px] font-semibold text-fog/60">détection illimitée · {cast.length} sujet{cast.length > 1 ? "s" : ""}</p>
        </div>
      )}

      {cast.length === 0 && (
        <div className="panel flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-fog">
            <User size={20} />
          </span>
          <p className="text-[13px] font-bold text-frost">Aucun sujet dans le casting</p>
          <p className="max-w-[280px] text-[11.5px] leading-relaxed text-fog">
            Importez un média ou générez une scène : une carte est créée pour <b className="text-cyan">chaque</b> visage extrait — sans limite. Désignez ensuite acteurs et figurants.
          </p>
        </div>
      )}

      <AnimatePresence initial={false}>
        {visible.map((m) => {
          const linked = scriptNames.some((n) => n.trim().toLowerCase() === m.name.trim().toLowerCase());
          const tone = toneById(m.tone);
          const recording = recordingId === m.id;
          const isActor = m.role === "actor";

          /* ----- figurant : carte compacte ----- */
          if (!isActor) {
            return (
              <motion.div
                key={m.id}
                layout
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: m.enabled ? 1 : 0.55, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="panel flex items-center gap-2.5 overflow-hidden px-3 py-2.5"
                style={{ borderColor: `${m.color}30` }}
              >
                <span className="h-8 w-[3px] shrink-0 self-stretch rounded-full" style={{ background: m.color }} />
                {m.thumb ? (
                  <img src={m.thumb} alt={m.name} className="h-9 w-9 shrink-0 rounded-md object-cover" style={{ border: `1.5px solid ${m.color}88` }} />
                ) : (
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-[12px] font-bold" style={{ background: `${m.color}1a`, color: m.color }}>
                    {m.name.slice(0, 1).toUpperCase() || "?"}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <input
                    value={m.name}
                    onChange={(e) => update(m.id, { name: e.target.value })}
                    className="field h-7 w-full rounded-md px-2 text-[12px] font-bold text-frost"
                    aria-label="Nom du figurant"
                  />
                  <p className="mt-0.5 font-mono text-[9px] font-semibold text-fog/60">
                    figurant · plan {m.zone ?? "mid"} {m.confidence !== null ? `· confiance ${Math.round(m.confidence * 100)}%` : ""}
                  </p>
                </div>
                <button
                  onClick={() => update(m.id, { enabled: !m.enabled })}
                  title={m.enabled ? "Désactiver ce figurant" : "Activer ce figurant"}
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-md border transition-all ${
                    m.enabled ? "border-mint/50 bg-mint/10 text-mint" : "border-white/10 text-fog/50"
                  }`}
                >
                  <Users size={13} />
                </button>
                <button
                  onClick={() => toggleRole(m)}
                  title="Passer acteur principal"
                  className="btn-ghost grid h-8 w-8 shrink-0 place-items-center rounded-md text-fog hover:!border-cyan/50 hover:!text-cyan"
                >
                  <Clapperboard size={13} />
                </button>
                <button onClick={() => remove(m.id)} aria-label="Retirer" className="btn-ghost grid h-8 w-8 shrink-0 place-items-center rounded-md text-fog hover:!border-coral/50 hover:!text-coral">
                  <Trash2 size={13} />
                </button>
              </motion.div>
            );
          }

          /* ----- acteur principal : carte complète ----- */
          return (
            <motion.div
              key={m.id}
              layout
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: m.enabled ? 1 : 0.55, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="panel overflow-hidden"
              style={{ borderColor: `${m.color}40` }}
            >
              <div className="h-[3px] w-full" style={{ background: `linear-gradient(90deg, ${m.color}, transparent)` }} />
              <div className="p-3.5">
                <div className="flex items-center gap-2.5">
                  {m.thumb ? (
                    <img src={m.thumb} alt={m.name} className="h-11 w-11 shrink-0 rounded-md object-cover" style={{ border: `1.5px solid ${m.color}` }} />
                  ) : (
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-[13px] font-bold" style={{ background: `${m.color}1f`, color: m.color, border: `1.5px solid ${m.color}55` }}>
                      {m.name.slice(0, 1).toUpperCase() || "?"}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <input
                      value={m.name}
                      onChange={(e) => update(m.id, { name: e.target.value })}
                      placeholder="Nom du clone (ex : K-9)"
                      className="field h-9 w-full rounded-md px-2.5 text-[13px] font-bold text-frost"
                    />
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {m.confidence !== null && <span className="font-mono text-[9.5px] font-semibold text-fog/70">confiance {Math.round(m.confidence * 100)}%</span>}
                      <span
                        className="flex items-center gap-1 rounded-sm px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wider"
                        style={{ color: linked ? "#34d399" : "#f5c542", background: linked ? "rgba(52,211,153,0.1)" : "rgba(245,197,66,0.1)" }}
                      >
                        {linked ? <Link2 size={10} /> : <Unlink size={10} />}
                        {linked ? `${matched[m.id] ?? 0} réplique${(matched[m.id] ?? 0) > 1 ? "s" : ""}` : "hors scénario"}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => update(m.id, { enabled: !m.enabled })}
                    title={m.enabled ? "Désactiver cet acteur" : "Activer cet acteur"}
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-md border transition-all ${
                      m.enabled ? "border-mint/50 bg-mint/10 text-mint" : "border-white/10 text-fog/50"
                    }`}
                  >
                    <Clapperboard size={13} />
                  </button>
                  <button onClick={() => remove(m.id)} aria-label="Retirer ce clone" className="btn-ghost grid h-8 w-8 shrink-0 place-items-center rounded-md text-fog hover:!border-coral/50 hover:!text-coral">
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* bascule de rôle */}
                <button
                  onClick={() => toggleRole(m)}
                  className="mt-2.5 flex w-full items-center justify-between rounded-md border border-volt/30 bg-volt/[0.06] px-2.5 py-1.5 transition-all hover:border-volt/60 hover:bg-volt/[0.12]"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#c9a0f5]">Acteur principal · répliques + voix</span>
                  <span className="text-[9.5px] font-bold uppercase tracking-wider text-fog/60">⇄ passer figurant</span>
                </button>

                {/* ton & ambiance */}
                <p className="mt-3 mb-1.5 text-[9.5px] font-bold uppercase tracking-[0.18em] text-fog">Ton & ambiance → paramètres TTS</p>
                <div className="flex flex-wrap gap-1.5">
                  {TONES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => update(m.id, { tone: t.id })}
                      className="rounded-md border px-2 py-1 text-[10.5px] font-bold transition-all"
                      style={{
                        borderColor: m.tone === t.id ? t.accent : "rgba(255,255,255,0.1)",
                        background: m.tone === t.id ? `${t.accent}1c` : "transparent",
                        color: m.tone === t.id ? t.accent : "#8b98ab",
                        boxShadow: m.tone === t.id ? `0 0 12px ${t.accent}30` : "none",
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* voix */}
                <p className="mt-3 mb-1.5 flex items-center justify-between text-[9.5px] font-bold uppercase tracking-[0.18em] text-fog">
                  Clonage / attribution vocale
                  {m.voiceLabel && <span className="font-mono normal-case tracking-normal text-mint">{m.voiceLabel}</span>}
                </p>
                {m.voiceBuffer ? (
                  <div className="space-y-2">
                    <Waveform buffer={m.voiceBuffer} color={tone.accent} />
                    <div className="flex gap-1.5">
                      <button onClick={() => preview(m)} className="btn-ghost flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[10.5px] font-bold uppercase tracking-wider text-fog">
                        <Play size={12} /> Écouter ({tone.label})
                      </button>
                      <button
                        onClick={() => (recording ? stopRecording() : void startRecording(m.id))}
                        className={`btn-ghost flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[10.5px] font-bold uppercase tracking-wider ${recording ? "!border-coral/60 !text-coral" : "text-fog"}`}
                      >
                        {recording ? <Square size={11} /> : <Mic size={12} />} {recording ? "Stop" : "Refaire"}
                      </button>
                      <button onClick={() => update(m.id, { voiceUrl: null, voiceBuffer: null, voiceLabel: null })} className="btn-ghost rounded-md px-2 py-1.5 text-[10.5px] font-bold uppercase tracking-wider text-fog">
                        Retirer
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => (recording ? stopRecording() : void startRecording(m.id))}
                      className={`btn-ghost flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-[10.5px] font-bold uppercase tracking-wider ${recording ? "!border-coral/60 !bg-coral/10 !text-coral" : "text-fog"}`}
                    >
                      {recording ? (
                        <>
                          <span className="h-2 w-2 animate-pulse-soft rounded-full bg-coral" /> Enregistrement… stop
                        </>
                      ) : (
                        <>
                          <Mic size={12} /> Enregistrer
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        targetRef.current = m.id;
                        uploadRef.current?.click();
                      }}
                      className="btn-ghost flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-[10.5px] font-bold uppercase tracking-wider text-fog"
                    >
                      <Upload size={12} /> Importer
                    </button>
                  </div>
                )}
                <p className="mt-2 font-mono text-[9px] font-semibold text-fog/50">
                  rate ×{tone.rate.toFixed(2)} · pitch ×{tone.pitch.toFixed(2)} · énergie {Math.round(tone.energy * 100)}% · moteur XTTS-v2 local
                </p>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      <input ref={uploadRef} type="file" accept="audio/*" className="hidden" onChange={(e) => void onUpload(e.target.files?.[0])} />
      {cast.length > 0 && (
        <p className="flex items-center gap-2 px-1 text-[10.5px] font-semibold text-fog/60">
          <MicOff size={12} /> Les champs de doublage vides sur une vidéo sonorisée basculent en nettoyage cinématique (pilier 4).
        </p>
      )}
    </div>
  );
}
