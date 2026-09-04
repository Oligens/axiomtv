/**
 * Axiom TV — Coquille de navigation : Sidebar (repliable), TopBar
 * (recherche, offres, Studio IA, cloche de notifications, profil),
 * BottomNav mobile.
 */
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  BadgeCheck, BarChart3, Bell, BellRing, ChevronLeft, Clapperboard, Crown, Film, Home,
  Inbox, LayoutList, LogOut, Megaphone, Podcast, Radio, Search, Settings, Sparkles, User, Wand2,
} from "lucide-react";
import { CATEGORIES, timeAgo, type CategoryId } from "../data/axiom";
import { useStore } from "../store/useStore";
import { apiEnabled } from "../store/useStore";
import { Logomark, Avatar } from "./brand";

/* ================= TopBar ================= */

export function TopBar() {
  const navigate = useNavigate();
  const user = useStore((s) => s.user);
  const openAuth = useStore((s) => s.openAuth);
  const logout = useStore((s) => s.logout);
  const notifications = useStore((s) => s.notifications);
  const markRead = useStore((s) => s.markRead);
  const markAllRead = useStore((s) => s.markAllRead);
  const loadNotifications = useStore((s) => s.loadNotifications);
  const toast = useStore((s) => s.toast);

  const [bellOpen, setBellOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, []);

  const notifIcon = (t: string) =>
    t === "live" ? <Radio size={13} className="text-coral" /> : t === "earning" ? <Sparkles size={13} className="text-gold" /> : t === "welcome" ? <BadgeCheck size={13} className="text-mint" /> : <Inbox size={13} className="text-cyan" />;

  return (
    <header className="glass-deep fixed inset-x-0 top-0 z-40 border-x-0 border-t-0">
      <div className="flex h-[64px] items-center gap-3 px-4 sm:gap-4 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2.5">
          <Logomark size={32} />
          <span className="hidden sm:block">
            <span className="font-display block text-[15px] font-bold leading-none tracking-[0.16em] text-frost">
              AXIOM<span className="text-glow text-cyan">TV</span>
            </span>
            <span className="mt-0.5 block text-[8.5px] font-semibold tracking-[0.14em] text-fog/70">L'information sans filtre</span>
          </span>
        </Link>

        {/* Recherche */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const q = new FormData(e.currentTarget).get("q");
            navigate(q ? `/search?q=${encodeURIComponent(String(q))}` : "/search");
          }}
          className="relative ml-1 hidden max-w-xl flex-1 md:block"
        >
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fog" />
          <input
            name="q"
            placeholder="Rechercher émissions, antennes, directs, podcasts…"
            className="field h-10 w-full rounded-full pl-10 pr-4 text-[13px] font-semibold text-frost"
          />
        </form>

        <div className="ml-auto flex items-center gap-2 sm:gap-2.5">
          {/* Recherche mobile */}
          <button onClick={() => navigate("/search")} aria-label="Recherche" className="btn-ghost grid h-10 w-10 place-items-center rounded-full text-fog md:hidden">
            <Search size={17} />
          </button>

          <button
            onClick={() => navigate("/pro")}
            className="gold-btn hidden h-10 items-center gap-1.5 rounded-full px-4 font-display text-[11px] font-bold uppercase tracking-[0.16em] lg:flex"
          >
            <Crown size={14} /> Pro
          </button>

          <button
            onClick={() => navigate(user ? "/studio/agwestream" : "/login")}
            className="btn-neon hidden h-10 items-center gap-2 rounded-full px-4 font-display text-[11px] font-bold uppercase tracking-[0.14em] sm:flex"
          >
            <Wand2 size={15} /> Studio IA
          </button>

          {user ? (
            <>
              {/* ---- Cloche ---- */}
              <div ref={bellRef} className="relative">
                <button
                  onClick={() => {
                    setBellOpen((v) => !v);
                    void loadNotifications();
                  }}
                  aria-label="Notifications"
                  className="btn-ghost relative grid h-10 w-10 place-items-center rounded-full text-fog"
                >
                  <Bell size={17} />
                  {unread > 0 && (
                    <span className="font-display absolute -right-0.5 -top-0.5 grid h-4.5 min-w-[18px] place-items-center rounded-full bg-coral px-1 text-[9.5px] font-bold text-white shadow-[0_0_10px_rgba(255,93,115,0.7)]" style={{ height: 18 }}>
                      {unread}
                    </span>
                  )}
                </button>

                {bellOpen && (
                  <div className="glass-deep absolute right-0 top-[calc(100%+10px)] w-[min(92vw,380px)] overflow-hidden rounded-xl shadow-[0_24px_70px_rgba(0,0,0,0.7)]" style={{ animation: "fadeIn 0.22s ease both" }}>
                    <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
                      <p className="font-display text-[11px] font-bold uppercase tracking-[0.2em] text-frost">Notifications</p>
                      {unread > 0 && (
                        <button onClick={markAllRead} className="text-[10.5px] font-bold uppercase tracking-wider text-cyan hover:underline">
                          Tout marquer lu
                        </button>
                      )}
                    </div>
                    <div className="max-h-[340px] overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="px-4 py-8 text-center text-[12px] font-semibold text-fog/70">Aucune notification pour le moment.</p>
                      ) : (
                        notifications.map((n) => (
                          <button
                            key={n.id}
                            onClick={() => markRead(n.id)}
                            className={`flex w-full items-start gap-3 border-b border-white/[0.05] px-4 py-3 text-left transition-colors hover:bg-white/[0.04] ${n.read ? "opacity-60" : ""}`}
                          >
                            <span className="mt-0.5 shrink-0">{notifIcon(n.type)}</span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2">
                                <span className="truncate text-[12.5px] font-bold text-frost">{n.title}</span>
                                {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan shadow-[0_0_8px_rgba(0,229,255,0.8)]" />}
                              </span>
                              <span className="mt-0.5 block text-[11.5px] leading-snug text-fog">{n.body}</span>
                              <span className="mt-1 block font-mono text-[9.5px] font-semibold text-fog/60">{timeAgo(n.createdAt)}</span>
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* ---- Profil ---- */}
              <div ref={menuRef} className="relative">
                <button onClick={() => setMenuOpen((v) => !v)} aria-label="Menu profil" className="transition-shadow hover:shadow-[0_0_18px_rgba(0,229,255,0.35)] rounded-full">
                  <Avatar name={user.displayName} size={38} />
                </button>
                {menuOpen && (
                  <div className="glass-deep absolute right-0 top-[calc(100%+10px)] w-60 overflow-hidden rounded-xl shadow-[0_24px_70px_rgba(0,0,0,0.7)]" style={{ animation: "fadeIn 0.22s ease both" }}>
                    <div className="border-b border-white/[0.07] px-4 py-3">
                      <p className="flex items-center gap-1.5 text-[13px] font-bold text-frost">
                        {user.displayName}
                        {user.verified && <BadgeCheck size={13} className="text-cyan" />}
                      </p>
                      <p className="truncate text-[11px] text-fog">@{user.username} · {apiEnabled() ? "session Neon" : "session locale"}</p>
                    </div>
                    {[
                      { icon: <User size={14} />, label: "Mon antenne", to: `/creator/${user.username}` },
                      { icon: <BarChart3 size={14} />, label: "Revenus & paiements", to: "/creator/earnings" },
                      { icon: <LayoutList size={14} />, label: "Mes publications", to: "/studio/publications" },
                      { icon: <Settings size={14} />, label: "Paramètres", to: "/settings" },
                    ].map((i) => (
                      <button
                        key={i.label}
                        onClick={() => {
                          setMenuOpen(false);
                          navigate(i.to);
                        }}
                        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[12.5px] font-semibold text-fog transition-colors hover:bg-white/[0.05] hover:text-frost"
                      >
                        <span className="text-cyan">{i.icon}</span> {i.label}
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        logout();
                        toast("Déconnexion réussie — à bientôt sur l'antenne", "ok");
                        navigate("/");
                      }}
                      className="flex w-full items-center gap-2.5 border-t border-white/[0.07] px-4 py-2.5 text-left text-[12.5px] font-semibold text-coral/85 transition-colors hover:bg-coral/10 hover:text-coral"
                    >
                      <LogOut size={14} /> Se déconnecter
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <button onClick={() => openAuth("login")} className="btn-ghost h-10 rounded-full px-4 font-display text-[11.5px] font-bold uppercase tracking-[0.14em] text-fog">
                Se connecter
              </button>
              <button onClick={() => openAuth("register")} className="btn-neon hidden h-10 items-center rounded-full px-4 font-display text-[11.5px] font-bold uppercase tracking-[0.14em] sm:flex">
                S'inscrire
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/* ================= Sidebar ================= */

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const location = useLocation();
  const [params] = useSearchParams();
  const user = useStore((s) => s.user);
  const navigate = useNavigate();
  const openAuth = useStore((s) => s.openAuth);

  const isHome = location.pathname === "/";
  const cat = (params.get("cat") as CategoryId) ?? "tous";

  const item = (active: boolean) =>
    `group relative flex w-full items-center gap-3 rounded-xl py-2.5 transition-all duration-300 ${collapsed ? "justify-center px-0" : "justify-center px-0 lg:justify-start lg:px-3.5"} ${
      active ? "bg-cyan/10 text-cyan shadow-[inset_0_0_18px_rgba(0,229,255,0.07)]" : "text-fog hover:bg-white/[0.05] hover:text-frost"
    }`;

  const label = `hidden truncate text-[13px] font-semibold tracking-wide ${collapsed ? "" : "lg:inline-block"}`;
  const Bar = () => <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-cyan shadow-[0_0_10px_rgba(0,229,255,0.8)]" />;

  const catIcon = (id: CategoryId) =>
    id === "directs" ? <Radio size={19} /> : id === "reportages" ? <Film size={19} /> : id === "conferences" ? <Megaphone size={19} /> : id === "podcasts" ? <Podcast size={19} /> : <Clapperboard size={19} />;

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-white/[0.07] bg-abyss/90 backdrop-blur-2xl transition-[width] duration-300 ease-out md:flex ${
        collapsed ? "md:w-[76px] lg:w-[76px]" : "md:w-[76px] lg:w-[248px]"
      }`}
    >
      {/* CTA Studio */}
      <div className="p-3 lg:p-4">
        <Link
          to={user ? "/studio/agwestream" : "/login"}
          title="AgwèStream — Studio IA"
          className={`btn-neon font-display flex w-full items-center gap-3 rounded-xl font-bold ${collapsed ? "justify-center px-0 py-3" : "px-4 py-3"}`}
        >
          <Wand2 size={19} strokeWidth={2.1} />
          <span className={`text-left leading-tight ${collapsed ? "hidden" : "hidden lg:block"}`}>
            <span className="block text-[14.5px] tracking-wide">AgwèStream</span>
            <span className="block text-[9.5px] font-semibold uppercase tracking-[0.2em] opacity-70">Studio de production IA</span>
          </span>
        </Link>
      </div>

      <nav className="side-scroll min-h-0 flex-1 overflow-y-auto px-3 pt-1">
        <p className={`font-display mb-2 hidden px-3.5 text-[10px] font-semibold uppercase tracking-[0.26em] text-fog/60 ${collapsed ? "" : "lg:block"}`}>Navigation</p>

        <Link to="/" className={item(isHome && cat === "tous")}>
          {isHome && cat === "tous" && <Bar />}
          <Home size={19} />
          <span className={label}>Accueil</span>
        </Link>

        {CATEGORIES.filter((c) => c.id !== "tous").map((c) => {
          const active = isHome && cat === c.id;
          return (
            <Link key={c.id} to={`/?cat=${c.id}`} title={c.label} className={item(active)}>
              {active && <Bar />}
              <span className="relative">
                {catIcon(c.id)}
                {c.id === "directs" && <span className="absolute -right-1 -top-0.5 h-1.5 w-1.5 rounded-full bg-coral shadow-[0_0_8px_rgba(255,93,115,0.9)] lg:hidden" />}
              </span>
              <span className={label}>{c.label}</span>
              {c.id === "directs" && (
                <span className={`rounded-full border border-coral/40 bg-coral/15 px-2 py-0.5 font-display text-[9.5px] font-bold text-coral ${collapsed ? "hidden" : "ml-auto hidden lg:inline"}`}>LIVE</span>
              )}
            </Link>
          );
        })}

        <p className={`font-display mb-2 mt-6 hidden px-3.5 text-[10px] font-semibold uppercase tracking-[0.26em] text-gold/70 ${collapsed ? "" : "lg:block"}`}>Monétisation</p>
        <Link to="/pro" title="Offres Pro & Gold" className={item(location.pathname === "/pro")}>
          {location.pathname === "/pro" && <Bar />}
          <Crown size={19} className="text-gold" />
          <span className={label}>Offres Pro & Gold</span>
        </Link>

        {user && (
          <>
            <p className={`font-display mb-2 mt-6 hidden px-3.5 text-[10px] font-semibold uppercase tracking-[0.26em] text-fog/60 ${collapsed ? "" : "lg:block"}`}>Espace créateur</p>
            {[
              { to: "/studio", label: "Mon Studio", icon: <Clapperboard size={19} /> },
              { to: "/studio/agwestream", label: "AgwèStream IA", icon: <Wand2 size={19} />, tag: true },
              { to: "/studio/publications", label: "Mes Publications", icon: <LayoutList size={19} /> },
              { to: "/creator/earnings", label: "Revenus", icon: <BarChart3 size={19} /> },
              { to: "/settings", label: "Paramètres", icon: <Settings size={19} /> },
            ].map((l) => {
              const active = location.pathname === l.to;
              return (
                <Link key={l.to} to={l.to} title={l.label} className={item(active)}>
                  {active && <Bar />}
                  <span className="relative">
                    {l.icon}
                    {l.tag && <Sparkles size={8} className="absolute -right-1.5 -top-1 text-volt" />}
                  </span>
                  <span className={label}>{l.label}</span>
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* Pied */}
      <div className="border-t border-white/[0.07] p-3">
        {user ? (
          <button onClick={() => navigate(`/creator/${user.username}`)} title="Mon antenne" className={`flex w-full items-center gap-3 rounded-xl p-2 transition-colors hover:bg-white/[0.05] ${collapsed ? "justify-center" : "lg:justify-start"}`}>
            <Avatar name={user.displayName} size={34} />
            <span className={`min-w-0 leading-tight ${collapsed ? "hidden" : "hidden lg:block"}`}>
              <span className="block truncate text-[12.5px] font-bold text-frost">{user.displayName}</span>
              <span className="block truncate text-[10.5px] text-fog">@{user.username}</span>
            </span>
          </button>
        ) : (
          <button onClick={() => openAuth("login")} className={`btn-ghost flex w-full items-center gap-2.5 rounded-xl p-2.5 text-fog ${collapsed ? "justify-center" : "lg:justify-start lg:px-3.5"}`}>
            <BellRing size={16} />
            <span className={`text-[12.5px] font-bold ${collapsed ? "hidden" : "hidden lg:block"}`}>Se connecter</span>
          </button>
        )}
        <button
          onClick={onToggle}
          title={collapsed ? "Déplier" : "Replier"}
          className={`mt-2 hidden w-full items-center gap-3 rounded-xl py-2 text-fog transition-colors hover:bg-white/[0.05] hover:text-cyan lg:flex ${collapsed ? "justify-center" : "justify-start px-3.5"}`}
        >
          <ChevronLeft size={17} className={`transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`} />
          <span className={`text-[12px] font-semibold tracking-wide ${collapsed ? "hidden" : ""}`}>Replier</span>
        </button>
      </div>
    </aside>
  );
}

/* ================= BottomNav mobile ================= */

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const user = useStore((s) => s.user);
  const openAuth = useStore((s) => s.openAuth);

  const isHome = location.pathname === "/";
  const cat = params.get("cat");

  const Btn = ({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick: () => void }) => (
    <button onClick={onClick} className={`relative flex flex-col items-center gap-1 py-2 transition-colors ${active ? "text-cyan" : "text-fog active:text-frost"}`}>
      {icon}
      <span className="font-display text-[8.5px] font-bold uppercase tracking-[0.12em]">{label}</span>
      {active && <span className="absolute -top-px h-0.5 w-8 rounded-full bg-cyan shadow-[0_0_8px_rgba(0,229,255,0.9)]" />}
    </button>
  );

  return (
    <nav className="glass-deep fixed inset-x-0 bottom-0 z-40 border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="grid grid-cols-5 items-end px-2 pt-1">
        <Btn icon={<Home size={20} />} label="Accueil" active={isHome && !cat} onClick={() => navigate("/")} />
        <Btn icon={<Radio size={20} />} label="Directs" active={isHome && cat === "directs"} onClick={() => navigate("/?cat=directs")} />
        <div className="relative flex justify-center">
          <button
            onClick={() => (user ? navigate("/studio/agwestream") : openAuth("login"))}
            aria-label="Studio AgwèStream"
            className="btn-neon absolute -top-7 grid h-14 w-14 place-items-center rounded-full border-4 border-ink"
          >
            <Wand2 size={22} strokeWidth={2.2} />
          </button>
          <span className="font-display pointer-events-none pb-2 pt-8 text-[8.5px] font-bold uppercase tracking-[0.12em] text-fog">Studio</span>
        </div>
        <Btn icon={<Search size={20} />} label="Recherche" active={location.pathname === "/search"} onClick={() => navigate("/search")} />
        <Btn
          icon={<User size={20} />}
          label="Profil"
          active={location.pathname.startsWith("/creator/")}
          onClick={() => (user ? navigate(`/creator/${user.username}`) : openAuth("login"))}
        />
      </div>
    </nav>
  );
}
