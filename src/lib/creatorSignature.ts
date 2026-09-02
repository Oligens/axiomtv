/**
 * ============================================================
 * SIGNATURE DE CRÉATEUR — CLEEF OLIGENS JOSEPH (« COJ »)
 * ============================================================
 * Strictement INVISIBLE dans l'interface utilisateur :
 *  - aucun composant du Hub / d'AgwèStream n'importe ce module ;
 *  - aucune injection dans le DOM (ni <img>, ni élément, ni style global) ;
 *  - exécuté uniquement comme effet de bord d'initialisation dans main.tsx.
 *
 * L'image (poisson doré & bleu tissé de motifs « COJ », nom au centre)
 * est un SVG dessiné sur mesure, 100 % ASCII, encodé en Base64 puis
 * affiché dans la console du navigateur (F12) via console.log stylisé.
 */

/* SVG volontairement ASCII pur → encodable par btoa() sans utilitaire. */
const SIGNATURE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 264">
<defs>
<linearGradient id="cojBody" x1="0" y1="0" x2="1" y2="0">
<stop offset="0" stop-color="#0b3f78"/>
<stop offset="0.45" stop-color="#1173c4"/>
<stop offset="0.75" stop-color="#00b4e0"/>
<stop offset="1" stop-color="#35d5f0"/>
</linearGradient>
<linearGradient id="cojTail" x1="0" y1="0" x2="1" y2="0">
<stop offset="0" stop-color="#d9a52f"/>
<stop offset="1" stop-color="#ffcf5e"/>
</linearGradient>
<radialGradient id="cojHaloB" cx="0.5" cy="0.5" r="0.5">
<stop offset="0" stop-color="#00e5ff" stop-opacity="0.16"/>
<stop offset="1" stop-color="#00e5ff" stop-opacity="0"/>
</radialGradient>
<radialGradient id="cojHaloG" cx="0.5" cy="0.5" r="0.5">
<stop offset="0" stop-color="#f5c542" stop-opacity="0.13"/>
<stop offset="1" stop-color="#f5c542" stop-opacity="0"/>
</radialGradient>
<pattern id="cojPat" width="42" height="20" patternUnits="userSpaceOnUse" patternTransform="rotate(-10)">
<text x="2" y="14" font-family="Arial,Helvetica,sans-serif" font-size="11" font-weight="700" letter-spacing="1" fill="#f5c542" opacity="0.34">COJ</text>
</pattern>
</defs>

<!-- halos ambiants -->
<circle cx="180" cy="120" r="150" fill="url(#cojHaloB)"/>
<circle cx="500" cy="150" r="140" fill="url(#cojHaloG)"/>

<!-- etoiles & etincelles -->
<circle cx="58" cy="52" r="2.4" fill="#00e5ff" opacity="0.55"/>
<circle cx="606" cy="58" r="2" fill="#f5c542" opacity="0.6"/>
<circle cx="588" cy="218" r="2.4" fill="#00e5ff" opacity="0.45"/>
<circle cx="76" cy="216" r="2" fill="#f5c542" opacity="0.5"/>
<path d="M560 30 L560 44 M553 37 L567 37" stroke="#f5c542" stroke-width="1.6" opacity="0.7"/>
<path d="M96 232 L96 244 M90 238 L102 238" stroke="#00e5ff" stroke-width="1.4" opacity="0.6"/>

<!-- bulles -->
<circle cx="52" cy="110" r="6" fill="none" stroke="#35d5f0" stroke-width="1.4" opacity="0.5"/>
<circle cx="38" cy="88" r="3.5" fill="none" stroke="#35d5f0" stroke-width="1.2" opacity="0.45"/>
<circle cx="60" cy="70" r="2.4" fill="none" stroke="#35d5f0" stroke-width="1" opacity="0.4"/>

<!-- queue doree -->
<path d="M462 132 C500 108 530 92 566 78 C552 116 552 148 566 186 C530 172 500 156 462 132 Z" fill="url(#cojTail)"/>
<path d="M462 132 C500 108 530 92 566 78 C552 116 552 148 566 186 C530 172 500 156 462 132 Z" fill="url(#cojPat)"/>

<!-- nageoires dorsale & ventrale -->
<path d="M250 66 C280 30 330 26 362 60 C330 62 290 66 250 66 Z" fill="#0f86c9"/>
<path d="M250 198 C280 234 330 238 362 204 C330 202 290 198 250 198 Z" fill="#0d6fa8"/>

