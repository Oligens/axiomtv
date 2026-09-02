/**
 * Mode de diagnostic visuel (§23) — frame synthétique de la scène avec
 * overlays activables : visages, objets, anatomie, trajectoires, anomalies.
 */
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BoxSelect, ScanFace, X, Zap } from "lucide-react";
import { hashSeed, mulberry } from "../../agwe/engines";
import { formatTime } from "../../lib/scenario";
import type { Anomaly, SceneConstraint } from "../../agwe/models";

const OVERLAYS = [
  { id: "faces", label: "Visages", icon: <ScanFace size={11} /> },
  { id: "objects", label: "Objets", icon: <BoxSelect size={11} /> },
  { id: "anatomy", label: "Anatomie", icon: <Zap size={11} /> },
  { id: "tracks", label: "Trajectoires", icon: <BoxSelect size={11} /> },
  { id: "anomaly", label: "Zone d'anomalie", icon: <X size={11} /> },
] as const;

export default function FrameInspector({
  anomaly,
  scene,
  characterColors,
  onClose,
}: {
  anomaly: Anomaly;
  scene: SceneConstraint | null;
  characterColors: Record<string, string>;
  onClose: () => void;
}) {
  const [layers, setLayers] = useState<Record<string, boolean>>({ faces: true, objects: true, anatomy: false, tracks: false, anomaly: true });
  const rng = useMemo(() => mulberry(hashSeed(`frame:${anomaly.id}`)), [anomaly.id]);

  /* disposition synthétique des sujets de la scène */
  const subjects = useMemo(() => {
    const n = Math.max(1, scene?.characters.length ?? 1);
    return Array.from({ length: Math.min(3, n) }, (_, i) => {
      const x = 0.22 + i * 0.26 + (rng() - 0.5) * 0.08;
      return {
        name: scene?.characters[i] ?? `Sujet ${i + 1}`,
        color: characterColors[scene?.characters[i] ?? ""] ?? ["#00e5ff", "#9d4edd", "#f5c542"][i % 3],
        x,
        faceY: 0.2 + (rng() - 0.5) * 0.06,
        h: 0.42 + rng() * 0.1,
      };
    });
  }, [scene, characterColors, rng]);

  const toggle = (id: string) => setLayers((l) => ({ ...l, [id]: !l[id] }));
  const night = scene ? !scene.interior || /night|nuit/i.test(scene.lighting) : true;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[85] grid place-items-center bg-abyss/88 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.94, y: 24 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="panel w-full max-w-[880px] overflow-hidden"
      >
        <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.06] px-4 py-3">
          <span className="font-display text-[11px] font-bold uppercase tracking-[0.24em] text-volt">Diagnostic visuel</span>
          <span className="font-mono text-[10px] font-semibold text-fog">
            {scene?.label.slice(0, 40) ?? "—"} · frame @ {formatTime(anomaly.timeStart)}
          </span>
          <div className="ml-auto flex flex-wrap gap-1.5">
            {OVERLAYS.map((o) => (
              <button
                key={o.id}
                onClick={() => toggle(o.id)}
                className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-mono text-[9px] font-bold uppercase tracking-wider transition-all ${
                  layers[o.id] ? "border-cyan/50 bg-cyan/10 text-cyan" : "border-white/10 text-fog/60 hover:text-fog"
                }`}
              >
                {o.icon} {o.label}
              </button>
            ))}
            <button onClick={onClose} aria-label="Fermer" className="btn-ghost grid h-7 w-7 place-items-center rounded-md text-fog">
              <X size={13} />
            </button>
          </div>
        </div>

        {/* frame synthétique */}
        <div className="relative aspect-video overflow-hidden bg-abyss">
          <svg viewBox="0 0 800 450" className="h-full w-full">
            {/* décor */}
            <defs>
              <linearGradient id="bgScene" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={night ? "#0d1420" : "#1a2230"} />
                <stop offset="1" stopColor="#070a10" />
              </linearGradient>
              <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#151c28" />
                <stop offset="1" stopColor="#0a0e14" />
              </linearGradient>
            </defs>
            <rect width="800" height="450" fill="url(#bgScene)" />
            <rect y="300" width="800" height="150" fill="url(#floor)" />
            {/* ligne d'horizon + source lumineuse */}
            <line x1="0" y1="300" x2="800" y2="300" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
            <circle cx={night ? 130 : 660} cy="90" r="46" fill={night ? "rgba(0,229,255,0.10)" : "rgba(245,197,66,0.14)"} />
            <circle cx={night ? 130 : 660} cy="90" r="14" fill={night ? "rgba(0,229,255,0.5)" : "rgba(245,197,66,0.7)"} />
            <text x={night ? 130 : 660} y="160" textAnchor="middle" fill="rgba(139,152,171,0.6)" fontSize="10" fontFamily="IBM Plex Mono">
              {scene?.lighting ?? "—"}
            </text>

            {/* trajectoires */}
            {layers.tracks &&
              subjects.map((s, i) => {
                const x0 = s.x * 800 - 60;
                const y0 = 330;
                return (
                  <g key={`tr-${i}`}>
                    <polyline
                      points={`${x0},${y0} ${x0 + 45},${y0 - 14} ${x0 + 92},${y0 - 20} ${s.x * 800},${s.faceY * 450 + s.h * 450}`}
                      fill="none"
                      stroke={s.color}
                      strokeWidth="1.4"
                      strokeDasharray="5 5"
                      opacity="0.65"
                    />
                    <circle cx={x0} cy={y0} r="3" fill={s.color} />
                  </g>
                );
              })}

            {/* sujets */}
            {subjects.map((s, i) => {
              const cx = s.x * 800;
              const topY = s.faceY * 450;
              const bodyH = s.h * 450;
              return (
                <g key={s.name + i}>
                  {/* silhouette */}
                  <rect x={cx - 34} y={topY + 34} width="68" height={bodyH - 34} rx="16" fill={`${s.color}22`} stroke={`${s.color}55`} strokeWidth="1.2" />
                  <circle cx={cx} cy={topY + 16} r="17" fill={`${s.color}2e`} stroke={`${s.color}66`} strokeWidth="1.2" />
                  {/* points anatomiques */}
                  {layers.anatomy && (
                    <g>
                      {[
                        [cx, topY + 44], [cx - 26, topY + 60], [cx + 26, topY + 60],
                        [cx - 40, topY + 108], [cx + 40, topY + 106], [cx - 14, topY + bodyH - 6], [cx + 14, topY + bodyH - 6],
                      ].map(([px, py], k) => (
                        <g key={k}>
                          <circle cx={px} cy={py} r="3.4" fill="#0a0e14" stroke="#34d399" strokeWidth="1.4" />
                        </g>
                      ))}
                      <polyline
                        points={`${cx - 26},${topY + 60} ${cx - 40},${topY + 108} ${cx - 14},${topY + bodyH - 6} M ${cx + 26},${topY + 60} ${cx + 40},${topY + 106} ${cx + 14},${topY + bodyH - 6} M ${cx},${topY + 44} ${cx},${topY + bodyH - 30}`}
                        fill="none" stroke="#34d399" strokeWidth="1" opacity="0.6" strokeDasharray="3 4"
                      />
                    </g>
                  )}
                  {/* bounding box visage */}
                  {layers.faces && (
                    <g>
                      <rect x={cx - 24} y={topY - 6} width="48" height="46" fill="none" stroke={s.color} strokeWidth="1.6" opacity="0.9" />
                      <text x={cx - 24} y={topY - 12} fill={s.color} fontSize="11" fontFamily="IBM Plex Mono" fontWeight="700">
                        {s.name} · {(88 + (i * 3) % 10)}%
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* objets */}
            {layers.objects &&
              (scene?.objects ?? []).slice(0, 3).map((o, i) => {
                const ox = 120 + i * 250 + (hashSeed(o.id) % 60);
                const oy = 322;
                return (
                  <g key={o.id}>
                    <rect x={ox} y={oy} width="54" height="34" rx="4" fill="rgba(96,165,250,0.12)" stroke="#60a5fa" strokeWidth="1.4" strokeDasharray="4 3" />
                    <text x={ox} y={oy - 8} fill="#60a5fa" fontSize="10" fontFamily="IBM Plex Mono" fontWeight="700">
                      {o.id} · {o.type}
                    </text>
                  </g>
                );
              })}

            {/* zone d'anomalie */}
            {layers.anomaly && (
              <g>
                <rect
                  x={anomaly.frameBox.x * 800}
                  y={anomaly.frameBox.y * 450}
                  width={anomaly.frameBox.w * 800}
                  height={anomaly.frameBox.h * 450}
                  fill="rgba(255,93,115,0.10)"
                  stroke="#ff5d73"
                  strokeWidth="2"
                  strokeDasharray="7 5"
                >
                  <animate attributeName="opacity" values="1;0.45;1" dur="1.4s" repeatCount="indefinite" />
                </rect>
                <text x={anomaly.frameBox.x * 800} y={anomaly.frameBox.y * 450 - 10} fill="#ff5d73" fontSize="12" fontFamily="IBM Plex Mono" fontWeight="700">
                  {anomaly.type.toUpperCase()}
                </text>
              </g>
            )}
          </svg>

          {/* letterbox */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[7%] bg-black" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[7%] bg-black" />
          <div className="grain animate-grain pointer-events-none absolute inset-0 opacity-[0.06]" />
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-white/[0.06] px-4 py-3 font-mono text-[9.5px] font-semibold text-fog/70">
          <span className="text-coral">■ {anomaly.type}</span>
          <span>{anomaly.engineId} · confiance estimée {anomaly.confidence} %</span>
          <span className="ml-auto text-fog/50">Frame synthétique de diagnostic — ne constitue pas une preuve.</span>
        </div>
      </motion.div>
    </motion.div>
  );
}
