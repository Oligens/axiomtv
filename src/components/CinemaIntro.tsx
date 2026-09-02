/**
 * CinemaIntro — Cinématique d'introduction façon Netflix pour AgwèStream / Axiom TV.
 *   Étape 1  monogramme « A » + « AgweStream » + « Axiom-Tv vous présente »
 *   Étape 2  titre du film (Cinzel)
 *   Étape 3  crédits (réalisateurs & distribution)
 * Signature sonore « tudum » synthétisée (WebAudio), déclenchée sur
 * l'illumination du « A », avec fondu de sortie avant le titre.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Clapperboard, Play, Plus, RotateCcw, SkipForward, Trash2, Volume2, VolumeX } from "lucide-react";
import type { IntroMetadata } from "../data/content";

const T = {
  logoIn: 0.9, logoFull: 2.7,
  wordIn: 2.7, wordFull: 4.1,
  presIn: 4.1, presFull: 5.5,
  dipStart: 5.8, dipEnd: 6.6,
  titleIn: 6.6,
  credIn: 10.6, credEnd: 16.4,
  fadeOut: 16.6,
  end: 17.4,
};
const IMPACT = T.logoFull;
const JINGLE_AT = IMPACT - 0.08;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const easeInOut = (x: number) => {
  const t = clamp01(x);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
const seg = (t: number, a: number, b: number) => easeInOut((t - a) / (b - a));
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/* ---------- fond vivant (particules bokeh) ---------- */
function Backdrop() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let w = 0, h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      w = cv.offsetWidth; h = cv.offsetHeight;
      cv.width = w * dpr; cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    const colors = ["rgba(0,229,255,", "rgba(157,78,221,", "rgba(245,197,66,", "rgba(255,255,255,"];
    interface P { x: number; y: number; r: number; vx: number; vy: number; a: number; c: string; tw: number; big: boolean }
    const spawn = (anywhere: boolean): P => ({
      x: Math.random() * w, y: anywhere ? Math.random() * h : h + 10,
      r: Math.random() * 1.7 + 0.4, vx: (Math.random() - 0.5) * 0.14, vy: -(Math.random() * 0.3 + 0.07),
      a: Math.random() * 0.5 + 0.07, c: colors[Math.floor(Math.random() * colors.length)],
      tw: Math.random() * Math.PI * 2, big: Math.random() < 0.1,
    });
    const parts: P[] = Array.from({ length: 100 }, () => spawn(true));
    const loop = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.x += p.vx; p.y += p.vy; p.tw += 0.02;
        if (p.y < -12 || p.x < -12 || p.x > w + 12) Object.assign(p, spawn(false));
        const alpha = p.a * (0.55 + 0.45 * Math.sin(p.tw));
        if (p.big) {
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 7);
          g.addColorStop(0, `${p.c}${alpha * 0.45})`); g.addColorStop(1, `${p.c}0)`);
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 7, 0, 7); ctx.fill();
        } else {
          ctx.fillStyle = `${p.c}${alpha})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 h-full w-full" aria-hidden />;
}

/* ---------- monogramme A ---------- */
function LogoA({ p, bloom }: { p: number; bloom: number }) {
  const off = 1 - p;
  return (
    <div className="relative" style={{ opacity: p, transform: `scale(${lerp(0.82, 1, p)})` }}>
      <div
        className="absolute left-1/2 top-1/2 -z-10 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(0,229,255,0.28) 0%, rgba(157,78,221,0.16) 45%, transparent 70%)", opacity: bloom, animation: "pulseSoft 2.6s ease-in-out infinite" }}
      />
      <svg width="190" height="190" viewBox="0 0 40 40" fill="none" aria-hidden>
        <defs>
          <linearGradient id="cine-grad" x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
            <stop stopColor="#00E5FF" />
            <stop offset="1" stopColor="#9D4EDD" />
          </linearGradient>
        </defs>
        <path d="M20 2.5 35.5 11.4v17.2L20 37.5 4.5 28.6V11.4L20 2.5Z" stroke="url(#cine-grad)" strokeWidth="1.4" pathLength={1} strokeDasharray="1" strokeDashoffset={off} strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 6px rgba(0,229,255,0.8))" }} />
        <path d="M16.2 13.4v13.2L27 20l-10.8-6.6Z" fill="url(#cine-grad)" pathLength={1} style={{ opacity: p, filter: "drop-shadow(0 0 10px rgba(0,229,255,0.9))" }} />
      </svg>
    </div>
  );
}

function Wordmark({ p }: { p: number }) {
  return (
    <div className="font-display flex items-baseline font-bold" style={{ opacity: p, letterSpacing: `${lerp(0.55, 0.06, p)}em`, transform: `translateY(${lerp(14, 0, p)}px)` }}>
      {"AgweStream".split("").map((ch, i) => {
        const lp = clamp01((p - i * 0.03) / 0.5);
        return (
          <span key={i} style={{ opacity: lp, color: i >= 4 ? "#00E5FF" : "#e8eef7", textShadow: i >= 4 ? "0 0 18px rgba(0,229,255,0.8)" : "0 0 12px rgba(232,238,247,0.4)" }}>
            {ch}
          </span>
        );
      })}
    </div>
  );
}

/* ---------- signature sonore « tudum » ---------- */
function makeJingle(ctx: AudioContext, at: number, fadeStart: number, fadeEnd: number): { master: GainNode } {
  const master = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp).connect(ctx.destination);
  master.gain.setValueAtTime(1, at);
  master.gain.setValueAtTime(1, fadeStart);
  master.gain.linearRampToValueAtTime(0.0001, fadeEnd);

  /* nappe basse qui monte */
  const bed = ctx.createOscillator();
  bed.type = "sine";
  bed.frequency.setValueAtTime(52, at);
  bed.frequency.exponentialRampToValueAtTime(104, at + 7);
  const bg = ctx.createGain();
  bg.gain.setValueAtTime(0.0001, at);
  bg.gain.exponentialRampToValueAtTime(0.05, at + 3.5);
  bg.gain.exponentialRampToValueAtTime(0.0001, at + 10);
  bed.connect(bg).connect(master);
  bed.start(at); bed.stop(at + 10.5);

  /* « pi » — transient claquant */
  const nb = ctx.createBuffer(1, ctx.sampleRate * 0.12, ctx.sampleRate);
  const nd = nb.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * (1 - i / nd.length);
  const ns = ctx.createBufferSource(); ns.buffer = nb;
  const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 2600;
  const ng = ctx.createGain(); ng.gain.setValueAtTime(0.5, at);
  ns.connect(hp).connect(ng).connect(master);
  ns.start(at);

  /* « dou » — chute de sub */
  const sub = ctx.createOscillator();
  sub.type = "sine";
  sub.frequency.setValueAtTime(150, at);
  sub.frequency.exponentialRampToValueAtTime(52, at + 0.32);
  const sg = ctx.createGain();
  sg.gain.setValueAtTime(0.0001, at);
  sg.gain.exponentialRampToValueAtTime(0.92, at + 0.03);
  sg.gain.exponentialRampToValueAtTime(0.0001, at + 1.4);
  sub.connect(sg).connect(master);
  sub.start(at); sub.stop(at + 1.6);

  /* « gunnn » — basse résonnante en partielles */
  [52, 78, 104, 156].forEach((f, i) => {
    const o = ctx.createOscillator();
    o.type = i === 0 ? "sine" : "triangle";
    o.frequency.setValueAtTime(f * (1 + (i % 2 ? 0.003 : -0.003)), at + 0.05);
    const g = ctx.createGain();
    const amp = [0.5, 0.24, 0.16, 0.08][i];
    g.gain.setValueAtTime(0.0001, at + 0.05);
    g.gain.exponentialRampToValueAtTime(amp, at + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 3.3);
    o.connect(g).connect(master);
    o.start(at + 0.05); o.stop(at + 3.5);
  });

  /* carillon de marque */
  [392, 523.25, 1046.5, 1568].forEach((f, i) => {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = f;
    const g = ctx.createGain();
    const t0 = at + 0.1 + i * 0.09;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime([0.1, 0.12, 0.08, 0.05][i], t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.4);
    const pan = ctx.createStereoPanner();
    pan.pan.value = [-0.3, 0.2, -0.15, 0.3][i];
    o.connect(g).connect(pan).connect(master);
    o.start(t0); o.stop(t0 + 2.6);
  });

  return { master };
}

/* ================= lecteur d'intro ================= */
export default function CinemaIntro({ meta, onClose, onFinished }: { meta: IntroMetadata; onClose: () => void; onFinished?: () => void }) {
  const [time, setTime] = useState(0);
  const [soundOn, setSoundOn] = useState(true);
  const rafRef = useRef(0);
  const startRef = useRef(0);
  const audioRef = useRef<AudioContext | null>(null);
  const finishedRef = useRef(false);

  const title = meta.title.trim() || "Sans titre";
  const directors = useMemo(() => meta.directors.filter((d) => d.name.trim()), [meta.directors]);
  const cast = useMemo(() => meta.cast.filter(Boolean), [meta.cast]);

  const play = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    finishedRef.current = false;
    startRef.current = performance.now();
    const tick = (now: number) => {
      const t = (now - startRef.current) / 1000;
      setTime(Math.min(t, T.end));
      if (t < T.end) rafRef.current = requestAnimationFrame(tick);
      else if (!finishedRef.current) {
        finishedRef.current = true;
        onFinished?.();
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [onFinished]);

  const startAudio = useCallback(() => {
    if (!soundOn) return;
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      audioRef.current = ctx;
      void ctx.resume();
      makeJingle(ctx, ctx.currentTime + JINGLE_AT, ctx.currentTime + 4.5, ctx.currentTime + T.dipStart + 0.1);
    } catch {
      /* audio indisponible : la séquence reste visuelle */
    }
  }, [soundOn]);

  const stopAudio = useCallback(() => {
    try { audioRef.current?.close(); } catch { /* noop */ }
    audioRef.current = null;
  }, []);

  useEffect(() => {
    play();
    startAudio();
    return () => { cancelAnimationFrame(rafRef.current); stopAudio(); };
  }, [play, startAudio, stopAudio]);

  const skip = () => {
    cancelAnimationFrame(rafRef.current);
    stopAudio();
    if (!finishedRef.current) { finishedRef.current = true; onFinished?.(); }
    onClose();
  };
  const replay = () => { stopAudio(); play(); startAudio(); };

  const logoP = seg(time, T.logoIn, T.logoFull);
  const logoBloom = seg(time, T.logoFull - 0.4, T.logoFull) * (1 - seg(time, T.dipStart, T.dipEnd));
  const logoVis = logoP * (1 - seg(time, T.dipStart, T.dipEnd));
  const impact = seg(time, IMPACT - 0.06, IMPACT) * (1 - seg(time, IMPACT, IMPACT + 0.6));
  const wordP = seg(time, T.wordIn, T.wordFull);
  const wordVis = wordP * (1 - seg(time, T.dipStart, T.dipEnd));
  const presP = seg(time, T.presIn, T.presFull);
  const presVis = presP * (1 - seg(time, T.dipStart, T.dipEnd));
  const dip = seg(time, T.dipStart, T.dipEnd);
  const titleP = seg(time, T.titleIn, T.titleIn + 1.6);
  const titleVis = titleP * (1 - seg(time, T.credIn - 0.4, T.credIn + 0.6));
  const credP = seg(time, T.credIn, T.credIn + 1.4);
  const credVis = credP * (1 - seg(time, T.fadeOut, T.end));
  const credY = lerp(34, -38, easeInOut(seg(time, T.credIn, T.credEnd)));
  const globalVis = 1 - seg(time, T.fadeOut, T.end);
  const barH = lerp(0, 7, seg(time, 0, 1.1));

  return (
    <div className="fixed inset-0 z-[80] select-none overflow-hidden bg-[#04060b]" role="dialog" aria-label="Introduction cinématique">
      <div className="absolute inset-0" style={{ opacity: globalVis }}>
        <Backdrop />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 42%, transparent 40%, rgba(2,4,8,0.85) 100%)" }} />
        <div className="absolute inset-0" style={{ opacity: impact * 0.55, background: "radial-gradient(circle at 50% 46%, rgba(224,251,255,0.95) 0%, rgba(0,229,255,0.4) 30%, rgba(157,78,221,0.18) 52%, transparent 68%)", mixBlendMode: "screen" }} />
      </div>

      {/* letterbox */}
      <div className="absolute inset-x-0 top-0 z-20 bg-black" style={{ height: `${barH}vh` }} />
      <div className="absolute inset-x-0 bottom-0 z-20 bg-black" style={{ height: `${barH}vh` }} />

      {/* ÉTAPE 1 — logo */}
      <div className="absolute inset-0 z-10 grid place-items-center" style={{ opacity: globalVis }}>
        <div className="flex flex-col items-center gap-7 text-center">
          <div style={{ opacity: logoVis, transform: `scale(${1 + impact * 0.055})` }}>
            <LogoA p={logoP} bloom={logoBloom + impact * 0.4} />
          </div>
          <div style={{ opacity: wordVis }} className="text-[40px] leading-none sm:text-[56px]">
            <Wordmark p={wordP} />
          </div>
          <p className="font-display text-[13px] font-semibold uppercase tracking-[0.42em] text-fog sm:text-[15px]" style={{ opacity: presVis, transform: `translateY(${lerp(10, 0, presP)}px)` }}>
            Axiom-Tv <span className="text-cyan">vous présente</span>
          </p>
        </div>
      </div>

      <div className="absolute inset-0 z-[15] bg-black" style={{ opacity: dip * (1 - seg(time, T.dipEnd, T.titleIn + 0.8)) }} />

      {/* ÉTAPE 2 — titre */}
      <div className="absolute inset-0 z-10 grid place-items-center px-6" style={{ opacity: globalVis }}>
        <div className="text-center" style={{ opacity: titleVis, transform: `translateY(${lerp(26, 0, titleP)}px)` }}>
          <p className="font-display mb-5 text-[11px] font-bold uppercase tracking-[0.5em] text-gold" style={{ opacity: titleP * 0.9 }}>{meta.year}</p>
          <h1 className="font-cine mx-auto max-w-[900px] text-[44px] font-bold leading-[1.08] tracking-[0.04em] text-frost sm:text-[72px]" style={{ textShadow: "0 0 34px rgba(245,197,66,0.35), 0 0 12px rgba(232,238,247,0.5)", animation: "pulseSoft 5s ease-in-out infinite" }}>
            {title}
          </h1>
          <div className="mx-auto mt-7 h-px w-40 bg-gradient-to-r from-transparent via-gold/70 to-transparent" style={{ opacity: titleP }} />
        </div>
      </div>

      {/* ÉTAPE 3 — crédits */}
      <div className="absolute inset-0 z-10 overflow-hidden" style={{ opacity: credVis * globalVis }}>
        <div className="absolute left-1/2 top-1/2 w-full max-w-[760px] px-8" style={{ transform: `translate(-50%, calc(-50% + ${credY}vh))` }}>
          {directors.length > 0 && (
            <div className="mb-16 text-center">
              <p className="font-display text-[11px] font-bold uppercase tracking-[0.44em] text-fog">Un film de</p>
              <div className="mt-4 space-y-2">
                {directors.map((d, i) => (
                  <p key={i} className="font-cine text-[26px] font-semibold tracking-wide text-frost sm:text-[34px]" style={{ textShadow: "0 0 18px rgba(0,229,255,0.35)" }}>
                    {d.name}
                    {d.role && d.role.trim() && d.role.trim() !== "Réalisation" && <span className="font-display ml-3 align-middle text-[12px] font-semibold uppercase tracking-[0.22em] text-fog">· {d.role}</span>}
                  </p>
                ))}
              </div>
            </div>
          )}
          {cast.length > 0 && (
            <div className="text-center">
              <p className="font-display text-[11px] font-bold uppercase tracking-[0.44em] text-fog">Avec</p>
              <p className="font-cine mt-5 text-[22px] font-semibold leading-relaxed tracking-wide text-frost sm:text-[28px]" style={{ textShadow: "0 0 14px rgba(157,78,221,0.4)" }}>
                {cast.join("  ·  ")}
              </p>
            </div>
          )}
          {directors.length === 0 && cast.length === 0 && (
            <p className="font-display text-center text-[13px] font-semibold uppercase tracking-[0.3em] text-fog/70">Crédits à renseigner dans le formulaire d'intro</p>
          )}
        </div>
      </div>

      {/* contrôles */}
      <div className="absolute inset-x-0 bottom-0 z-30 flex items-center gap-3 px-6 pb-5" style={{ opacity: 0.85 }}>
        <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-cyan via-volt to-gold" style={{ width: `${(time / T.end) * 100}%` }} />
        </div>
        <span className="font-display w-24 shrink-0 text-right text-[10.5px] font-bold tabular-nums text-fog">
          {time.toFixed(1)}s / {T.end.toFixed(1)}s
        </span>
        <button onClick={() => setSoundOn((s) => !s)} aria-label="Son" className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border transition-colors ${soundOn ? "border-cyan/45 text-cyan shadow-[0_0_12px_rgba(0,229,255,0.25)]" : "border-white/15 text-fog hover:border-cyan/50 hover:text-cyan"}`}>
          {soundOn ? <Volume2 size={15} /> : <VolumeX size={15} />}
        </button>
        <button onClick={replay} aria-label="Rejouer" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/15 text-fog transition-colors hover:border-cyan/50 hover:text-cyan">
          <RotateCcw size={15} />
        </button>
        <button onClick={skip} className="flex shrink-0 items-center gap-2 rounded-full border border-white/20 bg-white/[0.06] px-4 py-2 font-display text-[11px] font-bold uppercase tracking-[0.16em] text-frost transition-all hover:border-cyan/60 hover:text-cyan">
          <SkipForward size={14} /> Passer l'intro
        </button>
        <button onClick={onClose} aria-label="Terminer" className="btn-neon flex shrink-0 items-center gap-2 rounded-full px-4 py-2 font-display text-[11px] font-bold uppercase tracking-[0.16em]">
          <Clapperboard size={14} /> Terminer
        </button>
      </div>

      <div className="font-display absolute left-6 top-5 z-30 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-fog/60">
        <Play size={11} /> Intro AgwèStream · 2.39:1
      </div>
    </div>
  );
}

