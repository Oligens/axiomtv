/**
 * Studio de Rendu Cinématique & VFX.
 * Prévisualisation canvas animée : la prise brute (acteur assis) est
 * transfigurée en direct selon le mode (intime / action), l'environnement et
 * les couches d'effets — le curseur « morphing » révèle la transformation.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Clapperboard, Layers, Pause, Play, Sparkles, Users, Wand2 } from "lucide-react";
import { ENVIRONMENTS, FX_LAYERS, envById, type RenderMode, type VfxSuggestion } from "../agwe/vfx";

interface CastSlot {
  id: string;
  name: string;
  color: string;
  role: "actor" | "extra";
  enabled: boolean;
  zone?: "front" | "mid" | "back";
}

interface Props {
  mode: RenderMode;
  onMode: (m: RenderMode) => void;
  envId: string;
  onEnv: (id: string) => void;
  fx: Set<string>;
  onToggleFx: (id: string) => void;
  dof: number;
  onDof: (v: number) => void;
  morph: number;
  onMorph: (v: number) => void;
  suggestion: VfxSuggestion;
  cast: CastSlot[];
}

/* PRNG déterministe pour des particules stables */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  t: number,
  st: { mode: RenderMode; envId: string; fx: Set<string>; dof: number; morph: number; actors: CastSlot[]; extras: CastSlot[] }
) {
  const env = envById(st.envId);
  const action = st.mode === "action";
  const rnd = prng(1234);
  ctx.clearRect(0, 0, W, H);

  /* ---------- ciel / fond ---------- */
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, env.sky[0]);
  sky.addColorStop(1, env.sky[1]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  const horizon = H * 0.58;
  const shake = st.fx.has("shake") && action ? Math.sin(t * 13) * 3 + Math.cos(t * 7.3) * 2 : 0;
  ctx.save();
  ctx.translate(shake, shake * 0.6);

  /* ---------- profondeur de champ : flou du fond ---------- */
  const blur = st.fx.has("bokeh") || st.dof > 0.5 ? Math.round(st.dof * 6) : Math.round(st.dof * 3);
  ctx.filter = `blur(${blur}px)`;

  if (action) {
    /* skyline défilant en parallaxe */
    const scroll = (t * (st.fx.has("speed") ? 260 : 60)) % W;
    for (let layer = 0; layer < 2; layer++) {
      const speed = layer === 0 ? 0.35 : 0.8;
      const off = (scroll * speed) % W;
      ctx.fillStyle = layer === 0 ? "rgba(20,30,52,0.9)" : "rgba(12,16,28,0.95)";
      for (let i = -1; i < 9; i++) {
        const bw = 90 + rnd() * 80;
        const bh = 60 + rnd() * 140;
        const bx = i * 170 - off;
        ctx.fillRect(bx, horizon - bh, bw, bh + 40);
        /* fenêtres néon */
        if (layer === 1 && st.envId === "urbain") {
          ctx.fillStyle = `rgba(0,229,255,${0.25 + rnd() * 0.3})`;
          for (let wI = 0; wI < 5; wI++) ctx.fillRect(bx + 12 + wI * 16, horizon - bh + 14 + (wI % 3) * 22, 7, 9);
          ctx.fillStyle = "rgba(12,16,28,0.95)";
        }
      }
    }
    /* route */
    ctx.fillStyle = "#0a0c12";
    ctx.fillRect(0, horizon, W, H - horizon);
    /* lignes de vitesse sur l'asphalte */
    if (st.fx.has("speed")) {
      ctx.strokeStyle = "rgba(255,255,255,0.28)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 14; i++) {
        const y = horizon + 20 + i * 14;
        const x = ((t * 900 + i * 137) % (W + 200)) - 100;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 70 + i * 6, y);
        ctx.stroke();
      }
    }
  } else {
    /* décor intime : murs + fenêtre / table */
    ctx.fillStyle = "rgba(30,22,16,0.85)";
    ctx.fillRect(0, 0, W, horizon);
    if (st.envId === "bureau") {
      ctx.fillStyle = "rgba(60,90,140,0.5)";
      ctx.fillRect(W * 0.12, H * 0.1, W * 0.5, horizon - H * 0.12);
      ctx.fillStyle = "rgba(127,178,255,0.35)";
      for (let i = 0; i < 6; i++) ctx.fillRect(W * 0.14 + i * W * 0.075, H * 0.14, W * 0.05, horizon - H * 0.2);
    } else {
      /* chandelles / lueurs chaudes */
      const nGlow = st.envId === "resto" ? 5 : 3;
      for (let i = 0; i < nGlow; i++) {
        const gx = W * (0.15 + (i / nGlow) * 0.7);
        const flick = st.fx.has("flicker") ? 0.5 + 0.5 * Math.sin(t * 6 + i * 2) : 0.8;
        const g = ctx.createRadialGradient(gx, horizon - 40, 4, gx, horizon - 40, 90);
        g.addColorStop(0, `rgba(245,197,66,${0.5 * flick})`);
        g.addColorStop(1, "rgba(245,197,66,0)");
        ctx.fillStyle = g;
        ctx.fillRect(gx - 90, horizon - 130, 180, 180);
      }
    }
    ctx.fillStyle = "rgba(24,18,14,0.9)";
    ctx.fillRect(0, horizon, W, H - horizon);
  }
  ctx.filter = "none";

  /* ---------- figurants (arrière-plan, flous & sombres) ---------- */
  st.extras.forEach((ex, i) => {
    const exr = prng(700 + i);
    const cx = W * (0.08 + exr() * 0.84);
    const depth = ex.zone === "back" ? 0.34 : ex.zone === "mid" ? 0.5 : 0.66;
    const cy = horizon + 10 + depth * 30;
    const s = 0.5 + depth * 0.5;
    ctx.filter = `blur(${Math.round((1 - depth) * 4 + 1)}px)`;
    ctx.fillStyle = `rgba(14,16,26,${0.55 + depth * 0.3})`;
    ctx.beginPath();
    ctx.ellipse(cx, cy - 46 * s, 13 * s, 16 * s, 0, 0, 7);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - 26 * s, cy + 60 * s);
    ctx.quadraticCurveTo(cx - 20 * s, cy - 20 * s, cx, cy - 26 * s);
    ctx.quadraticCurveTo(cx + 20 * s, cy - 20 * s, cx + 26 * s, cy + 60 * s);
    ctx.closePath();
    ctx.fill();
    ctx.filter = "none";
  });

  /* ---------- acteurs principaux (premier plan, nets, rim-light) ---------- */
  st.actors.forEach((ac, i) => {
    const n = st.actors.length || 1;
    const cx = W * ((i + 0.5) / n) * 0.72 + W * 0.14;
    const breath = st.fx.has("micro") && !action ? Math.sin(t * 1.8 + i) * 2 : 0;
    const blink = st.fx.has("micro") && !action && Math.sin(t * 2.4 + i * 3) > 0.985;
    const baseY = action ? horizon + 60 : horizon + 70;
    const s = action ? 0.9 : 1;

    /* halo d'accent */
    const halo = ctx.createRadialGradient(cx, baseY - 90 * s, 10, cx, baseY - 90 * s, 120 * s);
    halo.addColorStop(0, `${ac.color}30`);
    halo.addColorStop(1, `${ac.color}00`);
    ctx.fillStyle = halo;
    ctx.fillRect(cx - 130 * s, baseY - 220 * s, 260 * s, 260 * s);

    /* corps */
    ctx.fillStyle = "#0b0e16";
    ctx.beginPath();
    ctx.ellipse(cx, baseY - 130 * s + breath, 30 * s, 36 * s, 0, 0, 7);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - 62 * s, baseY + 90 * s);
    ctx.quadraticCurveTo(cx - 52 * s, baseY - 60 * s + breath, cx, baseY - 80 * s + breath);
    ctx.quadraticCurveTo(cx + 52 * s, baseY - 60 * s + breath, cx + 62 * s, baseY + 90 * s);
    ctx.closePath();
    ctx.fill();

    /* rim-light accent */
    ctx.strokeStyle = `${ac.color}cc`;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.ellipse(cx - 4 * s, baseY - 130 * s + breath, 30 * s, 36 * s, 0, Math.PI * 0.75, Math.PI * 1.6);
    ctx.stroke();

    /* yeux (micro-expressions) */
    if (!action) {
      ctx.fillStyle = blink ? ac.color : "rgba(232,238,247,0.85)";
      const ey = baseY - 134 * s + breath;
      ctx.fillRect(cx - 10 * s, ey, 7 * s, blink ? 1.4 : 3 * s);
      ctx.fillRect(cx + 3 * s, ey, 7 * s, blink ? 1.4 : 3 * s);
    }

    /* étiquette */
    ctx.fillStyle = ac.color;
    ctx.font = "600 11px Manrope, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(ac.name.toUpperCase(), cx, baseY + 112 * s);
  });

  /* ---------- couches FX premier plan ---------- */
  if (action) {
    if (st.fx.has("sparks")) {
      for (let i = 0; i < 26; i++) {
        const sr = prng(900 + i);
        const p = (t * (0.5 + sr() * 0.8) + sr()) % 1;
        const sx = sr() * W;
        const sy = horizon + sr() * (H - horizon);
        ctx.fillStyle = `rgba(255,${140 + Math.floor(sr() * 100)},60,${(1 - p) * 0.8})`;
        ctx.beginPath();
        ctx.arc(sx + p * 40, sy - p * 30, 1.6, 0, 7);
        ctx.fill();
      }
    }
    if (st.fx.has("muzzle") && Math.sin(t * 5) > 0.86) {
      const mx = W * (0.3 + 0.4 * ((Math.floor(t * 1.3) % 2) as number));
      const g = ctx.createRadialGradient(mx, horizon - 20, 2, mx, horizon - 20, 70);
      g.addColorStop(0, "rgba(255,240,180,0.95)");
      g.addColorStop(1, "rgba(255,140,40,0)");
      ctx.fillStyle = g;
      ctx.fillRect(mx - 70, horizon - 90, 140, 140);
    }
    if (st.fx.has("smoke")) {
      for (let i = 0; i < 6; i++) {
        const smr = prng(1100 + i);
        const px = (smr() * W + t * 20) % W;
        const py = horizon - 30 - smr() * 120 + Math.sin(t * 0.7 + i) * 12;
        const g = ctx.createRadialGradient(px, py, 5, px, py, 60);
        g.addColorStop(0, "rgba(120,120,135,0.16)");
        g.addColorStop(1, "rgba(120,120,135,0)");
        ctx.fillStyle = g;
        ctx.fillRect(px - 60, py - 60, 120, 120);
      }
    }
    if (st.fx.has("flames")) {
      for (let i = 0; i < 18; i++) {
        const fr = prng(1300 + i);
        const fx2 = fr() * W;
        const life = (t * (0.8 + fr()) + fr()) % 1;
        const fy = horizon + 30 - life * 90;
        ctx.fillStyle = `rgba(255,${90 + Math.floor(life * 120)},30,${(1 - life) * 0.7})`;
        ctx.beginPath();
        ctx.ellipse(fx2, fy, 4 + (1 - life) * 5, 8 + (1 - life) * 10, 0, 0, 7);
        ctx.fill();
      }
    }
  } else {
    if (st.fx.has("dust")) {
      for (let i = 0; i < 40; i++) {
        const dr = prng(500 + i);
        const px = (dr() * W + Math.sin(t * 0.4 + i) * 14) % W;
        const py = (dr() * H + t * 8 * (0.3 + dr())) % H;
        ctx.fillStyle = `rgba(245,220,160,${0.12 + dr() * 0.2})`;
        ctx.beginPath();
        ctx.arc(px, py, dr() * 1.6 + 0.5, 0, 7);
        ctx.fill();
      }
    }
    if (st.fx.has("reflect")) {
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      for (let i = 0; i < 3; i++) {
        const rx = W * (0.2 + i * 0.3) + Math.sin(t * 0.8 + i) * 20;
        ctx.beginPath();
        ctx.ellipse(rx, horizon + 30, 60, 8, 0, 0, 7);
        ctx.fill();
      }
    }
  }

  ctx.restore();

  /* ---------- vignette + grain ---------- */
  const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 0.9);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
}

