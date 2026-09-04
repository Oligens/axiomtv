/**
 * Tableau de bord financier — revenus, passerelles de paiement
 * (Stripe, PayPal, MonCash, NatCash, IBAN) et retraits.
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { ArrowDownToLine, CreditCard, Landmark, Plus, Smartphone, Star, Trash2, TrendingUp, Wallet } from "lucide-react";
import { GATEWAYS, type Transaction } from "../data/axiom";
import { useStore } from "../store/useStore";

const fmt$ = (n: number) => `${n.toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;

const gatewayIcon = (id: string) =>
  id === "stripe" ? <CreditCard size={16} /> : id === "paypal" ? <Wallet size={16} /> : id === "moncash" || id === "natcash" ? <Smartphone size={16} /> : <Landmark size={16} />;

export default function EarningsPage() {
  const user = useStore((s) => s.user);
  const toast = useStore((s) => s.toast);
  const paymentMethods = useStore((s) => s.paymentMethods);
  const addPaymentMethod = useStore((s) => s.addPaymentMethod);
  const removePaymentMethod = useStore((s) => s.removePaymentMethod);
  const setDefaultMethod = useStore((s) => s.setDefaultMethod);

  const [txs, setTxs] = useState<Transaction[]>([]);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawMethod, setWithdrawMethod] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [newGateway, setNewGateway] = useState("stripe");
  const [form, setForm] = useState<Record<string, string>>({});

  const total = txs.filter((t) => t.kind !== "withdrawal").reduce((n, t) => n + t.amount, 0);
  const withdrawn = Math.abs(txs.filter((t) => t.kind === "withdrawal").reduce((n, t) => n + t.amount, 0));
  const available = total - withdrawn;
  const subscribers = 0;

  const doWithdraw = () => {
    const amt = parseFloat(withdrawAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast("Montant invalide", "warn");
      return;
    }
    if (amt > available) {
      toast(`Solde insuffisant (disponible : ${fmt$(available)})`, "warn");
      return;
    }
    const m = paymentMethods.find((x) => x.id === withdrawMethod);
    if (!m) {
      toast("Choisissez une méthode de paiement", "warn");
      return;
    }
    setTxs((t) => [{ id: `w-${Date.now()}`, kind: "withdrawal", label: `Retrait vers ${m.label}`, amount: -amt, date: new Date().toISOString().slice(0, 10), status: "pending", gateway: m.gateway }, ...t]);
    toast(`Retrait de ${fmt$(amt)} demandé — traitement sous 48 h`, "ok");
    setWithdrawAmount("");
  };

  const addMethod = () => {
    const g = GATEWAYS.find((x) => x.id === newGateway);
    if (!g) return;
    const missing = g.fields.some((f) => !form[f.key]?.trim());
    if (missing) {
      toast("Complétez tous les champs de la passerelle", "warn");
      return;
    }
    const firstField = form[g.fields[0].key].trim();
    const masked = `${g.label} •• ${firstField.slice(-4)}`;
    addPaymentMethod({ id: Date.now(), gateway: g.id, label: g.label, masked, isDefault: paymentMethods.length === 0 });
    setForm({});
    setAdding(false);
    toast(`${g.label} ajoutée comme méthode de paiement`, "ok");
  };

  const kindLabel = (k: Transaction["kind"]) =>
    k === "subscription" ? "Abonnement" : k === "tip" ? "Don" : k === "ppv" ? "Pay-Per-View" : "Retrait";
  const kindColor = (k: Transaction["kind"]) =>
    k === "subscription" ? "text-cyan" : k === "tip" ? "text-gold" : k === "ppv" ? "text-volt" : "text-coral";

  return (
    <div className="mx-auto max-w-[1200px] pb-16">
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
        <div className="max-w-2xl">
          <p className="eyebrow text-cyan">Espace créateur</p>
          <h1 className="font-display mt-2 text-[30px] font-bold leading-[1.05] tracking-tight text-white sm:text-[42px]">Revenus & paiements</h1>
          <p className="mt-3 text-[13.5px] leading-relaxed text-fog">Suivi des gains (abonnements, dons, ventes) et gestion des passerelles de paiement — @{user?.username}.</p>
        </div>
      </div>

      {/* Synthèse */}
      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Revenus totaux", value: fmt$(total), icon: <TrendingUp size={17} />, color: "#34d399" },
          { label: "Disponible", value: fmt$(available), icon: <Wallet size={17} />, color: "#00e5ff" },
          { label: "Déjà retiré", value: fmt$(withdrawn), icon: <ArrowDownToLine size={17} />, color: "#ff5d73" },
          { label: "Abonnés actifs", value: String(subscribers), icon: <Star size={17} />, color: "#f5c542" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: i * 0.07 }} className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <p className="font-display text-[11px] font-bold uppercase tracking-[0.16em] text-fog">{s.label}</p>
              <span style={{ color: s.color }}>{s.icon}</span>
            </div>
            <p className="font-display mt-2.5 text-[26px] font-bold leading-none text-white">{s.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Courbe */}
      <section className="glass mt-6 rounded-2xl p-6">
        <p className="eyebrow text-cyan">Évolution des revenus (6 mois)</p>
        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={[]}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00e5ff" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#9d4edd" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="m" tick={{ fill: "#8b98ab", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#8b98ab", fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
              <Tooltip contentStyle={{ background: "#151b25", border: "1px solid rgba(0,229,255,0.3)", borderRadius: 10, color: "#e8eef7", fontSize: 12 }} formatter={(v) => [fmt$(Number(v)), "Revenus"]} />
              <Area type="monotone" dataKey="v" stroke="#00e5ff" strokeWidth={2} fill="url(#rev)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Transactions */}
        <section className="glass rounded-2xl p-6">
          <p className="eyebrow text-cyan">Transactions</p>
          <div className="mt-4 space-y-2.5">
            {txs.map((t) => (
              <div key={t.id} className="flex items-center gap-3.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <span className={`font-display w-24 shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] ${kindColor(t.kind)}`}>{kindLabel(t.kind)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-bold text-frost">{t.label}</p>
                  <p className="font-mono text-[10px] font-semibold text-fog/60">{t.date}</p>
                </div>
                <span className={`font-mono shrink-0 text-[13px] font-bold ${t.amount < 0 ? "text-coral" : "text-mint"}`}>{t.amount < 0 ? "−" : "+"}{fmt$(Math.abs(t.amount))}</span>
                <span className={`font-display hidden shrink-0 rounded-full border px-2 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.12em] sm:block ${t.status === "completed" ? "border-mint/40 bg-mint/10 text-mint" : "border-gold/40 bg-gold/10 text-gold"}`}>
                  {t.status === "completed" ? "Complété" : "En cours"}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Passerelles + retrait */}
        <div className="space-y-6">
          <section className="glass rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <p className="eyebrow text-cyan">Méthodes de paiement</p>
              <button onClick={() => setAdding((v) => !v)} className="btn-ghost flex items-center gap-1.5 rounded-full px-3 py-1.5 font-display text-[10px] font-bold uppercase tracking-[0.12em] text-fog">
                <Plus size={12} /> Ajouter
              </button>
            </div>

            {adding && (
              <div className="mt-4 rounded-xl border border-cyan/30 bg-cyan/[0.04] p-4">
                <select value={newGateway} onChange={(e) => { setNewGateway(e.target.value); setForm({}); }} className="field h-10 w-full rounded-lg px-3 text-[12.5px] font-bold text-frost">
                  {GATEWAYS.map((g) => (
                    <option key={g.id} value={g.id} className="bg-panel">
                      {g.label} — {g.zone}
                    </option>
                  ))}
                </select>
                <div className="mt-3 space-y-2.5">
                  {(GATEWAYS.find((g) => g.id === newGateway)?.fields ?? []).map((f) => (
                    <label key={f.key} className="block">
                      <span className="font-display mb-1 block text-[9.5px] font-bold uppercase tracking-[0.16em] text-fog">{f.label}</span>
                      <input value={form[f.key] ?? ""} onChange={(e) => setForm((x) => ({ ...x, [f.key]: e.target.value }))} placeholder={f.placeholder} className="field h-10 w-full rounded-lg px-3 text-[12.5px] font-semibold text-frost" />
                    </label>
                  ))}
                </div>
                <button onClick={addMethod} className="btn-neon mt-3 w-full rounded-lg py-2.5 font-display text-[11px] font-bold uppercase tracking-[0.14em]">
                  Enregistrer la passerelle
                </button>
              </div>
            )}

            <div className="mt-4 space-y-2.5">
              {paymentMethods.length === 0 && !adding && (
                <p className="rounded-xl border border-dashed border-white/15 px-4 py-6 text-center text-[11.5px] font-semibold text-fog/70">
                  Aucune méthode configurée — ajoutez Stripe, PayPal, MonCash, NatCash ou un IBAN.
                </p>
              )}
              {paymentMethods.map((m) => (
                <div key={m.id} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
                  <span className="text-cyan">{gatewayIcon(m.gateway)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-[12.5px] font-bold text-frost">
                      {m.masked}
                      {m.isDefault && <span className="font-display rounded-full bg-cyan/15 px-2 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.1em] text-cyan">Défaut</span>}
                    </p>
                  </div>
                  {!m.isDefault && (
                    <button onClick={() => setDefaultMethod(m.id)} className="font-display rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-fog hover:text-cyan">
                      Définir
                    </button>
                  )}
                  <button onClick={() => { removePaymentMethod(m.id); toast("Méthode retirée", "warn"); }} aria-label="Retirer" className="text-fog hover:text-coral">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="glass rounded-2xl p-6">
            <p className="eyebrow text-cyan">Retirer des fonds</p>
            <label className="mt-3 block">
              <span className="font-display mb-1 block text-[9.5px] font-bold uppercase tracking-[0.16em] text-fog">Montant (disponible : {fmt$(available)})</span>
              <input value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} type="number" min="0" step="0.01" className="field h-11 w-full rounded-lg px-3 font-mono text-[14px] font-bold text-frost" />
            </label>
            <label className="mt-3 block">
              <span className="font-display mb-1 block text-[9.5px] font-bold uppercase tracking-[0.16em] text-fog">Vers</span>
              <select value={withdrawMethod ?? ""} onChange={(e) => setWithdrawMethod(Number(e.target.value))} className="field h-11 w-full rounded-lg px-3 text-[12.5px] font-bold text-frost">
                <option value="" className="bg-panel">Choisir une méthode…</option>
                {paymentMethods.map((m) => (
                  <option key={m.id} value={m.id} className="bg-panel">
                    {m.masked}
                  </option>
                ))}
              </select>
            </label>
            <button onClick={doWithdraw} disabled={paymentMethods.length === 0} className="btn-neon mt-4 w-full rounded-lg py-3 font-display text-[12px] font-bold uppercase tracking-[0.14em]">
              Demander le retrait
            </button>
            <p className="mt-2.5 text-[10.5px] font-semibold text-fog/60">Traitement sous 48 h · 0 % de frais pour Axiom Gold.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