/* ================= formulaire de métadonnées (crédits) ================= */
export function IntroMetadataForm({ meta, onChange, onPreview }: { meta: IntroMetadata; onChange: (m: IntroMetadata) => void; onPreview: () => void }) {
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="font-display mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-fog">Titre du film / documentaire</span>
        <input value={meta.title} onChange={(e) => onChange({ ...meta, title: e.target.value })} placeholder="Transmission" className="field h-10 w-full rounded-lg px-3 text-[13px] font-semibold text-frost" />
      </label>

      <div>
        <span className="font-display mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-fog">Collaborateurs / Réalisateurs</span>
        {meta.directors.map((d, i) => (
          <div key={i} className="mb-1.5 flex gap-1.5">
            <input value={d.name} onChange={(e) => onChange({ ...meta, directors: meta.directors.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} placeholder="Nom" className="field h-9 flex-1 rounded-lg px-3 text-[12.5px] font-semibold text-frost" />
            <input value={d.role} onChange={(e) => onChange({ ...meta, directors: meta.directors.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)) })} placeholder="Rôle" className="field h-9 w-32 rounded-lg px-3 text-[12.5px] font-semibold text-frost" />
            <button onClick={() => onChange({ ...meta, directors: meta.directors.filter((_, j) => j !== i) })} aria-label="Retirer" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-fog transition-colors hover:text-coral">
              <Trash2 size={13} />
            </button>
          </div>
        ))}
        <button onClick={() => onChange({ ...meta, directors: [...meta.directors, { name: "", role: "" }] })} className="btn-ghost flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-wider text-fog">
          <Plus size={12} /> Ajouter
        </button>
      </div>

      <label className="block">
        <span className="font-display mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-fog">Distribution (séparée par des virgules)</span>
        <input
          value={meta.cast.join(", ")}
          onChange={(e) => onChange({ ...meta, cast: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
          placeholder="K-9, Mira, Cleef"
          className="field h-10 w-full rounded-lg px-3 text-[13px] font-semibold text-frost"
        />
      </label>

      <button onClick={onPreview} className="btn-neon flex w-full items-center justify-center gap-2 rounded-lg py-2.5 font-display text-[11.5px] font-bold uppercase tracking-[0.16em]">
        <Play size={13} /> Prévisualiser l'intro
      </button>
    </div>
  );
}

/* export utilitaire pour validation */
export const introReady = (m: IntroMetadata) => m.title.trim().length > 0;
export { Check };
