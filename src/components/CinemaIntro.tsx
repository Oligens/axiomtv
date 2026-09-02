/**
 * CinemaIntro — AgwèStream / AxiomTV
 * Intro cinématique aquatique de 7 secondes.
 * 0.0s  logo A officiel + tentative ambiance vagues
 * 2.05s présentation
 * 3.35s titre dynamique
 * 5.05s casting / équipe
 * 6.45s fondu final
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { IntroMetadata } from "../data/content";

const T = {
  logoEnd: 1.45,
  logoFadeStart: 1.95,
  logoFadeEnd: 2.30,
  presentationStart: 2.05,
  presentationEnd: 3.35,
  titleStart: 3.35,
  titleEnd: 5.25,
  creditsStart: 5.05,
  creditsEnd: 6.45,
  fadeStart: 6.45,
  end: 7,
} as const;

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (v: number) => 1 - Math.pow(1 - clamp(v), 3);
const ease = (v: number) => {
  const t = clamp(v);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
const segment = (time: number, start: number, end: number, fn = ease) =>
  end <= start ? (time >= end ? 1 : 0) : fn((time - start) / (end - start));
const fade = (time: number, start: number, end: number) => {
  if (time < start || time > end) return 0;
  return Math.min(clamp((time - start) / 0.35), clamp((end - time) / 0.35));
};

function OceanBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    const particles = Array.from({ length: 72 }, (_, i) => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.4 + Math.random() * 1.6,
      speed: 0.00005 + Math.random() * 0.00012,
      phase: i * 0.71,
      alpha: 0.05 + Math.random() * 0.18,
    }));

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (now: number) => {
      ctx.clearRect(0, 0, w, h);
      const gradient = ctx.createRadialGradient(w * 0.5, h * 0.48, 0, w * 0.5, h * 0.48, Math.max(w, h) * 0.72);
      gradient.addColorStop(0, "rgba(0,242,254,.09)");
      gradient.addColorStop(.45, "rgba(0,114,255,.035)");
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);

      particles.forEach((p) => {
        p.y -= p.speed * 16;
        if (p.y < -0.04) p.y = 1.04;
        const pulse = .7 + Math.sin(now * .001 + p.phase) * .3;
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,242,254,${p.alpha * pulse})`;
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} className="absolute inset-0 h-full w-full" aria-hidden="true" />;
}

function WaterRings({ intensity }: { intensity: number }) {
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ opacity: intensity }} aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="absolute left-1/2 top-1/2 block rounded-full border border-cyan-300/20"
          style={{
            width: `${190 + i * 85}px`,
            height: `${190 + i * 85}px`,
            transform: "translate(-50%,-50%)",
            animation: `agwe-water-ring ${2.5 + i * .4}s ease-out infinite`,
            animationDelay: `${i * .35}s`,
          }}
        />
      ))}
    </div>
  );
}

function AgweLogo({ progress, glow }: { progress: number; glow: number }) {
  return (
    <div
      className="relative z-10"
      style={{
        opacity: progress,
        transform: `translateY(${18 - progress * 18}px) scale(${.78 + progress * .22})`,
      }}
    >
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          opacity: glow,
          background: "radial-gradient(circle,rgba(0,242,254,.34),rgba(0,114,255,.16) 38%,transparent 72%)",
          filter: "blur(10px)",
        }}
      />
      <img
        src="/agwe.svg"
        alt="AgwèStream"
        draggable={false}
        className="relative block h-[190px] w-[190px] select-none object-contain sm:h-[230px] sm:w-[230px]"
      />
    </div>
  );
}

function Presentation({ opacity, y }: { opacity: number; y: number }) {
  return (
    <section className="absolute inset-x-0 top-1/2 text-center" style={{ opacity, transform: `translateY(calc(-50% + ${y}px))` }}>
      <p className="mb-3 text-[10px] font-medium uppercase tracking-[.5em] text-cyan-300/70">AgwèStream</p>
      <h2 className="font-display text-3xl font-semibold tracking-[.06em] text-white sm:text-4xl">vous présente</h2>
      <p className="mt-4 text-[10px] uppercase tracking-[.38em] text-white/45 sm:text-xs">en collaboration avec AxiomTV</p>
    </section>
  );
}

function FilmTitle({ title, opacity, y }: { title: string; opacity: number; y: number }) {
  return (
    <section className="absolute inset-x-0 top-1/2 mx-auto w-[92%] text-center" style={{ opacity, transform: `translateY(calc(-50% + ${y}px))` }}>
      <p className="mb-5 text-[9px] uppercase tracking-[.55em] text-cyan-300/55">Une production AgwèStream</p>
      <h1 className="font-display text-4xl font-semibold leading-tight tracking-[.04em] text-white drop-shadow-[0_0_28px_rgba(0,242,254,.18)] sm:text-6xl">{title}</h1>
    </section>
  );
}

function Credits({ cast, directors, opacity, y }: { cast: string[]; directors: IntroMetadata["directors"]; opacity: number; y: number }) {
  const people = cast.slice(0, 8);
  const filmmakers = directors.filter((d) => d?.name?.trim()).slice(0, 3);

  return (
    <section className="absolute inset-x-0 top-1/2 mx-auto w-[92%] max-w-4xl text-center" style={{ opacity, transform: `translateY(calc(-50% + ${y}px))` }}>
      <p className="text-[9px] uppercase tracking-[.5em] text-cyan-300/55">Distribution & équipe</p>
      {people.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          {people.map((person, i) => <span key={`${person}-${i}`} className="text-sm tracking-[.1em] text-white/85 sm:text-base">{person}</span>)}
        </div>
      )}
      {filmmakers.length > 0 && (
        <div className="mt-5 text-xs tracking-[.12em] text-white/55">Réalisation : {filmmakers.map((d) => d.name).join(" · ")}</div>
      )}
    </section>
  );
}

function useOceanAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const enabledRef = useRef(true);
  const [enabled, setEnabled] = useState(true);
  const [blocked, setBlocked] = useState(false);

  const getAudio = useCallback(() => {
    if (!audioRef.current) {
      const src = import.meta.env.VITE_AGWE_OCEAN_AUDIO_URL?.trim() || "/sounds/ocean-waves.mp3";
      const audio = new Audio(src);
      audio.preload = "auto";
      audio.volume = .48;
      audioRef.current = audio;
    }
    return audioRef.current;
  }, []);

  const play = useCallback(async () => {
    if (!enabledRef.current) return false;
    const audio = getAudio();
    audio.currentTime = 0;
    try {
      await audio.play();
      setBlocked(false);
      return true;
    } catch {
      setBlocked(true);
      return false;
    }
  }, [getAudio]);

  const toggle = useCallback(async () => {
    const next = !enabledRef.current;
    enabledRef.current = next;
    setEnabled(next);
    if (!next) {
      audioRef.current?.pause();
      return;
    }
    await play();
  }, [play]);

  useEffect(() => {
    void play();
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, [play]);

  return { enabled, blocked, play, toggle };
}

export default function CinemaIntro({
  meta,
  onClose,
  onFinished,
}: {
  meta: IntroMetadata;
  onClose: () => void;
  onFinished?: () => void;
}) {
  const [time, setTime] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef(0);
  const finishedRef = useRef(false);
  const { enabled, blocked, play, toggle } = useOceanAudio();

  const title = useMemo(() => meta.title?.trim() || "Sans titre", [meta.title]);
  const cast = useMemo(() => (meta.cast || []).map(String).map((x) => x.trim()).filter(Boolean), [meta.cast]);
  const directors = useMemo(() => (meta.directors || []).filter((d) => d?.name?.trim()), [meta.directors]);

  const start = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    finishedRef.current = false;
    startRef.current = performance.now();

    const tick = (now: number) => {
      const elapsed = (now - startRef.current) / 1000;
      setTime(Math.min(elapsed, T.end));
      if (elapsed < T.end) rafRef.current = requestAnimationFrame(tick);
      else if (!finishedRef.current) {
        finishedRef.current = true;
        onFinished?.();
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [onFinished]);

  useEffect(() => {
    start();
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [start]);

  const skip = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    if (!finishedRef.current) {
      finishedRef.current = true;
      onFinished?.();
    }
    onClose();
  }, [onClose, onFinished]);

  const logo = segment(time, 0, T.logoEnd, easeOut) * (1 - segment(time, T.logoFadeStart, T.logoFadeEnd));
  const glow = segment(time, .15, 1.3, easeOut) * (1 - segment(time, 1.7, T.logoFadeEnd));
  const rings = glow;
  const presentation = fade(time, T.presentationStart, T.presentationEnd);
  const titleOpacity = fade(time, T.titleStart, T.titleEnd);
  const credits = fade(time, T.creditsStart, T.creditsEnd);
  const presentationY = 18 - segment(time, T.presentationStart, T.presentationStart + .5, easeOut) * 18;
  const titleY = 18 - segment(time, T.titleStart, T.titleStart + .5, easeOut) * 18;
  const creditsY = 14 - segment(time, T.creditsStart, T.creditsStart + .5, easeOut) * 14;
  const globalOpacity = 1 - segment(time, T.fadeStart, T.end);

  const soundAction = () => {
    if (blocked && enabled) void play();
    else void toggle();
  };

  return (
    <div className="fixed inset-0 z-[9999] overflow-hidden bg-[#030712]" role="dialog" aria-modal="true" aria-label="Introduction cinématique AgwèStream" style={{ opacity: globalOpacity }}>
      <OceanBackdrop />
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(circle at 50% 48%,rgba(0,242,254,.055),transparent 42%),radial-gradient(circle,transparent 0%,rgba(0,0,0,.2) 48%,rgba(0,0,0,.9) 100%)" }} />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/70 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/80 to-transparent" />

      <div className="absolute inset-0 flex items-center justify-center">
        <WaterRings intensity={rings} />
        <AgweLogo progress={logo} glow={glow} />
      </div>

      <Presentation opacity={presentation} y={presentationY} />
      <FilmTitle title={title} opacity={titleOpacity} y={titleY} />
      <Credits cast={cast} directors={directors} opacity={credits} y={creditsY} />

      <div className="absolute bottom-7 left-0 right-0 flex items-center justify-between px-5 sm:px-8">
        <button type="button" onClick={soundAction} className="rounded-full border border-white/10 bg-black/25 px-4 py-2 text-[10px] font-medium uppercase tracking-[.2em] text-white/65 backdrop-blur-md transition hover:border-cyan-300/40 hover:text-white" aria-label={enabled ? "Couper ou activer l'ambiance sonore" : "Activer l'ambiance sonore"}>
          {blocked && enabled ? "Activer le son" : enabled ? "Son activé" : "Son désactivé"}
        </button>
        <button type="button" onClick={skip} className="rounded-full border border-white/10 bg-black/25 px-4 py-2 text-[10px] font-medium uppercase tracking-[.2em] text-white/65 backdrop-blur-md transition hover:border-cyan-300/40 hover:text-white">Passer</button>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-px bg-white/[.06]">
        <div className="h-full bg-cyan-300/70 shadow-[0_0_12px_rgba(0,242,254,.7)]" style={{ width: `${(time / T.end) * 100}%` }} />
      </div>

      <style>{`
        @keyframes agwe-water-ring {
          0% { opacity:0; transform:translate(-50%,-50%) scale(.72); }
          22% { opacity:.7; }
          100% { opacity:0; transform:translate(-50%,-50%) scale(1.18); }
        }
        @media (prefers-reduced-motion: reduce) {
          *,*::before,*::after { animation-duration:.01ms !important; animation-iteration-count:1 !important; transition-duration:.01ms !important; }
        }
      `}</style>
    </div>
  );
}
