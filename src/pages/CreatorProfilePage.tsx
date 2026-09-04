/**
 * Antenne publique du créateur — /creator/:handle
 * Bannière, bio, charte, liens sociaux (« + Ajouter un lien »), vidéos,
 * abonnement et dons (réservés aux abonnés Pro/Gold).
 */
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BadgeCheck, Crown, Eye, Film, Gift, Globe, Instagram, Linkedin, Link as LinkIcon,
  Mail, MessageSquare, Plus, Rss, Send, Share2, Trash2, Youtube,
} from "lucide-react";
import { TIER_LABEL, type Tier, type Video } from "../data/axiom";
import { useStore } from "../store/useStore";
import VideoCard from "../components/VideoCard";

const PLATFORMS: { id: string; label: string; icon: React.ReactNode; placeholder: string }[] = [
  { id: "website", label: "Site web", icon: <Globe size={13} />, placeholder: "https://votre-media.org" },
  { id: "x", label: "X / Twitter", icon: <MessageSquare size={13} />, placeholder: "https://x.com/votre_compte" },
  { id: "youtube", label: "YouTube", icon: <Youtube size={13} />, placeholder: "https://youtube.com/@chaine" },
  { id: "instagram", label: "Instagram", icon: <Instagram size={13} />, placeholder: "https://instagram.com/compte" },
  { id: "linkedin", label: "LinkedIn", icon: <Linkedin size={13} />, placeholder: "https://linkedin.com/in/profil" },
  { id: "telegram", label: "Telegram", icon: <Send size={13} />, placeholder: "https://t.me/canal" },
  { id: "rss", label: "RSS", icon: <Rss size={13} />, placeholder: "https://flux.example/rss" },
  { id: "mail", label: "Email", icon: <Mail size={13} />, placeholder: "mailto:contact@media.org" },
];

interface SocialLink {
  id: number;
  platform: string;
  url: string;
}

const canGift = (t: Tier | undefined) => t === "pro" || t === "gold";

