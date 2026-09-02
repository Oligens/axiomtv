/**
 * Carte vidéo du hub — vignette générative, badge LIVE, survol néon.
 */
import { motion } from "framer-motion";
import { BadgeCheck, Eye, Play } from "lucide-react";
import { CATEGORIES, formatViews, type ThumbArt, type Video } from "../data/axiom";

function ThumbPattern({ art, live }: { art: ThumbArt; live?: boolean }) {
  return (
    <>
      <div className={`absolute inset-0 bg-gradient-to-br ${art.g}`} />
      <div
        className="absolute inset-0"
        style={{
          background:
            art.motif === "grid"
              ? "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)"
              : art.motif === "dots"
                ? "radial-gradient(rgba(255,255,255,0.14) 1px, transparent 1.5px)"
                : "none",
          backgroundSize: art.motif === "grid" ? "22px 22px" : art.motif === "dots" ? "12px 12px" : undefined,
        }}
      />
      {(art.motif === "beams" || art.motif === "waves") && (
        <div
          className="absolute inset-0"
          style={{
            background:
              art.motif === "beams"
                ? "repeating-linear-gradient(115deg, rgba(255,255,255,0.05) 0 2px, transparent 2px 34px)"
                : "repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0 2px, transparent 2px 14px)",
          }}
        />
      )}
      {art.motif === "scan" && <div className="scanlines absolute inset-0" />}
      <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 35% 30%, ${art.glow}, transparent 62%)` }} />
      <div className="absolute inset-0 bg-gradient-to-t from-abyss/85 via-transparent to-transparent" />
      {live && (
        <div className="absolute inset-0">
          <div className="absolute inset-x-0 top-0 h-[2px] overflow-hidden">
            <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-coral to-transparent" style={{ animation: "sweep 2.2s ease-in-out infinite" }} />
          </div>
        </div>
      )}
    </>
  );
}

export default function VideoCard({ video, index, onOpen }: { video: Video; index: number; onOpen: (v: Video) => void }) {
  const cat = CATEGORIES.find((c) => c.id === video.category);
  return (
    <motion.article
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay: (index % 4) * 0.07, ease: [0.22, 1, 0.36, 1] }}
      onClick={() => onOpen(video)}
      className="glass-card group cursor-pointer overflow-hidden rounded-2xl p-3"
    >
      <div className="relative aspect-video overflow-hidden rounded-xl border border-white/10 transition-colors duration-300 group-hover:border-cyan/45">
        <ThumbPattern art={video.art} live={video.live} />

        {video.live ? (
          <>
            <span className="font-display absolute left-3 top-3 flex items-center gap-1.5 rounded-md bg-coral px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white shadow-[0_0_18px_rgba(255,93,115,0.6)]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute h-full w-full rounded-full bg-white" style={{ animation: "pingSoft 1.5s cubic-bezier(0,0,0.2,1) infinite" }} />
                <span className="relative h-1.5 w-1.5 rounded-full bg-white" />
              </span>
              Live
            </span>
            <span className="glass-deep font-display absolute right-3 top-3 flex items-center gap-1.5 rounded-md px-2 py-1 text-[10.5px] font-bold text-frost">
              <Eye size={12} className="text-coral" /> {video.viewers?.toLocaleString("fr-FR")}
            </span>
          </>
        ) : (
          <>
            <span className="font-display absolute left-3 top-3 rounded-md border border-white/10 bg-abyss/75 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.18em] text-fog backdrop-blur-sm transition-colors group-hover:text-cyan">
              {cat?.short}
            </span>
            <span className="font-display absolute bottom-3 right-3 rounded-md border border-white/10 bg-abyss/85 px-2 py-0.5 text-[11px] font-bold text-frost backdrop-blur-sm">
              {video.duration}
            </span>
          </>
        )}

        <div className="absolute inset-0 grid place-items-center bg-abyss/25 opacity-0 transition-all duration-300 group-hover:opacity-100">
          <span className="grid h-14 w-14 scale-75 place-items-center rounded-full border border-cyan/70 bg-cyan/15 text-cyan shadow-[0_0_30px_rgba(0,229,255,0.45)] backdrop-blur-md transition-transform duration-300 group-hover:scale-100">
            <Play size={24} />
          </span>
        </div>
      </div>

      <div className="px-1 pb-1 pt-3.5">
        <h3 className="line-clamp-2 text-[14.5px] font-bold leading-snug text-frost transition-colors duration-300 group-hover:text-cyan">{video.title}</h3>
        <div className="mt-2.5 flex items-center gap-2">
          <span
            className={`font-display grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-bold ring-1 ${
              video.verified ? "bg-gradient-to-br from-cyan/35 to-volt/40 text-frost ring-cyan/50" : "bg-gradient-to-br from-white/12 to-white/4 text-fog ring-white/15"
            }`}
          >
            {video.creator.split(" ").map((w) => w[0]).slice(0, 2).join("")}
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 truncate text-[12.5px] font-semibold text-fog transition-colors group-hover:text-frost">
              {video.creator}
              {video.verified ? (
                <BadgeCheck size={14} className="shrink-0 text-cyan" />
              ) : (
                <span className="font-display shrink-0 rounded-sm border border-volt/45 bg-volt/12 px-1.5 py-px text-[8.5px] font-bold uppercase tracking-[0.16em] text-[#c78bf0]">Citoyen</span>
              )}
            </span>
            <span className="block truncate text-[11px] text-fog/70">{video.creatorRole}</span>
          </span>
        </div>
        <div className="mt-2.5 flex items-center gap-2 border-t border-white/[0.06] pt-2.5 text-[11.5px] font-semibold text-fog">
          {video.live ? (
            <>
              <span className="flex items-center gap-1 text-coral">
                <Eye size={13} /> {video.viewers?.toLocaleString("fr-FR")} spectateurs
              </span>
              <span className="h-1 w-1 rounded-full bg-fog/40" />
              <span>{video.published}</span>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1">
                <Eye size={13} /> {formatViews(video.views)} vues
              </span>
              <span className="h-1 w-1 rounded-full bg-fog/40" />
              <span>{video.published}</span>
            </>
          )}
        </div>
      </div>
    </motion.article>
  );
}