<!-- corps -->
<path id="cojFish" d="M70 132 C110 78 190 52 280 62 C360 70 420 84 470 132 C420 180 360 194 280 202 C190 212 110 186 70 132 Z" fill="url(#cojBody)" stroke="#00e5ff" stroke-opacity="0.55" stroke-width="2"/>
<use href="#cojFish" fill="url(#cojPat)"/>

<!-- nageoire pectorale -->
<path d="M200 142 C226 162 248 172 270 176 C250 186 222 180 200 162 Z" fill="#0a4d8c" opacity="0.9"/>

<!-- ouies & bouche -->
<path d="M168 96 C157 116 157 148 168 168" fill="none" stroke="#00e5ff" stroke-width="2" opacity="0.65"/>
<path d="M76 138 C84 145 93 147 101 144" fill="none" stroke="#06263f" stroke-width="2.4" stroke-linecap="round"/>

<!-- oeil -->
<circle cx="128" cy="118" r="13" fill="#eaf6ff"/>
<circle cx="131" cy="118" r="6.2" fill="#0a0e14"/>
<circle cx="126" cy="113.5" r="2.3" fill="#ffffff"/>

<!-- bandeau central : CLEEF OLIGENS JOSEPH -->
<rect x="178" y="104" width="232" height="56" rx="10" fill="#0a0e14" fill-opacity="0.74" stroke="#f5c542" stroke-opacity="0.4" stroke-width="1.2"/>
<text x="294" y="127" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="16" font-weight="800" letter-spacing="2.5" fill="#f5c542">CLEEF OLIGENS</text>
<text x="294" y="149" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="16" font-weight="800" letter-spacing="2.5" fill="#f5c542">JOSEPH</text>
</svg>`;

/** Data-URI Base64 — seule représentation de l'image dans le bundle. */
const SIGNATURE_DATA_URI = `data:image/svg+xml;base64,${btoa(SIGNATURE_SVG)}`;

/**
 * Affiche la signature dans la console du navigateur (F12).
 * Effet de bord pur : ne touche jamais au DOM.
 */
export function logCreatorSignature(): void {
  try {
    /* 1 — Bannière graphique (image en background, dimensionnée par le padding) */
    console.log(
      "%c ",
      [
        `background-image: url("${SIGNATURE_DATA_URI}")`,
        "background-size: 460px 190px",
        "background-repeat: no-repeat",
        "background-position: center",
        "background-color: #070b12",
        "padding: 95px 230px",
        "border-radius: 14px",
        "border: 1px solid rgba(0, 229, 255, 0.35)",
        "box-shadow: 0 0 42px rgba(0, 229, 255, 0.14), 0 0 90px rgba(245, 197, 66, 0.06)",
        "margin: 10px 0 4px",
        "line-height: 0",
      ].join(";")
    );

    /* 2 — Bandeau typographique en trois segments */
    console.log(
      "%c CLEEF OLIGENS JOSEPH %c CREATOR SIGNATURE %c Agw\u00e8Stream \u00d7 Axiom TV ",
      [
        "background: linear-gradient(120deg, #f5c542, #ffb347)",
        "color: #0a0e14",
        "font-weight: 800",
        "font-size: 15px",
        "letter-spacing: 2px",
        "padding: 7px 12px",
        "border-radius: 8px 0 0 8px",
      ].join(";"),
      [
        "background: #0b3f78",
        "color: #7fd8ff",
        "font-weight: 700",
        "font-size: 11px",
        "letter-spacing: 1.5px",
        "padding: 7px 12px",
      ].join(";"),
      [
        "background: #070b12",
        "color: #8b98ab",
        "font-size: 11px",
        "letter-spacing: 0.5px",
        "padding: 7px 12px",
        "border-radius: 0 8px 8px 0",
        "border: 1px solid rgba(0, 229, 255, 0.3)",
        "border-left: none",
      ].join(";")
    );

    /* 3 — Pied de signature : preuve d'invisibilité UI */
    console.log(
      "%cCOJ%c poisson dor\u00e9 & bleu \u00b7 motifs \u00ab COJ \u00bb \u00b7 signature embarqu\u00e9e \u2014 rendue uniquement ici, jamais dans le DOM.",
      [
        "background: rgba(245, 197, 66, 0.12)",
        "color: #f5c542",
        "font-weight: 800",
        "font-size: 11px",
        "letter-spacing: 2px",
        "padding: 3px 8px",
        "border-radius: 5px",
        "margin-right: 8px",
      ].join(";"),
      "color: #5d7089; font-size: 10.5px; font-style: italic;"
    );
  } catch {
    /* la signature ne doit jamais compromettre le démarrage de l'app */
  }
}
