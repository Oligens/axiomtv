/**
 * Hub Axiom TV — À la une, directs, Zap virtuel, contenus communautaires,
 * créateurs à suivre.
 */
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { BadgeCheck, Crown, Eye, Radio, Users, Wand2 } from "lucide-react";
import { CATEGORIES, CREATORS, STATS, TICKER, VIDEOS, ZAP_CHANNELS, formatViews, type CategoryId, type Video } from "../data/axiom";
import { useStore } from "../store/useStore";
import VideoCard from "../components/VideoCard";
import { Logomark } from "../components/brand";

function ThumbPattern({ g, motif, glow }: { g: string; motif: string; glow: string }) {
  return (
    <>
      <div className={`absolute inset-0 bg-gradient-to-br ${g}`} />
      {motif === "grid" && <div className="absolute inset-0" style={{ background: "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />}
      {motif === "beams" && <div className="absolute inset-0" style={{ background: "repeating-linear-gradient(115deg, rgba(255,255,255,0.05) 0 2px, transparent 2px 34px)" }} />}
      {motif === "waves" && <div className="absolute inset-0" style={{ background: "repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0 2px, transparent 2px 14px)" }} />}
      <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 35% 30%, ${glow}, transparent 62%)` }} />
    </>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const user = useStore((s) => s.user);
  const openAuth = useStore((s) => s.openAuth);
  const toast = useStore((s) => s.toast);

  const cat = (params.get("cat") as CategoryId) ?? "tous";
  const [query, setQuery] = useState("");

  const featured = VIDEOS[0];
  const lives = VIDEOS.filter((v) => v.live);
  const list = VIDEOS.filter(
    (v) => (cat === "tous" || v.category === cat) && (!query || v.title.toLowerCase().includes(query.toLowerCase()) || v.creator.toLowerCase().includes(query.toLowerCase()))
  );

  const setCat = (c: CategoryId) => setParams(c === "tous" ? {} : { cat: c });

  const openVideo = (v: Video) =>
    toast(v.live ? `Rejoindre « ${v.title} » — le flux s'ouvrira avec l'API vidéo` : `Lecture de « ${v.title} » — flux vidéo en attente de branchement`, "info");

  return (
    <div className="mx-auto max-w-[1360px]">
      {/* ================= À la une ================= */}
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="glass scanlines group relative mt-4 overflow-hidden rounded-[22px] shadow-[0_30px_80px_rgba(0,0,0,0.55)] md:mt-6"
      >
        <div className="absolute inset-0">
          <ThumbPattern g={featured.art.g} motif={featured.art.motif} glow={featured.art.glow} />
          <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/70 to-transparent" />
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan/60 to-transparent" />

        <div className="relative max-w-2xl p-8 sm:p-12">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display flex items-center gap-2 rounded-md bg-coral px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-white shadow-[0_0_24px_rgba(255,93,115,0.55)]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-white" style={{ animation: "pingSoft 1.5s cubic-bezier(0,0,0.2,1) infinite" }} />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
              </span>
              Direct en cours
            </span>
            <span className="glass-deep font-display flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-bold text-frost">
              <Eye size={12} className="text-coral" /> {featured.viewers?.toLocaleString("fr-FR")} spectateurs
            </span>
          </div>

          <h1 className="font-display mt-4 text-3xl font-bold leading-[1.06] tracking-tight text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)] sm:text-5xl">
            {featured.title}
          </h1>
          <p className="mt-4 max-w-xl text-[13.5px] leading-relaxed text-fog sm:text-[15px]">{featured.description}</p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button onClick={() => openVideo(featured)} className="btn-neon flex items-center gap-2 rounded-full px-6 py-3 font-display text-[14px] font-bold tracking-wide">
              Regarder le direct
            </button>
            <button onClick={() => navigate(user ? "/studio/agwestream" : "/login")} className="glass flex items-center gap-2 rounded-full px-5 py-3 text-[13px] font-bold text-frost transition-all hover:border-volt/60 hover:text-[#c78bf0]">
              <Wand2 size={16} /> Créer avec AgwèStream
            </button>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-semibold text-fog">
            <span className="flex items-center gap-1.5 text-frost">
              {featured.creator}
              <BadgeCheck size={13} className="text-cyan" />
            </span>
            <span className="h-1 w-1 rounded-full bg-fog/50" />
            <span>{featured.creatorRole}</span>
          </div>
        </div>
      </motion.section>

      {/* ================= bandeau directs + ticker ================= */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <span className="font-display flex items-center gap-2 rounded-full border border-coral/40 bg-coral/10 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-coral">
          <Radio size={14} /> {lives.length} direct(s) indépendant(s) en ce moment
        </span>
        <button onClick={() => navigate("/pro")} className="gold-btn flex items-center gap-1.5 rounded-full px-4 py-2 font-display text-[10.5px] font-bold uppercase tracking-[0.16em]">
          <Crown size={13} /> Passer en Pro
        </button>
        <div className="ticker-mask ml-auto hidden max-w-[420px] flex-1 overflow-hidden lg:block">
          <div className="flex w-max gap-10" style={{ animation: "marquee 32s linear infinite" }}>
            {[0, 1].map((k) => (
              <span key={k} className="font-mono flex gap-10 text-[10px] font-semibold tracking-wider text-fog/60">
                {TICKER.map((t, i) => (
                  <span key={i}>{t}</span>
                ))}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ================= Zap virtuel ================= */}
      <section className="mt-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-cyan">Zap virtuel</p>
            <h2 className="font-display mt-1.5 text-2xl font-bold tracking-tight text-white sm:text-[28px]">Antennes en continu</h2>
          </div>
          <span className="font-mono hidden text-[10.5px] font-semibold text-fog/60 sm:block">flux non-stop · 100 % communautaires</span>
        </div>
        <div className="no-scrollbar mt-5 flex snap-x gap-4 overflow-x-auto pb-2">
          {ZAP_CHANNELS.map((ch, i) => (
            <motion.button
              key={ch.id}
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-30px" }}
              transition={{ duration: 0.45, delay: i * 0.06 }}
              onClick={() => toast(`Zap sur ${ch.name} — ${ch.nowPlaying}`, "info")}
              className="glass-card group relative w-[250px] shrink-0 snap-start overflow-hidden rounded-2xl text-left sm:w-[280px]"
            >
              <div className="relative h-32 overflow-hidden">
                <ThumbPattern g={ch.art.g} motif={ch.art.motif} glow={ch.art.glow} />
                <span className="font-display absolute left-3 top-3 text-[26px] font-bold text-white/90 drop-shadow-[0_0_14px_rgba(0,229,255,0.5)]">{ch.num}</span>
                {ch.live && (
                  <span className="font-display absolute right-3 top-3 flex items-center gap-1.5 rounded bg-coral px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-white">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute h-full w-full rounded-full bg-white" style={{ animation: "pingSoft 1.5s cubic-bezier(0,0,0.2,1) infinite" }} />
                      <span className="relative h-1.5 w-1.5 rounded-full bg-white" />
                    </span>
                    Live
                  </span>
                )}
                <div className="absolute inset-x-3 bottom-2.5">
                  <div className="h-1 overflow-hidden rounded-full bg-white/15">
                    <div className="channel-progress h-full w-2/3 rounded-full" />
                  </div>
                </div>
              </div>
              <div className="p-4">
                <p className="font-display text-[15px] font-bold text-frost">{ch.name}</p>
                <p className="mt-0.5 line-clamp-1 text-[11.5px] text-fog">{ch.tagline}</p>
                <p className="mt-2 line-clamp-1 text-[11px] font-semibold text-cyan/85">▸ {ch.nowPlaying}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-fog">
                    <Eye size={13} /> {ch.viewers.toLocaleString("fr-FR")}
                  </span>
                  <span className="btn-ghost rounded-full px-3.5 py-1.5 font-display text-[10px] font-bold uppercase tracking-[0.16em] text-fog group-hover:border-cyan/50 group-hover:text-cyan">
                    Zapper
                  </span>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </section>

      {/* ================= Hub communautaire ================= */}
      <section className="mt-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-cyan">Hub communautaire</p>
            <h2 className="font-display mt-1.5 text-2xl font-bold tracking-tight text-white sm:text-[32px]">
              {CATEGORIES.find((c) => c.id === cat)?.label ?? "Tout le hub"}
            </h2>
          </div>
          <div className="relative w-full sm:w-72">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtrer sur cette page…"
              className="field h-10 w-full rounded-full px-4 text-[13px] font-semibold text-frost"
            />
          </div>
        </div>

        <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              className={`font-display shrink-0 rounded-full border px-4 py-2 text-[11.5px] font-bold uppercase tracking-[0.12em] transition-all duration-300 ${
                cat === c.id ? "chip-on" : "chip text-fog hover:text-frost"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((v, i) => (
            <VideoCard key={v.id} video={v} index={i} onOpen={openVideo} />
          ))}
        </div>
        {list.length === 0 && (
          <p className="glass mt-6 rounded-2xl px-6 py-12 text-center text-[13px] font-semibold text-fog">
            Aucun contenu ne correspond à « {query} » dans cette catégorie.
          </p>
        )}
      </section>

      {/* ================= Créateurs à suivre ================= */}
      <section className="mt-14">
        <div className="flex items-center gap-3">
          <Users size={20} className="text-cyan" />
          <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-[28px]">Créateurs / Journalistes à suivre</h2>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {CREATORS.map((c, i) => (
            <motion.button
              key={c.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-30px" }}
              transition={{ duration: 0.45, delay: i * 0.06 }}
              onClick={() => navigate(`/creator/${c.handle}`)}
              className="glass-card flex items-center gap-3.5 rounded-xl p-4 text-left"
            >
              <span
                className="font-display grid h-12 w-12 shrink-0 place-items-center rounded-full text-[13px] font-bold text-white ring-1 ring-white/20"
                style={{ background: `linear-gradient(135deg, ${c.hue}55, ${c.hueTo}66)`, textShadow: `0 0 12px ${c.hue}` }}
              >
                {c.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-[13.5px] font-bold text-frost">
                  {c.name}
                  {c.verified && <BadgeCheck size={13} className="shrink-0 text-cyan" />}
                </span>
                <span className="block truncate text-[11.5px] text-fog">{c.role}</span>
                <span className="mt-0.5 block font-mono text-[10px] font-semibold text-fog/60">{formatViews(c.followers)} abonnés</span>
              </span>
              <span className="btn-ghost shrink-0 rounded-full px-3 py-1.5 font-display text-[9.5px] font-bold uppercase tracking-[0.14em] text-fog">
                Suivre
              </span>
            </motion.button>
          ))}
        </div>
      </section>

      {/* ================= Stats ================= */}
      <section className="mt-14 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {STATS.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-30px" }}
            transition={{ duration: 0.45, delay: i * 0.07 }}
            className="glass rounded-2xl p-5"
          >
            <p className="font-display text-[30px] font-bold leading-none text-white">{s.value}</p>
            <p className="mt-2 text-[11.5px] font-bold text-frost">{s.label}</p>
            <p className="mt-0.5 font-mono text-[10px] font-semibold text-cyan/80">{s.sub}</p>
          </motion.div>
        ))}
      </section>

      {/* ================= pied ================= */}
      <footer className="mt-16 border-t border-white/[0.07] pb-8 pt-8 text-center">
        <div className="flex items-center justify-center gap-2.5">
          <Logomark size={26} />
          <p className="font-display text-[14px] font-bold tracking-[0.2em] text-frost">
            AXIOM<span className="text-cyan">TV</span>
          </p>
        </div>
        <p className="mt-2 text-[11.5px] text-fog">L'information sans filtre, la liberté sans concession — 100 % communautaire, financée par les spectateurs.</p>
        {!user && (
          <button onClick={() => openAuth("register")} className="btn-neon mt-5 rounded-full px-6 py-3 font-display text-[12.5px] font-bold tracking-wide">
            Ouvrir mon antenne gratuitement
          </button>
        )}
      </footer>
    </div>
  );
}
