/**
 * AGWÈSTREAM — PreviewEngine & ProjectRenderer.
 *
 * Construit un `Project` exécutable à partir des données existantes
 * (scénario parsé, timeline, casting, contraintes de scènes du moteur QA)
 * et rend chaque frame sur canvas : décors, personnages, sous-titres,
 * effets, slate d'intro et overlays QA. Aucun asset externe.
 */
import type { CleanupOptions, ParsedLine, Timeline } from "../data/content";
import type { CastMember } from "../lib/scenario";
import { planScenes, scoreScene, type ScoringContext } from "./engines";
import { ENGINE_DEFS, type EngineId, type SceneConstraint } from "./models";
import { ENVIRONMENTS, type RenderMode } from "./vfx";

/* ================= Modèle Project ================= */

export interface IntroMode {
  id: "agwe" | "axiom" | "both" | "none";
  label: string;
}

export const INTRO_MODES: IntroMode[] = [
  { id: "agwe", label: "AgwèStream présente" },
  { id: "axiom", label: "Axiom TV présente" },
  { id: "both", label: "AgwèStream × Axiom TV présentent" },
  { id: "none", label: "Aucun intro" },
];

export const INTRO_DURATION = 2.8;

export interface ProjectDialogue {
  start: number;
  duration: number;
  text: string;
  character: string;
  color: string;
  tone: string;
}

export interface ProjectScene extends SceneConstraint {
  quality: number;
  status: "READY" | "REVIEW" | "BLOCKED";
  envId: string;
  mode: RenderMode;
}

export interface Project {
  title: string;
  fps: number;
  resolution: string;
  language: string;
  total: number;
  introMode: IntroMode["id"];
  introOffset: number;
  scenes: ProjectScene[];
  dialogues: ProjectDialogue[];
  characters: { name: string; color: string; role: string; zone: string }[];
  globalScore: number | null;
}

/* ================= Construction ================= */

const ACTION_SCENES = /poursuit|course|voiture|tir|explos|flamme|fum[eé]e|sprint|combat|crash/i;

function envFor(scene: SceneConstraint, fallback: string): string {
  const text = `${scene.label} ${scene.location} ${scene.environment}`.toLowerCase();
  const map: [RegExp, string][] = [
    [/restaurant|d[iî]ne|table.*nappe/, "resto"],
    [/bureau|panoram|baie/, "bureau"],
    [/salon|canap|lamp/, "salon"],
    [/chambre|matin|lit/, "chambre"],
    [/rue|pi[eé]tonn|pav[eé]/, "rue"],
    [/poursuit|course|asphalte|route/, "poursuite"],
    [/tir|fusillade|impact/, "fusillade"],
    [/flamme|incendie|feu|fum[eé]e/, "incendie"],
    [/ville|m[eé]tropole|n[eé]on|urbain/, "urbain"],
  ];
  for (const [re, id] of map) if (re.test(text)) return id;
  return ENVIRONMENTS.some((e) => e.id === fallback) ? fallback : "salon";
}

export function buildProject(opts: {
  title: string;
  parsed: ParsedLine[];
  timeline: Timeline;
  cast: CastMember[];
  unassigned: string[];
  hasAudio: boolean;
  cleanup: CleanupOptions;
  samplingRate: number;
  introMode: IntroMode["id"];
  vfxEnv: string;
  vfxMode: RenderMode;
  resolution: string;
  language: string;
}): Project {
  const ctx: ScoringContext = { unassigned: opts.unassigned, hasAudio: opts.hasAudio, cleanup: opts.cleanup, samplingRate: opts.samplingRate };
  const planned = planScenes(opts.parsed, opts.timeline, opts.cast);
  const offset = opts.introMode === "none" ? 0 : INTRO_DURATION;

  const scenes: ProjectScene[] = planned.map((s) => {
    const scores = ENGINE_DEFS.slice(0, 10).map((e) => scoreScene(s, e.id as EngineId, ctx));
    const quality = scores.reduce((a, b) => a + b, 0) / scores.length;
    const isAction = ACTION_SCENES.test(`${s.label} ${s.actions.map((a) => a.action).join(" ")}`);
    return {
      ...s,
      start: s.start + offset,
      end: s.end + offset,
      quality,
      status: quality >= 92 ? "READY" : quality >= 85 ? "REVIEW" : "BLOCKED",
      envId: envFor(s, opts.vfxEnv),
      mode: isAction ? "action" : opts.vfxMode,
    };
  });

  const dialogues: ProjectDialogue[] = opts.timeline.entries
    .filter((e) => e.kind === "dialogue")
    .map((e) => ({
      start: e.start + offset,
      duration: e.duration,
      text: e.label ?? "",
      character: e.characterName ?? "?",
      color: e.color ?? "#00e5ff",
      tone: e.tone ?? "calme",
    }));

  const total = opts.timeline.total + offset;
  const globalScore = scenes.length ? scenes.reduce((a, s) => a + s.quality, 0) / scenes.length : null;

  return {
    title: opts.title,
    fps: 24,
    resolution: opts.resolution,
    language: opts.language,
    total,
    introMode: opts.introMode,
    introOffset: offset,
    scenes,
    dialogues,
    characters: opts.cast.filter((c) => c.enabled !== false).map((c) => ({ name: c.name, color: c.color, role: c.role ?? "actor", zone: c.zone ?? "mid" })),
    globalScore,
  };
}

