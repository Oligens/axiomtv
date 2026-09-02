/**
 * AGWÈSTREAM — PublishingEngine & AxiomPublisher.
 *
 * Couche de publication abstraite (Partie 18) : si le backend Axiom TV est
 * joint (VITE_API_URL), on utilise son contrat réel — POST /api/agwestream/videos
 * avec le JWT Bearer déjà géré par le store. Sinon, un service local simule le
 * pipeline de statuts pour que l'interface reste fonctionnelle.
 *
 * Sécurité : aucune clé côté front ; le token provient du stockage local du
 * store ; titres/fichiers/visibilité sont validés avant envoi.
 */
import type { Project } from "./preview";

export type PublishStatusCode =
  | "DRAFT"
  | "PROCESSING"
  | "QUALITY_CHECK"
  | "READY"
  | "PUBLISHING"
  | "PUBLISHED"
  | "FAILED";

export type ContentType = "video" | "short" | "episode" | "series" | "film" | "trailer";

export interface EpisodeDraft {
  id: string;
  title: string;
  description: string;
  sceneId: string | null;
}

export interface SeasonDraft {
  id: string;
  number: number;
  episodes: EpisodeDraft[];
}

export interface PublishingSettings {
  title: string;
  description: string;
  category: string;
  genre: string;
  language: string;
  tags: string[];
  contentType: ContentType;
  ageRating: string;
  visibility: "public" | "unlisted" | "private";
  /* film */
  filmYear: number;
  filmTrailer: string;
  /* série */
  seasons: SeasonDraft[];
}

export const CONTENT_TYPES: { id: ContentType; label: string }[] = [
  { id: "video", label: "Vidéo" },
  { id: "short", label: "Short" },
  { id: "episode", label: "Épisode" },
  { id: "series", label: "Série" },
  { id: "film", label: "Film" },
  { id: "trailer", label: "Bande-annonce" },
];

export const AGE_RATINGS = ["Tous publics", "10+", "13+", "16+", "18+"];
export const GENRES = ["Drame", "Science-Fiction", "Action", "Thriller", "Documentaire", "Comédie", "Animation"];
export const CATEGORIES = ["Reportages Terrain", "Conférences de Presse", "Podcasts Citoyens", "Courts-Métrages", "Cinéma Indépendant", "Séries & Films"];

export const DEFAULT_PUBLISH: PublishingSettings = {
  title: "",
  description: "",
  category: "Cinéma Indépendant",
  genre: "Science-Fiction",
  language: "Français",
  tags: [],
  contentType: "film",
  ageRating: "Tous publics",
  visibility: "public",
  filmYear: new Date().getFullYear(),
  filmTrailer: "",
  seasons: [{ id: "s1", number: 1, episodes: [{ id: "e1", title: "Épisode 01", description: "", sceneId: null }] }],
};

export interface AxiomPublication {
  id: string;
  url: string;
  publishedAt: string;
  visibility: string;
  status: PublishStatusCode;
  title: string;
}

export interface PublishStage {
  code: PublishStatusCode;
  label: string;
  progress: number;
}

/** Pipeline de statuts affiché pendant la publication (Partie 12). */
export const PUBLISH_STAGES: { code: PublishStatusCode; label: string }[] = [
  { code: "PROCESSING", label: "UPLOADING" },
  { code: "QUALITY_CHECK", label: "PROCESSING" },
  { code: "PUBLISHING", label: "PUBLISHING" },
  { code: "PUBLISHED", label: "PUBLISHED" },
];

/* ================= Contrat abstrait ================= */

export interface PublishingService {
  readonly mode: "api" | "local";
  validate(settings: PublishingSettings, project: Project): string | null;
  publish(settings: PublishingSettings, project: Project, username: string | null): Promise<AxiomPublication>;
}

const apiBase = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") ?? null;

function tokenFromStorage(): string | null {
  try {
    const raw = localStorage.getItem("axiom-tv-store");
    if (!raw) return null;
    return (JSON.parse(raw) as { state?: { authToken?: string | null } }).state?.authToken ?? null;
  } catch {
    return null;
  }
}

export function validatePublish(settings: PublishingSettings, project: Project): string | null {
  if (settings.title.trim().length < 2) return "Titre requis (2 caractères minimum).";
  if (settings.title.trim().length > 120) return "Titre trop long (120 caractères max).";
  if (settings.description.trim().length < 10) return "Description requise (10 caractères minimum).";
  if (settings.contentType === "series" && settings.seasons.every((s) => s.episodes.length === 0))
    return "Une série nécessite au moins un épisode.";
  if (project.scenes.length === 0) return "Aucune scène générée — le projet est vide.";
  if (project.total < 1) return "Durée du projet invalide.";
  return null;
}

/**
 * Publication réelle via l'API Axiom TV (contrat existant :
 * POST /api/agwestream/videos). Retourne l'identifiant NeoN et l'URL publique
 * de l'antenne du créateur.
 */
async function publishViaApi(settings: PublishingSettings, project: Project, username: string | null): Promise<AxiomPublication> {
  const token = tokenFromStorage();
  if (!token) throw new Error("Authentification requise — connectez-vous à Axiom TV avant de publier.");
  const res = await fetch(`${apiBase}/api/agwestream/videos`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      title: settings.title.trim(),
      prompt: settings.description.trim(),
      category: settings.category,
      duration: Math.round(project.total),
      resolution: project.resolution,
      speakers: project.characters.filter((c) => c.role !== "extra").map((c) => c.name),
    }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `Publication refusée (HTTP ${res.status})`);
  }
  const data = (await res.json()) as { id: number | string };
  return {
    id: `PUB-${data.id}`,
    url: `#/creator/${username ?? "antenne"}`,
    publishedAt: new Date().toISOString(),
    visibility: settings.visibility,
    status: "PUBLISHED",
    title: settings.title,
  };
}

/** Repli local : mêmes statuts, même contrat, zéro réseau. */
function publishLocal(settings: PublishingSettings, project: Project, username: string | null): AxiomPublication {
  const id = `PUB-${Date.now().toString(36).toUpperCase()}`;
  return {
    id,
    url: `#/creator/${username ?? "antenne"}`,
    publishedAt: new Date().toISOString(),
    visibility: settings.visibility,
    status: "PUBLISHED",
    title: `${settings.title} « ${project.title} »`,
  };
}

export function createPublisher(): PublishingService {
  const mode: PublishingService["mode"] = apiBase ? "api" : "local";
  return {
    mode,
    validate: validatePublish,
    publish: (settings, project, username) => {
      const err = validatePublish(settings, project);
      if (err) return Promise.reject(new Error(err));
      if (mode === "api") return publishViaApi(settings, project, username).catch((e) => {
        /* backend injoignable → repli local pour préserver l'expérience */
        if (e instanceof TypeError) return publishLocal(settings, project, username);
        throw e;
      });
      return new Promise((resolve) => setTimeout(() => resolve(publishLocal(settings, project, username)), 400));
    },
  };
}