/** Prise brute : l'acteur assis sur une chaise, éclairage plat de studio. */
function drawSource(ctx: CanvasRenderingContext2D, W: number, H: number, actors: CastSlot[]) {
  ctx.fillStyle = "#14161c";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#1d2027";
  ctx.fillRect(0, H * 0.72, W, H * 0.28);
  /* grille studio */
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  for (let i = 0; i < 10; i++) {
    ctx.beginPath();
    ctx.moveTo(W * (i / 10), H * 0.72);
    ctx.lineTo(W * (i / 10) * 1.4 - W * 0.2, H);
    ctx.stroke();
  }
  actors.forEach((ac, i) => {
    const n = actors.length || 1;
    const cx = W * ((i + 0.5) / n) * 0.7 + W * 0.15;
    const by = H * 0.72;
    /* chaise */
    ctx.fillStyle = "#262a33";
    ctx.fillRect(cx - 34, by - 6, 68, 8);
    ctx.fillRect(cx - 34, by - 60, 6, 60);
    ctx.fillRect(cx - 30, by + 2, 8, 34);
    ctx.fillRect(cx + 22, by + 2, 8, 34);
    /* silhouette assise */
    ctx.fillStyle = "#0d0f14";
    ctx.beginPath();
    ctx.ellipse(cx + 4, by - 96, 26, 30, 0, 0, 7);
    ctx.fill();
    ctx.fillRect(cx - 26, by - 70, 60, 66);
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, by - 96, 26, 30, 0, Math.PI * 0.8, Math.PI * 1.5);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = "600 10px Manrope, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(ac.name.toUpperCase(), cx, by + 56);
  });
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.font = "700 11px Manrope, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("PRISE BRUTE — plateau neutre", 14, 20);
}