/* ================= Rendu canvas ================= */

export interface RenderOpts {
  fx: string[];
  dof: number;
  quality: number; // 1 = plein
  captions: boolean;
  envOverride?: string;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (Math.imul(a, 1664525) + 1013904223) >>> 0;
    return a / 4294967296;
  };
}

const ZONE_Y: Record<string, number> = { back: 0.62, mid: 0.72, front: 0.85 };
const ZONE_S: Record<string, number> = { back: 0.55, mid: 0.8, front: 1.05 };

function drawEnvironment(ctx: CanvasRenderingContext2D, w: number, h: number, envId: string, mode: RenderMode, t: number, fx: string[], dof: number) {
  const env = ENVIRONMENTS.find((e) => e.id === envId) ?? ENVIRONMENTS[2];
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, env.sky[0]);
  sky.addColorStop(1, env.sky[1]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  const horizon = h * 0.6;
  const rand = rng(hash(envId));

  if (mode === "action") {
    /* silhouettes urbaines défilantes */
    const scroll = (t * (envId === "poursuite" ? 260 : 60)) % w;
    ctx.fillStyle = "rgba(0,0,0,0.42)";
    for (let i = -1; i < 14; i++) {
      const bw = 60 + rand() * 90;
      const bh = 90 + rand() * (h * 0.32);
      const x = ((i * 130 - scroll) % (w + 260)) - 130;
      ctx.fillRect(x, horizon - bh, bw, bh);
      /* fenêtres */
      ctx.fillStyle = `${env.accent}22`;
      for (let wy = 0; wy < 5; wy++) for (let wx = 0; wx < 3; wx++) ctx.fillRect(x + 10 + wx * 18, horizon - bh + 14 + wy * 26, 8, 12);
      ctx.fillStyle = "rgba(0,0,0,0.42)";
    }
    /* route */
    ctx.fillStyle = "#0a0c12";
    ctx.fillRect(0, horizon, w, h - horizon);
    const lane = (t * 420) % 120;
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 4;
    ctx.setLineDash([46, 74]);
    ctx.lineDashOffset = -lane;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.8);
    ctx.lineTo(w, h * 0.8);
    ctx.stroke();
    ctx.setLineDash([]);
    if (fx.includes("speed")) {
      ctx.strokeStyle = "rgba(255,255,255,0.16)";
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 16; i++) {
        const y = rand() * h;
        const len = 80 + rand() * 220;
        const x = ((rand() * w - t * 900) % (w + len)) + w;
        ctx.beginPath();
        ctx.moveTo(x % (w + len), y);
        ctx.lineTo((x % (w + len)) - len, y);
        ctx.stroke();
      }
    }
    if (fx.includes("sparks") || fx.includes("muzzle")) {
      for (let i = 0; i < 12; i++) {
        const phase = (t * 3 + i * 1.7) % 1.4;
        if (phase > 0.5) continue;
        const x = (rand() * 0.8 + 0.1) * w;
        const y = (rand() * 0.4 + 0.35) * h;
        const r = (0.5 - phase) * 26;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, "rgba(255,220,140,0.9)");
        g.addColorStop(1, "rgba(255,120,40,0)");
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
    }
    if (fx.includes("smoke") || fx.includes("fire")) {
      for (let i = 0; i < 5; i++) {
        const x = ((i * 0.22 + 0.08) * w + Math.sin(t * 0.6 + i) * 26);
        const y = horizon - 30 - ((t * 26 + i * 60) % 160);
        const r = 34 + i * 12;
        ctx.fillStyle = fx.includes("fire") ? "rgba(255,110,50,0.10)" : "rgba(150,160,175,0.10)";
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else {
    /* sol intérieur */
    const floor = ctx.createLinearGradient(0, horizon, 0, h);
    floor.addColorStop(0, "rgba(0,0,0,0.28)");
    floor.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = floor;
    ctx.fillRect(0, horizon, w, h - horizon);
    /* perspective douce */
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.moveTo(w / 2 + (i - 3) * 30, horizon);
      ctx.lineTo(w / 2 + (i - 3) * 190, h);
      ctx.stroke();
    }
    /* bokeh / sources lumineuses chaudes */
    if (fx.includes("bokeh") || fx.includes("flicker") || dof > 0.4) {
      for (let i = 0; i < 14; i++) {
        const x = rand() * w;
        const y = rand() * horizon * 0.9;
        const r = (6 + rand() * 26) * (0.6 + dof);
        const flick = fx.includes("flicker") ? 0.5 + 0.5 * Math.sin(t * 5 + i * 2.4) : 1;
        ctx.fillStyle = `${env.accent}${Math.round(14 * flick).toString(16).padStart(2, "0")}`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (fx.includes("reflect")) {
      ctx.fillStyle = "rgba(255,255,255,0.045)";
      ctx.beginPath();
      ctx.moveTo(w * 0.62, horizon);
      ctx.lineTo(w * 0.78, horizon);
      ctx.lineTo(w * 0.7, h);
      ctx.lineTo(w * 0.55, h);
      ctx.closePath();
      ctx.fill();
    }
    if (fx.includes("dust")) {
      for (let i = 0; i < 26; i++) {
        const x = (rand() * w + t * 8 * (i % 3)) % w;
        const y = (rand() * h + Math.sin(t + i) * 14 + h) % h;
        ctx.fillStyle = "rgba(255,255,255,0.14)";
        ctx.fillRect(x, y, 1.4, 1.4);
      }
    }
  }
}

function drawCharacter(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  x: number,
  zone: string,
  color: string,
  name: string,
  t: number,
  seed: number
) {
  const s = ZONE_S[zone] ?? 0.8;
  const baseY = h * (ZONE_Y[zone] ?? 0.72);
  const sway = Math.sin(t * 1.6 + seed) * 3 * s;
  const headR = 30 * s;
  const cx = x * w + sway;

  /* corps */
  ctx.fillStyle = "#0b0f18";
  ctx.beginPath();
  ctx.moveTo(cx - 62 * s, baseY + 190 * s);
  ctx.quadraticCurveTo(cx - 50 * s, baseY + 8 * s, cx, baseY - 4 * s);
  ctx.quadraticCurveTo(cx + 50 * s, baseY + 8 * s, cx + 62 * s, baseY + 190 * s);
  ctx.closePath();
  ctx.fill();
  /* tête */
  ctx.beginPath();
  ctx.ellipse(cx, baseY - headR * 1.25, headR * 0.82, headR, 0, 0, Math.PI * 2);
  ctx.fill();
  /* rim light */
  ctx.strokeStyle = `${color}cc`;
  ctx.lineWidth = 2.2 * s;
  ctx.beginPath();
  ctx.ellipse(cx - headR * 0.12, baseY - headR * 1.25, headR * 0.82, headR, 0, Math.PI * 0.7, Math.PI * 1.55);
  ctx.stroke();
  /* halo au sol */
  const g = ctx.createRadialGradient(cx, baseY + 185 * s, 0, cx, baseY + 185 * s, 90 * s);
  g.addColorStop(0, `${color}22`);
  g.addColorStop(1, "transparent");
  ctx.fillStyle = g;
  ctx.fillRect(cx - 100 * s, baseY + 120 * s, 200 * s, 130 * s);
}

export function drawRawTake(ctx: CanvasRenderingContext2D, w: number, h: number, chars: Project["characters"], t: number) {
  /* prise brute : pièce neutre, acteur assis sur chaise, lumière plate */
  ctx.fillStyle = "#15181e";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#1b1f27";
  ctx.fillRect(0, h * 0.66, w, h * 0.34);
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.strokeRect(w * 0.08, h * 0.12, w * 0.3, h * 0.4);
  const actors = chars.filter((c) => c.role !== "extra").slice(0, 3);
  actors.forEach((c, i) => {
    const cx = w * (0.28 + i * 0.22);
    const cy = h * 0.56;
    /* chaise */
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 3;
    ctx.strokeRect(cx - 34, cy + 40, 68, 8);
    ctx.beginPath();
    ctx.moveTo(cx - 30, cy + 48);
    ctx.lineTo(cx - 30, cy + 120);
    ctx.moveTo(cx + 30, cy + 48);
    ctx.lineTo(cx + 30, cy + 120);
    ctx.stroke();
    /* silhouette assise */
    ctx.fillStyle = "#0d1015";
    ctx.beginPath();
    ctx.ellipse(cx, cy - 34, 22, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx - 30, cy - 10, 60, 56);
    ctx.strokeStyle = `${c.color}88`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(cx, cy - 34, 22, 26, 0, Math.PI * 0.75, Math.PI * 1.6);
    ctx.stroke();
  });
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "600 11px 'IBM Plex Mono', monospace";
  ctx.fillText(`PRISE BRUTE · ${new Date(t * 1000).toISOString().slice(14, 19)}`, 14, h - 14);
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  project: Project,
  t: number,
  opts: RenderOpts
) {
  /* ---- slate d'intro ---- */
  if (t < project.introOffset) {
    const p = t / project.introOffset;
    ctx.fillStyle = "#04060b";
    ctx.fillRect(0, 0, w, h);
    const fade = p < 0.2 ? p / 0.2 : p > 0.85 ? (1 - p) / 0.15 : 1;
    const line = INTRO_MODES.find((m) => m.id === project.introMode)?.label ?? "";
    ctx.globalAlpha = Math.max(0, Math.min(1, fade));
    /* monogramme */
    ctx.strokeStyle = "#00e5ff";
    ctx.lineWidth = 3;
    const cx = w / 2;
    const cy = h / 2 - 26;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 44);
    ctx.lineTo(cx + 40, cy - 21);
    ctx.lineTo(cx + 40, cy + 25);
    ctx.lineTo(cx, cy + 48);
    ctx.lineTo(cx - 40, cy + 25);
    ctx.lineTo(cx - 40, cy - 21);
    ctx.closePath();
    ctx.stroke();
    ctx.font = "700 44px Cinzel, serif";
    ctx.fillStyle = "#e8eef7";
    ctx.textAlign = "center";
    ctx.fillText("A", cx, cy + 16);
    ctx.font = "600 15px 'Chakra Petch', sans-serif";
    ctx.fillStyle = "#8b98ab";
    ctx.fillText(line.toUpperCase(), cx, cy + 86);
    ctx.textAlign = "left";
    ctx.globalAlpha = 1;
    letterbox(ctx, w, h);
    return;
  }

  const local = t - project.introOffset;
  const scene = project.scenes.find((s) => local >= s.start - project.introOffset && local < s.end - project.introOffset) ?? project.scenes[project.scenes.length - 1];
  const envId = opts.envOverride ?? scene?.envId ?? "salon";
  const mode: RenderMode = scene?.mode ?? "intimate";

  drawEnvironment(ctx, w, h, envId, mode, local, opts.fx, opts.dof);

  /* ---- personnages (figurants d'abord, puis acteurs) ---- */
  const ordered = [...project.characters].sort((a, b) => (ZONE_Y[a.zone] ?? 0.7) - (ZONE_Y[b.zone] ?? 0.7));
  ordered.forEach((c, i) => {
    const isExtra = c.role === "extra";
    const x = isExtra ? 0.08 + ((i * 0.37 + hash(c.name) % 10) / 10) * 0.84 : 0.24 + i * 0.18;
    const zone = isExtra ? "back" : c.zone;
    ctx.globalAlpha = isExtra ? 0.55 : 1;
    drawCharacter(ctx, w, h, Math.min(0.92, x), zone, c.color, c.name, local, hash(c.name));
    ctx.globalAlpha = 1;
  });

  /* ---- sous-titres ---- */
  if (opts.captions) {
    const d = project.dialogues.find((dd) => t >= dd.start && t <= dd.start + dd.duration);
    if (d) {
      ctx.font = "600 15px 'Manrope', sans-serif";
      const text = `${d.character} — « ${d.text} »`;
      const tw = Math.min(ctx.measureText(text).width + 28, w - 60);
      ctx.fillStyle = "rgba(4,6,11,0.78)";
      const bx = (w - tw) / 2;
      const by = h - 86;
      ctx.beginPath();
      ctx.roundRect(bx, by, tw, 32, 8);
      ctx.fill();
      ctx.fillStyle = "#e8eef7";
      ctx.textAlign = "center";
      ctx.fillText(text.length > 90 ? text.slice(0, 88) + "…" : text, w / 2, by + 21);
      ctx.textAlign = "left";
      ctx.fillStyle = d.color;
      ctx.fillRect(bx, by, 3, 32);
    }
  }

  /* ---- finition cinéma ---- */
  const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, h * 0.95);
  vg.addColorStop(0, "transparent");
  vg.addColorStop(1, "rgba(0,0,0,0.5)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
  /* grain léger */
  const g = rng(Math.floor(local * 24));
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  for (let i = 0; i < 40; i++) ctx.fillRect(g() * w, g() * h, 1, 1);
  letterbox(ctx, w, h);
}

function letterbox(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const bar = h * 0.075;
  ctx.fillStyle = "#020308";
  ctx.fillRect(0, 0, w, bar);
  ctx.fillRect(0, h - bar, w, bar);
}

/* ================= Moteur de miniatures ================= */

export interface ThumbConfig {
  source: "auto" | "extract" | "ai" | "upload";
  time: number;
  zoom: number;
  offsetX: number; // -1..1
  offsetY: number;
  uploadUrl: string | null;
}

export const DEFAULT_THUMB: ThumbConfig = { source: "auto", time: -1, zoom: 1, offsetX: 0, offsetY: 0, uploadUrl: null };

function artFromTitle(title: string, w: number, h: number): { css: string; accent: string } {
  const r = rng(hash(title.toLowerCase()));
  const palettes = [
    { sky: ["#0a1220", "#16293f"], accent: "#00e5ff" },
    { sky: ["#1a0e08", "#3a1a0c"], accent: "#ff7a3d" },
    { sky: ["#120a20", "#2a163f"], accent: "#9d4edd" },
    { sky: ["#0c1a12", "#14331f"], accent: "#34d399" },
    { sky: ["#20160a", "#3f2c14"], accent: "#f5c542" },
  ];
  const p = palettes[Math.floor(r() * palettes.length)];
  return { css: `${p.sky[0]}|${p.sky[1]}`, accent: p.accent };
}

export function makeThumbnail(project: Project, cfg: ThumbConfig, opts: RenderOpts, w = 640, h = 360): string {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return "";

  if (cfg.source === "upload" && cfg.uploadUrl) {
    /* dessin synchrone impossible pour une image non chargée — le composant précharge */
    ctx.fillStyle = "#0a0e14";
    ctx.fillRect(0, 0, w, h);
  } else if (cfg.source === "ai") {
    const art = artFromTitle(project.title, w, h);
    const [c1, c2] = art.css.split("|");
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, c1);
    g.addColorStop(1, c2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const r = rng(hash(project.title));
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = i % 4 === 0 ? `${art.accent}55` : "rgba(255,255,255,0.16)";
      ctx.beginPath();
      ctx.arc(r() * w, r() * h, r() * 2 + 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.font = "700 34px Cinzel, serif";
    ctx.fillStyle = "#e8eef7";
    ctx.textAlign = "center";
    ctx.shadowColor = art.accent;
    ctx.shadowBlur = 22;
    ctx.fillText(project.title.toUpperCase().slice(0, 26), w / 2, h / 2 + 12);
    ctx.shadowBlur = 0;
    ctx.textAlign = "left";
  } else {
    const time = cfg.time >= 0 ? cfg.time : bestFrameTime(project);
    renderFrame(ctx, w, h, project, time, opts);
  }

  /* recadrage / positionnement */
  if (cfg.zoom > 1 || cfg.offsetX !== 0 || cfg.offsetY !== 0) {
    const snap = ctx.getImageData(0, 0, w, h);
    const tmp = document.createElement("canvas");
    tmp.width = w;
    tmp.height = h;
    tmp.getContext("2d")!.putImageData(snap, 0, 0);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    const dw = w * cfg.zoom;
    const dh = h * cfg.zoom;
    const maxOx = (dw - w) / 2;
    const maxOy = (dh - h) / 2;
    ctx.drawImage(tmp, (w - dw) / 2 - cfg.offsetX * maxOx, (h - dh) / 2 - cfg.offsetY * maxOy, dw, dh);
  }

  /* habillage */
  ctx.fillStyle = "rgba(2,3,8,0.55)";
  ctx.fillRect(0, h - 46, w, 46);
  ctx.font = "700 15px 'Chakra Petch', sans-serif";
  ctx.fillStyle = "#e8eef7";
  ctx.fillText(project.title.slice(0, 48), 14, h - 26);
  ctx.font = "600 10px 'IBM Plex Mono', monospace";
  ctx.fillStyle = "#00e5ff";
  ctx.fillText(`AGWÈSTREAM · ${fmtClock(project.total)} · ${project.resolution}`, 14, h - 11);
  return c.toDataURL("image/jpeg", 0.88);
}

export function bestFrameTime(project: Project): number {
  const best = [...project.scenes].sort((a, b) => b.quality - a.quality)[0];
  return best ? (best.start + best.end) / 2 : project.introOffset + 1;
}

export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function fmtTimecode(sec: number, fps = 24): string {
  const s = Math.max(0, sec);
  const f = String(Math.floor((s % 1) * fps)).padStart(2, "0");
  return `${fmtClock(s)}:${f}`;
}
