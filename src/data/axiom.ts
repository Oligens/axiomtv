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

export const VIDEOS: Video[] = [
  {
    id: "v1", title: "Nuit de l'assemblée — la rue en direct", creator: "Aïcha Bellard", creatorRole: "Grand reporter terrain",
    verified: true, category: "directs", duration: "EN DIRECT", views: 0, published: "débuté il y a 42 min", live: true, viewers: 2841,
    art: { g: "from-[#1c0f2e] via-[#0d1117] to-[#061a24]", motif: "beams", glow: "rgba(255,93,115,0.35)" },
    description: "Couverture immersive de la soirée, sans commentaire éditorial : le direct brut filmé au plus près de la rue.",
  },
  {
    id: "v2", title: "Plateau ouvert — Radio Axiom 24/7", creator: "Collectif Axiom", creatorRole: "Radio communautaire",
    verified: true, category: "directs", duration: "EN CONTINU", views: 0, published: "flux permanent", live: true, viewers: 963,
    art: { g: "from-[#12102a] via-[#0a0e14] to-[#001a22]", motif: "waves", glow: "rgba(0,229,255,0.3)" },
    description: "Le plateau ouvert de la communauté : prises de parole libres et vérifications en temps réel, 24h/24.",
  },
  {
    id: "v3", title: "L'affaire des eaux troubles — 6 mois d'enquête", creator: "Marc Delain", creatorRole: "Journaliste d'investigation",
    verified: true, category: "reportages", duration: "26:14", views: 24180, published: "il y a 3 jours",
    art: { g: "from-[#0f2e33] via-[#0a1420] to-[#0d1117]", motif: "grid", glow: "rgba(0,229,255,0.28)" },
    description: "Quarante documents inédits, douze témoignages, une cartographie complète des rejets industriels du bassin.",
  },
  {
    id: "v4", title: "Nuit debout, chroniques de la place", creator: "Aïcha Bellard", creatorRole: "Grand reporter terrain",
    verified: true, category: "reportages", duration: "14:32", views: 12430, published: "il y a 2 jours",
    art: { g: "from-[#241230] via-[#120d1f] to-[#0a0e14]", motif: "scan", glow: "rgba(157,78,221,0.32)" },
    description: "Trois nuits sur la place, à hauteur d'yeux. Un récit sans voix off, monté avec les habitants.",
  },
  {
    id: "v5", title: "L'envers du barrage", creator: "Sofia Kramer", creatorRole: "Documentariste citoyenne",
    verified: false, category: "reportages", duration: "21:07", views: 8812, published: "il y a 5 jours",
    art: { g: "from-[#0d2433] via-[#0a1420] to-[#101018]", motif: "beams", glow: "rgba(52,211,153,0.28)" },
    description: "Dix jours de marche le long de la retenue d'eau pour recueillir la parole des riverains et des hydrologues.",
  },
  {
    id: "v6", title: "La ville qui s'étend, vue du ciel", creator: "Théo Vasseur", creatorRole: "Vidéaste & pilote de drone",
    verified: false, category: "reportages", duration: "08:45", views: 5240, published: "il y a 1 semaine",
    art: { g: "from-[#1a1030] via-[#0d1117] to-[#0a1a26]", motif: "grid", glow: "rgba(0,229,255,0.25)" },
    description: "Cartographie aérienne de l'étalement urbain, réalisée avec un drone grand public et des données ouvertes.",
  },
  {
    id: "v7", title: "Conférence — Collectif Vérité & Médias", creator: "Nadia Okonkwo", creatorRole: "Porte-parole du collectif",
    verified: true, category: "conferences", duration: "58:20", views: 18350, published: "hier",
    art: { g: "from-[#2a1430] via-[#140d20] to-[#0a0e14]", motif: "beams", glow: "rgba(245,197,66,0.26)" },
    description: "Rapport annuel sur la concentration des médias, en séance publique et intégrale, questions comprises.",
  },
  {
    id: "v8", title: "Q&R — L'observatoire des médias indépendants", creator: "Marc Delain", creatorRole: "Journaliste d'investigation",
    verified: true, category: "conferences", duration: "52:40", views: 6120, published: "il y a 4 jours",
    art: { g: "from-[#101a2e] via-[#0a1020] to-[#0d1117]", motif: "dots", glow: "rgba(0,229,255,0.24)" },
    description: "Une heure de questions sur le financement de la presse libre et la protection des sources.",
  },
  {
    id: "v9", title: "Fréquence Libre #42 — Informer coûte que coûte", creator: "Nadia Okonkwo", creatorRole: "Animatrice Fréquence Libre",
    verified: true, category: "podcasts", duration: "48:12", views: 3977, published: "il y a 3 jours",
    art: { g: "from-[#1e0f28] via-[#120a1e] to-[#0a0e14]", motif: "waves", glow: "rgba(157,78,221,0.3)" },
    description: "Trois journalistes menacés témoignent du prix réel de l'information indépendante.",
  },
  {
    id: "v10", title: "Mémoires de presse — les archives interdites", creator: "Théo Vasseur", creatorRole: "Vidéaste & pilote de drone",
    verified: false, category: "podcasts", duration: "35:58", views: 2310, published: "il y a 6 jours",
    art: { g: "from-[#241a10] via-[#14100a] to-[#0a0e14]", motif: "dots", glow: "rgba(245,197,66,0.24)" },
    description: "Plongée sonore dans les archives d'un journal censuré en 1962, sauvées par un archiviste bénévole.",
  },
  {
    id: "v11", title: "Signal Faible", creator: "Lina Morvan", creatorRole: "Réalisatrice indépendante",
    verified: false, category: "courts", duration: "12:03", views: 15830, published: "il y a 2 semaines",
    art: { g: "from-[#0d2233] via-[#0a1424] to-[#120d24]", motif: "scan", glow: "rgba(0,229,255,0.32)" },
    description: "Dans une ville où les réseaux tombent un à un, une opératrice radio capte le dernier signal. Sélection Courts Libres 2026.",
  },
  {
    id: "v12", title: "Dernière Édition", creator: "Lina Morvan", creatorRole: "Réalisatrice indépendante",
    verified: false, category: "courts", duration: "07:41", views: 9406, published: "il y a 1 mois",
    art: { g: "from-[#1a1428] via-[#0d0d18] to-[#0a0e14]", motif: "grid", glow: "rgba(157,78,221,0.26)" },
    description: "La dernière nuit d'une imprimerie de presse. Sept minutes, un seul plan, aucune musique.",
  },
];

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

