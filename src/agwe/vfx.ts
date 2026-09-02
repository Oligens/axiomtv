/**
 * AGWÈSTREAM — Moteur VFX & Rendu Cinématique.
 *
 * Deux modes pilotés par le scénario global :
 *  - INTIMATE  : environnements calmes & réalistes (restaurant, bureau, salon,
 *                chambre, rue piétonne) — lumière ambiante, reflets, DoF,
 *                micro-expressions.
 *  - ACTION    : transformation vidéo-vers-vidéo (VFX) — une prise modeste
 *                (acteur assis mimant la conduite) devient une course-poursuite,
 *                un échange de tirs, un décor urbain en flammes.
 *
 * Le texte du scénario est analysé pour déduire automatiquement le mode,
 * l'environnement et les couches d'effets à injecter.
 */
import type { ParsedLine } from "../data/content";

export type RenderMode = "intimate" | "action";

/* ================= Environnements ================= */

export interface EnvironmentPreset {
  id: string;
  mode: RenderMode;
  label: string;
  desc: string;
  /** Palette dominante du décor */
  sky: [string, string];
  accent: string;
  warm: boolean;
  /** Bokeh / profondeur de champ par défaut */
  dof: number;
}

export const ENVIRONMENTS: EnvironmentPreset[] = [
  { id: "resto", mode: "intimate", label: "Restaurant de luxe", desc: "Nappes blanches, chandelles, reflets de cristal", sky: ["#2b1a12", "#4a2c18"], accent: "#f5c542", warm: true, dof: 0.7 },
  { id: "bureau", mode: "intimate", label: "Bureau panoramique", desc: "Baies vitrées, ville en contre-jour, lumière rasante", sky: ["#101a2e", "#1e3050"], accent: "#7fb2ff", warm: false, dof: 0.45 },
  { id: "salon", mode: "intimate", label: "Salon feutré", desc: "Lampe chaude, pénombre, textures douces", sky: ["#241812", "#3a2818"], accent: "#ffb46b", warm: true, dof: 0.6 },
  { id: "chambre", mode: "intimate", label: "Chambre au matin", desc: "Voilages, lumière diffuse, grain fin", sky: ["#2a2230", "#4a3a52"], accent: "#e8c8ff", warm: true, dof: 0.55 },
  { id: "rue", mode: "intimate", label: "Rue piétonne", desc: "Pavés mouillés, enseignes, passants flous", sky: ["#141c26", "#243444"], accent: "#8fd8ff", warm: false, dof: 0.5 },
  { id: "poursuite", mode: "action", label: "Course-poursuite", desc: "Asphalte défilant, vitesse, gerbes d'étincelles", sky: ["#0c0e18", "#1a2340"], accent: "#ff5d73", warm: false, dof: 0.3 },
  { id: "fusillade", mode: "action", label: "Échange de tirs", desc: "Impacts, douilles, éclats de muzzle-flash", sky: ["#100c14", "#26182c"], accent: "#ffb347", warm: false, dof: 0.35 },
  { id: "incendie", mode: "action", label: "Flammes & fumée", desc: "Braises, colonne de fumée, lueurs dansantes", sky: ["#1a0e08", "#3a1a0c"], accent: "#ff7a3d", warm: true, dof: 0.4 },
  { id: "urbain", mode: "action", label: "Métropole dynamique", desc: "Néons, circulation, foule en mouvement", sky: ["#0a1220", "#16293f"], accent: "#00e5ff", warm: false, dof: 0.38 },
];

/* ================= Couches d'effets ================= */

export interface FxLayer {
  id: string;
  label: string;
  mode: RenderMode;
  desc: string;
}

export const FX_LAYERS: FxLayer[] = [
  /* Intimate */
  { id: "bokeh", label: "Profondeur de champ", mode: "intimate", desc: "Flou d'arrière-plan anamorphique" },
  { id: "dust", label: "Poussière en suspension", mode: "intimate", desc: "Particules fines dans la lumière" },
  { id: "flicker", label: "Lueur vacillante", mode: "intimate", desc: "Chandelles / néons doux" },
  { id: "reflect", label: "Reflets cristallins", mode: "intimate", desc: "Verres, miroirs, surfaces polies" },
  { id: "micro", label: "Micro-expressions", mode: "intimate", desc: "Clignements, souffle, regards" },
  /* Action */
  { id: "speed", label: "Traînées de vitesse", mode: "action", desc: "Motion blur directionnel" },
  { id: "sparks", label: "Étincelles & impacts", mode: "action", desc: "Gerbes, ricochets, débris" },
  { id: "muzzle", label: "Muzzle-flash", mode: "action", desc: "Éclats de bouche de canon" },
  { id: "smoke", label: "Fumée volumétrique", mode: "action", desc: "Nappes denses et lentes" },
  { id: "flames", label: "Flammes & braises", mode: "action", desc: "Feu animé, lueurs chaudes" },
  { id: "shake", label: "Tremblement caméra", mode: "action", desc: "Shake manuel réaliste" },
];

