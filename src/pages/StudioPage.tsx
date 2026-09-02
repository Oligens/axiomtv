/**
 * Mon Studio — tableau de bord créateur : raccourcis vers AgwèStream,
 * publications, revenus et intro cinématique.
 */
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { BarChart3, Clapperboard, Film, LayoutList, Wand2, Zap } from "lucide-react";
import { useStore } from "../store/useStore";
import CinemaIntro from "../components/CinemaIntro";
import { useState } from "react";

export default function StudioPage() {
  const navigate = useNavigate();
  const user = useStore((s) => s.user);
  const publications = useStore((s) => s.publications);
  const introMeta = useStore((s) => s.introMeta);
  const agwePack = useStore((s) => s.agwePack);
  const [introOpen, setIntroOpen] = useState(false);

  const tiles = [
    {
      icon: <Wand2 size={22} />,
      title: "AgwèStream IA",
      desc: "Studio de production virtuel : scénario global, extraction de visages, clonage vocal et timeline.",
      to: "/studio/agwestream",
      accent: "#9d4edd",
      badge: agwePack ? `${agwePack.videosLeft}/15` : undefined,
    },
    {
      icon: <LayoutList size={22} />,
      title: "Mes Publications",
      desc: "Gérez vos contenus : statut, tarif Pay-Per-View, vues et revenus.",
      to: "/studio/publications",
      accent: "#00e5ff",
      badge: String(publications.length),
    },
    {
      icon: <BarChart3 size={22} />,
      title: "Revenus",
      desc: "Suivi des gains, passerelles de paiement et retraits de fonds.",
      to: "/creator/earnings",
      accent: "#34d399",
    },
    {
      icon: <Clapperboard size={22} />,
      title: "Intro cinématique",
      desc: "Prévisualisez la séquence d'ouverture « AgweStream » pré-collée à vos films.",
      to: "#intro",
      accent: "#f5c542",
    },
  ];

  return (
    <div className="mx-auto max-w-[1100px] pb-16">
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
        <div className="max-w-2xl">
          <p className="eyebrow text-cyan">Espace créateur</p>
          <h1 className="font-display mt-2 text-[30px] font-bold leading-[1.05] tracking-tight text-white sm:text-[42px]">
            Mon Studio <span className="text-fog">— @{user?.username}</span>
          </h1>
          <p className="mt-3 text-[13.5px] leading-relaxed text-fog">Centralisez toute la puissance d'un studio professionnel : production IA, publication, monétisation.</p>
        </div>
        <button onClick={() => navigate("/studio/agwestream")} className="btn-neon flex items-center gap-2 rounded-full px-6 py-3 font-display text-[13px] font-bold tracking-wide">
          <Zap size={16} /> Lancer AgwèStream
        </button>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {tiles.map((t, i) => (
          <motion.button
            key={t.title}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
            onClick={() => (t.to === "#intro" ? setIntroOpen(true) : navigate(t.to))}
            className="glass-card group relative overflow-hidden rounded-2xl p-6 text-left"
          >
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-40" style={{ background: t.accent }} />
            <div className="flex items-start justify-between">
              <span className="grid h-12 w-12 place-items-center rounded-xl border" style={{ borderColor: `${t.accent}55`, background: `${t.accent}14`, color: t.accent }}>
                {t.icon}
              </span>
              {t.badge && <span className="font-mono rounded-full border border-white/15 bg-white/[0.04] px-2.5 py-1 text-[10.5px] font-bold text-frost">{t.badge}</span>}
            </div>
            <p className="font-display mt-4 text-[17px] font-bold text-frost">{t.title}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-fog">{t.desc}</p>
          </motion.button>
        ))}
      </div>

      {/* dernières publications */}
      <section className="glass mt-8 rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <p className="eyebrow text-cyan">Dernières publications</p>
          <button onClick={() => navigate("/studio/publications")} className="font-display text-[10.5px] font-bold uppercase tracking-[0.14em] text-cyan hover:underline">
            Tout voir
          </button>
        </div>
        {publications.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-white/15 px-4 py-8 text-center text-[12px] font-semibold text-fog/70">
            Aucune publication — créez votre première scène avec AgwèStream.
          </p>
        ) : (
          <div className="mt-4 space-y-2.5">
            {publications.slice(0, 4).map((p) => (
              <div key={p.id} className="flex items-center gap-3.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <Film size={17} className="shrink-0 text-cyan" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-frost">{p.title}</p>
                  <p className="text-[11px] text-fog">{p.category} · {p.kind === "ppv" ? `PPV ${p.price.toFixed(2)} $` : "Gratuit"}</p>
                </div>
                <span className={`font-display rounded-full border px-2 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.12em] ${p.status === "online" ? "border-mint/40 bg-mint/10 text-mint" : "border-gold/40 bg-gold/10 text-gold"}`}>
                  {p.status === "online" ? "En ligne" : "Vérification"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {introOpen && <CinemaIntro meta={introMeta} onClose={() => setIntroOpen(false)} onFinished={() => setIntroOpen(false)} />}
    </div>
  );
}