export const CREATORS: Creator[] = [
  { id: "c1", name: "Aïcha Bellard", handle: "aicha-bellard", role: "Grand reporter terrain", followers: 48200, hue: "#00e5ff", hueTo: "#9d4edd", verified: true, bio: "La rue comme studio, le direct comme preuve. 12 ans de terrain, zéro rédacteur en chef." },
  { id: "c2", name: "Marc Delain", handle: "marc-delain", role: "Journaliste d'investigation", followers: 36900, hue: "#9d4edd", hueTo: "#ff5d73", verified: true, bio: "Documents, sources, patience. Chaque enquête est financée par celles et ceux qui la regardent." },
  { id: "c3", name: "Nadia Okonkwo", handle: "nadia-okonkwo", role: "Animatrice — Fréquence Libre", followers: 22400, hue: "#f5c542", hueTo: "#ff5d73", verified: true, bio: "Un micro ouvert, des voix qu'on n'entend pas ailleurs. Fréquence Libre, chaque jeudi." },
  { id: "c4", name: "Sofia Kramer", handle: "sofia-kramer", role: "Documentariste citoyenne", followers: 12100, hue: "#34d399", hueTo: "#00e5ff", verified: false, bio: "Je marche, j'écoute, je filme. Les grands récits commencent toujours par un pas de côté." },
  { id: "c5", name: "Théo Vasseur", handle: "theo-vasseur", role: "Vidéaste & pilote de drone", followers: 8700, hue: "#00e5ff", hueTo: "#34d399", verified: false, bio: "Le territoire vu d'en haut, raconté par ceux d'en bas. Données ouvertes, ciel ouvert." },
];

