# AGWÈSTREAM 2.0 — Moteur de Génération Vidéo Intelligent, Cohérence & Contrôle Qualité Automatique

> **Principe central :** `GENERATE → OBSERVE → ANALYZE → REPAIR → VERIFY → RENDER`
>
> AgwèStream ne fait plus « Script → vidéo ». Il fait :
> **Script → compréhension → planification → génération → analyse → détection d'anomalies → réparation → nouvelle analyse → validation → rendu final.**

Ce document décrit l'architecture, les API, les modèles de données, le système de
scoring et le système de réparation. L'intégration est **modulaire** : aucune
fonctionnalité existante (piliers 1–5 : scénario, extraction de visages, fiches de
personnage, audio hybride, timeline) n'a été supprimée.

---

## A. Architecture du pipeline

```text
SCRIPT (pilier 1 — existant)
  │
  ├─► STORY INTELLIGENCE ──► planScenes()          → SceneConstraint[]  (§3)
  │     (personnages, objets, actions, caméra, lumière, vêtements…)
  │
  ├─► CHARACTER REGISTRY ──► buildCharacterProfiles() → CharacterIdentityProfile[] (§4)
  ├─► OBJECT REGISTRY    ──► (inclus dans SceneConstraint) → ObjectIdentityProfile[] (§5)
  ├─► SCENE MEMORY       ──► SceneConstraint (réinjectée à la régénération)  (§24)
  └─► PROJECT MEMORY     ──► buildProjectMemory() → ProjectMemory  (§25)
  │
  ▼
GENERATION ORCHESTRATOR  (runQAPipeline — pipeline.ts)
  │   rend chaque scène (Wan 2.1 · IP-Adapter, simulé côté client)
  ▼
FAST SCAN  (échantillonnage adaptatif, §28)
  │   scoreScene() × 13 moteurs, par scène
  ▼
DEEP ANALYSIS  (seules les scènes sous le seuil profond)
  ▼
VISUAL / TEMPORAL / PHYSICS / AUDIO / LIPSYNC QA  (§7–§16)
  │   detectAnomalies() + analyzeTemporal()
  ▼
AGWÈ QUALITY SCORE  (§17) — computeGlobal(), pondéré
  │
  ├─► PASS  (≥ seuil) ──────────────────────► FINAL RENDER
  └─► FAIL ─► AUTOMATIC REPAIR  (§18–§20)
              selectRepairBatch() → buildRepairJobs() → applyRepair()
              (régénération LOCALISÉE du segment, jamais la vidéo entière)
              └─► boucle bornée (maxAttempts) → RE-ANALYSIS → VERIFY
```

### Les 16 moteurs (§26) — chacun une responsabilité claire

| Moteur | Fichier | Responsabilité |
|---|---|---|
| StoryEngine | `engines.ts` `planScenes` | structure du scénario, contraintes de scène |
| CharacterEngine | `engines.ts` `buildCharacterProfiles` | registre d'identité des personnages |
| ObjectEngine | `engines.ts` (dans `planScenes`) | registre + suivi des objets |
| SceneEngine | `engines.ts` `buildProjectMemory` | mémoires scène/projet |
| GenerationEngine | `pipeline.ts` | rendu des segments |
| VisionEngine | `engines.ts` `scoreScene` (face/anatomy/text) | analyse visuelle |
| TemporalEngine | `engines.ts` `analyzeTemporal` | dérive frame à frame |
| MotionEngine | `engines.ts` `scoreScene(motion)` | trajectoires |
| PhysicsEngine | `engines.ts` `scoreScene(physics)` | gravité/collisions/ombres |
| LightingEngine | `engines.ts` `scoreScene(lighting)` | direction/intensité lumière |
| CameraEngine | `engines.ts` `scoreScene(camera)` | focale/perspective/mouvement |
| LipSyncEngine | `engines.ts` `scoreScene(lipsync)` | phonèmes→visèmes→mouvement |
| AudioEngine | `engines.ts` `scoreScene(audio)` | voix/volume/réverb |
| QualityEngine | `engines.ts` `computeGlobal` | score global pondéré |
| RepairEngine | `engines.ts` `selectRepairBatch/applyRepair/buildRepairJobs` | réparation localisée |
| RenderEngine | `pipeline.ts` (fin) | assemblage final |

---

## B. Modèles de données (§35.D)

Définis dans `src/agwe/models.ts` :

- **`SceneConstraint`** — scène, personnages, objets, actions, caméra, lumière,
  vêtements, durée, transition, événements, fenêtre temporelle.
- **`CharacterIdentityProfile`** — identité (embedding facial 8-d, forme du visage,
  yeux, cheveux, âge apparent), corps, vêtements, voix, style visuel.
