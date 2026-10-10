# Stack — Ma vie de rêve

Statut : Phase 1 terminée (2026-10-10). Code à la racine (pas de sous-dossier `ma-vie-de-reve/`).

## Langages / frameworks
- TypeScript (strict) — Vue 3 (Composition API, `<script setup>`) + Vite — Pinia
- Three.js (dernière version, direct ; TresJS seulement si aucune perte de fonctionnalité)
- Physique : `@dimforge/rapier3d-compat` (KinematicCharacterController)
- Post-FX : `postprocessing` (pmndrs) + `n8ao` — Joystick : `nipplejs`
- Assets : glTF/GLB Draco/Meshopt, textures KTX2 via `@gltf-transform/cli`
- Optionnel : Blender headless (Python `bpy`) pour modélisation + lightmaps Cycles
- Tests visuels : Playwright (captures headless)

## Environnement
Windows 11 — Node 24.19, npm 11.17, Python 3.14, Git 2.55 (dépôt git pas encore initialisé).

## Commandes (réelles)
- `npm install` / `npm run dev` / `npm run build` (vue-tsc + vite build) / `npm run typecheck`
- `npm run assets:fetch` → `scripts/fetch-assets.mjs` (API Poly Haven + modèles)
- `npm run shots -- <phase>` → `scripts/shots.mjs` (lance son propre Vite :5199, pilote `window.__game`/`__store` en DEV, sortie `screenshots/<phase>/`)
- Versions : three 0.186, rapier3d-compat 0.21, nipplejs 1.0 (`create()`, events `e.data.vector/force`), vite 8, TypeScript **5.9** (TS 7 incompatible vue-tsc), pinia 4.
- Pas encore de lint (eslint non installé).

## Points d'entrée
- `src/Game.ts` orchestre engine/physique/monde/joueur (hors réactivité, `markRaw`) ; `debugTeleport()`/`playerPosition` pour les tests.

## Architecture (une phrase par composant)
- `src/engine/` — renderer WebGL, scène, post-processing, profils de qualité.
- `src/world/` — génération de la villa (archi, intérieurs, extérieurs, piscine, végétation, voitures) depuis le floorplan.
- `src/player/` — personnage animé, contrôleur, caméra 3e/1re personne anti-murs, inputs clavier/joystick.
- `src/physics/` — monde Rapier, colliders statiques, character controller.
- `src/audio/` — ambiances spatialisées, pas selon surface.
- `src/data/floorplan.ts` — plan de la villa en données (pièces, murs, ouvertures, cotes en mètres) ; source de vérité.
- `src/components/` — UI Vue (accueil, chargement, HUD, minimap, paramètres, joystick).
- `src/stores/` — état Pinia (qualité, joueur, pièce courante, jour/nuit, son).
- `scripts/` — téléchargement/compression d'assets, script Blender.
- `public/assets/` — models, textures, hdri, audio (crédits dans `CREDITS.md`).
