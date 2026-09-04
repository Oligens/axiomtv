/**
 * Axiom TV — Modèle du hub communautaire.
 * Contenus d'illustration structurés comme le contrat de l'API
 * (GET /api/videos, /api/creators, /api/channels…) : il suffit de
 * remplacer ces constantes par les appels réseau pour brancher Neon.
 */

export type CategoryId = "tous" | "directs" | "reportages" | "conferences" | "podcasts" | "courts";

export interface Category {
  id: CategoryId;
  label: string;
  short: string;
}

export const CATEGORIES: Category[] = [
  { id: "tous", label: "Tout le hub", short: "Tout" },
  { id: "directs", label: "Directs", short: "Directs" },
  { id: "reportages", label: "Reportages Terrain", short: "Terrain" },
  { id: "conferences", label: "Conférences de Presse", short: "Conférences" },
  { id: "podcasts", label: "Podcasts Citoyens", short: "Podcasts" },
  { id: "courts", label: "Courts-Métrages", short: "Courts" },
];

export type Tier = "free" | "agwestream_pass" | "pro" | "gold";

export const TIER_LABEL: Record<Tier, string> = {
  free: "Studio Citoyen",
  agwestream_pass: "Pass AgwèStream",
  pro: "Axiom Pro",
  gold: "Axiom Gold",
};

/* Vignettes génératives — dégradés + motifs, zéro asset externe */
export interface ThumbArt {
  g: string; // dégradé de fond (classes tailwind)
  motif: "grid" | "scan" | "dots" | "beams" | "waves";
  glow: string; // teinte du halo
}

export interface Video {
  id: string;
  title: string;
  creator: string;
  creatorRole: string;
  verified: boolean;
  category: Exclude<CategoryId, "tous">;
  duration: string;
  views: number;
  published: string;
  live?: boolean;
  viewers?: number;
  art: ThumbArt;
  description: string;
}

/** Contenus dynamiques : aucune donnée fictive n'est fournie au premier chargement. */
export const VIDEOS: Video[] = [];

export interface Creator {
  id: string;
  name: string;
  handle: string;
  role: string;
  followers: number;
  hue: string;
  hueTo: string;
  verified: boolean;
  bio: string;
}

/** Profils créateurs provenant exclusivement de l'API / du store utilisateur. */
export const CREATORS: Creator[] = [];
export const TICKER: string[] = [];
export const STATS: { value: string; label: string; sub: string }[] = [];

export interface ZapChannel {
  id: string;
  num: string;
  name: string;
  tagline: string;
  nowPlaying: string;
  viewers: number;
  live: boolean;
  art: ThumbArt;
}
export const ZAP_CHANNELS: ZapChannel[] = [];

/* ================= Tarification ================= */
export const ANNUAL_RATE = 0.82; // -18 %

export interface Plan {
  id: Tier;
  name: string;
  sub: string;
  monthly: number;
  badge?: string;
  gold?: boolean;
  highlight?: boolean;
  list: string[];
  cta: string;
}

export const PLANS: Plan[] = [
  {
    id: "free", name: "Axiom Free", sub: "Le Studio Citoyen", monthly: 0,
    list: ["Vidéos courtes & courts-métrages gratuits", "Direct 720p HD", "Cadeaux virtuels & Tips (réservés aux abonnés Pro/Gold côté envoi)", "Statistiques de base", "Page Antenne personnalisée"],
    cta: "Créer mon Studio",
  },
  {
    id: "pro", name: "Axiom Pro", sub: "Créateurs & Indépendants", monthly: 59.99, badge: "Recommandé", highlight: true,
    list: ["Vidéos jusqu'à 30 minutes · 1080p & 4K", "Longs-métrages & séries en Pay-Per-View", "Abonnements de chaîne payants", "Commission réduite", "Sondages interactifs Agwé Vision", "Mode « Audio Only » économie de data", "Badge Certifié Pro"],
    cta: "Activer l'Antenne Pro",
  },
  {
    id: "gold", name: "Axiom Gold", sub: "Grandes Industries Cinématographiques", monthly: 195.99, badge: "Monétisation Max", gold: true,
    list: ["0 % de commission sur le Pay-Per-View", "Directs 4K Ultra HD multi-caméras", "Watch Parties privées", "Notifications Push EPG (rappels d'émissions)", "Picture-in-Picture prioritaire", "Placement « À la Une » sur le Hub", "Studio AgwèStream illimité"],
    cta: "Devenir Membre Gold",
  },
];

