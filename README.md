# Ma vie de rêve

Visite 3D photoréaliste d'une villa contemporaine de luxe dans le navigateur (Vue 3 + Three.js + Rapier), à la 3e ou 1re personne, au clavier/souris ou au joystick tactile.

**Démo : https://ma-vie-de-reve.vercel.app/**

## Fonctionnalités
- Villa générée depuis un plan en mètres (`src/data/floorplan.ts`), avec collisions physiques (Rapier)
- Extérieurs : piscine, terrasses, végétation, voitures
- Intérieurs meublés pièce par pièce
- Trois ambiances : jour, coucher de soleil, nuit (éclairages intérieurs et paysagers)
- Portes interactives
- Sons procéduraux (ambiances, pas selon la surface)
- Mini-carte
- Menu de téléportation vers les pièces
- Visite guidée automatique
- Post-processing (AO, bloom, SMAA) et qualité adaptative

## Prérequis
- Node.js 20+ (testé avec Node 24) et npm
- Navigateur récent avec WebGL 2

## Installation
```bash
npm install
npm run assets:fetch        # télécharge HDRI, textures (Poly Haven, CC0) et modèles dans public/assets/
npm run assets:optimize     # allège les arbres haute définition (obligatoire après assets:fetch)
```
Option : `node scripts/fetch-assets.mjs --res 2k` pour des textures 2k.

## Lancement
```bash
npm run dev                 # serveur de développement Vite
npm run build               # vérification TypeScript + build de production (dist/)
npm run preview             # sert le build
```

## Contrôles
| Action | Clavier / souris | Mobile |
|---|---|---|
| Se déplacer | ZQSD / WASD / flèches | Joystick analogique (à droite de l'écran) |
| Courir | Maj | Joystick poussé à fond |
| Regarder | Glisser la souris (verrouillage du pointeur en 1re personne) | Glisser un doigt |
| Zoom caméra | Molette | Pincer |
| Changer de vue (3e / 1re personne) | V ou bouton en haut à droite | Bouton en haut à droite |
| Interagir (portes) | E | Bouton E (à gauche) |

## Qualité graphique
Trois profils dans `src/engine/quality.ts` :

| Profil | Pixel ratio | Ombres | Textures | Post-processing |
|---|---|---|---|---|
| `low` | 1 | 512 | 1k | aucun |
| `medium` | 1 | 1024 | 1k | AO + bloom + SMAA |
| `ultra` | 1,5 | 2048 | 2k | AO + bloom + SMAA, antialiasing |

Le profil est détecté automatiquement (GPU, cœurs, mémoire, tactile) : jamais `ultra` en auto, et un choix manuel enregistré est prioritaire. La résolution de rendu s'adapte en continu aux performances, plafonnée par le ratio du profil et le `devicePixelRatio`. Le rendu se met en pause quand l'onglet est masqué.

## Scripts
- `npm run assets:fetch` / `assets:models` / `assets:simplify` / `assets:optimize` — téléchargement et allègement des assets
- `npm run shots -- <dossier>` — captures Playwright multi-points de vue
- `npm run typecheck` — vérification TypeScript seule

## Structure
- `src/engine/` — renderer, scène, post-processing, profils de qualité
- `src/world/` — villa générée depuis le floorplan : architecture, intérieurs, extérieurs, piscine, végétation, voitures, portes
- `src/player/` — personnage, contrôleur, caméra anti-murs, entrées clavier/joystick
- `src/physics/` — monde Rapier, colliders, character controller
- `src/audio/` — ambiances et sons procéduraux
- `src/data/` — `floorplan.ts` (plan, source de vérité) et parcours de la visite guidée
- `src/components/`, `src/stores/` — interface Vue (HUD, mini-carte, téléportation, visite) et état Pinia
- `scripts/` — assets, captures, Blender

## Crédits
Tous les assets et leurs licences sont listés dans [CREDITS.md](CREDITS.md).
