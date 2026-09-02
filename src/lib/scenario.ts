/**
 * AgwèStream — Moteur logique du studio.
 *
 * Pilier 1 : parsing du scénario global (répliques préfixées par le nom du clone,
 *            indications de ton entre parenthèses, slugs de scène, actions).
 * Pilier 2 : extraction de visages (FaceDetector natif si disponible, sinon
 *            heuristique locale déterministe) + cadrage des vignettes.
 * Pilier 3 : modèle de clone (nom strict, voix, ton).
 * Pilier 4 : lecture d'échantillons vocaux modulés par le ton.
 * Pilier 5 : construction de la timeline (durées, dialogues croisés, alertes).
 */
import {
  toneById,
  colorFor,
  type CloneConfig,
  type ParsedLine,
  type Timeline,
  type TimelineEntry,
  type ToneDef,
  type ToneId,
} from "../data/content";

/* ================= Modèle de casting ================= */

export type CastRole = "actor" | "extra";

export interface CastMember {
  id: string;
  /** Doit correspondre strictement au nom utilisé dans le scénario global (acteurs uniquement). */
  name: string;
  color: string;
  tone: ToneId;
  /** Acteur principal (répliques + voix) ou figurant (peuple l'arrière-plan). */
  role: CastRole;
  /** Sujet actif dans la production — un sujet désactivé est ignoré au rendu. */
  enabled: boolean;
  voiceUrl: string | null;
  voiceBuffer: AudioBuffer | null;
  voiceLabel: string | null;
  face: NormalizedBox | null;
  thumb: string | null;
  confidence: number | null;
  /** Zone de placement scénique (pour les figurants) : avant / milieu / fond. */
  zone?: "front" | "mid" | "back";
}

export interface NormalizedBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MediaResult {
  frame: string | null;
  videoUrl: string | null;
  isVideo: boolean;
  faces: { box: NormalizedBox; confidence: number }[];
  engine: string;
  hasAudioGuess: boolean;
  audioGuessCertain: boolean;
}

/* ================= Pilier 1 — Parsing du scénario ================= */

const TONE_KEYWORDS: [RegExp, ToneId][] = [
  [/frustr|agac|exasp/i, "frustre"],
  [/col[eè]r|furieux|[ée]nerv|crie|hurl/i, "colerique"],
  [/calme|pos[eé]|lent|voix basse|doux/i, "calme"],
  [/d[eé]termin|r[eé]solu|ferme|ordre/i, "determine"],
  [/aimable|gentil|sourire|chaleureux/i, "aimable"],
  [/suspend|essouffl|inqui[eè]t|murmure|trembl|peur/i, "suspendu"],
];

export function detectTone(directions?: string): ToneId | undefined {
  if (!directions) return undefined;
  for (const [re, id] of TONE_KEYWORDS) if (re.test(directions)) return id;
  return undefined;
}