export const AGWE_PACK = {
  price: 0.5,
  total: 15,
  perDay: 1,
  maxMinutes: 5,
  resolution: "720p",
  rules: [
    { title: "15 vidéos au total", text: "Une (1) génération par jour, à votre rythme." },
    { title: "N'expire jamais", text: "Sautez des jours : le quota reste actif tant que les 15 vidéos ne sont pas consommées." },
    { title: "≤ 5 min · 720p", text: "Durée maximale de 5 minutes par vidéo, qualité 720p." },
  ],
};

/* ================= Paiements (Earnings) ================= */
export interface Gateway {
  id: string;
  label: string;
  zone: string;
  fields: { key: string; label: string; placeholder: string; hint?: string }[];
}

export const GATEWAYS: Gateway[] = [
  {
    id: "stripe", label: "Stripe", zone: "Cartes bancaires mondiales",
    fields: [{ key: "accountId", label: "Identifiant de compte", placeholder: "acct_1NxK…", hint: "Format acct_…" }],
  },
  {
    id: "paypal", label: "PayPal", zone: "International",
    fields: [{ key: "email", label: "Email PayPal", placeholder: "vous@studio.org" }],
  },
  {
    id: "moncash", label: "MonCash", zone: "Haïti · Caraïbes",
    fields: [{ key: "phone", label: "Numéro MonCash", placeholder: "+509 3400 0000" }],
  },
  {
    id: "natcash", label: "NatCash", zone: "Haïti · Caraïbes",
    fields: [{ key: "phone", label: "Numéro NatCash", placeholder: "+509 4400 0000" }],
  },
  {
    id: "iban", label: "Compte bancaire", zone: "Virement SEPA / IBAN",
    fields: [
      { key: "iban", label: "IBAN", placeholder: "FR76 3000 4000 03…" },
      { key: "bic", label: "BIC / SWIFT", placeholder: "BNPAFRPP" },
    ],
  },
];

export interface Transaction {
  id: string;
  kind: "subscription" | "tip" | "ppv" | "withdrawal";
  label: string;
  amount: number;
  date: string;
  status: "completed" | "pending";
  gateway?: string;
}

export const DEMO_TRANSACTIONS: Transaction[] = [
  { id: "t1", kind: "subscription", label: "Abonnements mensuels (412 actifs)", amount: 1842.6, date: "2026-02-01", status: "completed" },
  { id: "t2", kind: "ppv", label: "Ventes « L'affaire des eaux troubles »", amount: 934.2, date: "2026-01-28", status: "completed" },
  { id: "t3", kind: "tip", label: "Dons pendant « Nuit de l'assemblée »", amount: 486.9, date: "2026-01-26", status: "completed" },
  { id: "t4", kind: "withdrawal", label: "Retrait vers MonCash •• 4821", amount: -1200, date: "2026-01-24", status: "completed", gateway: "moncash" },
  { id: "t5", kind: "subscription", label: "Abonnements mensuels (388 actifs)", amount: 1720.1, date: "2026-01-01", status: "completed" },
  { id: "t6", kind: "ppv", label: "Ventes « Dernière Édition »", amount: 512.4, date: "2025-12-22", status: "completed" },
  { id: "t7", kind: "withdrawal", label: "Retrait vers Stripe •• acct", amount: -2000, date: "2025-12-20", status: "completed", gateway: "stripe" },
];

export const REVENUE_SERIES = [
  { m: "Sep", v: 1240 }, { m: "Oct", v: 1418 }, { m: "Nov", v: 1662 },
  { m: "Déc", v: 2232 }, { m: "Jan", v: 3153 }, { m: "Fév", v: 1842 },
];

/* ================= Notifications ================= */
export interface AppNotification {
  id: string;
  type: "welcome" | "live" | "earning" | "info";
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export const EMPTY_NOTIFICATIONS: AppNotification[] = [];

export const formatViews = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1).replace(".", ",")} k` : String(n);

export const timeAgo = (iso: string) => {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "à l'instant";
  const m = Math.round(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} j`;
};
