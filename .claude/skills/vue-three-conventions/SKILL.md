---
name: vue-three-conventions
description: Conventions de code Vue 3 + TypeScript + Three.js + Rapier pour Ma vie de rêve. Utiliser pour écrire ou modifier du code dans src/ (engine, world, player, physics, audio, components, stores, data/floorplan.ts).
paths: ["src/**", "vite.config.*", "tsconfig*.json"]
---

# Conventions Vue + Three.js

- **Séparation stricte** : Three.js vit dans `src/engine|world|player|physics|audio` (TS pur, classes). Vue = UI uniquement (`src/components`). Pont via stores Pinia (valeurs primitives) et événements.
- **Jamais** d'objet Three/Rapier dans un `ref`/`reactive` Vue → `markRaw` ou `shallowRef` si indispensable.
- **Floorplan piloté par données** : toute géométrie d'architecture dérive de `src/data/floorplan.ts` (mètres, Y-up, plafond 3 m, portes 0,9×2,1 m). Pas de cotes en dur ailleurs.
- **Cycle de vie** : chaque module expose `init()`, `update(dt)`, `dispose()` ; `dispose()` libère géométries, matériaux, textures, colliders.
- **PBR** : `MeshStandardMaterial`/`MeshPhysicalMaterial`, textures couleur en `SRGBColorSpace`, data en `NoColorSpace` ; tone mapping AgX.
- **Perf** : instancing pour répétitions, LOD végétation/voitures, ombres seulement sur objets utiles, profils qualité dans `src/engine/quality.ts`.
- **TS strict**, imports `three/addons/...`, nommage : `PascalCase` classes/composants, `camelCase` fonctions, fichiers TS en `camelCase.ts`, composants `PascalCase.vue`.

Patrons détaillés (vent onBeforeCompile, caméra anti-murs, Rapier KCC, eau) : [reference.md](reference.md).
