/**
 * CinemaIntro — AgwèStream / AxiomTV
 *
 * Intro cinématique 7 secondes :
 * 0.0s  : logo A Agwè seul + vague sonore
 * 2.1s  : AgwèStream vous présente / en collaboration avec AxiomTV
 * 3.5s  : titre dynamique du film
 * 5.2s  : casting / équipe
 * 6.45s : fondu final
 *
 * Le logo est le SVG officiel fourni pour AgwèStream (/agwe.svg).
 * L'audio utilise VITE_AGWE_OCEAN_AUDIO_URL avec fallback /sounds/ocean-waves.mp3.
 * L'autoplay est tenté mais jamais requis : si le navigateur le bloque,
 * l'utilisateur peut activer le son avec le bouton prévu à cet effet.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { IntroMetadata } from "../data/content";

const T = {
  logoIn: 0.0,
  logoFull: 1.45,
  presentationIn: 2.05,
  presentationEnd: 3.35,
  titleIn: 3.35,
  titleEnd: 5.25,
  creditsIn: 5.05,
  creditsEnd: 6.45,
  fadeOut: 6.45,
  end: 7.0,
} as const;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const easeOutCubic = (value: number) => {
  const t = clamp01(value);
  return 1 - Math.pow(1 - t, 3);
};

const easeInOutCubic = (value: number) => {
  const t = clamp01(value);
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

const segment = (
  time: number,
  start: number,
  end: number,
  easing = easeInOutCubic,
) => {
  if (end <= start) return time >= end ? 1 : 0;
  return easing((time - start) / (end - start));
};

const fade = (
  time: number,
  start: number,
  end: number,
  fadeIn = 0.35,
  fadeOut = 0.35,
) => {
  if (time < start || time > end) return 0;

  const entering = clamp01((time - start) / fadeIn);
  const leaving = clamp01((end - time) / fadeOut);

  return Math.min(entering, leaving);
};

/* -------------------------------------------------------------------------- */
/* BACKDROP                                                                   */
/* -------------------------------------------------------------------------- */

function OceanBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let width = 0;
    let height = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      width = rect.width;
      height = rect.height;

      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    interface Particle {
      x: number;
      y: number;
      radius: number;
      speed: number;
      drift: number;
      phase: number;
      opacity: number;
    }

    const particles: Particle[] = Array.from({ length: 72 }, (_, index) => ({
      x: Math.random(),
      y: Math.random(),
      radius: 0.4 + Math.random() * 1.6,
      speed: 0.00005 + Math.random() * 0.00012,
      drift: (Math.random() - 0.5) * 0.00008,
      phase: index * 0.71,
      opacity: 0.06 + Math.random() * 0.18,
    }));

    const draw = (now: number) => {
      ctx.clearRect(0, 0, width, height);

      const glow = ctx.createRadialGradient(
        width * 0.5,
        height * 0.48,
        0,
        width * 0.5,
        height * 0.48,
        Math.max(width, height) * 0.72,
      );

      glow.addColorStop(0, "rgba(0,242,254,0.09)");
      glow.addColorStop(0.45, "rgba(0,114,255,0.035)");
      glow.addColorStop(1, "rgba(0,0,0,0)");

      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      for (const particle of particles) {
        particle.y -= particle.speed * 16;
        particle.x += particle.drift * 16;

        if (particle.y < -0.04) particle.y = 1.04;
        if (particle.x < -0.04) particle.x = 1.04;
        if (particle.x > 1.04) particle.x = -0.04;

        const pulse =
          0.7 + Math.sin(now * 0.001 + particle.phase) * 0.3;

        ctx.beginPath();
        ctx.arc(
          particle.x * width,
          particle.y * height,
          particle.radius,
          0,
          Math.PI * 2,
        );
        ctx.fillStyle = `rgba(0,242,254,${particle.opacity * pulse})`;
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
    />
  );
}