/* ================= Analyse du scénario ================= */

export interface VfxSuggestion {
  mode: RenderMode;
  envId: string;
  fx: string[];
  drivers: { line: string; kind: string }[];
  confidence: number;
}

const ACTION_RE = /poursuit|course|conduit|voiture|tir|tire|explos|flamme|fum[eé]e|court|sprint|combat|chase|gun|shoot|car|vitesse|d[eé]rap|crash|poursuite/i;
const INTIMATE_RE = /restaurant|d[iî]ne|bureau|salon|chambre|table|verre|vin|caf[eé]|parle|discute|chuchot|rue|balade|intime|calme/i;
const FX_HINTS: [RegExp, string][] = [
  [/fum[eé]e/, "smoke"],
  [/flamme|feu|incendie|braise/, "flames"],
  [/tir|coup de feu|pistolet|fusil|munition/, "muzzle"],
  [/vitesse|d[eé]rap|poursuit|course|km\/h/, "speed"],
  [/impact|ricochet|[ée]tincelle|d[eé]bris/, "sparks"],
  [/trembl|secousse|choc|explos/, "shake"],
  [/verre|cristal|reflet|miroir/, "reflect"],
  [/poussi[eè]re|particule/, "dust"],
  [/chandelle|bougie|vacill|n[eé]on/, "flicker"],
];

export const MODE_KEYWORDS = { action: ACTION_RE, intimate: INTIMATE_RE };

/**
 * Déduit le mode de rendu, l'environnement et les FX depuis le scénario
 * global — le texte reste le chef d'orchestre unique.
 */
export function suggestVfx(parsed: ParsedLine[], hasAudio: boolean): VfxSuggestion {
  let actionHits = 0;
  let intimateHits = 0;
  const drivers: VfxSuggestion["drivers"] = [];
  const fx = new Set<string>();

  for (const line of parsed) {
    const text = line.text ?? line.raw;
    const isAct = ACTION_RE.test(text);
    const isInt = INTIMATE_RE.test(text);
    if (isAct) {
      actionHits++;
      if (drivers.length < 4) drivers.push({ line: text, kind: "action" });
    }
    if (isInt) {
      intimateHits++;
      if (drivers.length < 4) drivers.push({ line: text, kind: "intimate" });
    }
    for (const [re, id] of FX_HINTS) if (re.test(text)) fx.add(id);
  }

  const total = actionHits + intimateHits;
  const mode: RenderMode = total === 0 ? "intimate" : actionHits >= intimateHits ? "action" : "intimate";

  /* Environnement par défaut selon le mode + mots-clés présents */
  const raw = parsed.map((l) => l.text ?? l.raw).join(" ");
  let envId = mode === "action" ? "poursuite" : "resto";
  if (mode === "intimate") {
    if (/bureau/.test(raw)) envId = "bureau";
    else if (/salon/.test(raw)) envId = "salon";
    else if (/chambre/.test(raw)) envId = "chambre";
    else if (/rue/.test(raw)) envId = "rue";
  } else {
    if (/fum[eé]e|incendie|flamme/.test(raw)) envId = "incendie";
    else if (/tir|fusillade|combat/.test(raw)) envId = "fusillade";
    else if (/ville|m[eé]tropole|n[eé]on|urbain/.test(raw)) envId = "urbain";
  }

  /* FX par défaut du mode */
  if (mode === "intimate") {
    fx.add("bokeh");
    fx.add("dust");
    fx.add("micro");
    if (!hasAudio) fx.add("flicker");
  } else {
    fx.add("speed");
    fx.add("shake");
    fx.add("smoke");
  }

  const confidence = total === 0 ? 0.5 : Math.min(0.97, 0.6 + (Math.max(actionHits, intimateHits) / Math.max(total, 1)) * 0.37);

  return { mode, envId, fx: [...fx], drivers, confidence };
}

export const envById = (id: string): EnvironmentPreset => ENVIRONMENTS.find((e) => e.id === id) ?? ENVIRONMENTS[0];