export default function VfxStudio({ mode, onMode, envId, onEnv, fx, onToggleFx, dof, onDof, morph, onMorph, suggestion, cast }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [playing, setPlaying] = useState(true);
  const timeRef = useRef(0);
  const rafRef = useRef(0);

  const actors = useMemo(() => cast.filter((c) => c.enabled && c.role === "actor"), [cast]);
  const extras = useMemo(() => cast.filter((c) => c.enabled && c.role === "extra"), [cast]);
  const envs = useMemo(() => ENVIRONMENTS.filter((e) => e.mode === mode), [mode]);
  const layers = useMemo(() => FX_LAYERS.filter((l) => l.mode === mode), [mode]);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const W = (cv.width = cv.clientWidth * 2);
    const H = (cv.height = Math.round((cv.clientWidth * 9) / 16) * 2);

    const st = { mode, envId, fx, dof, morph, actors, extras };
    let last = performance.now();

    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (playing) timeRef.current += dt;
      const t = timeRef.current;

      if (st.morph < 0.02) {
        drawSource(ctx, W, H, st.actors.length ? st.actors : extras.slice(0, 2));
      } else if (st.morph > 0.98) {
        drawFrame(ctx, W, H, t, st);
      } else {
        drawSource(ctx, W, H, st.actors.length ? st.actors : extras.slice(0, 2));
        ctx.save();
        ctx.globalAlpha = st.morph;
        drawFrame(ctx, W, H, t, st);
        ctx.restore();
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [mode, envId, fx, dof, morph, actors, extras, playing]);

  const env = envById(envId);

  return (
    <motion.div initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.5 }} className="panel panel-volt overflow-hidden">
      {/* -------- barre de mode -------- */}
      <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.06] px-5 py-3.5">
        <span className="eyebrow text-volt">Moteur VFX · vidéo-vers-vidéo</span>
        <div className="ml-auto flex rounded-lg border border-white/10 bg-white/[0.03] p-1">
          {(
            [
              ["intimate", "Intime & Réaliste"],
              ["action", "Action & SF"],
            ] as [RenderMode, string][]
          ).map(([m, label]) => (
            <button
              key={m}
              onClick={() => onMode(m)}
              className={`rounded-md px-4 py-1.5 text-[11.5px] font-bold uppercase tracking-wider transition-all ${
                mode === m ? "bg-volt/20 text-[#c9a0f5] shadow-[0_0_14px_rgba(157,78,221,0.3)]" : "text-fog hover:text-frost"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="hidden items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-fog/60 md:flex">
          <Sparkles size={12} className="text-gold" /> suggestion script · {Math.round(suggestion.confidence * 100)}%
        </span>
      </div>

      <div className="grid gap-5 p-5 lg:grid-cols-[1.5fr_1fr]">
        {/* -------- preview canvas -------- */}
        <div>
          <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-abyss">
            <canvas ref={canvasRef} className="block h-auto w-full" />
            {/* HUD */}
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-3">
              <span className="rounded-md bg-abyss/80 px-2.5 py-1 font-mono text-[10px] font-bold tracking-wider text-frost backdrop-blur-sm">
                {env.label.toUpperCase()} · {mode === "action" ? "VFX" : "INTIME"}
              </span>
              <span className="rounded-md bg-abyss/80 px-2.5 py-1 font-mono text-[10px] font-bold tracking-wider backdrop-blur-sm" style={{ color: env.accent }}>
                MORPH {Math.round(morph * 100)}%
              </span>
            </div>
            <button
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? "Mettre en pause" : "Lire"}
              className="absolute bottom-3 left-3 grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-abyss/80 text-frost backdrop-blur-sm transition-colors hover:border-volt/60 hover:text-[#c9a0f5]"
            >
              {playing ? <Pause size={15} /> : <Play size={15} />}
            </button>
          </div>

          {/* -------- curseur de morphing -------- */}
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-[10.5px] font-bold uppercase tracking-wider">
              <span className="text-fog">Prise brute</span>
              <span className="flex items-center gap-1.5 text-volt">
                <Wand2 size={12} /> Transformation IA
              </span>
              <span className="text-fog">Rendu cinématique</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={morph}
              onChange={(e) => onMorph(Number(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-full"
              style={{
                background: `linear-gradient(90deg, #9d4edd ${morph * 100}%, rgba(255,255,255,0.1) ${morph * 100}%)`,
              }}
              aria-label="Curseur de morphing"
            />
          </div>

          {/* -------- lignes motrices du script -------- */}
          {suggestion.drivers.length > 0 && (
            <div className="mt-4 space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-fog/70">Le scénario pilote le rendu</p>
              {suggestion.drivers.slice(0, 3).map((d, i) => (
                <p key={i} className="flex items-start gap-2 rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[11.5px] leading-snug text-fog">
                  <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${d.kind === "action" ? "bg-coral" : "bg-gold"}`} />
                  <span className="line-clamp-1">« {d.line} »</span>
                </p>
              ))}
            </div>
          )}
        </div>

        {/* -------- réglages -------- */}
        <div className="flex flex-col gap-4">
          {/* environnements */}
          <div>
            <p className="mb-2 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.2em] text-fog">
              <Clapperboard size={13} className="text-volt" /> Environnement
            </p>
            <div className="grid grid-cols-2 gap-2">
              {envs.map((e) => (
                <button
                  key={e.id}
                  onClick={() => onEnv(e.id)}
                  className={`rounded-lg border p-2.5 text-left transition-all ${
                    envId === e.id ? "border-volt/60 bg-volt/[0.1] shadow-[0_0_16px_rgba(157,78,221,0.2)]" : "border-white/[0.08] bg-white/[0.02] hover:border-white/25"
                  }`}
                >
                  <span className="block text-[12px] font-bold" style={{ color: envId === e.id ? e.accent : "#e8eef7" }}>
                    {e.label}
                  </span>
                  <span className="mt-0.5 block text-[10px] leading-snug text-fog/80">{e.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* couches FX */}
          <div>
            <p className="mb-2 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.2em] text-fog">
              <Layers size={13} className="text-volt" /> Couches d'effets
            </p>
            <div className="flex flex-wrap gap-1.5">
              {layers.map((l) => {
                const on = fx.has(l.id);
                return (
                  <button
                    key={l.id}
                    onClick={() => onToggleFx(l.id)}
                    title={l.desc}
                    className={`rounded-full border px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-wider transition-all ${
                      on ? "border-volt/60 bg-volt/[0.14] text-[#c9a0f5] shadow-[0_0_12px_rgba(157,78,221,0.25)]" : "border-white/[0.09] bg-white/[0.02] text-fog hover:text-frost"
                    }`}
                  >
                    {l.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* profondeur de champ */}
          <div>
            <div className="mb-1.5 flex items-center justify-between text-[10.5px] font-bold uppercase tracking-wider text-fog">
              <span>Profondeur de champ</span>
              <span className="font-mono text-volt">ƒ/{(1.2 + dof * 6).toFixed(1)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={dof}
              onChange={(e) => onDof(Number(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-full"
              style={{ background: `linear-gradient(90deg, #00e5ff ${dof * 100}%, rgba(255,255,255,0.1) ${dof * 100}%)` }}
              aria-label="Profondeur de champ"
            />
          </div>

          {/* répartition casting */}
          <div className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-3">
            <p className="mb-2 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.2em] text-fog">
              <Users size={13} className="text-mint" /> Répartition au rendu
            </p>
            <div className="flex items-center gap-4">
              <div>
                <p className="font-mono text-[20px] font-bold text-cyan">{actors.length}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-fog">Acteurs · 1er plan</p>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div>
                <p className="font-mono text-[20px] font-bold text-gold">{extras.length}</p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-fog">Figurants · arrière-plan</p>
              </div>
            </div>
            <p className="mt-2 text-[10.5px] leading-relaxed text-fog/70">
              Les figurants peuplent le décor sans répliques ; les acteurs portent les dialogues synchronisés du scénario.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