export const TICKER: string[] = [
  "DIRECT — « Nuit de l'assemblée » : 2 841 spectateurs connectés",
  "NOUVEAU — Studio AgwèStream : scénario global, clonage vocal et timeline IA",
  "ENQUÊTE — « L'affaire des eaux troubles » dépasse les 24 000 vues",
  "PRO — Sondages Agwé Vision : votez en direct et orientez les émissions",
  "DIRECT — Plateau ouvert Radio Axiom : 963 auditeurs en ce moment",
  "CHARTE — 1 200 signataires pour la charte de la presse indépendante",
  "STUDIO — 312 contenus publiés par la communauté cette semaine",
];

export const STATS: { value: string; label: string; sub: string }[] = [
  { value: "12 480", label: "Journalistes & créateurs", sub: "+318 ce mois-ci" },
  { value: "3 842", label: "Contenus ce mois-ci", sub: "100 % communautaires" },
  { value: "214", label: "Directs en cours", sub: "41 fuseaux horaires" },
  { value: "1,2 M", label: "Spectateurs", sub: "zéro algorithme publicitaire" },
];

/* ================= Antennes continues (Zap virtuel) ================= */
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

export const ZAP_CHANNELS: ZapChannel[] = [
  { id: "ch1", num: "01", name: "Axiom 24/7", tagline: "L'antenne généraliste de la communauté", nowPlaying: "Plateau ouvert — parole libre", viewers: 963, live: true, art: { g: "from-[#0d2b3f] via-[#0a0e14] to-[#0d1117]", motif: "waves", glow: "rgba(0,229,255,0.3)" } },
  { id: "ch2", num: "02", name: "100% Documentaires", tagline: "Enquêtes & terrain en format long", nowPlaying: "L'affaire des eaux troubles", viewers: 1284, live: true, art: { g: "from-[#0f3342] via-[#0a1018] to-[#0d1117]", motif: "grid", glow: "rgba(52,211,153,0.28)" } },
  { id: "ch3", num: "03", name: "Conférences de Presse", tagline: "Les prises de parole publiques, intégrales", nowPlaying: "Vérité & Médias — rapport annuel", viewers: 642, live: true, art: { g: "from-[#251243] via-[#120d20] to-[#0d1117]", motif: "beams", glow: "rgba(245,197,66,0.26)" } },
  { id: "ch4", num: "04", name: "Podcasts Citoyens", tagline: "Talk-shows & débats en continu", nowPlaying: "Fréquence Libre #42", viewers: 481, live: true, art: { g: "from-[#2c1233] via-[#160d20] to-[#0d1117]", motif: "waves", glow: "rgba(157,78,221,0.3)" } },
  { id: "ch5", num: "05", name: "Courts & Création", tagline: "Cinéma indépendant non-stop", nowPlaying: "Signal Faible — Lina Morvan", viewers: 356, live: false, art: { g: "from-[#111d3e] via-[#0a1224] to-[#0d1117]", motif: "scan", glow: "rgba(0,229,255,0.28)" } },
];

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

/* ================= Notifications (seed démo) ================= */
export interface AppNotification {
  id: string;
  type: "welcome" | "live" | "earning" | "info";
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export const seedNotifications = (name: string): AppNotification[] => {
  const now = Date.now();
  return [
    { id: `n-${now}-1`, type: "welcome", title: "Bienvenue sur AxiomTV", body: `Votre antenne citoyenne est prête, ${name}. Publiez votre premier contenu.`, read: false, createdAt: new Date(now).toISOString() },
    { id: `n-${now}-2`, type: "live", title: "Un nouveau direct est disponible", body: "« Nuit de l'assemblée » vient de passer en direct — rejoignez la rue.", read: false, createdAt: new Date(now - 60000).toISOString() },
    { id: `n-${now}-3`, type: "earning", title: "Nouveau don reçu", body: "Un spectateur vous a envoyé 5,00 $ de soutien pendant votre dernier direct.", read: true, createdAt: new Date(now - 3600000).toISOString() },
  ];
};

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
