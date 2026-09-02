/**
 * Tarification Axiom TV — Free / Pro / Gold + pack Agwe Stream (0,50 $),
 * bascule Mensuel / Annuel (−18 %).
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, ChevronDown, Clock, Crown, Film, MonitorPlay, Wand2, Zap } from "lucide-react";
import { AGWE_PACK, ANNUAL_RATE, PLANS, type Tier } from "../data/axiom";
import { useStore } from "../store/useStore";

const fmt = (n: number) => n.toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const FAQ = [
  { q: "Comment fonctionne le quota Agwe Stream ?", a: "Le forfait Agwe Stream est un paiement unique de 0,50 $ qui vous donne droit à 15 vidéos générées par IA, à raison d'une par jour. Le plan n'est pas limité dans le temps : même si vous sautez plusieurs jours, votre quota reste intact jusqu'à ce que les 15 vidéos soient entièrement consommées." },
  { q: "Puis-je changer de forfait à tout moment ?", a: "Oui. Vous pouvez passer du Studio Citoyen à Axiom Pro ou Gold (et inversement) quand vous le souhaitez. Le changement de niveau est appliqué immédiatement sur votre antenne et vos crédits de rendu." },
  { q: "Que se passe-t-il avec la facturation annuelle ?", a: "En choisissant la facturation annuelle, un rabais de 18 % est appliqué sur le tarif mensuel des forfaits Pro et Gold. Le montant total est facturé une seule fois pour l'année — vous économisez l'équivalent de plus de deux mois." },
  { q: "Quels moyens de paiement acceptez-vous ?", a: "Carte bancaire, virement SEPA, PayPal, MonCash et NatCash. Tous les paiements sont sécurisés et les revenus des créateurs sont reversés sans intermédiaire bancaire opaque." },
];

export default function ProPage() {
  const navigate = useNavigate();
  const user = useStore((s) => s.user);
  const setTier = useStore((s) => s.setTier);
  const agwePack = useStore((s) => s.agwePack);
  const activateAgwePack = useStore((s) => s.activateAgwePack);
  const openAuth = useStore((s) => s.openAuth);
  const toast = useStore((s) => s.toast);

  const [billing, setBilling] = useState<"mensuel" | "annuel">("mensuel");
  const [faqOpen, setFaqOpen] = useState<number | null>(0);

  const choose = (id: Tier) => {
    if (!user) {
      openAuth("register");
      toast("Créez un compte pour activer votre forfait", "info");
      return;
    }
    setTier(id);
    toast(id === "pro" ? "Axiom Pro activé — vidéos 30 min, 1080p & 4K débloqués" : id === "gold" ? "Axiom Gold activé — capacité industrielle en ligne" : "Studio Citoyen actif — bienvenue sur le réseau", "ok");
    navigate("/studio");
  };

  const activateAgwe = () => {
    if (!user) {
      openAuth("register");
      toast("Créez un compte pour activer Agwe Stream", "info");
      return;
    }
    if (agwePack && agwePack.videosLeft > 0) {
      navigate("/studio/agwestream");
      return;
    }
    activateAgwePack();
    toast("Pass AgwèStream activé — 15 générations ajoutées (1/jour · 720p · ≤5 min)", "ok");
  };

  const passActive = !!agwePack;

  return (
    <div className="mx-auto max-w-[1200px] pb-16">
      {/* En-tête + bascule */}
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
        <div className="max-w-2xl">
          <p className="eyebrow text-cyan">Tarification</p>
          <h1 className="font-display mt-2 text-[30px] font-bold leading-[1.05] tracking-tight text-white sm:text-[42px]">Trois fréquences, un même signal libre.</h1>
          <p className="mt-3 text-[13.5px] leading-relaxed text-fog">Chaque palier finance directement les créateurs indépendants — jamais la publicité.</p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="glass relative inline-flex items-center rounded-full p-1">
            <motion.span
              layout
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-y-1 rounded-full bg-cyan/15 ring-1 ring-cyan/50 shadow-[0_0_18px_rgba(0,229,255,0.25)]"
              style={{ left: billing === "mensuel" ? 4 : "50%", width: "calc(50% - 4px)" }}
            />
            {(["mensuel", "annuel"] as const).map((b) => (
              <button key={b} onClick={() => setBilling(b)} className={`font-display relative z-10 flex items-center gap-2 rounded-full px-5 py-2.5 text-[12px] font-bold uppercase tracking-[0.14em] transition-colors ${billing === b ? "text-cyan" : "text-fog hover:text-frost"}`}>
                {b}
                {b === "annuel" && <span className={`rounded-full px-1.5 py-px text-[9.5px] ${billing === "annuel" ? "bg-cyan/20 text-cyan" : "bg-white/[0.06] text-fog"}`}>−18 %</span>}
              </button>
            ))}
          </div>
          <p className="text-[11px] font-semibold text-fog/80">Facturation {billing === "mensuel" ? "mensuelle" : "annuelle · rabais de 18 % appliqué"}</p>
        </div>
      </div>

      {/* Forfaits */}
      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        {PLANS.map((p, i) => {
          const isFree = p.id === "free";
          const shown = billing === "annuel" && !isFree ? p.monthly * ANNUAL_RATE : p.monthly;
          const yearly = p.monthly * 12 * ANNUAL_RATE;
          const isCurrent = user?.tier === p.id;
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 34 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
              className={`glass-card relative flex flex-col overflow-hidden rounded-[22px] border p-7 ${
                p.gold ? "border-gold/55 shadow-[0_0_44px_rgba(245,197,66,0.12)]" : p.highlight ? "border-cyan/60 shadow-[0_0_48px_rgba(0,229,255,0.16)] lg:-translate-y-3 lg:scale-[1.02]" : "border-white/25"
              }`}
            >
              {isFree && <div className="absolute inset-x-0 top-0 h-px bg-white/30" />}
              {p.highlight && <div className="channel-progress absolute inset-x-0 top-0 h-[3px]" />}
              {p.gold && <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#8a6d1a] via-gold to-[#8a6d1a] shadow-[0_0_16px_rgba(245,197,66,0.6)]" />}

              {p.badge && (
                <span className={`font-display absolute right-5 top-5 flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${p.gold ? "gold-ring text-gold" : "border border-cyan/55 bg-cyan/12 text-cyan shadow-[0_0_18px_rgba(0,229,255,0.3)]"}`}>
                  {p.highlight && <span className="relative flex h-1.5 w-1.5"><span className="absolute h-full w-full rounded-full bg-cyan" style={{ animation: "pingSoft 1.5s cubic-bezier(0,0,0.2,1) infinite" }} /><span className="relative h-1.5 w-1.5 rounded-full bg-cyan" /></span>}
                  {p.gold && <Crown size={11} />}
                  {p.badge}
                </span>
              )}

              <div className={p.badge ? "pr-24" : ""}>
                <p className={`font-display text-[20px] font-bold tracking-[0.1em] ${p.gold ? "gold-text" : isFree ? "text-frost" : "text-glow text-cyan"}`}>{p.name.toUpperCase()}</p>
                <p className="font-display mt-0.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-fog">{p.sub}</p>
              </div>

              <div className="mt-6 flex items-baseline gap-2">
                <span className={`font-display text-[44px] font-bold leading-none tracking-tight ${p.gold ? "gold-text" : "text-white"}`}>{fmt(shown)} $</span>
                <span className="font-display text-[12px] font-bold uppercase tracking-[0.16em] text-fog">{isFree ? "pour toujours" : "/ mois"}</span>
              </div>
              <p className={`mt-2 min-h-[16px] text-[11px] font-semibold ${billing === "annuel" && !isFree ? "text-cyan" : "text-fog/70"}`}>
                {isFree ? "Aucune carte bancaire requise" : billing === "annuel" ? `facturé ${fmt(yearly)} $ / an — économisez ${fmt(p.monthly * 12 - yearly)} $` : "sans engagement · annulable à tout moment"}
              </p>

              <ul className="mt-5 flex-1 space-y-2.5">
                {p.list.map((li) => (
                  <li key={li} className="flex items-start gap-2.5 text-[12.5px] leading-snug text-fog">
                    <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full ${p.gold ? "bg-gold/15 text-gold" : isFree ? "bg-white/10 text-frost" : "bg-cyan/15 text-cyan"}`}>
                      <Check size={10} strokeWidth={2.6} />
                    </span>
                    {li}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => choose(p.id)}
                disabled={isCurrent}
                className={`mt-7 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-display text-[13.5px] font-bold tracking-wide transition-all ${
                  isCurrent
                    ? "cursor-default border border-mint/50 bg-mint/12 text-mint"
                    : p.gold
                      ? "bg-gradient-to-r from-[#fff3c4] via-gold to-[#ffb347] text-[#241a02] shadow-[0_0_26px_rgba(245,197,66,0.35)] hover:shadow-[0_0_44px_rgba(245,197,66,0.55)] hover:brightness-110"
                      : isFree
                        ? "border border-white/25 bg-white/[0.05] text-frost hover:border-white/50 hover:bg-white/10"
                        : "btn-neon"
                }`}
              >
                {isCurrent && <Check size={15} />}
                {isCurrent ? "Forfait actuel" : p.cta}
              </button>
            </motion.div>
          );
        })}
      </div>

      {/* Pack Agwe Stream */}
      <motion.section
        initial={{ opacity: 0, y: 34 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        className="scanlines relative mt-10 overflow-hidden rounded-[22px] border border-volt/45 bg-gradient-to-br from-[#170f2e] via-[#12102a] to-ink shadow-[0_0_48px_rgba(157,78,221,0.14)]"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-volt/80 to-transparent" />
        <div className="grid gap-8 p-7 sm:p-9 lg:grid-cols-[1.1fr_1.4fr_1fr]">
          <div>
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl border border-volt/50 bg-volt/15 text-volt shadow-[0_0_24px_rgba(157,78,221,0.35)]">
                <Wand2 size={22} />
              </span>
              <div>
                <p className="font-display text-[19px] font-bold tracking-[0.1em] text-white">
                  AGWE <span className="text-glow-violet text-volt">STREAM</span>
                </p>
                <p className="font-display text-[10px] font-semibold uppercase tracking-[0.2em] text-fog">Petits créateurs · studio IA</p>
              </div>
            </div>
            <div className="mt-6 flex items-baseline gap-2">
              <span className="font-display text-[46px] font-bold leading-none tracking-tight text-white">0,50 $</span>
              <span className="font-display text-[11px] font-bold uppercase tracking-[0.16em] text-volt">US · paiement unique</span>
            </div>
            <p className="mt-2 text-[11.5px] font-semibold text-fog">Le forfait IA le plus accessible du réseau — sans abonnement, sans expiration.</p>
          </div>

          <div className="space-y-3.5">
            {AGWE_PACK.rules.map((r, i) => (
              <div key={r.title} className="glass flex items-start gap-3.5 rounded-xl p-3.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-volt/45 bg-volt/12 text-volt">
                  {i === 0 ? <Film size={15} /> : i === 1 ? <Clock size={15} /> : <MonitorPlay size={15} />}
                </span>
                <div>
                  <p className="text-[13px] font-bold text-frost">{r.title}</p>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-fog">{r.text}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col justify-between">
            <div>
              <p className="font-display flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.2em] text-fog">
                Quota de générations
                <span className={`font-display text-[12px] ${passActive ? "text-mint" : "text-volt"}`}>{passActive ? `${agwePack?.videosLeft}/15 restantes` : "15 vidéos"}</span>
              </p>
              <div className="mt-2.5 grid gap-1" style={{ gridTemplateColumns: "repeat(15, minmax(0, 1fr))" }}>
                {Array.from({ length: 15 }).map((_, i) => {
                  const lit = i < (agwePack?.videosLeft ?? 15);
                  return (
                    <motion.span
                      key={i}
                      initial={{ scale: 0.4, opacity: 0 }}
                      whileInView={{ scale: 1, opacity: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.3, delay: i * 0.04 }}
                      className={`h-5 rounded-[4px] ${lit ? "bg-gradient-to-b from-volt to-cyan/70 shadow-[0_0_8px_rgba(157,78,221,0.6)]" : "bg-white/[0.07]"}`}
                    />
                  );
                })}
              </div>
              <p className="mt-2 text-[10.5px] font-semibold text-fog/80">1/jour · le solde ne fond pas avec le temps.</p>
            </div>
            <button
              onClick={activateAgwe}
              className={`mt-6 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-display text-[13.5px] font-bold tracking-wide transition-all ${
                passActive ? "border border-mint/50 bg-mint/12 text-mint hover:bg-mint/20" : "bg-gradient-to-r from-[#d8b4fe] via-volt to-[#7b2cbf] text-white shadow-[0_0_26px_rgba(157,78,221,0.45)] hover:shadow-[0_0_44px_rgba(157,78,221,0.65)] hover:brightness-110"
              }`}
            >
              {passActive ? (<><Zap size={15} /> Ouvrir le Studio IA</>) : (<><Zap size={15} /> Activer Agwe Stream</>)}
            </button>
          </div>
        </div>
      </motion.section>

      <p className="mt-8 text-center text-[11.5px] font-semibold text-fog/80">
        <Check size={12} className="mr-1.5 inline text-cyan" />
        Paiement sécurisé · sans engagement · la communauté fixe librement le prix de ses contenus Pay-Per-View
      </p>

      {/* FAQ */}
      <section className="mx-auto mt-14 max-w-[820px]">
        <h3 className="font-display text-center text-[24px] font-bold tracking-tight text-white">Questions fréquentes</h3>
        <div className="mt-6 space-y-3">
          {FAQ.map((f, i) => {
            const open = faqOpen === i;
            return (
              <div key={f.q} className={`glass overflow-hidden rounded-xl transition-colors ${open ? "border-cyan/40" : ""}`}>
                <button onClick={() => setFaqOpen(open ? null : i)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left">
                  <span className={`text-[13.5px] font-bold transition-colors ${open ? "text-cyan" : "text-frost"}`}>{f.q}</span>
                  <ChevronDown size={17} className={`shrink-0 text-fog transition-transform duration-300 ${open ? "rotate-180 text-cyan" : ""}`} />
                </button>
                <div className="grid transition-[grid-template-rows] duration-300 ease-out" style={{ gridTemplateRows: open ? "1fr" : "0fr" }}>
                  <div className="overflow-hidden">
                    <p className="px-5 pb-4 text-[12.5px] leading-relaxed text-fog">{f.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
