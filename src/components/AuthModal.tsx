/**
 * Authentification Axiom TV — onglets Connexion / Inscription.
 * L'inscription déclenche l'email de bienvenue transactionnel (Resend)
 * côté serveur quand l'API est jointe.
 */
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Eye, EyeOff, Mail, X } from "lucide-react";
import { useStore, apiEnabled } from "../store/useStore";
import { Logomark } from "./brand";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AuthModal() {
  const authModal = useStore((s) => s.authModal);
  const closeAuth = useStore((s) => s.closeAuth);
  const login = useStore((s) => s.login);
  const register = useStore((s) => s.register);
  const toast = useStore((s) => s.toast);

  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [err, setErr] = useState<{ name?: string; email?: string; password?: string }>({});
  const [done, setDone] = useState<null | { email: string }>(null);

  useEffect(() => {
    if (authModal) {
      setMode(authModal);
      setError(null);
      setErr({});
      setDone(null);
      setBusy(false);
    }
  }, [authModal]);

  useEffect(() => {
    if (!authModal) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeAuth();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [authModal, closeAuth]);

  const validate = () => {
    const fe: typeof err = {};
    if (mode === "register" && name.trim().length < 2) fe.name = "2 caractères min.";
    if (!EMAIL_RE.test(email)) fe.email = "Email invalide";
    if (password.length < 6) fe.password = "6 caractères min.";
    setErr(fe);
    return Object.keys(fe).length === 0;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !validate()) return;
    setBusy(true);
    setError(null);
    const res = mode === "login" ? await login(email.trim(), password) : await register(name.trim(), email.trim(), password);
    setBusy(false);
    if (res) {
      setError(res);
      return;
    }
    if (mode === "register") {
      setDone({ email: email.trim() });
      setTimeout(() => {
        closeAuth();
        toast("Bienvenue sur AxiomTV — votre antenne est en ligne", "ok");
      }, 2000);
    } else {
      closeAuth();
      toast("Session ouverte — bon retour sur l'antenne", "ok");
    }
  };

  const Field = ({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) => (
    <label className="block">
      <span className="font-display mb-1.5 flex items-baseline justify-between text-[10px] font-bold uppercase tracking-[0.2em] text-fog">
        {label}
        {error && <span className="normal-case tracking-normal text-coral">{error}</span>}
      </span>
      {children}
    </label>
  );

  return (
    <AnimatePresence>
      {authModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          onClick={closeAuth}
          className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-abyss/85 p-4 backdrop-blur-md"
        >
          <motion.div
            initial={{ opacity: 0, y: 34, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="glass-deep relative my-8 w-full max-w-[420px] overflow-hidden rounded-[22px] shadow-[0_40px_110px_rgba(0,0,0,0.7)]"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan/70 to-transparent" />
            <div className="p-7">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <Logomark size={30} />
                  <div>
                    <p className="font-display text-[15px] font-bold tracking-[0.14em] text-frost">
                      AXIOM<span className="text-glow text-cyan">TV</span>
                    </p>
                    <p className="text-[9px] font-semibold tracking-[0.08em] text-fog">L'information sans filtre</p>
                  </div>
                </div>
                <button onClick={closeAuth} aria-label="Fermer" className="grid h-8 w-8 place-items-center rounded-full text-fog transition-colors hover:bg-white/[0.06] hover:text-frost">
                  <X size={16} />
                </button>
              </div>

              {done ? (
                <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} className="py-10 text-center">
                  <span className="relative mx-auto grid h-16 w-16 place-items-center rounded-full border border-mint/50 bg-mint/10 text-mint shadow-[0_0_34px_rgba(52,211,153,0.3)]">
                    <span className="absolute inset-0 rounded-full bg-mint/20" style={{ animation: "pingSoft 1.6s cubic-bezier(0,0,0.2,1) infinite" }} />
                    <Check size={26} strokeWidth={2.4} />
                  </span>
                  <h3 className="font-display mt-5 text-[20px] font-bold text-white">Antenne activée !</h3>
                  <p className="mx-auto mt-2 flex max-w-[300px] items-center justify-center gap-2 text-[12.5px] leading-relaxed text-fog">
                    <Mail size={14} className="shrink-0 text-cyan" />
                    Email de bienvenue envoyé à <b className="text-frost">{done.email}</b>
                  </p>
                  <p className="font-display mt-3 text-[9px] font-bold uppercase tracking-[0.22em] text-fog/60">
                    {apiEnabled() ? "Via Resend · transactionnel" : "Simulation locale"}
                  </p>
                </motion.div>
              ) : (
                <>
                  {/* Onglets */}
                  <div className="relative mt-6 grid grid-cols-2 rounded-xl border border-white/10 bg-white/[0.03] p-1">
                    <motion.span
                      layout
                      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                      className="absolute inset-y-1 rounded-lg bg-cyan/15 shadow-[0_0_18px_rgba(0,229,255,0.18)] ring-1 ring-cyan/40"
                      style={{ left: mode === "login" ? 4 : "50%", width: "calc(50% - 4px)" }}
                    />
                    {(["login", "register"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => {
                          setMode(m);
                          setError(null);
                          setErr({});
                        }}
                        className={`font-display relative z-10 rounded-lg py-2.5 text-[12px] font-bold uppercase tracking-[0.16em] transition-colors ${mode === m ? "text-cyan" : "text-fog hover:text-frost"}`}
                      >
                        {m === "login" ? "Connexion" : "Inscription"}
                      </button>
                    ))}
                  </div>

                  <h2 className="font-display mt-5 text-[22px] font-bold tracking-tight text-white">
                    {mode === "login" ? "Reprendre l'antenne" : "Ouvrir votre antenne"}
                  </h2>
                  <p className="mt-1 text-[12px] leading-relaxed text-fog">
                    {mode === "login"
                      ? "Connectez-vous pour publier, suivre vos directs et gérer votre antenne."
                      : "Créez votre compte citoyen — un email de bienvenue vous attend."}
                  </p>

                  <form onSubmit={submit} className="mt-5 space-y-3.5">
                    <AnimatePresence initial={false}>
                      {mode === "register" && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                          <Field label="Nom" error={err.name}>
                            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nora Kaci" autoComplete="name" className="field h-11 w-full rounded-xl px-4 text-[13.5px] font-semibold text-frost" />
                          </Field>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <Field label="Email" error={err.email}>
                      <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="vous@media-independant.org" autoComplete="email" className="field h-11 w-full rounded-xl px-4 text-[13.5px] font-semibold text-frost" />
                    </Field>

                    <Field label="Mot de passe" error={err.password}>
                      <div className="relative">
                        <input
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          type={showPw ? "text" : "password"}
                          placeholder="••••••••••"
                          autoComplete={mode === "login" ? "current-password" : "new-password"}
                          className="field h-11 w-full rounded-xl px-4 pr-11 text-[13.5px] font-semibold text-frost"
                        />
                        <button type="button" onClick={() => setShowPw((v) => !v)} aria-label="Afficher le mot de passe" className="absolute right-3 top-1/2 -translate-y-1/2 text-fog transition-colors hover:text-cyan">
                          {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </Field>

                    {error && (
                      <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg border border-coral/40 bg-coral/10 px-3 py-2 text-[11.5px] font-bold text-coral">
                        {error}
                      </motion.p>
                    )}

                    <button type="submit" disabled={busy} className="btn-neon mt-1 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-display text-[13.5px] font-bold tracking-wide">
                      {busy ? (
                        <>
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#04121a]/30 border-t-[#04121a]" />
                          {mode === "login" ? "Connexion…" : "Création du compte…"}
                        </>
                      ) : mode === "login" ? (
                        "Se connecter"
                      ) : (
                        "S'inscrire gratuitement"
                      )}
                    </button>
                  </form>

                  <p className="mt-4 text-center text-[11.5px] font-semibold text-fog">
                    {mode === "login" ? (
                      <>
                        Première fois sur le réseau ?{" "}
                        <button onClick={() => setMode("register")} className="font-bold text-cyan hover:underline">
                          Créer un compte
                        </button>
                      </>
                    ) : (
                      <>
                        Déjà membre ?{" "}
                        <button onClick={() => setMode("login")} className="font-bold text-cyan hover:underline">
                          Se connecter
                        </button>
                      </>
                    )}
                  </p>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
