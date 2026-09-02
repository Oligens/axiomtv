import { useCallback, useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, Waves } from "lucide-react";

const STORAGE_KEY = "axiom-agwe-ocean-enabled";
const AUDIO_SRC = "/sounds/ocean-waves.mp3";

type ProceduralOcean = {
  ctx: AudioContext;
  source: AudioBufferSourceNode;
  gain: GainNode;
  filter: BiquadFilterNode;
};

/** Ambiance marine : MP3 si présent, sinon texture océanique Web Audio sans dépendance externe. */
export default function AmbientOcean() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const proceduralRef = useRef<ProceduralOcean | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [available, setAvailable] = useState(true);

  const startProcedural = useCallback(async () => {
    if (proceduralRef.current) {
      await proceduralRef.current.ctx.resume();
      return true;
    }
    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return false;

    const ctx = new AudioContextCtor();
    const bufferSize = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < bufferSize; i += 1) {
      const white = Math.random() * 2 - 1;
      brown = brown * 0.985 + white * 0.15;
      data[i] = brown;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    filter.Q.value = 0.7;

    const gain = ctx.createGain();
    gain.gain.value = 0.0001;

    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start();
    await ctx.resume();
    proceduralRef.current = { ctx, source, gain, filter };
    return true;
  }, []);

  const stopProcedural = useCallback(() => {
    const ocean = proceduralRef.current;
    if (!ocean) return;
    ocean.gain.gain.cancelScheduledValues(ocean.ctx.currentTime);
    ocean.gain.gain.setTargetAtTime(0.0001, ocean.ctx.currentTime, 0.18);
    window.setTimeout(() => {
      try { ocean.source.stop(); } catch { /* déjà arrêté */ }
      void ocean.ctx.close();
    }, 900);
    proceduralRef.current = null;
  }, []);

  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (audio) {
      try {
        await audio.play();
        setEnabled(true);
        try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* storage indisponible */ }
        return true;
      } catch {
        // Autoplay refusé ou MP3 absent : fallback Web Audio après geste utilisateur.
      }
    }

    try {
      const ok = await startProcedural();
      if (!ok) return false;
      const ocean = proceduralRef.current;
      if (ocean) {
        const now = ocean.ctx.currentTime;
        ocean.gain.gain.cancelScheduledValues(now);
        ocean.gain.gain.setTargetAtTime(0.022, now, 0.8);
      }
      setEnabled(true);
      try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* storage indisponible */ }
      return true;
    } catch {
      setAvailable(false);
      return false;
    }
  }, [startProcedural]);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) audio.pause();
    stopProcedural();
    setEnabled(false);
    try { localStorage.setItem(STORAGE_KEY, "0"); } catch { /* storage indisponible */ }
  }, [stopProcedural]);

  const toggle = useCallback(() => {
    if (enabled) stop();
    else void play();
  }, [enabled, play, stop]);

  useEffect(() => {
    const audio = new Audio(AUDIO_SRC);
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = 0.16;
    audioRef.current = audio;

    let wantsAmbient = true;
    try { wantsAmbient = localStorage.getItem(STORAGE_KEY) !== "0"; } catch { /* défaut activé */ }

    if (wantsAmbient) void play();

    const unlock = () => {
      if (wantsAmbient && !enabled) void play();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    window.addEventListener("touchstart", unlock, { passive: true });

    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
      audio.pause();
      audio.src = "";
      audioRef.current = null;
      stopProcedural();
    };
    // L'état enabled ne pilote pas l'installation des listeners : ils sont volontairement attachés une seule fois.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play, stopProcedural]);

  if (!available) return null;

  return (
    <div className="fixed bottom-20 right-4 z-50 sm:bottom-5 sm:right-5">
      <button
        type="button"
        onClick={toggle}
        aria-label={enabled ? "Désactiver l'ambiance sonore" : "Activer l'ambiance sonore"}
        title={enabled ? "Ambiance marine activée" : "Activer l'ambiance marine"}
        className={`group flex h-11 items-center gap-2 rounded-full border px-3.5 backdrop-blur-xl transition-all ${
          enabled
            ? "border-cyan/45 bg-[#071a25]/85 text-cyan shadow-[0_0_24px_rgba(0,229,255,0.16)]"
            : "border-white/10 bg-black/45 text-fog hover:border-cyan/30 hover:text-frost"
        }`}
      >
        {enabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
        <span className="hidden text-[10px] font-bold uppercase tracking-[0.16em] sm:inline">
          {enabled ? "Vagues" : "Son off"}
        </span>
        <Waves size={14} className={enabled ? "animate-pulse" : "opacity-50"} />
      </button>
    </div>
  );
}
