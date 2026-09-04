/**
 * Axiom TV — État global (Zustand + persistance locale).
 *
 * Sans backend joint, les sessions sont établies localement ; dès que
 * VITE_API_URL est défini, login/register/me/notifications partent
 * vers l'API Neon (server/index.js) avec un JWT Bearer.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { EMPTY_NOTIFICATIONS, type AppNotification, type Tier } from "../data/axiom";
import type { IntroMetadata } from "../data/content";
import { DEFAULT_INTRO } from "../data/content";

export interface User {
  id?: number;
  username: string;
  displayName: string;
  email: string;
  bio: string;
  avatarUrl?: string;
  bannerUrl?: string;
  verified: boolean;
  tier: Tier;
}

export interface Publication {
  id: string;
  title: string;
  category: string;
  kind: "free" | "ppv";
  price: number;
  status: "processing" | "online";
  views: number;
  revenue: number;
  createdAt: number;
  intro?: IntroMetadata;
}

export interface PaymentMethod {
  id: number;
  gateway: string;
  label: string;
  masked: string;
  isDefault: boolean;
}

export interface ToastItem {
  id: number;
  msg: string;
  kind: "ok" | "warn" | "info";
}

const apiBase = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") ?? null;
export const apiEnabled = () => apiBase !== null;

function tokenFromStorage(): string | null {
  try {
    const raw = localStorage.getItem("axiom-tv-store");
    if (!raw) return null;
    return (JSON.parse(raw) as { state?: { authToken?: string | null } })?.state?.authToken ?? null;
  } catch {
    return null;
  }
}

async function api<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = tokenFromStorage();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts.body && typeof opts.body === "string") headers["Content-Type"] = "application/json";
  const res = await fetch(`${apiBase}${path}`, { ...opts, headers });
  if (!res.ok) {
    let msg = `Erreur ${res.status}`;
    try {
      msg = ((await res.json()) as { error?: string }).error ?? msg;
    } catch { /* corps non-JSON */ }
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

