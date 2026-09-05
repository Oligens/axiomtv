/**
 * Pages secondaires : Recherche, Login, Paramètres, Publications, 404.
 */
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { Clapperboard, Film, Inbox, LogOut, Radio, Search as SearchIcon, Settings as SettingsIcon, Trash2 } from "lucide-react";
import CinemaIntro, { IntroMetadataForm } from "../components/CinemaIntro";
import { useStore, apiEnabled } from "../store/useStore";
import { CATEGORIES, VIDEOS, formatViews } from "../data/axiom";
import VideoCard from "../components/VideoCard";
import { Switch } from "../components/ui";
import { Avatar } from "../components/brand";

function PageHead({ kicker, title, text, right }: { kicker: string; title: React.ReactNode; text?: string; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
      <div className="max-w-2xl">
        <p className="eyebrow text-cyan">{kicker}</p>
        <h1 className="font-display mt-2 text-[30px] font-bold leading-[1.05] tracking-tight text-white sm:text-[42px]">{title}</h1>
        {text && <p className="mt-3 text-[13.5px] leading-relaxed text-fog">{text}</p>}
      </div>
      {right}
    </div>
  );
}

/* ================= Recherche ================= */
export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const [local, setLocal] = useState(q);
  const navigate = useNavigate();
  const toast = useStore((s) => s.toast);

  useEffect(() => setLocal(q), [q]);

  const results = VIDEOS.filter((v) => !q || v.title.toLowerCase().includes(q.toLowerCase()) || v.creator.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="mx-auto max-w-[1100px] pb-16">
      <PageHead kicker="Recherche" title="Explorer le réseau" text="Émissions, antennes de journalistes, directs et podcasts publiés par la communauté." />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setParams(local ? { q: local } : {});
        }}
        className="glass mt-6 flex items-center gap-3 rounded-2xl p-2 pl-5"
      >
        <SearchIcon size={19} className="shrink-0 text-cyan" />
        <input
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          placeholder="Rechercher sur AxiomTV…"
          className="h-11 w-full bg-transparent text-[14.5px] font-semibold text-frost outline-none placeholder:text-fog/60"
          autoFocus
        />
        <button type="submit" className="btn-neon shrink-0 rounded-xl px-5 py-2.5 font-display text-[12px] font-bold uppercase tracking-[0.14em]">
          Lancer
        </button>
      </form>

      {q ? (
        <>
          <p className="mt-6 text-[13px] font-semibold text-fog">
            {results.length} résultat(s) pour <b className="text-cyan">« {q} »</b>
          </p>
          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((v, i) => (
              <VideoCard key={v.id} video={v} index={i} onOpen={(vv) => toast(`Lecture de « ${vv.title} »`, "info")} />
            ))}
          </div>
          {results.length === 0 && (
            <div className="glass mt-6 rounded-2xl px-6 py-14 text-center">
              <SearchIcon size={26} className="mx-auto text-fog/50" />
              <p className="mt-3 text-[14px] font-bold text-frost">Aucun résultat pour « {q} »</p>
              <p className="mt-1 text-[12.5px] text-fog">Essayez un autre mot-clé ou parcourez les catégories du hub.</p>
              <button onClick={() => navigate("/")} className="btn-ghost mt-5 rounded-full px-5 py-2.5 font-display text-[11.5px] font-bold uppercase tracking-[0.14em] text-fog">
                Retour au hub
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="glass mt-8 rounded-2xl px-6 py-14 text-center">
          <SearchIcon size={26} className="mx-auto text-fog/50" />
          <p className="mt-3 text-[14px] font-bold text-frost">Lancez une recherche</p>
          <p className="mt-1 text-[12.5px] text-fog">Tapez un mot-clé pour interroger les émissions, les antennes, les directs et les podcasts.</p>
        </div>
      )}
    </div>
  );
}

