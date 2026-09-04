/** Hub public AxiomTV — aucune donnée de démonstration n'est injectée côté client. */
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Crown, Film, Radio, Users, Wand2 } from "lucide-react";
import { CATEGORIES, type CategoryId } from "../data/axiom";
import { useStore } from "../store/useStore";

export default function HomePage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const user = useStore((s) => s.user);
  const openAuth = useStore((s) => s.openAuth);
  const [query, setQuery] = useState("");
  const cat = (params.get("cat") as CategoryId) ?? "tous";

  const setCat = (value: CategoryId) => setParams(value === "tous" ? {} : { cat: value });

  return (
    <div className="mx-auto max-w-[1360px] pb-16">
      <section className="glass relative mt-4 overflow-hidden rounded-[22px] p-8 sm:p-12 md:mt-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(0,229,255,.08),transparent_48%)]" />
        <div className="relative max-w-2xl">
          <p className="eyebrow text-cyan">Hub communautaire</p>
          <h1 className="font-display mt-3 text-3xl font-bold tracking-tight text-white sm:text-5xl">Aucun contenu pour le moment</h1>
          <p className="mt-4 max-w-xl text-[13.5px] leading-relaxed text-fog">
            Le catalogue est vide. Les vidéos, directs, chaînes, créateurs et statistiques sont chargés uniquement lorsqu'ils proviennent de sources réelles.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={() => navigate(user ? "/studio/agwestream" : "/login")} className="btn-neon flex items-center gap-2 rounded-full px-6 py-3 font-display text-[13px] font-bold">
              <Wand2 size={16} /> {user ? "Créer avec AgwèStream" : "Ouvrir mon studio"}
            </button>
            <button onClick={() => navigate("/pro")} className="gold-btn flex items-center gap-2 rounded-full px-5 py-3 font-display text-[12px] font-bold">
              <Crown size={15} /> Voir les offres
            </button>
          </div>
        </div>
      </section>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <span className="font-display flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-fog">
          <Radio size={14} /> Aucun direct en cours
        </span>
      </div>

      <section className="mt-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-cyan">Catalogue</p>
            <h2 className="font-display mt-1.5 text-2xl font-bold tracking-tight text-white sm:text-[30px]">
              {CATEGORIES.find((c) => c.id === cat)?.label ?? "Tout le hub"}
            </h2>
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher dans le catalogue…"
            className="field h-10 w-full rounded-full px-4 text-[13px] font-semibold text-frost sm:w-72"
          />
        </div>

        <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map((c) => (
            <button key={c.id} onClick={() => setCat(c.id)} className={`font-display shrink-0 rounded-full border px-4 py-2 text-[11.5px] font-bold uppercase tracking-[0.12em] ${cat === c.id ? "chip-on" : "chip text-fog hover:text-frost"}`}>
              {c.label}
            </button>
          ))}
        </div>

        <div className="glass mt-6 rounded-2xl px-6 py-14 text-center">
          <Film size={28} className="mx-auto text-fog/40" />
          <p className="mt-4 text-[14px] font-bold text-frost">Aucune vidéo pour le moment</p>
          <p className="mt-1 text-[12px] text-fog">
            {query ? `Aucun résultat pour « ${query} ».` : "Publiez un premier contenu pour alimenter cette section."}
          </p>
        </div>
      </section>

      <section className="mt-14">
        <div className="flex items-center gap-3">
          <Users size={20} className="text-cyan" />
          <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-[28px]">Créateurs à suivre</h2>
        </div>
        <div className="glass mt-5 rounded-2xl px-6 py-12 text-center">
          <p className="text-[13.5px] font-bold text-frost">Aucun créateur pour le moment</p>
          <p className="mt-1 text-[12px] text-fog">Les profils apparaîtront lorsqu'ils seront enregistrés dans le système.</p>
        </div>
      </section>
    </div>
  );
}