- **`ObjectIdentityProfile`** — id persistant, type, couleur, matériau, position,
  propriétaire, état.
- **`TemporalAnalysis`** — échantillons frame à frame + dérive.
- **`QualityReport`** — statut, score global, scores des 13 moteurs, anomalies,
  analyses temporelles, tentatives de réparation, seuil, **disclaimer**.
- **`Anomaly`** — moteur, scène, segment temporel, sévérité, confiance, statut.
- **`RepairJob`** — anomalie ciblée, segment, tentative, scores avant/après.
- **`ProjectMemory`** — personnages, objets récurrents, lieux, palette, caméra,
  voix, relations, chronologie.

## C. API / contrats d'échange (§35.C)

Le pipeline est orchestré côté client par `runQAPipeline(input, settings, callbacks)`
(`src/agwe/pipeline.ts`) :

```ts
runQAPipeline(
  { parsed, timeline, cast, hasAudio, cleanup, ignoredAnomalyIds },  // QAInput
  settings,                                                          // QASettings
  { onLog, onPhase, onAnomalies, onReport, onJobs }                  // QACallbacks
): { done: Promise<QAResult>; cancel: () => void }
```

Les moteurs sont des **fonctions pures synchrones** (`src/agwe/engines.ts`),
testables isolément. Le pipeline ajoute l'asynchronisme, la journalisation et la
boucle de réparation. Cette séparation permet de brancher plus tard de vrais
modèles (GPU/serveur) derrière chaque moteur sans toucher à l'UI.

## D. Variables d'environnement

Aucune clé n'est requise côté front : l'analyse est **souveraine et locale**.
Les variables existantes du projet (`.env.local` : `DATABASE_URL`, `RESEND_API_KEY`,
`JWT_SECRET`) restent inchangées et ne concernent que le backend `server/`.

## E. Système de scoring (§17)

- 13 moteurs, chacun noté 0–100 par scène, agrégé en **moyenne pondérée**.
- Pondération et seuils **configurables** en mode Expert (`QASettings.weights`,
  `passThreshold`, `deepThreshold`).
- Statuts : `pass` ≥ seuil · `warning` ≥ seuil−6 · `error` sinon.
- **IMPORTANT (§32)** : les scores sont des *estimations de cohérence selon les
  métriques actives*. Ils ne constituent **ni une garantie d'absence d'erreur, ni
  une preuve d'origine IA/humaine**. Le `disclaimer` est affiché dans l'UI et inclus
  dans chaque `QualityReport`.

## F. Système de réparation (§18–§20)

1. `selectRepairBatch` trie les anomalies par **sévérité** (CRITICAL>HIGH>MEDIUM>LOW)
   puis **confiance**, lot de 3 max.
2. `applyRepair` régénère **uniquement le moteur de la scène touchée** — identité,
   vêtements, caméra, environnement et audio sont préservés. Jamais la vidéo entière.
3. Boucle bornée par `maxAttempts` ; arrêt anticipé si le score n'améliore plus
   (`REPAIR LIMIT REACHED`), et les anomalies restantes sont présentées à l'utilisateur.
4. Chaque segment réparé est **ré-analysé** avant validation.

## G. Modes utilisateur (§31)

- **SIMPLE** — l'utilisateur génère ; AgwèStream analyse et corrige automatiquement.
- **PRO** — scores, erreurs, timeline diagnostique et réparations visibles.
- **EXPERT** — contrôle des seuils, moteurs, sampling, pondération et tentatives
  (panneau latéral `ExpertDrawer`).

## H. Tests (§33)

```bash
npx vitest run
```

Couverture : Character (même/différent/visage masqué), Objet (stable/déplacé/disparu),
Temporal (stable/brutal), Audio (avec/sans piste), LipSync (nettoyé/synthèse),
Repair (détection/succès/segment), plus cas extrêmes (0/1/10 personnages, photo,
vidéo longue, scène sans dialogue).

## I. Intégration UI

Nouvelles sections de la page AgwèStream (`/studio/agwestream`) :

- **06 · Génération & Contrôle Qualité** — `QualityControlPanel` (13 moteurs, jauge
  globale, modes Simple/Pro/Expert) + `ProductionLog` (journal horodaté + boucle de
  régénération).
- **07 · Timeline Diagnostique & Mémoires** — `DiagnosticTimeline` (6 pistes, marqueurs
  cliquables : Réparer / Ignorer / Voir la frame), `FrameInspector` (mode de diagnostic
  visuel : visages, objets, anatomie, trajectoires, zone d'anomalie), `MemoryPanels`
  (Scene Memory + Project Memory + profils d'identité).