export default function CreatorProfilePage() {
  const { handle } = useParams();
  const navigate = useNavigate();
  const user = useStore((s) => s.user);
  const openAuth = useStore((s) => s.openAuth);
  const toast = useStore((s) => s.toast);
  const publications = useStore((s) => s.publications);

  const creator = undefined;
  const isOwner = !!user && user.username === handle;

  const [links, setLinks] = useState<SocialLink[]>([]);
  const [adding, setAdding] = useState(false);
  const [newPlatform, setNewPlatform] = useState("website");
  const [newUrl, setNewUrl] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editBio, setEditBio] = useState(user?.bio ?? "");
  const [editAvatar, setEditAvatar] = useState(user?.avatarUrl ?? "");
  const [editBanner, setEditBanner] = useState(user?.bannerUrl ?? "");

  const videos: Video[] = useMemo(() => isOwner ? publications.map((p) => ({ id: p.id, title: p.title, creator: user?.displayName ?? "", creatorRole: "Créateur", verified: user?.verified ?? false, category: "courts", duration: "—", views: p.views, published: new Date(p.createdAt).toISOString(), art: { g: "from-[#0d2233] via-[#0a1424] to-[#0d1117]", motif: "scan", glow: "rgba(0,229,255,0.20)" }, description: "" })) : [], [isOwner, publications, user]);

  if (!creator && !isOwner) {
    return (
      <div className="mx-auto max-w-[700px] pb-16">
        <div className="glass rounded-2xl px-6 py-14 text-center">
          <Film size={26} className="mx-auto text-fog/50" />
          <p className="mt-3 text-[14px] font-bold text-frost">Antenne « @{handle} » introuvable</p>
          <p className="mt-1 text-[12.5px] text-fog">Cette antenne n'est pas enregistrée sur le réseau, ou l'API des profils n'est pas branchée.</p>
          <button onClick={() => navigate("/")} className="btn-ghost mt-5 rounded-full px-5 py-2.5 font-display text-[11.5px] font-bold uppercase tracking-[0.14em] text-fog">
            Retour au hub
          </button>
        </div>
      </div>
    );
  }

  const name = creator?.name ?? user?.displayName ?? "Créateur";
  const role = creator?.role ?? "Citoyen journaliste";
  const bio = creator?.bio ?? user?.bio ?? "";
  const verified = creator?.verified ?? false;
  const followers = 0;
  const hue = creator?.hue ?? "#00e5ff";
  const hueTo = creator?.hueTo ?? "#9d4edd";
  const tier: Tier = creator?.id ? (creator.verified ? "pro" : "free") : (user?.tier ?? "free");
  const avatarUrl = creator?.id ? undefined : user?.avatarUrl;
  const bannerUrl = creator?.id ? undefined : user?.bannerUrl;

  const saveProfile = () => {
    if (!isOwner || !user) return;
    useStore.getState().updateLocalUser({ bio: editBio.trim(), avatarUrl: editAvatar.trim() || undefined, bannerUrl: editBanner.trim() || undefined });
    setEditOpen(false);
    toast("Profil mis à jour", "ok");
  };

  const addLink = () => {
    if (!newUrl.trim()) return;
    setLinks((l) => [...l, { id: Date.now(), platform: newPlatform, url: newUrl.trim() }]);
    setNewUrl("");
    setAdding(false);
    toast("Lien ajouté à l'antenne", "ok");
  };

  const subscribe = () => {
    if (!user) {
      openAuth("register");
      return;
    }
    setSubscribed((s) => !s);
    toast(subscribed ? "Abonnement annulé" : `Vous suivez l'antenne de ${name}`, "ok");
  };

  const sendGift = (amount: number) => {
    setGiftOpen(false);
    toast(`Cadeau de ${amount.toFixed(2)} $ envoyé à ${name} — merci pour le soutien !`, "ok");
  };

  return (
    <div className="mx-auto max-w-[1100px] pb-16">
      {/* ================= bannière ================= */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="scanlines relative mt-4 h-52 overflow-hidden rounded-[22px] border border-white/[0.08] md:mt-6 md:h-64"
      >
        <div className={`absolute inset-0 bg-gradient-to-br`} style={{ background: `linear-gradient(120deg, ${hue}33, transparent 45%), linear-gradient(240deg, ${hueTo}3d, transparent 50%), linear-gradient(160deg, #10151d, #0a0e14)` }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize: "34px 34px" }} />
        <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 25% 35%, ${hue}40, transparent 55%)` }} />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-ink to-transparent" />
        <span className="font-display absolute right-4 top-4 flex items-center gap-1.5 rounded-full border border-white/15 bg-abyss/70 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-frost backdrop-blur-sm">
          <BadgeCheck size={12} className="text-cyan" /> Antenne indépendante
        </span>
      </motion.div>

      {/* ================= identité ================= */}
      <div className="relative -mt-14 px-5 sm:px-8">
        <div className="flex flex-wrap items-end gap-5">
          <span
            className="font-display grid h-28 w-28 shrink-0 place-items-center rounded-2xl border-4 border-ink text-[34px] font-bold text-white shadow-[0_0_34px_rgba(0,0,0,0.6)]"
            style={{ background: `linear-gradient(135deg, ${hue}55, ${hueTo}66)`, textShadow: `0 0 18px ${hue}` }}
          >
            {avatarUrl ? <img src={avatarUrl} alt={name} className="h-full w-full rounded-[10px] object-cover" /> : name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
          </span>
          <div className="min-w-0 flex-1 pb-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-display text-[26px] font-bold tracking-tight text-white sm:text-[32px]">{name}</h1>
              {verified && <BadgeCheck size={20} className="text-cyan" />}
              <span className={`font-display rounded-full px-3 py-1 text-[9.5px] font-bold uppercase tracking-[0.16em] ${tier === "gold" ? "gold-ring text-gold" : tier === "pro" ? "border border-cyan/55 bg-cyan/12 text-cyan" : "border border-white/20 text-fog"}`}>
                {TIER_LABEL[tier]}
              </span>
            </div>
            <p className="mt-1 text-[12.5px] font-semibold text-fog">
              @{handle} · {role} · <span className="text-cyan">{followers} abonnés</span> · {videos.length} publications
            </p>
          </div>

          {/* actions : propriétaire = édition, visiteur = abonnement/don */}
          <div className="flex items-center gap-2.5 pb-1">
            {isOwner ? (
              <button onClick={() => { setEditBio(bio); setEditAvatar(avatarUrl ?? ""); setEditBanner(bannerUrl ?? ""); setEditOpen(true); }} className="btn-neon rounded-full px-5 py-2.5 font-display text-[12px] font-bold uppercase tracking-[0.14em]">Modifier le profil</button>
            ) : (
              <>
                <button onClick={subscribe} className={`flex items-center gap-2 rounded-full px-5 py-2.5 font-display text-[12px] font-bold uppercase tracking-[0.14em] transition-all ${subscribed ? "border border-mint/50 bg-mint/12 text-mint" : "btn-neon"}`}>{subscribed ? "Abonné ✓" : "S’abonner"}</button>
                <div className="relative">
                  <button onClick={() => { if (!user) return openAuth("register"); if (!canGift(user.tier)) { toast("L’envoi de cadeaux est réservé aux abonnés Axiom Pro & Gold", "warn"); navigate("/pro"); return; } setGiftOpen((v) => !v); }} className="gold-btn flex items-center gap-2 rounded-full px-5 py-2.5 font-display text-[12px] font-bold uppercase tracking-[0.14em]"><Gift size={14} /> Faire un don</button>
                  {giftOpen && canGift(user?.tier) && <div className="glass-deep absolute right-0 top-[calc(100%+8px)] z-30 w-48 overflow-hidden rounded-xl">{[2,5,10,25].map((a) => <button key={a} onClick={() => sendGift(a)} className="flex w-full items-center justify-between px-4 py-2.5 text-left text-[12.5px] font-bold text-frost"><span><Gift size={13} className="mr-2 inline text-gold" />Soutien</span><span className="font-mono text-gold">{a.toFixed(2)} $</span></button>)}</div>}
                </div>
              </>
            )}
            <button onClick={() => toast("Lien de l’antenne copié — partagez librement", "info")} aria-label="Partager" className="btn-ghost grid h-10 w-10 place-items-center rounded-full text-fog"><Share2 size={16} /></button>
          </div>
        </div>

        {/* bio */}
        <p className="mt-5 max-w-2xl text-[13.5px] leading-relaxed text-fog">{bio || "Cette antenne n'a pas encore rédigé sa biographie."}</p>

        {/* liens sociaux */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {links.map((l) => {
            const p = PLATFORMS.find((x) => x.id === l.platform) ?? PLATFORMS[0];
            return (
              <a
                key={l.id}
                href={l.url}
                target="_blank"
                rel="noreferrer"
                className="chip group flex items-center gap-2 rounded-full px-3.5 py-2 text-[11.5px] font-bold text-fog"
              >
                <span className="text-cyan">{p.icon}</span>
                {p.label}
                {isOwner && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.preventDefault();
                      setLinks((ls) => ls.filter((x) => x.id !== l.id));
                      toast("Lien retiré", "warn");
                    }}
                    onKeyDown={(e) => e.key === "Enter" && setLinks((ls) => ls.filter((x) => x.id !== l.id))}
                    className="ml-1 text-fog/50 hover:text-coral"
                  >
                    <Trash2 size={11} />
                  </span>
                )}
              </a>
            );
          })}

          {isOwner &&
            (adding ? (
              <span className="flex flex-wrap items-center gap-2">
                <select value={newPlatform} onChange={(e) => setNewPlatform(e.target.value)} className="field h-9 rounded-full px-3 text-[11.5px] font-bold text-frost">
                  {PLATFORMS.map((p) => (
                    <option key={p.id} value={p.id} className="bg-panel">
                      {p.label}
                    </option>
                  ))}
                </select>
                <input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder={PLATFORMS.find((p) => p.id === newPlatform)?.placeholder} className="field h-9 w-56 rounded-full px-3 text-[11.5px] font-semibold text-frost" />
                <button onClick={addLink} className="btn-neon h-9 rounded-full px-4 font-display text-[10.5px] font-bold uppercase tracking-[0.12em]">
                  Ajouter
                </button>
                <button onClick={() => setAdding(false)} className="btn-ghost h-9 rounded-full px-3 font-display text-[10.5px] font-bold uppercase tracking-[0.12em] text-fog">
                  Annuler
                </button>
              </span>
            ) : (
              <button onClick={() => setAdding(true)} className="chip flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[11.5px] font-bold text-cyan">
                <Plus size={13} /> Ajouter un lien
              </button>
            ))}
        </div>
      </div>

      {/* ================= charte ================= */}
      <section className="mt-10 px-5 sm:px-8">
        <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <div className="glass rounded-2xl p-6">
            <p className="eyebrow text-cyan">Charte de l'antenne</p>
            <p className="mt-3 text-[12.5px] leading-relaxed text-fog">
              « Cette antenne s'engage à publier sans censure, à citer ses sources, à corriger ses erreurs en toute visibilité et à refuser tout financement qui conditionnerait l'information. Les revenus proviennent uniquement de la communauté : abonnements, dons et contenus à l'unité. »
            </p>
            <p className="font-display mt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-fog/70">Signée par @{handle} · vérifiée par le collège communautaire</p>
          </div>
          <div className="glass rounded-2xl p-6">
            <p className="eyebrow text-fog">Informations</p>
            <dl className="mt-3 space-y-2.5 text-[12.5px] font-semibold">
              <div className="flex justify-between gap-4"><dt className="text-fog">Niveau</dt><dd className="text-frost">{TIER_LABEL[tier]}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-fog">Abonnement</dt><dd className="text-frost">{tier === "free" ? "Gratuit" : "4,99 $ / mois"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-fog">Identifiant</dt><dd className="text-cyan">@{handle}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-fog">Liens publics</dt><dd className="text-frost">{links.length}</dd></div>
            </dl>
          </div>
        </div>
      </section>

      {/* ================= vidéos ================= */}
      <section className="mt-10 px-5 sm:px-8">
        <div className="flex items-center gap-3">
          <Film size={19} className="text-cyan" />
          <h2 className="font-display text-xl font-bold tracking-tight text-white sm:text-2xl">Publications de l'antenne</h2>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((v, i) => (
            <VideoCard key={v.id} video={v} index={i} onOpen={(vv) => toast(`Lecture de « ${vv.title} »`, "info")} />
          ))}
        </div>
        {videos.length === 0 && (
          <div className="glass mt-4 rounded-2xl px-6 py-12 text-center">
            <Film size={24} className="mx-auto text-fog/50" />
            <p className="mt-3 text-[13.5px] font-bold text-frost">Aucune publication pour le moment</p>
            <p className="mt-1 text-[12px] text-fog">Cette antenne n'a pas encore publié de contenu.</p>
          </div>
        )}
      </section>

      {isOwner && editOpen && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="edit-profile-title">
          <div className="glass-deep w-full max-w-xl rounded-2xl border border-white/10 p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-4"><div><p className="eyebrow text-cyan">Mon antenne</p><h2 id="edit-profile-title" className="mt-1 font-display text-xl font-bold text-white">Modifier le profil</h2></div><button onClick={() => setEditOpen(false)} className="btn-ghost rounded-full px-3 py-2 text-fog">Fermer</button></div>
            <div className="mt-6 space-y-4">
              <label className="block"><span className="eyebrow text-fog">Photo de profil — URL</span><input value={editAvatar} onChange={(e) => setEditAvatar(e.target.value)} placeholder="https://..." className="field mt-2 w-full rounded-xl px-4 py-3 text-[12px] text-frost" /></label>
              <label className="block"><span className="eyebrow text-fog">Bannière — URL</span><input value={editBanner} onChange={(e) => setEditBanner(e.target.value)} placeholder="https://..." className="field mt-2 w-full rounded-xl px-4 py-3 text-[12px] text-frost" /></label>
              <label className="block"><span className="eyebrow text-fog">Biographie</span><textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} rows={5} placeholder="Cette antenne n’a pas encore rédigé sa biographie." className="field mt-2 w-full resize-none rounded-xl px-4 py-3 text-[12px] leading-relaxed text-frost" /></label>
            </div>
            <div className="mt-6 flex justify-end gap-2"><button onClick={() => setEditOpen(false)} className="btn-ghost rounded-full px-5 py-2.5 text-[11px] font-bold uppercase text-fog">Annuler</button><button onClick={saveProfile} className="btn-neon rounded-full px-5 py-2.5 text-[11px] font-bold uppercase">Enregistrer</button></div>
          </div>
        </div>
      )}

      <span className="hidden"><Eye size={10} /><Crown size={10} /><LinkIcon size={10} /></span>
    </div>
  );
}
