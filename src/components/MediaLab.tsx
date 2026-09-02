/**
 * Pilier 2 — Analyse intelligente des médias & extraction des visages.
 * Déclenche la segmentation dès l'upload (FaceDetector natif si présent,
 * sinon moteur local), cadre chaque sujet en bounding box et remonte
 * exactement N visages — aucune limite figée de casting.
 */
import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Film, ImagePlus, Loader2, RefreshCw, ScanFace, Sparkles, Users, UserPlus, Volume2, VolumeX } from "lucide-react";
import { colorFor, type MediaResult } from "../lib/scenario";
import { extractFromFile, buildDemoMedia, buildCrowdMedia, detectFaces, cropThumb } from "../lib/scenario";
import { Switch, Note } from "./ui";

export interface CastSeed {
  name: string;
  face: MediaResult["faces"][number]["box"];
  thumb: string | null;
  confidence: number;
}

interface Props {
  onAnalyzed: (r: MediaResult, seeds: CastSeed[]) => void;
  onAddManual: () => void;
  hasAudio: boolean;
  onHasAudioChange: (v: boolean) => void;
  castCount: number;
  notify: (msg: string, kind?: "ok" | "warn" | "info") => void;
}

const DEMO_NAMES = ["K-9", "Mira", "Cleef"];

