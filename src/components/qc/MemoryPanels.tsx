/**
 * Scene Memory (§24) + Global Project Memory (§25).
 * Ces mémoires sont réinjectées automatiquement dans le contexte de
 * génération lors de toute régénération de segment.
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, Database, Layers } from "lucide-react";
import type { CharacterIdentityProfile, ProjectMemory, SceneConstraint } from "../../agwe/models";

function KV({ k, v }: { k: string; v: string }) {
  return (
    <p className="flex justify-between gap-3 text-[10.5px]">
      <span className="font-mono font-bold uppercase tracking-wider text-fog/60">{k}</span>
      <span className="truncate text-right font-semibold text-fog">{v}</span>
    </p>
  );
}

export default function MemoryPanels({
  scenes,
  profiles,
  memory,
}: {
  scenes: SceneConstraint[];
  profiles: CharacterIdentityProfile[];
  memory: ProjectMemory | null;
}) {
  const [open, setOpen] = useState<string | null>(scenes[0]?.sceneId ?? null);

  if (!scenes.length && !memory) {
    return (
      <div className="panel px-5 py-8 text-center text-[12px] font-semibold text-fog/60">
        Les mémoires de scène et de projet se construisent après la planification du scénario.
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
      {/* ---- Scene Memory ---- */}
      <div className="panel overflow-hidden">
        <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
          <Layers size={13} className="text-cyan" />
          <span className="font-display text-[11px] font-bold uppercase tracking-[0.24em] text-cyan">Scene memory</span>
          <span className="ml-auto font-mono text-[9.5px] font-semibold text-fog/60">réinjectée à chaque régénération</span>
        </div>
        <div className="max-h-[420px] overflow-y-auto p-3" style={{ scrollbarWidth: "thin" }}>
          {scenes.map((sc) => {
            const isOpen = open === sc.sceneId;
            return (
              <div key={sc.sceneId} className="mb-2 overflow-hidden rounded-lg border border-white/[0.07]">
                <button
                  onClick={() => setOpen(isOpen ? null : sc.sceneId)}
                  className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors ${isOpen ? "bg-cyan/[0.06]" : "hover:bg-white/[0.03]"}`}
                >
                  <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-cyan">{sc.sceneId.toUpperCase()}</span>
                  <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-frost">{sc.label}</span>
                  <span className="font-mono text-[9px] font-semibold text-fog/60">
                    {sc.characters.length} pers · {sc.objects.length} obj
                  </span>
                  <ChevronDown size={13} className={`shrink-0 text-fog transition-transform duration-200 ${isOpen ? "rotate-180 text-cyan" : ""}`} />
                </button>
                <motion.div
                  initial={false}
                  animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="grid gap-x-6 gap-y-1 border-t border-white/[0.06] px-3.5 py-3 sm:grid-cols-2">
                    <KV k="Characters" v={sc.characters.join(", ") || "—"} />
                    <KV k="Objects" v={sc.objects.map((o) => o.type).join(", ") || "—"} />
                    <KV k="Light" v={sc.lighting} />
                    <KV k="Camera" v={`${sc.camera.shot} · ${sc.camera.movement}`} />
                    <KV k="Environment" v={`${sc.interior ? "INT" : "EXT"} ${sc.location}`} />
                    <KV k="Transition" v={sc.transition} />
                    {sc.characters.map((c) => (
                      <KV key={c} k={`Costume · ${c}`} v={sc.clothing[c] ?? "—"} />
                    ))}
                    {sc.events.length > 0 && <KV k="Events" v={sc.events.join(" / ").slice(0, 90)} />}
                  </div>
                </motion.div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---- Project Memory ---- */}
      <div className="panel overflow-hidden">
        <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
          <Database size={13} className="text-gold" />
          <span className="font-display text-[11px] font-bold uppercase tracking-[0.24em] text-gold">Project memory</span>
          <span className="ml-auto font-mono text-[9.5px] font-semibold text-fog/60">cohérence scène 1 ↔ scène N</span>
        </div>
        {!memory ? (
          <p className="px-4 py-8 text-center text-[11.5px] font-semibold text-fog/60">En attente de planification…</p>
        ) : (
          <div className="max-h-[420px] space-y-4 overflow-y-auto p-4" style={{ scrollbarWidth: "thin" }}>
            <div>
              <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-fog/60">Personnages</p>
              <div className="mt-1.5 space-y-1.5">
                {memory.characters.map((c) => (
                  <div key={c.name} className="flex items-center gap-2.5 rounded-md border border-white/[0.07] bg-white/[0.02] px-3 py-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color, boxShadow: `0 0 8px ${c.color}` }} />
                    <span className="text-[11.5px] font-bold text-frost">{c.name}</span>
                    <span className="truncate font-mono text-[9.5px] font-semibold text-fog/70">{c.wardrobe}</span>
                    <span className="ml-auto shrink-0 font-mono text-[9px] font-semibold text-volt">{c.voice ?? "voix —"}</span>
                  </div>
                ))}
                {memory.characters.length === 0 && <p className="text-[10.5px] font-semibold text-fog/50">Aucun personnage au casting.</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-fog/60">Objets récurrents</p>
                <div className="mt-1.5 space-y-1">
                  {memory.recurringObjects.map((o) => (
                    <p key={o.id} className="truncate text-[10.5px] font-semibold text-fog">
                      <span className="text-[#60a5fa]">{o.id}</span> · {o.type} <span className="text-fog/50">({o.color})</span>
                    </p>
                  ))}
                  {memory.recurringObjects.length === 0 && <p className="text-[10.5px] text-fog/50">—</p>}
                </div>
              </div>
              <div>
                <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-fog/60">Lieux</p>
                <div className="mt-1.5 space-y-1">
                  {memory.locations.map((l) => (
                    <p key={l} className="truncate text-[10.5px] font-semibold text-fog">{l}</p>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-fog/60">Caméra & style</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {memory.cameraPrefs.map((c) => (
                  <span key={c} className="rounded-md border border-white/[0.09] bg-white/[0.03] px-2 py-1 font-mono text-[9.5px] font-semibold text-fog">{c}</span>
                ))}
                <span className="rounded-md border border-gold/30 bg-gold/[0.06] px-2 py-1 font-mono text-[9.5px] font-semibold text-gold">{memory.palette}</span>
              </div>
            </div>

            {memory.relations.length > 0 && (
              <div>
                <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-fog/60">Relations</p>
                <div className="mt-1.5 space-y-1">
                  {memory.relations.map((r) => (
                    <p key={r} className="truncate text-[10.5px] font-semibold text-fog">{r}</p>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-fog/60">Chronologie</p>
              <div className="mt-1.5 space-y-1">
                {memory.chronology.map((c, i) => (
                  <p key={c.sceneId} className="flex gap-2 text-[10.5px] font-semibold text-fog/80">
                    <span className="font-mono text-fog/40">{String(i + 1).padStart(2, "0")}</span>
                    <span className="truncate">{c.label}</span>
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* profils d'identité (repliés, consultables) */}
      {profiles.length > 0 && (
        <div className="panel lg:col-span-2 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
            <span className="font-display text-[11px] font-bold uppercase tracking-[0.24em] text-mint">Character identity profiles</span>
            <span className="ml-auto font-mono text-[9.5px] font-semibold text-fog/60">{profiles.length} profil(s) · comparaison frame à frame</span>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {profiles.map((p) => (
              <div key={p.id} className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-md font-display text-[11px] font-bold" style={{ background: `${p.color}22`, color: p.color, border: `1px solid ${p.color}55` }}>
                    {p.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-bold text-frost">{p.name}</p>
                    <p className="font-mono text-[9px] font-semibold text-fog/60">embedding 8-d · {p.identity.apparentAge}</p>
                  </div>
                </div>
                <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1">
                  <KV k="Face" v={p.identity.faceShape} />
                  <KV k="Hair" v={p.identity.hair} />
                  <KV k="Top" v={p.clothing.top} />
                  <KV k="Shoes" v={p.clothing.shoes} />
                  <KV k="Voice" v={p.voice.style} />
                  <KV k="Posture" v={p.body.posture} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
