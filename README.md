# Ma vie de rêve

Visite 3D photoréaliste d'une villa contemporaine de luxe dans le navigateur (Vue 3 + Three.js + Rapier), à la 3e ou 1re personne, au clavier/souris ou au joystick tactile.

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
| Se déplacer | ZQSD / WASD | Joystick analogique (moitié droite de l'écran) |
| Courir | Maj | Joystick poussé à fond |
| Regarder | Glisser la souris (verrouillage du pointeur en 1re personne) | Glisser un doigt |
| Zoom caméra | Molette | Pincer |
| Changer de vue (3e / 1re personne) | V ou bouton en haut à droite | Bouton en haut à droite |
| Interagir | E | Bouton E |

## Structure
- `src/engine/` — rendu, environnement HDRI, profils de qualité
- `src/world/` — villa générée depuis `src/data/floorplan.ts` (plan en mètres, source de vérité)
- `src/player/` — personnage, contrôleur, caméra, entrées
- `src/physics/` — Rapier (colliders, character controller)
- `src/components/`, `src/stores/` — interface Vue et état Pinia
- `scripts/` — téléchargement d'assets, captures Playwright (`npm run shots -- <dossier>`)

## Crédits
Tous les assets et leurs licences sont listés dans [CREDITS.md](CREDITS.md).
