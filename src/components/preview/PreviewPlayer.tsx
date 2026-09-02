/**
 * AGWÈ PREVIEW — Lecteur vidéo professionnel.
 * Rendu canvas image par image du Project, transport complet, timecode,
 * vitesse, qualité, volume, plein écran, mode comparaison (slider),
 * overlays Visual QA et état de génération en direct.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Clapperboard, Frame, Maximize, Minimize, VolumeX, Pause, Play, RotateCcw, ScanEye,
  SkipBack, SkipForward, Square, Volume2,
} from "lucide-react";
import { drawRawTake, fmtClock, fmtTimecode, renderFrame, type Project } from "../../agwe/preview";
import type { QualityReport } from "../../agwe/models";
import type { RenderMode } from "../../agwe/vfx";
import type { RenderOpts } from "../../agwe/preview";

export interface GeneratingState {
  label: string;
  sceneIndex: number;
  bars: { label: string; value: number }[];
  score: number;
}

interface Props {
  project: Project;
  generating: GeneratingState | null;
  envId: string;
  fx: string[];
  dof: number;
  mode: RenderMode;
  report: QualityReport | null;
  onOpenIntro: () => void;
  onSeek?: (t: number) => void;
  externalPlayhead?: number;
}

const QUALITIES = [
  { id: "480p", label: "480p · Draft", w: 854, h: 480 },
  { id: "720p", label: "720p · Studio", w: 1280, h: 720 },
  { id: "1080p", label: "1080p · Master", w: 1920, h: 1080 },
];
const SPEEDS = [0.5, 1, 1.5, 2];

const ZONE_Y: Record<string, number> = { back: 0.62, mid: 0.72, front: 0.85 };
const ZONE_S: Record<string, number> = { back: 0.55, mid: 0.8, front: 1.05 };

interface QALayers {
  chars: boolean;
  objects: boolean;
  anomalies: boolean;
  tracking: boolean;
  anatomy: boolean;
  scores: boolean;
}

export default function PreviewPlayer({ project, generating, envId, fx, dof, mode, report, onOpenIntro, onSeek, externalPlayhead }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const tRef = useRef(0);
  const lastRef = useRef(performance.now());
  const spokenRef = useRef(-1);
  const audioRef = useRef<{ ctx: AudioContext; gain: GainNode } | null>(null);

  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [quality, setQuality] = useState("720p");
  const [fullscreen, setFullscreen] = useState(false);
  const [compare, setCompare] = useState<null | { kind: "source" | "repaired"; split: number }>(null);
  const [visualQA, setVisualQA] = useState(false);
  const [layers, setLayers] = useState<QALayers>({ chars: true, objects: true, anomalies: true, tracking: false, anatomy: false, scores: true });

  tRef.current = t;
  const q = QUALITIES.find((x) => x.id === quality) ?? QUALITIES[1];

  /* ---- suivi du playhead externe (clic sur scène/timeline) ---- */
  useEffect(() => {
    if (externalPlayhead !== undefined && Math.abs(externalPlayhead - tRef.current) > 0.01) {
      setT(Math.min(externalPlayhead, project.total));
      cancelSpeech();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalPlayhead]);

  /* ---- audio bed ---- */
  const ensureAudio = useCallback(() => {
    if (audioRef.current) return audioRef.current;
    try {
      const ctx = new AudioContext();
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 240;
      const o1 = ctx.createOscillator();
      o1.frequency.value = 55;
      const o2 = ctx.createOscillator();
      o2.type = "triangle";
      o2.frequency.value = 110.7;
      o1.connect(lp);
      o2.connect(lp);
      lp.connect(gain);
      gain.connect(ctx.destination);
      o1.start();
      o2.start();
      audioRef.current = { ctx, gain };
      return audioRef.current;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const a = audioRef.current;
    if (a) a.gain.gain.value = muted || !playing ? 0 : volume * 0.16;
  }, [muted, playing, volume]);

  useEffect(() => () => { audioRef.current?.ctx.close().catch(() => {}); cancelSpeech(); }, []);

  function cancelSpeech() {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }

  /* ---- boucle de rendu ---- */
  useEffect(() => {
    let raf = 0;
    const opts: RenderOpts = { fx, dof, quality: 1, captions: true, envOverride: envId };
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - lastRef.current) / 1000);
      lastRef.current = now;
      let nt = tRef.current;
      if (playing && !generating) {
        nt = Math.min(project.total, nt + dt * speed);
        if (nt >= project.total) {
          setPlaying(false);
        } else {
          setT(nt);
          /* réplique traversée → TTS */
          const d = project.dialogues.findIndex((dd) => nt >= dd.start && nt <= dd.start + 0.12);
          if (d >= 0 && d !== spokenRef.current) {
            spokenRef.current = d;
            if (!muted && "speechSynthesis" in window) {
              const dd = project.dialogues[d];
              const u = new SpeechSynthesisUtterance(dd.text);
              u.lang = project.language === "Français" ? "fr-FR" : "en-US";
              u.rate = Math.min(2, speed);
              u.pitch = dd.tone === "colerique" ? 0.8 : dd.tone === "aimable" ? 1.15 : 1;
              u.volume = volume;
              window.speechSynthesis.speak(u);
            }
          }
        }
      }
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) {
        renderFrame(ctx, canvas.width, canvas.height, project, nt, opts);
        if (compare) drawCompare(ctx, canvas.width, canvas.height, nt, compare);
        if (visualQA) drawQAOverlay(ctx, canvas.width, canvas.height, nt);
        drawHud(ctx, canvas.width, canvas.height, nt);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed, project, fx, dof, envId, compare, visualQA, layers, muted, volume, generating]);

  function drawCompare(ctx: CanvasRenderingContext2D, w: number, h: number, nt: number, cmp: { kind: string; split: number }) {
    const splitX = w * cmp.split;
    const tmp = document.createElement("canvas");
    tmp.width = w;
    tmp.height = h;
    const tctx = tmp.getContext("2d")!;
    if (cmp.kind === "source") drawRawTake(tctx, w, h, project.characters, nt);
    else {
      /* ORIGINAL (avec anomalie simulée : teinte instable) vs REPAIRED */
      renderFrame(tctx, w, h, project, nt, { fx, dof, quality: 1, captions: true, envOverride: envId });
      tctx.fillStyle = "rgba(255,93,115,0.10)";
      tctx.fillRect(0, 0, w, h);
      tctx.font = "700 13px 'IBM Plex Mono', monospace";
      tctx.fillStyle = "#ff5d73";
      tctx.fillText("⚠ TEMPORAL DRIFT", 16, 40);
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, splitX, h);
    ctx.clip();
    ctx.drawImage(tmp, 0, 0);
    ctx.restore();
    /* poignée */
    ctx.fillStyle = "rgba(0,229,255,0.9)";
    ctx.fillRect(splitX - 1.5, 0, 3, h);
    ctx.beginPath();
    ctx.arc(splitX, h / 2, 16, 0, Math.PI * 2);
    ctx.fillStyle = "#04121a";
    ctx.fill();
    ctx.strokeStyle = "#00e5ff";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#00e5ff";
    ctx.font = "700 11px 'IBM Plex Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("◂ ▸", splitX, h / 2 + 4);
    ctx.textAlign = "left";
    ctx.font = "700 11px 'Chakra Petch', sans-serif";
    ctx.fillStyle = "#e8eef7";
    ctx.fillText(cmp.kind === "source" ? "SOURCE" : "ORIGINAL", 14, h * 0.075 + 20);
    ctx.textAlign = "right";
    ctx.fillText(cmp.kind === "source" ? "GENERATED" : "REPAIRED", w - 14, h * 0.075 + 20);
    ctx.textAlign = "left";
  }

  function charLayout(w: number, h: number, nt: number) {
    const ordered = [...project.characters].sort((a, b) => (ZONE_Y[a.zone] ?? 0.7) - (ZONE_Y[b.zone] ?? 0.7));
    return ordered.map((c, i) => {
      const isExtra = c.role === "extra";
      const x = isExtra ? 0.08 + ((i * 0.37 + (c.name.length * 7) % 10) / 10) * 0.84 : Math.min(0.92, 0.24 + i * 0.18);
      const s = ZONE_S[isExtra ? "back" : c.zone] ?? 0.8;
      const baseY = h * (ZONE_Y[isExtra ? "back" : c.zone] ?? 0.72);
      const sway = Math.sin(nt * 1.6 + c.name.length) * 3 * s;
      return { c, cx: x * w + sway, baseY, s, headR: 30 * s };
    });
  }

  function drawQAOverlay(ctx: CanvasRenderingContext2D, w: number, h: number, nt: number) {
    const scene = project.scenes.find((s) => nt >= s.start && nt < s.end);
    const layout = charLayout(w, h, nt);
    ctx.lineWidth = 1.5;

    if (layers.chars || layers.tracking || layers.anatomy) {
      layout.forEach(({ c, cx, baseY, headR }) => {
        if (c.role === "extra" && !layers.chars) return;
        /* boîte visage */
        if (layers.chars) {
          ctx.strokeStyle = `${c.color}cc`;
          ctx.strokeRect(cx - headR, baseY - headR * 2.4, headR * 2, headR * 2.4);
          ctx.font = "700 10px 'IBM Plex Mono', monospace";
          ctx.fillStyle = c.color;
          const conf = 90 + ((c.name.length * 13) % 9);
          ctx.fillText(`${c.name.toUpperCase()} · ${conf}%`, cx - headR, baseY - headR * 2.4 - 6);
        }
        /* tracking */
        if (layers.tracking) {
          ctx.strokeStyle = `${c.color}66`;
          ctx.setLineDash([3, 4]);
          ctx.beginPath();
          for (let k = 0; k <= 8; k++) {
            const px = cx - 26 + k * 6.5;
            const py = baseY - headR * 1.3 + Math.sin((nt - k * 0.08) * 1.6 + c.name.length) * 3;
            if (k === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.stroke();
          ctx.setLineDash([]);
        }
        /* points anatomiques */
        if (layers.anatomy) {
          ctx.fillStyle = "#f5c542";
          const pts: [number, number][] = [
            [cx, baseY - headR * 1.25],
            [cx - 24 * (headR / 30), baseY + 4],
            [cx + 24 * (headR / 30), baseY + 4],
            [cx - 34 * (headR / 30), baseY + 60 * (headR / 30)],
            [cx + 34 * (headR / 30), baseY + 60 * (headR / 30)],
          ];
          pts.forEach(([px, py]) => {
            ctx.beginPath();
            ctx.arc(px, py, 2.6, 0, Math.PI * 2);
            ctx.fill();
          });
        }
      });
    }

    /* objets de la scène */
    if (layers.objects && scene) {
      scene.objects.slice(0, 5).forEach((o, i) => {
        const ox = w * (0.14 + i * 0.18);
        const oy = h * 0.8;
        ctx.strokeStyle = "rgba(52,211,153,0.85)";
        ctx.strokeRect(ox, oy, 66, 40);
        ctx.font = "700 9px 'IBM Plex Mono', monospace";
        ctx.fillStyle = "#34d399";
        ctx.fillText(`${o.id} ${o.type.toUpperCase()}`, ox, oy - 5);
      });
    }

    /* anomalies dans la fenêtre courante */
    if (layers.anomalies && report) {
      report.anomalies
        .filter((a) => nt >= a.timeStart - 0.6 && nt <= a.timeEnd + 0.6 && a.status !== "ignored" && a.status !== "repaired")
        .forEach((a, i) => {
          const bx = a.frameBox.x * w;
          const by = a.frameBox.y * h;
          const pulse = 0.6 + 0.4 * Math.sin(nt * 6);
          ctx.strokeStyle = `rgba(255,93,115,${pulse})`;
          ctx.lineWidth = 2;
          ctx.strokeRect(bx, by, a.frameBox.w * w, a.frameBox.h * h);
          ctx.fillStyle = "rgba(255,93,115,0.9)";
          ctx.font = "700 10px 'IBM Plex Mono', monospace";
          ctx.fillText(`${a.type.toUpperCase()} · ${Math.round(a.confidence * 100)}%`, bx, by - 6);
          if (i === 0) {
            ctx.fillStyle = "rgba(255,93,115,0.75)";
            ctx.fillText(`⚠ ${fmtTimecode(a.timeStart)}`, bx, by + a.frameBox.h * h + 14);
          }
        });
    }

    /* HUD scores */
    if (layers.scores && scene) {
      const lip = report?.engines.find((e) => e.engineId === "lipsync")?.score ?? 97.4;
      const items = [
        { k: "COHÉRENCE", v: scene.quality },
        { k: "LIPSYNC", v: lip },
      ];
      items.forEach((it, i) => {
        const x = w - 150;
        const y = h * 0.075 + 14 + i * 26;
        ctx.fillStyle = "rgba(4,6,11,0.7)";
        ctx.beginPath();
        ctx.roundRect(x, y, 136, 20, 5);
        ctx.fill();
        ctx.font = "700 9px 'IBM Plex Mono', monospace";
        ctx.fillStyle = "#8b98ab";
        ctx.fillText(it.k, x + 8, y + 13);
        ctx.fillStyle = it.v >= 92 ? "#34d399" : it.v >= 85 ? "#f5c542" : "#ff5d73";
        ctx.textAlign = "right";
        ctx.fillText(`${it.v.toFixed(1)}%`, x + 128, y + 13);
        ctx.textAlign = "left";
      });
    }
  }

  function drawHud(ctx: CanvasRenderingContext2D, w: number, h: number, nt: number) {
    const scene = project.scenes.find((s) => nt >= s.start && nt < s.end);
    ctx.font = "700 10px 'IBM Plex Mono', monospace";
    ctx.fillStyle = "rgba(232,238,247,0.75)";
    ctx.fillText(scene ? `SCENE ${String(scene.index + 1).padStart(2, "0")} · ${scene.camera.shot.toUpperCase()} · ${scene.lighting}` : "—", 14, h * 0.075 + 20);
    ctx.textAlign = "right";
    ctx.fillText(fmtTimecode(nt, project.fps), w - 14, h - h * 0.075 - 10);
    ctx.textAlign = "left";
  }

  /* ---- transport ---- */
  const seek = (nt: number) => {
    const clamped = Math.max(0, Math.min(project.total, nt));
    setT(clamped);
    cancelSpeech();
    spokenRef.current = -1;
    onSeek?.(clamped);
  };
  const togglePlay = () => {
    if (!playing) {
      ensureAudio()?.ctx.resume().catch(() => {});
      if (tRef.current >= project.total - 0.05) setT(0);
    } else {
      cancelSpeech();
    }
    setPlaying((p) => !p);
  };
  const stop = () => {
    setPlaying(false);
    cancelSpeech();
    seek(0);
  };
  const frameStep = (dir: 1 | -1) => {
    setPlaying(false);
    seek(tRef.current + dir / project.fps);
  };
  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      setFullscreen(false);
    } else {
      wrapRef.current?.requestFullscreen().catch(() => {});
      setFullscreen(true);
    }
  };
  useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  /* clavier */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.code === "ArrowLeft") seek(tRef.current - 5);
      else if (e.code === "ArrowRight") seek(tRef.current + 5);
      else if (e.key === "f") toggleFullscreen();
      else if (e.key === "m") setMuted((m) => !m);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.total]);

  /* ---- barre de progression ---- */
  const barRef = useRef<HTMLDivElement>(null);
  const dragSeek = (e: React.PointerEvent) => {
    const el = barRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    seek(((e.clientX - r.left) / r.width) * project.total);
  };

  /* ---- slider comparaison ---- */
  const cmpDrag = (e: React.PointerEvent) => {
    if (!compare) return;
    const el = wrapRef.current?.querySelector("canvas");
    if (!el) return;
    const r = el.getBoundingClientRect();
    setCompare({ ...compare, split: Math.max(0.05, Math.min(0.95, (e.clientX - r.left) / r.width)) });
  };

  const sceneNow = project.scenes.find((s) => t >= s.start && t < s.end);
  const progress = project.total > 0 ? (t / project.total) * 100 : 0;

  return (
    <div className="panel overflow-hidden">
      {/* barre supérieure du lecteur */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] px-4 py-2.5">
        <span className="eyebrow flex items-center gap-2 text-cyan">
          <Clapperboard size={14} /> Moniteur
        </span>
        <span className="font-mono rounded-md border border-white/10 bg-abyss px-2 py-1 text-[10px] font-bold text-fog">
          {sceneNow ? `SCENE ${String(sceneNow.index + 1).padStart(2, "0")}` : "—"} · {project.resolution} · {project.fps} i/s
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <select value={quality} onChange={(e) => setQuality(e.target.value)} className="field h-8 rounded-md px-2 font-mono text-[10.5px] font-bold text-fog" aria-label="Qualité">
            {QUALITIES.map((x) => (
              <option key={x.id} value={x.id} className="bg-panel text-frost">{x.label}</option>
            ))}
          </select>
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="field h-8 rounded-md px-2 font-mono text-[10.5px] font-bold text-fog" aria-label="Vitesse">
            {SPEEDS.map((s) => (
              <option key={s} value={s} className="bg-panel text-frost">×{s}</option>
            ))}
          </select>
          <button
            onClick={() => setCompare(compare ? null : { kind: "source", split: 0.5 })}
            className={`btn-ghost flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[10px] font-bold uppercase tracking-wider ${compare ? "!border-cyan/60 !text-cyan" : "text-fog"}`}
            title="Comparer SOURCE vs GENERATED"
          >
            <Frame size={12} /> Compare
          </button>
          {compare && (
            <button
              onClick={() => setCompare({ kind: compare.kind === "source" ? "repaired" : "source", split: compare.split })}
              className="btn-ghost h-8 rounded-md px-2.5 text-[10px] font-bold uppercase tracking-wider text-gold"
            >
              {compare.kind === "source" ? "→ Original vs Repaired" : "→ Source vs Generated"}
            </button>
          )}
          <button
            onClick={() => setVisualQA((v) => !v)}
            className={`btn-ghost flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[10px] font-bold uppercase tracking-wider ${visualQA ? "!border-coral/60 !text-coral" : "text-fog"}`}
            title="Overlays Visual QA"
          >
            <ScanEye size={12} /> Visual QA
          </button>
          <button onClick={onOpenIntro} className="btn-ghost flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[10px] font-bold uppercase tracking-wider text-fog" title="Prévisualiser l'intro">
            <Play size={11} /> Intro
          </button>
          <button onClick={toggleFullscreen} className="btn-ghost grid h-8 w-8 place-items-center rounded-md text-fog" aria-label="Plein écran">
            {fullscreen ? <Minimize size={13} /> : <Maximize size={13} />}
          </button>
        </div>
      </div>

      {/* toggles des overlays QA */}
      {visualQA && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-white/[0.06] bg-coral/[0.03] px-4 py-2">
          <span className="font-mono text-[9.5px] font-bold uppercase tracking-wider text-coral">Overlays</span>
          {(
            [
              ["chars", "Personnages"],
              ["objects", "Objets"],
              ["anomalies", "Anomalies"],
              ["tracking", "Tracking"],
              ["anatomy", "Anatomie"],
              ["scores", "Scores"],
            ] as [keyof QALayers, string][]
          ).map(([k, label]) => (
            <label key={k} className="flex cursor-pointer items-center gap-1.5 text-[10.5px] font-bold text-fog hover:text-frost">
              <input type="checkbox" checked={layers[k]} onChange={() => setLayers((l) => ({ ...l, [k]: !l[k] }))} className="h-3.5 w-3.5 accent-[#ff5d73]" />
              {label}
            </label>
          ))}
        </div>
      )}

      {/* zone image */}
      <div ref={wrapRef} className="relative bg-abyss" onPointerMove={compare ? cmpDrag : undefined}>
        {generating ? (
          <div className="relative flex aspect-video flex-col items-center justify-center gap-5 overflow-hidden">
            <div className="absolute inset-0 opacity-40" style={{ background: "radial-gradient(ellipse at 50% 40%, rgba(0,229,255,0.12), transparent 60%)" }} />
            <div className="grain animate-grain absolute inset-0" />
            <p className="font-mono text-[13px] font-bold tracking-[0.3em] text-cyan">
              GENERATING SCENE {String(generating.sceneIndex + 1).padStart(2, "0")}
            </p>
            <div className="w-[min(420px,80%)] space-y-2.5">
              {generating.bars.map((b) => (
                <div key={b.label}>
                  <div className="mb-1 flex justify-between font-mono text-[9px] font-bold uppercase tracking-wider text-fog">
                    <span>{b.label}</span>
                    <span className="text-cyan">{Math.round(b.value)}%</span>
                  </div>
                  <div className="h-[7px] overflow-hidden rounded-full bg-white/[0.06]">
                    <div className="flowbar h-full rounded-full transition-[width] duration-300" style={{ width: `${b.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="text-center">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-fog">Quality Score</p>
              <p className="font-display text-[34px] font-bold text-mint">{generating.score.toFixed(1)}%</p>
            </div>
          </div>
        ) : (
          <canvas ref={canvasRef} width={q.w} height={q.h} className="block aspect-video w-full cursor-crosshair" />
        )}
      </div>

      {/* barre de progression */}
      <div className="px-4 pt-3">
        <div
          ref={barRef}
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            dragSeek(e);
          }}
          onPointerMove={(e) => e.buttons === 1 && dragSeek(e)}
          className="group relative h-[10px] cursor-pointer rounded-full bg-white/[0.07]"
          role="slider"
          aria-label="Position de lecture"
          aria-valuenow={Math.round(progress)}
        >
          {/* marqueurs de scènes */}
          {project.scenes.map((s) => (
            <span
              key={s.sceneId}
              className="absolute top-0 h-full w-[2px] bg-white/20"
              style={{ left: `${(s.start / project.total) * 100}%` }}
            />
          ))}
          {/* anomalies */}
          {report?.anomalies.filter((a) => a.status === "detected").map((a) => (
            <span key={a.id} className="absolute top-[-3px] h-4 w-[3px] rounded-full bg-coral shadow-[0_0_8px_rgba(255,93,115,0.8)]" style={{ left: `${(a.timeStart / project.total) * 100}%` }} />
          ))}
          <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan to-volt shadow-[0_0_12px_rgba(0,229,255,0.5)]" style={{ width: `${progress}%` }} />
          <span className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-frost opacity-0 shadow-[0_0_10px_rgba(0,229,255,0.9)] transition-opacity group-hover:opacity-100" style={{ left: `calc(${progress}% - 7px)` }} />
        </div>
      </div>

      {/* transport */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        <span className="font-mono min-w-[150px] text-[12.5px] font-bold tabular-nums text-cyan">
          {fmtClock(t)} <span className="text-fog/50">/ {fmtClock(project.total)}</span>
        </span>

        <div className="flex items-center gap-1">
          <button onClick={() => frameStep(-1)} className="btn-ghost grid h-8 w-8 place-items-center rounded-md text-fog" title="Image précédente" aria-label="Image précédente">
            <Frame size={13} />
          </button>
          <button onClick={() => seek(tRef.current - 5)} className="btn-ghost grid h-8 w-8 place-items-center rounded-md text-fog" title="Reculer 5 s" aria-label="Reculer 5 secondes">
            <SkipBack size={14} />
          </button>
          <button onClick={stop} className="btn-ghost grid h-8 w-8 place-items-center rounded-md text-fog" title="Stop" aria-label="Stop">
            <Square size={13} />
          </button>
          <button
            onClick={togglePlay}
            className="btn-neon grid h-11 w-11 place-items-center rounded-full"
            title={playing ? "Pause (espace)" : "Lecture (espace)"}
            aria-label={playing ? "Pause" : "Lecture"}
          >
            {playing ? <Pause size={18} /> : <Play size={18} className="translate-x-[1px]" />}
          </button>
          <button onClick={() => { seek(0); setPlaying(true); ensureAudio()?.ctx.resume().catch(() => {}); }} className="btn-ghost grid h-8 w-8 place-items-center rounded-md text-fog" title="Replay" aria-label="Replay">
            <RotateCcw size={14} />
          </button>
          <button onClick={() => seek(tRef.current + 5)} className="btn-ghost grid h-8 w-8 place-items-center rounded-md text-fog" title="Avancer 5 s" aria-label="Avancer 5 secondes">
            <SkipForward size={14} />
          </button>
          <button onClick={() => frameStep(1)} className="btn-ghost grid h-8 w-8 place-items-center rounded-md text-fog" title="Image suivante" aria-label="Image suivante">
            <Frame size={13} />
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setMuted((m) => !m)} className="btn-ghost grid h-8 w-8 place-items-center rounded-md text-fog" aria-label={muted ? "Activer le son" : "Couper le son"}>
            {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            onChange={(e) => {
              setVolume(Number(e.target.value));
              setMuted(false);
            }}
            className="w-24"
            aria-label="Volume"
            style={{ accentColor: "#00e5ff" }}
          />
          <span className="font-mono w-9 text-[10.5px] font-bold text-fog">{Math.round((muted ? 0 : volume) * 100)}%</span>
        </div>
      </div>
    </div>
  );
}