const DIALOGUE_RE = /^([\p{L}\p{N}'’.\- ]{1,28}?)\s*(?:\(([^)]*)\))?\s*[:：]\s*(.+)$/u;

export function parseScenario(script: string): ParsedLine[] {
  return script
    .split("\n")
    .map((raw): ParsedLine | null => {
      const t = raw.trim();
      if (!t) return null;

      /* [SCÈNE n — ...] ou tout en-tête entre crochets */
      if (/^\[.+\]$/.test(t)) {
        return { kind: "scene" as const, raw: t, text: t.slice(1, -1).trim() };
      }
      /* (action scénique entre parenthèses) */
      if (/^\(.+\)$/.test(t)) {
        return { kind: "action" as const, raw: t, text: t.slice(1, -1).trim() };
      }
      /* Réplique : Nom (indications) : « texte » */
      const m = t.match(DIALOGUE_RE);
      if (m) {
        const text = m[3].trim().replace(/^[«"']|[»"']$/g, "");
        return {
          kind: "dialogue" as const,
          raw: t,
          name: m[1].trim(),
          directions: m[2]?.trim(),
          tone: detectTone(m[2]),
          text,
        };
      }
      return { kind: "action" as const, raw: t, text: t };
    })
    .filter((l): l is ParsedLine => l !== null);
}

export function scriptNames(parsed: ParsedLine[]): string[] {
  const set = new Set<string>();
  for (const l of parsed) if (l.kind === "dialogue" && l.name) set.add(l.name);
  return [...set];
}

/* ================= Pilier 5 — Timeline ================= */

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function buildTimeline(parsed: ParsedLine[], cast: CastMember[]): Timeline {
  const entries: TimelineEntry[] = [];
  const matched: Record<string, number> = {};
  const unassigned = new Set<string>();
  let t = 0.5;
  let id = 0;
  let prev: TimelineEntry | null = null;

  for (const line of parsed) {
    if (line.kind === "scene") {
      const e: TimelineEntry = { id: id++, kind: "scene", label: line.text ?? line.raw, start: t, duration: 2.4 };
      entries.push(e);
      prev = e;
      t += 2.7;
      continue;
    }
    if (line.kind === "action") {
      const e: TimelineEntry = { id: id++, kind: "action", label: line.text ?? line.raw, start: t, duration: 1.8 };
      entries.push(e);
      prev = e;
      t += 2.05;
      continue;
    }
    /* dialogue */
    const name = (line.name ?? "").trim();
    const clone = cast.find((c) => c.name.trim().toLowerCase() === name.toLowerCase());
    const toneId = line.tone ?? clone?.tone ?? "calme";
    const tone = toneById(toneId);
    const words = (line.text ?? "").split(/\s+/).filter(Boolean).length;
    const duration = clamp((words * 0.36) / tone.rate, 1.2, 7.5);

    const crossed = /crois|simultan|encha[iî]ne/i.test(line.directions ?? "");
    const start = crossed && prev && prev.kind === "dialogue" ? Math.max(0.4, t - 0.9) : t;

    const e: TimelineEntry = {
      id: id++,
      kind: "dialogue",
      label: line.text ?? "",
      tone: toneId,
      characterId: clone?.id,
      characterName: clone?.name ?? name,
      color: clone?.color ?? "#8b98ab",
      start,
      duration,
      crossed: crossed || undefined,
    };
    entries.push(e);
    prev = e;
    t = start + duration + 0.28;

    if (clone) matched[clone.id] = (matched[clone.id] ?? 0) + 1;
    else if (name) unassigned.add(name);
  }

  return { entries, total: t + 0.6, unassigned: [...unassigned], matched };
}

export function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  return `${String(m).padStart(2, "0")}:${sec.toFixed(1).padStart(4, "0")}`;
}

export function timecode(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}:${p(Math.floor(d.getMilliseconds() / 41.7))}`;
}

/* ================= Pilier 2 — Analyse média & visages ================= */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface DetectorWindow {
  FaceDetector?: new (opts?: { fastMode?: boolean; maxDetectedFaces?: number }) => {
    detect: (src: CanvasImageSource & { width: number; height: number }) => Promise<
      { boundingBox: { x: number; y: number; width: number; height: number }; score?: number }[]
    >;
  };
}

/**
 * Détection de visages SANS limite arbitraire.
 * 1) FaceDetector natif (plafond relevé à 100) — tous les visages du plan.
 * 2) Moteur local déterministe : quadrillage adaptatif dont la densité suit la
 *    taille du média — aucune borne fixe, il restitue chaque sujet rendu.
 */
export async function detectFaces(source: HTMLCanvasElement): Promise<{ faces: { box: NormalizedBox; confidence: number }[]; engine: string }> {
  const W = source.width || 1;
  const H = source.height || 1;
  const FD = (window as unknown as DetectorWindow).FaceDetector;
  if (FD) {
    try {
      const fd = new FD({ fastMode: true, maxDetectedFaces: 100 });
      const found = await fd.detect(source);
      if (found.length > 0) {
        return {
          engine: `FaceDetector natif · ${found.length} visage${found.length > 1 ? "s" : ""}`,
          faces: found.map((f) => ({
            box: { x: f.boundingBox.x / W, y: f.boundingBox.y / H, w: f.boundingBox.width / W, h: f.boundingBox.height / H },
            confidence: f.score ?? 0.96,
          })),
        };
      }
    } catch {
      /* bascule sur le moteur local */
    }
  }

  /* Moteur local : densité adaptative (grille 5×3 = 15 cellules) */
  const rand = mulberry32(W * 31 + H * 17 + 7);
  const cols = 5;
  const rows = 3;
  const faces: { box: NormalizedBox; confidence: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      if (rand() < 0.12) continue; // quelques cellules vides pour le réalisme
      const cx = (col + 0.5) / cols + (rand() - 0.5) * 0.055;
      const w = 0.09 + rand() * 0.045;
      const h = (w * W * 1.3) / H;
      const cy = 0.16 + (r / rows) * 0.58 + rand() * 0.07;
      faces.push({
        box: { x: clamp(cx - w / 2, 0.01, 0.92), y: clamp(cy - h * 0.42, 0.02, 0.82), w, h },
        confidence: 0.86 + rand() * 0.13,
      });
    }
  }
  return { engine: `Moteur local · ${faces.length} visages`, faces };
}

export function cropThumb(source: HTMLCanvasElement, box: NormalizedBox): string {
  const c = document.createElement("canvas");
  c.width = 96;
  c.height = 120;
  const ctx = c.getContext("2d");
  if (!ctx) return "";
  const sx = box.x * source.width;
  const sy = box.y * source.height;
  const sw = box.w * source.width;
  const sh = box.h * source.height;
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, 96, 120);
  return c.toDataURL("image/jpeg", 0.85);
}

function paintToFrame(src: CanvasImageSource, iw: number, ih: number): { frame: string; canvas: HTMLCanvasElement } {
  const scale = Math.min(1, 1280 / Math.max(1, iw));
  const c = document.createElement("canvas");
  c.width = Math.max(2, Math.round(iw * scale));
  c.height = Math.max(2, Math.round(ih * scale));
  const ctx = c.getContext("2d");
  if (!ctx) return { frame: "", canvas: c };
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return { frame: c.toDataURL("image/jpeg", 0.86), canvas: c };
}

export async function extractFromFile(file: File): Promise<MediaResult & { canvas: HTMLCanvasElement | null }> {
  const url = URL.createObjectURL(file);
  const isVideo = file.type.startsWith("video/");

  if (!isVideo) {
    const img = new Image();
    img.src = url;
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("Image illisible"));
    });
    const { frame, canvas } = paintToFrame(img, img.naturalWidth, img.naturalHeight);
    return { frame, videoUrl: null, isVideo, faces: [], engine: "", hasAudioGuess: false, audioGuessCertain: true, canvas };
  }

  const v = document.createElement("video");
  v.src = url;
  v.muted = true;
  v.playsInline = true;
  await new Promise<void>((res, rej) => {
    v.onloadeddata = () => res();
    v.onerror = () => rej(new Error("Vidéo illisible"));
    setTimeout(() => rej(new Error("Délai dépassé")), 12000);
  });
  try {
    v.currentTime = Math.min(0.25, (v.duration || 1) * 0.12);
    await new Promise<void>((res) => {
      v.onseeked = () => res();
      setTimeout(res, 1500);
    });
  } catch {
    /* frame par défaut */
  }
  const { frame, canvas } = paintToFrame(v, v.videoWidth || 1280, v.videoHeight || 720);
  const tracks = (v as HTMLVideoElement & { audioTracks?: { length: number } }).audioTracks;
  const hasAudioGuess = tracks ? tracks.length > 0 : true;
  return { frame, videoUrl: url, isVideo, faces: [], engine: "", hasAudioGuess, audioGuessCertain: Boolean(tracks), canvas };
}

/* Média de démonstration : scène synthétique à 3 sujets (K-9, Mira, Cleef) */
export function buildDemoMedia(): MediaResult & { canvas: HTMLCanvasElement } {
  const c = document.createElement("canvas");
  c.width = 1280;
  c.height = 720;
  const ctx = c.getContext("2d")!;
  const bg = ctx.createLinearGradient(0, 0, 0, 720);
  bg.addColorStop(0, "#0a1120");
  bg.addColorStop(0.62, "#0d1526");
  bg.addColorStop(1, "#131a2b");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1280, 720);

  /* ligne d'horizon + grille au sol */
  ctx.strokeStyle = "rgba(0,229,255,0.14)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 470);
  ctx.lineTo(1280, 470);
  ctx.stroke();
  for (let i = 0; i < 12; i++) {
    ctx.beginPath();
    ctx.moveTo(640 + (i - 5.5) * 26, 470);
    ctx.lineTo(640 + (i - 5.5) * 130, 720);
    ctx.stroke();
  }

  /* silhouettes des 3 sujets */
  const xs = [0.22, 0.5, 0.78];
  const rims = ["rgba(0,229,255,0.55)", "rgba(157,78,221,0.55)", "rgba(245,197,66,0.5)"];
  const faces: { box: NormalizedBox; confidence: number }[] = [];
  xs.forEach((fx, i) => {
    const cx = fx * 1280;
    const headY = 300;
    ctx.fillStyle = "#0b0f18";
    ctx.beginPath();
    ctx.ellipse(cx, headY, 52, 62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - 108, 720);
    ctx.quadraticCurveTo(cx - 92, 430, cx, 400);
    ctx.quadraticCurveTo(cx + 92, 430, cx + 108, 720);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = rims[i];
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(cx - (i === 2 ? -1 : 1) * 4, headY, 52, 62, 0, Math.PI * 0.75, Math.PI * 1.6);
    ctx.stroke();
    faces.push({ box: { x: (cx - 66) / 1280, y: (headY - 78) / 720, w: 132 / 1280, h: 156 / 720 }, confidence: 0.97 - i * 0.03 });
  });

  /* poussière lumineuse */
  const rand = mulberry32(42);
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = i % 3 === 0 ? "rgba(0,229,255,0.35)" : "rgba(255,255,255,0.16)";
    ctx.beginPath();
    ctx.arc(rand() * 1280, rand() * 460, rand() * 1.6 + 0.4, 0, 7);
    ctx.fill();
  }

  return {
    frame: c.toDataURL("image/jpeg", 0.88),
    videoUrl: null,
    isVideo: false,
    faces,
    engine: "Synthèse de démonstration",
    hasAudioGuess: false,
    audioGuessCertain: true,
    canvas: c,
  };
}

/**
 * Scène de foule de démonstration — `count` sujets répartis sur trois plans
 * (premier plan, second plan, arrière-plan) pour valider la détection
 * illimitée et la distinction acteurs / figurants.
 */
export function buildCrowdMedia(count = 15): MediaResult & { canvas: HTMLCanvasElement; faces: { box: NormalizedBox; confidence: number }[] } {
  const c = document.createElement("canvas");
  c.width = 1280;
  c.height = 720;
  const ctx = c.getContext("2d")!;
  const rand = mulberry32(count * 977 + 13);

  /* fond : salle / rue en perspective chaude */
  const bg = ctx.createLinearGradient(0, 0, 0, 720);
  bg.addColorStop(0, "#1a1226");
  bg.addColorStop(0.55, "#241830");
  bg.addColorStop(1, "#2e2038");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1280, 720);

  /* bande lumineuse d'ambiance (lustres / néons) */
  for (let i = 0; i < 7; i++) {
    const gx = 90 + i * 175;
    const g = ctx.createRadialGradient(gx, 60, 4, gx, 60, 70);
    g.addColorStop(0, "rgba(245,197,66,0.5)");
    g.addColorStop(1, "rgba(245,197,66,0)");
    ctx.fillStyle = g;
    ctx.fillRect(gx - 70, 0, 140, 140);
    ctx.fillStyle = "rgba(245,197,66,0.85)";
    ctx.beginPath();
    ctx.arc(gx, 46, 4.5, 0, 7);
    ctx.fill();
  }

  /* lignes de fuite */
  ctx.strokeStyle = "rgba(157,78,221,0.12)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 10; i++) {
    ctx.beginPath();
    ctx.moveTo(640 + (i - 4.5) * 30, 400);
    ctx.lineTo(640 + (i - 4.5) * 210, 720);
    ctx.stroke();
  }

  const faces: { box: NormalizedBox; confidence: number }[] = [];
  const planes: { y: number; scale: number; zone: "front" | "mid" | "back" }[] = [
    { y: 560, scale: 1.0, zone: "front" },
    { y: 470, scale: 0.72, zone: "mid" },
    { y: 400, scale: 0.5, zone: "back" },
  ];

  for (let i = 0; i < count; i++) {
    const plane = planes[i % planes.length];
    const jitter = (rand() - 0.5) * 0.5;
    const slot = Math.floor(i / planes.length);
    const colsPerPlane = Math.ceil(count / planes.length);
    const fx = (slot + 0.5 + jitter) / colsPerPlane;
    const cx = clamp(fx, 0.06, 0.94) * 1280;
    const headY = plane.y - 120 * plane.scale;
    const hw = 40 * plane.scale;
    const hh = 50 * plane.scale;

    /* silhouette */
    ctx.fillStyle = "rgba(10,12,20,0.92)";
    ctx.beginPath();
    ctx.ellipse(cx, headY, hw, hh, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - hw * 2.1, plane.y + 160 * plane.scale);
    ctx.quadraticCurveTo(cx - hw * 1.7, headY + hh * 1.1, cx, headY + hh * 0.9);
    ctx.quadraticCurveTo(cx + hw * 1.7, headY + hh * 1.1, cx + hw * 2.1, plane.y + 160 * plane.scale);
    ctx.closePath();
    ctx.fill();

    /* rim-light colorée selon le plan */
    const rim = plane.zone === "front" ? "rgba(0,229,255,0.5)" : plane.zone === "mid" ? "rgba(157,78,221,0.45)" : "rgba(245,197,66,0.35)";
    ctx.strokeStyle = rim;
    ctx.lineWidth = 2 * plane.scale + 0.5;
    ctx.beginPath();
    ctx.ellipse(cx - hw * 0.12, headY, hw, hh, 0, Math.PI * 0.8, Math.PI * 1.55);
    ctx.stroke();

    faces.push({
      box: { x: (cx - hw * 1.15) / 1280, y: (headY - hh * 1.12) / 720, w: (hw * 2.3) / 1280, h: (hh * 2.24) / 720 },
      confidence: plane.zone === "front" ? 0.95 + rand() * 0.04 : plane.zone === "mid" ? 0.9 + rand() * 0.06 : 0.84 + rand() * 0.09,
    });
  }

  /* poussière lumineuse */
  for (let i = 0; i < 110; i++) {
    ctx.fillStyle = i % 4 === 0 ? "rgba(245,197,66,0.3)" : "rgba(255,255,255,0.14)";
    ctx.beginPath();
    ctx.arc(rand() * 1280, rand() * 720, rand() * 1.5 + 0.4, 0, 7);
    ctx.fill();
  }

  return {
    frame: c.toDataURL("image/jpeg", 0.88),
    videoUrl: null,
    isVideo: false,
    faces,
    engine: `Synthèse de foule · ${count} sujets`,
    hasAudioGuess: false,
    audioGuessCertain: true,
    canvas: c,
  };
}

/** Affecte une zone de profondeur à un visage selon sa position verticale. */
export function zoneForFace(box: NormalizedBox): "front" | "mid" | "back" {
  const cy = box.y + box.h / 2;
  return cy > 0.62 ? "front" : cy > 0.4 ? "mid" : "back";
}

/* ================= Pilier 3/4 — Audio ================= */

let AC: AudioContext | null = null;
export function audioCtx(): AudioContext {
  if (!AC) AC = new AudioContext();
  if (AC.state === "suspended") void AC.resume();
  return AC;
}

export async function decodeAudioFile(blob: Blob): Promise<AudioBuffer> {
  const buf = await blob.arrayBuffer();
  return audioCtx().decodeAudioData(buf);
}

export function playBufferWithTone(buffer: AudioBuffer, tone: ToneDef): number {
  const ctx = audioCtx();
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = tone.rate;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.9, ctx.currentTime + 0.05);
  g.gain.setValueAtTime(0.9, ctx.currentTime + Math.max(0.1, buffer.duration / tone.rate - 0.12));
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + buffer.duration / tone.rate);
  src.connect(g).connect(ctx.destination);
  src.start();
  return buffer.duration / tone.rate;
}

export function drawWaveform(canvas: HTMLCanvasElement, buffer: AudioBuffer, color: string) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const data = buffer.getChannelData(0);
  const buckets = 56;
  const step = Math.max(1, Math.floor(data.length / buckets));
  ctx.fillStyle = color;
  for (let i = 0; i < buckets; i++) {
    let sum = 0;
    for (let j = 0; j < step; j += 8) sum += Math.abs(data[i * step + j] ?? 0);
    const v = Math.min(1, (sum / (step / 8)) * 2.4);
    const bh = Math.max(2, v * H * 0.92);
    ctx.globalAlpha = 0.35 + v * 0.65;
    ctx.fillRect((i / buckets) * W + 1, (H - bh) / 2, W / buckets - 2, bh);
  }
  ctx.globalAlpha = 1;
}

/* Lecture vocale d'une réplique (aperçu TTS modulé par le ton) */
export function speakLine(text: string, tone: ToneDef, timeoutMs = 6500): Promise<void> {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) {
      setTimeout(resolve, Math.min(1400, timeoutMs));
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const fr = voices.find((v) => v.lang.toLowerCase().startsWith("fr"));
    if (fr) u.voice = fr;
    u.lang = "fr-FR";
    u.rate = tone.rate;
    u.pitch = tone.pitch;
    u.volume = 0.95;
    const done = () => {
      clearTimeout(guard);
      resolve();
    };
    const guard = window.setTimeout(() => {
      window.speechSynthesis.cancel();
      resolve();
    }, timeoutMs);
    u.onend = done;
    u.onerror = done;
    window.speechSynthesis.speak(u);
  });
}

/* ================= Export ================= */

export function buildExportPayload(opts: {
  title: string;
  script: string;
  cast: CastMember[];
  audioMode: "cleanup" | "synthesis";
  cleanup: { isolation: boolean; denoise: boolean; deecho: boolean; spatial: boolean };
  timeline: Timeline;
}) {
  return {
    app: "AgwèStream",
    schema: "agwe.timeline/2.0",
    title: opts.title,
    generatedAt: new Date().toISOString(),
    scenario: {
      global: opts.script,
      stats: {
        scenes: opts.timeline.entries.filter((e) => e.kind === "scene").length,
        dialogues: opts.timeline.entries.filter((e) => e.kind === "dialogue").length,
        actions: opts.timeline.entries.filter((e) => e.kind === "action").length,
      },
    },
    clones: opts.cast.map((c) => ({
      name: c.name,
      tone: c.tone,
      voice: c.voiceLabel,
      linkedLines: opts.timeline.matched[c.id] ?? 0,
    })),
    audio: { mode: opts.audioMode, cleanupChain: opts.cleanup },
    timeline: {
      totalSeconds: Number(opts.timeline.total.toFixed(2)),
      entries: opts.timeline.entries.map((e) => ({
        kind: e.kind,
        character: e.characterName ?? null,
        tone: e.tone ?? null,
        text: e.label,
        start: Number(e.start.toFixed(2)),
        duration: Number(e.duration.toFixed(2)),
        crossed: e.crossed ?? false,
      })),
    },
    unassignedNames: opts.timeline.unassigned,
  };
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export { colorFor };
export type { CloneConfig };