/* ================= Login ================= */
export function LoginPage() {
  const user = useStore((s) => s.user);
  const openAuth = useStore((s) => s.openAuth);
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const from = location.state?.from ?? "/";

  useEffect(() => {
    if (user) navigate(from, { replace: true });
  }, [user, from, navigate]);

  useEffect(() => {
    openAuth("login");
  }, [openAuth]);

  return (
    <div className="mx-auto max-w-[640px] pb-16">
      <PageHead kicker="Accès" title="Prendre l'antenne" text={apiEnabled() ? "Connectez-vous pour publier, suivre vos directs et monétiser vos créations." : "Le serveur API n'est pas joint — la session sera établie localement, puis synchronisée dès que Neon sera reachable."} />
      <p className="mt-6 text-[13px] text-fog">La fenêtre de connexion s'ouvre automatiquement…</p>
    </div>
  );
}

/* ================= Paramètres ================= */
export function SettingsPage() {
  const user = useStore((s) => s.user);
  const logout = useStore((s) => s.logout);
  const toast = useStore((s) => s.toast);
  const navigate = useNavigate();

  const [prefs, setPrefs] = useState({ notifEpg: true, notifLive: true, notifMentions: false });\n  const [displayName, setDisplayName] = useState(user?.displayName ?? "");\n  const [charter, setCharter] = useState(user?.charter ?? "");\n  const [savingProfile, setSavingProfile] = useState(false);\n\n  useEffect(() => {\n    setDisplayName(user?.displayName ?? "");\n    setCharter(user?.charter ?? "");\n  }, [user?.displayName, user?.charter]);\n\n  const saveAccountProfile = async () => {\n    if (!user) return;\n    if (!displayName.trim()) { toast("Le nom d’affichage est obligatoire", "warn"); return; }\n    setSavingProfile(true);\n    const error = await updateProfile({ displayName: displayName.trim(), charter: charter.trim() });\n    setSavingProfile(false);\n    if (error) { toast(error, "warn"); return; }\n    toast("Paramètres du profil enregistrés", "ok");\n  };

  const rows: { key: keyof typeof prefs; title: string; text: string }[] = [
    { key: "notifEpg", title: "Rappels EPG", text: "Notification push 5 minutes avant chaque direct programmé." },
    { key: "notifLive", title: "Alertes de direct", text: "Être notifié quand une antenne suivie passe en direct." },
    { key: "notifMentions", title: "Mentions", text: "Être notifié lorsque la communauté vous cite." },
  ];

  return (
    <div className="mx-auto max-w-[820px] pb-16">
      <PageHead kicker="Compte" title={<>Paramètres <span className="text-fog">— @{user?.username}</span></>} text="Notifications, session et préférences du compte." />

      <section className="glass mt-8 rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow text-cyan">Identité de l’antenne</p>
            <h2 className="mt-1 font-display text-[15px] font-bold text-frost">Profil public</h2>
            <p className="mt-1 text-[11.5px] text-fog">Ces informations sont visibles sur votre antenne. Seul le propriétaire connecté peut les modifier.</p>
          </div>
          {user && <button onClick={() => navigate(`/creator/${user.username}`)} className="btn-ghost rounded-full px-4 py-2 font-display text-[10.5px] font-bold uppercase tracking-[0.12em] text-cyan">Ouvrir mon antenne</button>}
        </div>
        <div className="mt-5 grid gap-4">
          <label className="block"><span className="eyebrow text-fog">Nom d’affichage</span><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={60} className="field mt-2 w-full rounded-xl px-4 py-3 text-[12px] text-frost" /></label>
          <label className="block"><span className="eyebrow text-fog">Charte de l’antenne</span><textarea value={charter} onChange={(e) => setCharter(e.target.value)} rows={6} maxLength={1000} placeholder="Définissez les engagements éditoriaux de votre antenne…" className="field mt-2 w-full resize-none rounded-xl px-4 py-3 text-[12px] leading-relaxed text-frost" /></label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] text-fog">Photo, bannière, modèles AxiomTV et glisser-déposer : utilisez « Ouvrir mon antenne ».</p>
            <button disabled={savingProfile} onClick={() => void saveAccountProfile()} className="btn-neon rounded-full px-5 py-2.5 font-display text-[11px] font-bold uppercase disabled:opacity-50">{savingProfile ? "Enregistrement…" : "Enregistrer"}</button>
          </div>
        </div>
      </section>

      <section className="glass mt-8 rounded-2xl p-6">
        <h2 className="font-display text-[15px] font-bold text-frost">Notifications</h2>
        {rows.map((r) => (
          <div key={r.key} className="flex items-center justify-between gap-4 border-b border-white/[0.06] py-4 last:border-0">
            <div>
              <p className="text-[13.5px] font-bold text-frost">{r.title}</p>
              <p className="mt-0.5 text-[11.5px] text-fog">{r.text}</p>
            </div>
            <Switch on={prefs[r.key]} onChange={() => setPrefs((p) => ({ ...p, [r.key]: !p[r.key] }))} label={r.title} />
          </div>
        ))}
      </section>

      <section className="glass mt-5 rounded-2xl p-6">
        <h2 className="font-display text-[15px] font-bold text-frost">Session</h2>
        <div className="mt-3 flex items-center gap-3">
          <Avatar name={user?.displayName ?? "?"} size={44} />
          <div>
            <p className="text-[13px] font-bold text-frost">{user?.email}</p>
            <p className="text-[11.5px] text-fog">
              offre <b className="text-cyan">{user?.tier}</b> · {apiEnabled() ? "API Neon jointe (JWT actif)" : "mode local — synchronisation Neon en attente"}
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            logout();
            toast("Déconnexion réussie", "ok");
            navigate("/");
          }}
          className="mt-4 flex items-center gap-2 rounded-xl border border-white/20 bg-white/[0.05] px-5 py-2.5 font-display text-[11.5px] font-bold uppercase tracking-[0.14em] text-frost transition-all hover:border-cyan/50 hover:text-cyan"
        >
          <LogOut size={15} /> Se déconnecter
        </button>
      </section>
    </div>
  );
}

