import { useMemo, useState } from "react";
import { Atom, Camera, Download, Sparkles, Wand2 } from "lucide-react";
import { buildScifiCommandText, buildScifiRenderPlan } from "../agwe/scifi";

const DEFAULT_TEXT = "[SCÈNE 1 — INT. BUREAU — NUIT]\nMira entre dans la station spatiale. Un hologramme s'active. La caméra tremble légèrement, stabilisation à 72 %. Ajouter une distorsion spatiale et améliorer en 4K.";

export default function ScifiDirectorPanel() {
  const [text, setText] = useState(DEFAULT_TEXT);
  const plan = useMemo(() => buildScifiRenderPlan(text.split(/\n+/).filter(Boolean)), [text]);

  const exportPlan = () => {
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "agwe-scifi-render-plan.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="panel relative z-20 mb-6 overflow-hidden p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan/10 text-cyan shadow-[0_0_22px_rgba(0,229,255,.12)]"><Atom size={20} /></span>
          <div>
            <p className="eyebrow text-cyan">Chef d'orchestre Sci‑Fi</p>
            <p className="text-xs text-fog">Le texte pilote le contrat de rendu, sans exposer de secrets IA au navigateur.</p>
          </div>
        </div>
        <button type="button" onClick={exportPlan} className="btn-ghost flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold"><Download size={14} /> Export</button>
      </div>

      <textarea value={text} onChange={(e) => setText(e.target.value)} className="field min-h-36 w-full rounded-xl p-3 text-sm leading-relaxed text-frost" placeholder="Décrivez le film : station spatiale, décor cyberpunk, stabilisation, 4K, hologrammes…" />

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Info icon={<Wand2 size={14} />} label="Décor" value={plan.environment} />
        <Info icon={<Sparkles size={14} />} label="VFX" value={plan.vfx.length ? plan.vfx.join(", ") : "aucun"} />
        <Info icon={<Camera size={14} />} label="Caméra" value={`${plan.camera.treatment} · ${Math.round(plan.camera.strength * 100)}%`} />
        <Info icon={<Sparkles size={14} />} label="Upscale" value={plan.upscale} />
      </div>

      <pre className="mt-4 max-h-40 overflow-auto rounded-xl border border-white/[.07] bg-black/25 p-3 text-[10px] leading-relaxed text-fog">{buildScifiCommandText(plan)}</pre>
    </section>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="rounded-xl border border-white/[.07] bg-white/[.025] p-3"><div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-fog/70">{icon}{label}</div><div className="truncate text-xs font-bold text-frost">{value}</div></div>;
}
