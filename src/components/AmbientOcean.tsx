import { useCallback, useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, Waves } from "lucide-react";

const STORAGE_KEY = "axiom-agwe-ocean-enabled";
const AUDIO_SRC = "/sounds/ocean-waves.mp3";

/** Ambiance marine non bloquante : tentative d'autoplay puis activation au premier geste. */
export default function AmbientOcean() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [available, setAvailable] = useState(true);

  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return false;
    try {
      await audio.play();
      setEnabled(true);
      try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* storage indisponible */ }
      return true;
    } catch {
      return false;
    }
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    setEnabled(false);
    try { localStorage.setItem(STORAGE_KEY, "0"); } catch { /* storage indisponible */ }
  }, []);

  const toggle = useCallback(() => {
    if (enabled) stop();
    else void play();
  }, [enabled, play, stop]);

  useEffect(() => {
    const audio = new Audio(AUDIO_SRC);
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = 0.16;
    audio.addEventListener("error", () => setAvailable(false), { once: true });
    audioRef.current = audio;

    let wantsAmbient = true;
    try { wantsAmbient = localStorage.getItem(STORAGE_KEY) !== "0"; } catch { /* défaut activé */ }

    if (wantsAmbient) {
      void play();
    }

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
    };
    // Initialisation uniquement : play est stable et l'état enabled n'est pas une dépendance volontaire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play]);

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