/* ================= Publications ================= */
export function PublicationsPage() {
  const publications = useStore((s) => s.publications);
  const deletePublication = useStore((s) => s.deletePublication);
  const introMeta = useStore((s) => s.introMeta);
  const setIntroMeta = useStore((s) => s.setIntroMeta);
  const toast = useStore((s) => s.toast);
  const navigate = useNavigate();
  const [introOpen, setIntroOpen] = useState(false);
  const [introPub, setIntroPub] = useState<string | null>(null);

  const pub = publications.find((p) => p.id === introPub);

  return (
    <div className="mx-auto max-w-[1100px] pb-16">
      <PageHead
        kicker="Studio · Contenus"
        title={<>Mes Publications <span className="text-fog">({publications.length})</span></>}
        text="Statut, tarif Pay-Per-View, vues et revenus de chaque contenu publié sur votre antenne."
        right={
          <button onClick={() => navigate("/studio/agwestream")} className="btn-neon flex items-center gap-2 rounded-full px-6 py-3 font-display text-[13px] font-bold tracking-wide">
            <Film size={16} /> Créer avec AgwèStream
          </button>
        }
      />

      <div className="mt-8">
        {publications.length === 0 ? (
          <div className="glass rounded-2xl px-6 py-14 text-center">
            <Inbox size={26} className="mx-auto text-fog/50" />
            <p className="mt-3 text-[14px] font-bold text-frost">Aucune publication pour le moment</p>
            <p className="mt-1 text-[12.5px] text-fog">Générez votre première scène dans le studio AgwèStream : elle apparaîtra ici avec ses statistiques.</p>
            <button onClick={() => navigate("/studio/agwestream")} className="btn-neon mt-5 rounded-full px-6 py-3 font-display text-[13px] font-bold tracking-wide">
              Ouvrir le studio
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {publications.map((p) => (
              <div key={p.id} className="glass-card flex flex-wrap items-center gap-4 rounded-xl p-4">
                <span className={`grid h-11 w-11 place-items-center rounded-xl border ${p.kind === "ppv" ? "border-gold/45 bg-gold/10 text-gold" : "border-cyan/40 bg-cyan/10 text-cyan"}`}>
                  <Film size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-bold text-frost">{p.title}</p>
                  <p className="text-[11.5px] text-fog">
                    {p.category} · {p.kind === "ppv" ? `PPV ${p.price.toFixed(2)} $` : "Gratuit"} · {formatViews(p.views)} vues · {p.revenue.toFixed(2)} $
                  </p>
                </div>
                <span className={`font-display rounded-full border px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-[0.14em] ${p.status === "online" ? "border-mint/45 bg-mint/10 text-mint" : "border-gold/40 bg-gold/10 text-gold"}`}>
                  {p.status === "online" ? "En ligne" : "Vérification"}
                </span>
                {p.intro && (
                  <button
                    onClick={() => {
                      setIntroPub(p.id);
                      setIntroOpen(true);
                    }}
                    className="font-display flex items-center gap-1.5 rounded-full border border-volt/45 bg-volt/10 px-3 py-1.5 text-[9.5px] font-bold uppercase tracking-[0.14em] text-[#c78bf0] transition-all hover:bg-volt/18 hover:shadow-[0_0_14px_rgba(157,78,221,0.3)]"
                  >
                    <Clapperboard size={12} /> Intro
                  </button>
                )}
                <button
                  onClick={() => {
                    deletePublication(p.id);
                    toast(`« ${p.title} » supprimée`, "warn");
                  }}
                  className="font-display rounded-full border border-white/12 px-3 py-1.5 text-[9.5px] font-bold uppercase tracking-[0.14em] text-fog transition-colors hover:border-coral/50 hover:text-coral"
                >
                  <Trash2 size={11} className="mr-1 inline" /> Supprimer
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* formulaire intro */}
      <section className="glass mt-10 rounded-2xl p-6">
        <h2 className="font-display text-[15px] font-bold text-frost">Intro cinématique (crédits par défaut)</h2>
        <p className="mt-1 text-[12px] text-fog">Renseignez le titre, les collaborateurs et la distribution — l'intro est pré-collée au début de chaque film exporté.</p>
        <div className="mt-4 max-w-[520px]">
          <IntroMetadataForm meta={introMeta} onChange={setIntroMeta} onPreview={() => setIntroOpen(true)} />
        </div>
      </section>

      {introOpen && pub?.intro && <CinemaIntro meta={pub.intro} onClose={() => setIntroOpen(false)} onFinished={() => setIntroOpen(false)} />}
      {introOpen && !pub && <CinemaIntro meta={introMeta} onClose={() => setIntroOpen(false)} onFinished={() => setIntroOpen(false)} />}
    </div>
  );
}

/* ================= 404 ================= */
export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-[700px] pb-16">
      <PageHead kicker="404" title="Signal perdu" text="Cette fréquence n'émet pas. Vérifiez l'adresse ou revenez au hub." />
      <div className="glass mt-8 rounded-2xl px-6 py-14 text-center">
        <Radio size={26} className="mx-auto text-fog/50" />
        <p className="mt-3 text-[14px] font-bold text-frost">Antenne introuvable</p>
        <p className="mt-1 text-[12.5px] text-fog">La page demandée n'existe pas sur le réseau AxiomTV.</p>
        <button onClick={() => navigate("/")} className="btn-neon mt-5 rounded-full px-6 py-3 font-display text-[13px] font-bold tracking-wide">
          Retour au hub
        </button>
      </div>
    </div>
  );
}