export default function MediaLab({ onAnalyzed, onAddManual, hasAudio, onHasAudioChange, castCount, notify }: Props) {
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState<null | string>(null);
  const [result, setResult] = useState<MediaResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const runDetection = async (canvas: HTMLCanvasElement, base: MediaResult) => {
    setBusy("Segmentation des sujets…");
    await new Promise((r) => setTimeout(r, 650));
    const det = await detectFaces(canvas);
    const seeds: CastSeed[] = det.faces.map((f, i) => ({
      name: base.engine.startsWith("Synthèse") ? (DEMO_NAMES[i] ?? `Sujet ${i + 1}`) : `Sujet ${i + 1}`,
      face: f.box,
      thumb: cropThumb(canvas, f.box),
      confidence: f.confidence,
    }));
    const final: MediaResult = { ...base, faces: det.faces, engine: det.engine };
    canvasRef.current = canvas;
    setResult(final);
    onAnalyzed(final, seeds);
    setBusy(null);
    notify(`${seeds.length} visage${seeds.length > 1 ? "s" : ""} extrait${seeds.length > 1 ? "s" : ""} · ${det.engine}`, "ok");
  };

  const handleFile = async (file: File | undefined | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      notify("Format non supporté — déposez une photo ou une vidéo.", "warn");
      return;
    }
    try {
      setBusy("Extraction de la frame…");
      const ex = await extractFromFile(file);
      if (!ex.canvas) throw new Error("canvas");
      onHasAudioChange(ex.hasAudioGuess);
      await runDetection(ex.canvas, { ...ex, engine: "…" });
    } catch {
      setBusy(null);
      notify("Lecture du média impossible — vérifiez le fichier.", "warn");
    }
  };

  const handleDemo = async () => {
    setBusy("Génération de la scène…");
    await new Promise((r) => setTimeout(r, 450));
    const demo = buildDemoMedia();
    onHasAudioChange(demo.hasAudioGuess);
    setBusy("Segmentation des sujets…");
    await new Promise((r) => setTimeout(r, 650));
    /* la scène de démonstration porte 3 sujets connus, alignés sur les silhouettes */
    const seeds: CastSeed[] = demo.faces.map((f, i) => ({
      name: DEMO_NAMES[i] ?? `Sujet ${i + 1}`,
      face: f.box,
      thumb: cropThumb(demo.canvas, f.box),
      confidence: f.confidence,
    }));
    canvasRef.current = demo.canvas;
    setResult(demo);
    onAnalyzed(demo, seeds);
    setBusy(null);
    notify(`3 visages extraits · ${demo.engine}`, "ok");
  };

  /* Foule de démonstration — détection illimitée (15+ visages) */
  const handleCrowd = async () => {
    setBusy("Génération de la foule…");
    await new Promise((r) => setTimeout(r, 450));
    const demo = buildCrowdMedia(15);
    onHasAudioChange(demo.hasAudioGuess);
    setBusy("Segmentation des sujets…");
    await new Promise((r) => setTimeout(r, 700));
    const seeds: CastSeed[] = demo.faces.map((f, i) => ({
      name: `Sujet ${i + 1}`,
      face: f.box,
      thumb: cropThumb(demo.canvas, f.box),
      confidence: f.confidence,
    }));
    canvasRef.current = demo.canvas;
    setResult(demo);
    onAnalyzed(demo, seeds);
    setBusy(null);
    notify(`${seeds.length} visages extraits sans limite — désignez acteurs & figurants`, "ok");
  };

  const reanalyze = () => {
    if (canvasRef.current && result) void runDetection(canvasRef.current, result);
  };

  return (
    <div className="panel flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-2.5">
        <span className="eyebrow text-cyan">Zone d'analyse</span>
        {result && (
          <button onClick={reanalyze} disabled={!!busy} className="btn-ghost ml-auto flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[10.5px] font-bold uppercase tracking-wider text-fog">
            <RefreshCw size={11} className={busy ? "animate-spin" : ""} /> Ré-analyser
          </button>
        )}
      </div>

      <input ref={inputRef} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => void handleFile(e.target.files?.[0])} />

      {/* ---- Dropzone / aperçu ---- */}
      <div className="relative m-3 flex-1">
        {!result && !busy && (
          <button
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              void handleFile(e.dataTransfer.files?.[0]);
            }}
            className={`group flex h-full min-h-[300px] w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed transition-all duration-300 ${
              drag ? "border-cyan bg-cyan/[0.06] shadow-[0_0_40px_rgba(0,229,255,0.15)]" : "border-white/[0.14] bg-white/[0.02] hover:border-cyan/50 hover:bg-cyan/[0.03]"
            }`}
          >
            <span className="grid h-14 w-14 place-items-center rounded-lg border border-cyan/40 bg-cyan/[0.08] text-cyan transition-transform duration-300 group-hover:scale-110">
              <ImagePlus size={24} />
            </span>
            <span className="text-[13.5px] font-bold text-frost">Glissez une photo ou une vidéo</span>
            <span className="text-[11.5px] font-semibold text-fog">L'analyse des visages se déclenche automatiquement à l'import</span>
            <span className="mt-1 flex flex-wrap items-center justify-center gap-2">
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleDemo();
                }}
                onKeyDown={(e) => e.key === "Enter" && void handleDemo()}
                className="btn-ghost flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-fog"
              >
                <Sparkles size={13} className="text-volt" /> Scène 3 sujets
              </span>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleCrowd();
                }}
                onKeyDown={(e) => e.key === "Enter" && void handleCrowd()}
                className="btn-ghost flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-fog"
              >
                <Users size={13} className="text-gold" /> Foule · 15 visages
              </span>
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-fog/50">détection illimitée · acteurs & figurants</span>
          </button>
        )}

        {/* analyse en cours */}
        {busy && (
          <div className="relative flex h-full min-h-[300px] flex-col items-center justify-center gap-4 overflow-hidden rounded-lg border border-cyan/30 bg-abyss">
            {result?.frame && <img src={result.frame} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />}
            <div className="absolute inset-x-0 top-0 h-[2px] overflow-hidden">
              <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-cyan to-transparent" style={{ animation: "sweep 1.6s ease-in-out infinite" }} />
            </div>
            <Loader2 size={26} className="animate-spin text-cyan" />
            <p className="font-mono text-[11.5px] font-semibold tracking-wide text-cyan">{busy}</p>
            <p className="text-[10.5px] font-semibold text-fog">Recadrage automatisé · bounding boxes · estimation de confiance</p>
          </div>
        )}

        {/* aperçu + boxes */}
        {result && !busy && (
          <div className="relative h-full min-h-[300px] overflow-hidden rounded-lg border border-white/[0.1] bg-abyss">
            {result.isVideo && result.videoUrl ? (
              <video src={result.videoUrl} muted loop autoPlay playsInline className="absolute inset-0 h-full w-full object-contain" />
            ) : (
              result.frame && <img src={result.frame} alt="Frame extraite" className="absolute inset-0 h-full w-full object-contain" />
            )}
            {/* voile bas */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-abyss/90 to-transparent" />

            {result.faces.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 1.15 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.12, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="absolute"
                style={{
                  left: `${f.box.x * 100}%`,
                  top: `${f.box.y * 100}%`,
                  width: `${f.box.w * 100}%`,
                  height: `${f.box.h * 100}%`,
                  border: `1.5px solid ${colorFor(i)}`,
                  boxShadow: `0 0 18px ${colorFor(i)}55, inset 0 0 14px ${colorFor(i)}22`,
                }}
              >
                <span
                  className="font-mono absolute -top-5 left-0 whitespace-nowrap rounded-sm px-1.5 py-px text-[9px] font-bold tracking-wide"
                  style={{ background: colorFor(i), color: "#0a0e14" }}
                >
                  SUJET {i + 1} · {Math.round(f.confidence * 100)}%
                </span>
              </motion.div>
            ))}

            {/* barre d'info */}
            <div className="absolute inset-x-3 bottom-2.5 flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-md bg-abyss/85 px-2.5 py-1 font-mono text-[10px] font-semibold text-cyan backdrop-blur-sm">
                <ScanFace size={12} /> {result.faces.length} sujet{result.faces.length > 1 ? "s" : ""} détecté{result.faces.length > 1 ? "s" : ""}
              </span>
              <span className="rounded-md bg-abyss/85 px-2.5 py-1 font-mono text-[10px] font-semibold text-fog backdrop-blur-sm">{result.engine}</span>
              {result.isVideo && (
                <span className="flex items-center gap-1 rounded-md bg-abyss/85 px-2.5 py-1 font-mono text-[10px] font-semibold text-volt backdrop-blur-sm">
                  <Film size={11} /> vidéo
                </span>
              )}
              <button
                onClick={onAddManual}
                className="btn-ghost ml-auto flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-fog"
              >
                <UserPlus size={12} /> Ajouter un sujet
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ---- détection de piste audio (pilier 4) ---- */}
      <div className="border-t border-white/[0.06] px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider ${hasAudio ? "text-mint" : "text-gold"}`}>
            {hasAudio ? <Volume2 size={14} /> : <VolumeX size={14} />}
            {hasAudio ? "Piste audio détectée" : "Média muet / photo"}
          </span>
          <span className="text-[10.5px] font-semibold text-fog/70">
            {hasAudio ? "→ Nettoyage cinématique de la voix d'origine" : "→ Synthèse vocale (TTS) depuis le scénario"}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-fog">Forcer audio</span>
            <Switch on={hasAudio} onChange={() => onHasAudioChange(!hasAudio)} label="Forcer la présence d'une piste audio" />
          </div>
        </div>
        {result && (
          <div className="mt-2.5">
            <Note kind={hasAudio ? "ok" : "info"}>
              {castCount} carte{castCount > 1 ? "s" : ""} de casting générée{castCount > 1 ? "s" : ""} dynamiquement — exactement autant que de visages extraits.
            </Note>
          </div>
        )}
      </div>
    </div>
  );
}
