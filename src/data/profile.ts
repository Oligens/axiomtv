export interface BannerTemplate {
  id: string;
  name: string;
  background: string;
  accent: string;
}

export const AXIOM_BANNER_TEMPLATES: BannerTemplate[] = [
  { id: "ocean", name: "Océan Axiom", background: "linear-gradient(120deg,#06131f,#0b4f68 48%,#00e5ff)", accent: "#00e5ff" },
  { id: "abyss", name: "Abysses", background: "linear-gradient(135deg,#020617,#0b1120 55%,#164e63)", accent: "#22d3ee" },
  { id: "aurora", name: "Aurore", background: "linear-gradient(120deg,#08111f,#123b5d 35%,#5b21b6 72%,#ec4899)", accent: "#c084fc" },
  { id: "gold", name: "Axiom Gold", background: "linear-gradient(120deg,#17120a,#6b4f0b 48%,#eab308)", accent: "#facc15" },
  { id: "cyan", name: "Néon Cyan", background: "linear-gradient(135deg,#031018,#075985 50%,#06b6d4)", accent: "#67e8f9" },
  { id: "violet", name: "Nuit Violette", background: "linear-gradient(135deg,#0b0615,#3b0764 50%,#7e22ce)", accent: "#d8b4fe" },
  { id: "emerald", name: "Émeraude", background: "linear-gradient(135deg,#03130d,#065f46 52%,#10b981)", accent: "#6ee7b7" },
  { id: "coral", name: "Corail", background: "linear-gradient(135deg,#18090d,#7f1d1d 48%,#fb7185)", accent: "#fda4af" },
  { id: "midnight", name: "Minuit", background: "linear-gradient(120deg,#020617,#111827 50%,#1e293b)", accent: "#94a3b8" },
  { id: "electric", name: "Électricité", background: "linear-gradient(120deg,#030712,#1d4ed8 48%,#38bdf8)", accent: "#7dd3fc" },
  { id: "magenta", name: "Magenta", background: "linear-gradient(135deg,#120612,#701a75 52%,#db2777)", accent: "#f9a8d4" },
  { id: "forest", name: "Forêt", background: "linear-gradient(135deg,#03120b,#14532d 55%,#65a30d)", accent: "#bef264" },
  { id: "sunset", name: "Crépuscule", background: "linear-gradient(120deg,#170b08,#9a3412 50%,#f59e0b)", accent: "#fed7aa" },
  { id: "space", name: "Station Orbitale", background: "linear-gradient(135deg,#020617,#172554 50%,#312e81)", accent: "#a5b4fc" },
  { id: "matrix", name: "Signal", background: "linear-gradient(120deg,#020a06,#064e3b 48%,#16a34a)", accent: "#86efac" },
  { id: "ice", name: "Glace", background: "linear-gradient(135deg,#07111c,#164e63 48%,#bae6fd)", accent: "#e0f2fe" },
  { id: "ruby", name: "Rubis", background: "linear-gradient(135deg,#150509,#881337 50%,#e11d48)", accent: "#fda4af" },
  { id: "royal", name: "Royal", background: "linear-gradient(135deg,#080b1f,#3730a3 52%,#6366f1)", accent: "#c7d2fe" },
  { id: "mono", name: "Monochrome", background: "linear-gradient(120deg,#050505,#262626 55%,#525252)", accent: "#f5f5f5" },
  { id: "wave", name: "Vague Axiom", background: "radial-gradient(circle at 20% 80%,#00e5ff33,transparent 32%),linear-gradient(135deg,#031018,#0e7490 48%,#0f172a)", accent: "#22d3ee" },
];