/* -------------------------------------------------------------------------- */
/* WATER RINGS                                                                */
/* -------------------------------------------------------------------------- */

function WaterRings({ intensity }: { intensity: number }) {
  return (
    <div
      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      aria-hidden="true"
      style={{ opacity: intensity }}
    >
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="absolute left-1/2 top-1/2 block rounded-full border border-cyan-300/20"
          style={{
            width: `${190 + index * 85}px`,
            height: `${190 + index * 85}px`,
            transform: "translate(-50%, -50%)",
            animation: `agwe-water-ring ${2.5 + index * 0.4}s ease-out infinite`,
            animationDelay: `${index * 0.35}s`,
          }}
        />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* OFFICIAL AGWE SVG                                                          */
/* -------------------------------------------------------------------------- */

function AgweLogo({ progress, glow }: { progress: number; glow: number }) {
  const scale = 0.78 + progress * 0.22;
  const translateY = 18 - progress * 18;

  return (
    <div
      className="relative z-10"
      style={{
        opacity: progress,
        transform: `translateY(${translateY}px) scale(${scale})`,
      }}
    >
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          opacity: glow,
          background:
            "radial-gradient(circle, rgba(0,242,254,.34) 0%, rgba(0,114,255,.16) 38%, transparent 72%)",
          filter: "blur(10px)",
        }}
      />

      <img
        src="/agwe.svg"
        alt="AgwèStream"
        className="relative block h-[190px] w-[190px] select-none object-contain sm:h-[230px] sm:w-[230px]"
        draggable={false}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* PRESENTATION                                                               */
/* -------------------------------------------------------------------------- */

function Presentation({ opacity, y }: { opacity: number; y: number }) {
  return (
    <section
      className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center"
      style={{
        opacity,
        transform: `translateY(calc(-50% + ${y}px))`,
      }}
    >
      <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.5em] text-cyan-300/70">
        AgwèStream
      </p>

      <h2 className="font-display text-3xl font-semibold tracking-[0.06em] text-white sm:text-4xl">
        vous présente
      </h2>

      <p className="mt-4 text-[10px] uppercase tracking-[0.38em] text-white/45 sm:text-xs">
        en collaboration avec AxiomTV
      </p>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* TITLE                                                                      */
/* -------------------------------------------------------------------------- */

function FilmTitle({
  title,
  opacity,
  y,
}: {
  title: string;
  opacity: number;
  y: number;
}) {
  return (
    <section
      className="absolute inset-x-0 top-1/2 mx-auto w-[92%] -translate-y-1/2 text-center"
      style={{
        opacity,
        transform: `translateY(calc(-50% + ${y}px))`,
      }}
    >
      <p className="mb-5 text-[9px] uppercase tracking-[0.55em] text-cyan-300/55">
        Une production AgwèStream
      </p>

      <h1 className="font-display text-4xl font-semibold leading-tight tracking-[0.04em] text-white drop-shadow-[0_0_28px_rgba(0,242,254,.18)] sm:text-6xl">
        {title}
      </h1>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* CREDITS                                                                    */
/* -------------------------------------------------------------------------- */

function Credits({
  cast,
  directors,
  opacity,
  y,
}: {
  cast: string[];
  directors: IntroMetadata["directors"];
  opacity: number;
  y: number;
}) {
  const people = cast.slice(0, 8);
  const filmmakers = directors
    .filter((director) => director.name.trim())
    .slice(0, 3);

  return (
    <section
      className="absolute inset-x-0 top-1/2 mx-auto w-[92%] max-w-4xl -translate-y-1/2 text-center"
      style={{
        opacity,
        transform: `translateY(calc(-50% + ${y}px))`,
      }}
    >
      <p className="text-[9px] uppercase tracking-[0.5em] text-cyan-300/55">
        Distribution & équipe
      </p>

      {people.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          {people.map((person, index) => (
            <span
              key={`${person}-${index}`}
              className="text-sm tracking-[0.1em] text-white/85 sm:text-base"
            >
              {person}
            </span>
          ))}
        </div>
      )}

      {filmmakers.length > 0 && (
        <div className="mt-5 text-xs tracking-[0.12em] text-white/55">
          Réalisation : {filmmakers.map((person) => person.name).join(" · ")}
        </div>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* AUDIO                                                                      */
/* -------------------------------------------------------------------------- */

function getOceanAudioUrl() {
  const configured = import.meta.env.VITE_AGWE_OCEAN_AUDIO_URL?.trim();
  return configured || "/sounds/ocean-waves.mp3";
}

function useOceanAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [blocked, setBlocked] = useState(false);

  const ensureAudio = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio(getOceanAudioUrl());
      audio.preload = "auto";
      audio.loop = false;
      audio.volume = 0.48;
      audioRef.current = audio;
    }

    return audioRef.current;
  }, []);

  const play = useCallback(async () => {
    if (!enabled) return false;

    const audio = ensureAudio();
    audio.currentTime = 0;

    try {
      await audio.play();
      setBlocked(false);
      return true;
    } catch {
      setBlocked(true);
      return false;
    }
  }, [enabled, ensureAudio]);

  const toggle = useCallback(async () => {
    const next = !enabled;
    setEnabled(next);

    if (!next) {
      audioRef.current?.pause();
      return;
    }

    const audio = ensureAudio();

    try {
      await audio.play();
      setBlocked(false);
    } catch {
      setBlocked(true);
    }
  }, [enabled, ensureAudio]);

  useEffect(() => {
    void play();

    return () => {
      const audio = audioRef.current;
      audio?.pause();
      if (audio) audio.currentTime = 0;
      audioRef.current = null;
    };
  }, [play]);

  return {
    enabled,
    blocked,
    toggle,
    play,
  };
}

/* -------------------------------------------------------------------------- */
/* CINEMA INTRO                                                               */
/* -------------------------------------------------------------------------- */

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

  const { enabled, blocked, toggle } = useOceanAudio();

  const title = useMemo(
    () => meta.title?.trim() || "Sans titre",
    [meta.title],
  );

  const cast = useMemo(
    () =>
      (meta.cast || [])
        .map((person) => String(person).trim())
        .filter(Boolean),
    [meta.cast],
  );

  const directors = useMemo(
    () =>
      (meta.directors || []).filter(
        (director) => director?.name?.trim(),
      ),
    [meta.directors],
  );

  const startTimeline = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }

    finishedRef.current = false;
    startRef.current = performance.now();

    const tick = (now: number) => {
      const elapsed = (now - startRef.current) / 1000;
      const current = Math.min(elapsed, T.end);

      setTime(current);

      if (elapsed < T.end) {
        rafRef.current = requestAnimationFrame(tick);
      } else if (!finishedRef.current) {
        finishedRef.current = true;
        onFinished?.();
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [onFinished]);

  useEffect(() => {
    startTimeline();

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [startTimeline]);

  const skip = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }

    if (!finishedRef.current) {
      finishedRef.current = true;
      onFinished?.();
    }

    onClose();
  }, [onClose, onFinished]);

  /* Logo : premier élément visible */
  const logoProgress = segment(
    time,
    T.logoIn,
    T.logoFull,
    easeOutCubic,
  );

  const logoFadeOut = segment(
    time,
    1.95,
    2.3,
    easeInOutCubic,
  );

  const logoVisibility = logoProgress * (1 - logoFadeOut);

  const logoGlow =
    segment(time, 0.25, 1.35, easeOutCubic) *
    (1 - segment(time, 1.7, 2.3));

  const presentationOpacity = fade(
    time,
    T.presentationIn,
    T.presentationEnd,
    0.35,
    0.3,
  );

  const presentationY =
    18 -
    segment(
      time,
      T.presentationIn,
      T.presentationIn + 0.5,
      easeOutCubic,
    ) *
      18;

  const titleOpacity = fade(
    time,
    T.titleIn,
    T.titleEnd,
    0.42,
    0.38,
  );

  const titleY =
    18 -
    segment(
      time,
      T.titleIn,
      T.titleIn + 0.5,
      easeOutCubic,
    ) *
      18;

  const creditsOpacity = fade(
    time,
    T.creditsIn,
    T.creditsEnd,
    0.4,
    0.35,
  );

  const creditsY =
    14 -
    segment(
      time,
      T.creditsIn,
      T.creditsIn + 0.5,
      easeOutCubic,
    ) *
      14;

  const ringsIntensity =
    segment(time, 0.35, 1.35, easeOutCubic) *
    (1 - segment(time, 1.75, 2.35));

  const globalOpacity =
    1 - segment(time, T.fadeOut, T.end, easeInOutCubic);

  return (
    <div
      className="fixed inset-0 z-[9999] overflow-hidden bg-[#030712]"
      role="dialog"
      aria-modal="true"
      aria-label="Introduction cinématique AgwèStream"
      style={{ opacity: globalOpacity }}
    >
      <OceanBackdrop />

      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(circle at 50% 48%, rgba(0,242,254,.055), transparent 42%), radial-gradient(circle at center, transparent 0%, rgba(0,0,0,.2) 48%, rgba(0,0,0,.9) 100%)",
        }}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/70 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/80 to-transparent" />

      {/* ÉTAPE 1 — le A est volontairement seul au démarrage */}
      <div className="absolute inset-0 flex items-center justify-center">
        <WaterRings intensity={ringsIntensity} />

        <AgweLogo
          progress={logoVisibility}
          glow={logoGlow}
        />
      </div>

      {/* ÉTAPE 2 */}
      <Presentation
        opacity={presentationOpacity}
        y={presentationY}
      />

      {/* ÉTAPE 3 */}
      <FilmTitle
        title={title}
        opacity={titleOpacity}
        y={titleY}
      />

      {/* ÉTAPE 4 */}
      <Credits
        cast={cast}
        directors={directors}
        opacity={creditsOpacity}
        y={creditsY}
      />

      {/* Contrôle audio — indispensable pour les navigateurs qui refusent autoplay */}
      <div className="absolute bottom-7 left-0 right-0 flex items-center justify-between px-5 sm:px-8">
        <button
          type="button"
          onClick={() => void toggle()}
          className="rounded-full border border-white/10 bg-black/25 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.2em] text-white/65 backdrop-blur-md transition hover:border-cyan-300/40 hover:text-white"
          aria-label={enabled ? "Couper l'ambiance sonore" : "Activer l'ambiance sonore"}
        >
          {enabled ? "Son activé" : "Son désactivé"}
        </button>

        <button
          type="button"
          onClick={skip}
          className="rounded-full border border-white/10 bg-black/25 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.2em] text-white/65 backdrop-blur-md transition hover:border-cyan-300/40 hover:text-white"
        >
          Passer
        </button>
      </div>

      {blocked && enabled && (
        <button
          type="button"
          onClick={() => {
            const event = new Event("click");
            void event;
            /* toggle off/on déclenche une tentative après interaction */
            void toggle();
          }}
          className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-cyan-100 backdrop-blur-md"
        >
          Activer l'ambiance sonore
        </button>
      )}

      <div className="absolute bottom-0 left-0 right-0 h-px bg-white/[0.06]">
        <div
          className="h-full bg-cyan-300/70 shadow-[0_0_12px_rgba(0,242,254,.7)]"
          style={{ width: `${(time / T.end) * 100}%` }}
        />
      </div>

      <style>{`
        @keyframes agwe-water-ring {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(.72);
          }
          22% {
            opacity: .7;
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(1.18);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: .01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: .01ms !important;
            scroll-behavior: auto !important;
          }
        }
      `}</style>
    </div>
  );
}