const slug = (email: string) => email.split("@")[0].replace(/[^a-z0-9]/gi, "-").toLowerCase() || "citoyen";
const pretty = (s: string) => s.replace(/[-_.]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

interface Store {
  /* ---- session ---- */
  user: User | null;
  authToken: string | null;
  authModal: "login" | "register" | null;
  openAuth: (m: "login" | "register") => void;
  closeAuth: () => void;
  login: (email: string, password: string) => Promise<string | null>;
  register: (name: string, email: string, password: string) => Promise<string | null>;
  logout: () => void;
  boot: () => Promise<void>;
  setTier: (t: Tier) => void;
  updateLocalUser: (p: Partial<User>) => void;
  updateProfile: (p: Partial<Pick<User, "displayName" | "bio" | "avatarUrl" | "bannerUrl">>) => Promise<string | null>;
  addProfileLink: (link: { platform: string; label: string; url: string }) => Promise<string | null>;
  deleteProfileLink: (id: number) => Promise<string | null>;

  /* ---- notifications ---- */
  notifications: AppNotification[];
  loadNotifications: () => Promise<void>;
  markRead: (id: string) => void;
  markAllRead: () => void;

  /* ---- contenus créateur ---- */
  publications: Publication[];
  addPublication: (p: Publication) => void;
  deletePublication: (id: string) => void;
  paymentMethods: PaymentMethod[];
  addPaymentMethod: (m: PaymentMethod) => void;
  removePaymentMethod: (id: number) => void;
  setDefaultMethod: (id: number) => void;

  /* ---- monétisation ---- */
  agwePack: { videosLeft: number } | null;
  activateAgwePack: () => void;
  consumeAgweVideo: () => void;

  /* ---- intro cinématique ---- */
  introMeta: IntroMetadata;
  setIntroMeta: (m: IntroMetadata) => void;

  /* ---- toasts ---- */
  toasts: ToastItem[];
  toast: (msg: string, kind?: ToastItem["kind"]) => void;
  dismissToast: (id: number) => void;
}

let uid = 1;

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      user: null,
      authToken: null,
      authModal: null,
      openAuth: (m) => set({ authModal: m }),
      closeAuth: () => set({ authModal: null }),

      login: async (email, password) => {
        if (apiEnabled()) {
          try {
            const r = await api<{ token: string; user: { id: number; name: string; username: string; email: string; bio?: string; tier: Tier; verified?: boolean } }>(
              "/api/auth/login",
              { method: "POST", body: JSON.stringify({ email, password }) }
            );
            set({
              user: { id: r.user.id, username: r.user.username, displayName: r.user.name, email: r.user.email, bio: r.user.bio ?? "", verified: !!r.user.verified, tier: r.user.tier ?? "free" },
              authToken: r.token,
            });
            void get().loadNotifications();
            return null;
          } catch (e) {
            return e instanceof Error ? e.message : "Erreur de connexion";
          }
        }
        const u: User = { username: slug(email), displayName: pretty(slug(email)), email, bio: "", verified: false, tier: get().user?.tier ?? "free" };
        set({ user: u, authToken: null, notifications: [] });
        return null;
      },

      register: async (name, email, password) => {
        if (apiEnabled()) {
          try {
            const r = await api<{ token: string; user: { id: number; name: string; username: string; email: string; bio?: string; tier: Tier; verified?: boolean }; welcomeEmail?: boolean }>(
              "/api/auth/register",
              { method: "POST", body: JSON.stringify({ name, email, password }) }
            );
            set({
              user: { id: r.user.id, username: r.user.username, displayName: r.user.name, email: r.user.email, bio: r.user.bio ?? "", verified: !!r.user.verified, tier: r.user.tier ?? "free" },
              authToken: r.token,
            });
            void get().loadNotifications();
            return null;
          } catch (e) {
            return e instanceof Error ? e.message : "Erreur lors de l'inscription";
          }
        }
        const u: User = { username: slug(email), displayName: name.trim(), email, bio: "", verified: false, tier: "free" };
        set({ user: u, authToken: null, notifications: [] });
        return null;
      },

      logout: () => set({ user: null, authToken: null, notifications: [] }),

      boot: async () => {
        if (apiEnabled() && get().authToken) {
          try {
            const r = await api<{ user: { name: string; username: string; email: string; bio?: string; tier: Tier; verified?: boolean } }>("/api/auth/me");
            set({ user: { id: r.user.id, username: r.user.username, displayName: r.user.name, email: r.user.email, bio: r.user.bio ?? "", verified: !!r.user.verified, tier: r.user.tier ?? "free" } });
          } catch {
            set({ user: null, authToken: null });
          }
        }
        if (get().user) void get().loadNotifications();
      },

      setTier: (t) => set((s) => ({ user: s.user ? { ...s.user, tier: t } : s.user })),
      updateLocalUser: (p) => set((s) => ({ user: s.user ? { ...s.user, ...p } : s.user })),
      updateProfile: async (p) => {
        if (!get().user) return "Authentification requise";
        if (apiEnabled() && get().authToken) {
          try {
            const r = await api<{ user: { id: number; username: string; name: string; email: string; bio?: string; tier: Tier; verified?: boolean; avatarUrl?: string | null; bannerUrl?: string | null } }>(
              "/api/profile",
              {
                method: "PATCH",
                body: JSON.stringify({
                  name: p.displayName,
                  bio: p.bio,
                  avatarUrl: p.avatarUrl ?? null,
                  bannerUrl: p.bannerUrl ?? null,
                }),
              }
            );
            set((s) => ({
              user: s.user
                ? {
                    ...s.user,
                    id: r.user.id,
                    username: r.user.username,
                    displayName: r.user.name,
                    email: r.user.email,
                    bio: r.user.bio ?? "",
                    tier: r.user.tier ?? s.user.tier,
                    verified: !!r.user.verified,
                    avatarUrl: r.user.avatarUrl ?? undefined,
                    bannerUrl: r.user.bannerUrl ?? undefined,
                  }
                : s.user,
            }));
            return null;
          } catch (e) {
            return e instanceof Error ? e.message : "Impossible de mettre à jour le profil";
          }
        }
        set((s) => ({ user: s.user ? { ...s.user, ...p } : s.user }));
        return null;
      },

      addProfileLink: async (link) => {
        if (!get().user || !get().authToken || !apiEnabled()) return "Authentification requise";
        try {
          await api("/api/profile/links", { method: "POST", body: JSON.stringify(link) });
          return null;
        } catch (e) {
          return e instanceof Error ? e.message : "Impossible d'ajouter le lien";
        }
      },
      deleteProfileLink: async (id) => {
        if (!get().user || !get().authToken || !apiEnabled()) return "Authentification requise";
        try {
          await api(`/api/profile/links/${id}`, { method: "DELETE" });
          return null;
        } catch (e) {
          return e instanceof Error ? e.message : "Impossible de supprimer le lien";
        }
      },

      notifications: [],
      loadNotifications: async () => {
        if (apiEnabled() && get().authToken) {
          try {
            const r = await api<{ notifications: AppNotification[] }>("/api/notifications");
            set({ notifications: r.notifications });
            return;
          } catch { /* repli local */ }
        }
        if (get().user && get().notifications.length === 0) set({ notifications: EMPTY_NOTIFICATIONS });
      },
      markRead: (id) => {
        set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) }));
        if (apiEnabled() && get().authToken) api(`/api/notifications/${id}/read`, { method: "POST" }).catch(() => {});
      },
      markAllRead: () => {
        set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) }));
        if (apiEnabled() && get().authToken) api("/api/notifications/read-all", { method: "POST" }).catch(() => {});
      },

      publications: [],
      addPublication: (p) => set((s) => ({ publications: [p, ...s.publications] })),
      deletePublication: (id) => set((s) => ({ publications: s.publications.filter((p) => p.id !== id) })),
      paymentMethods: [],
      addPaymentMethod: (m) => set((s) => ({ paymentMethods: [...s.paymentMethods, m] })),
      removePaymentMethod: (id) => set((s) => ({ paymentMethods: s.paymentMethods.filter((m) => m.id !== id) })),
      setDefaultMethod: (id) => set((s) => ({ paymentMethods: s.paymentMethods.map((m) => ({ ...m, isDefault: m.id === id })) })),

      agwePack: null,
      activateAgwePack: () => set({ agwePack: { videosLeft: 15 } }),
      consumeAgweVideo: () =>
        set((s) => ({ agwePack: s.agwePack ? { videosLeft: Math.max(0, s.agwePack.videosLeft - 1) } : null })),

      introMeta: { ...DEFAULT_INTRO },
      setIntroMeta: (m) => set({ introMeta: m }),

      toasts: [],
      toast: (msg, kind = "info") => {
        const id = Date.now() + uid++;
        set((s) => ({ toasts: [...s.toasts.slice(-3), { id, msg, kind }] }));
        setTimeout(() => get().dismissToast(id), 4200);
      },
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    }),
    {
      name: "axiom-tv-store",
      partialize: (s) => ({
        user: s.user,
        authToken: s.authToken,
        publications: s.publications,
        paymentMethods: s.paymentMethods,
        agwePack: s.agwePack,
        introMeta: s.introMeta,
      }),
    }
  )
);

export const useToast = () => useStore((s) => s.toast);
