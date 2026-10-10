# État d'avancement

_Mis à jour : 2026-10-10 (fin Phase 4)_

## Fait
- Système mémoire/contexte Claude Code (`CLAUDE.md`, `.claude/`, `.projetmemory/`).
- Phase 1 : Vite+Vue+TS+Pinia, Engine (AgX, ombres), HDRI Poly Haven, TestGround (escaliers 17 cm, rampe, deck, murs, bornes carte), Rapier KCC, perso Soldier animé, caméra 3e/1re pers. anti-murs (5 rayons), joystick nipplejs **à droite** (demande user), E à gauche, écrans chargement/accueil/HUD. Captures : `screenshots/phase1/`, escalier gravi (y=1.04), 60 fps.
- Phase 2 : `src/data/floorplan.ts` (pièces, murs+ouvertures, dalles, escalier, garde-corps, pergola, `roomAt`), `src/world/Villa.ts` (MeshBatcher par matériau, UV monde, collider par pièce de mur), `Terrain.ts` (TestGround supprimé), finitions PBR (`Finishes`, 6 textures Poly Haven + CREDITS), HUD nom de pièce, README. Escalier gravi (y=3.47), 60 fps. Captures `screenshots/phase2/`.
- Phase 3 (5 agents Sonnet, 1 fichier chacun) : Pool.ts (Water2, caustiques), Vegetation.ts (palmiers procéduraux, jacaranda allégé via `npm run assets:optimize`, haies shrub_03, herbe instanciée), Exteriors.ts, OutdoorFurniture.ts, Cars.ts (CarConcept Khronos ×3). Manifests `scripts/assets/*.json`. Perf : 27 M → 3 M triangles/frame, jacaranda 208 → 16 Mo. `scripts/perf.mjs` = sonde draw calls/triangles. Poussé sur GitHub (commit 3a31199).
- Déployé sur Vercel : https://ma-vie-de-reve.vercel.app/ (base `/`, build `npm run build`, dist).
- Audit Phase 3 : pelouse `aerial_grass_rock` (terre) remplacée par `leafy_grass` + anti-répétition shader (Terrain.ts).
- Phase 4 (3 agents Sonnet) : `src/world/interiors/` — `kit.ts` (preload/model/box/cyl/collider + `finalize()` = fusion par matériau : 1447→470 meshes, fps 14→28), `living.ts` (salon/cuisine/salle à manger), `ground.ts` (hall, bureau, ch.4, douches, vestiaire, cellier, buanderie), `upper.ts` (suite, SdB, dressing, ch.2/3, douches, salon haut, terrasse, balcon). 36 modèles Poly Haven CC0 (`npm run assets:models` → GLB WebP 512 px, `npm run assets:simplify` → ≤6k tris) : 11 Mo. Captures `screenshots/phase4/`.

## En cours
- Prochaine étape : **Phase 5** (éclairage intérieur, lumières, reflets, post-FX, jour/nuit).
- Rien de commité depuis 3a31199 (Phases 3-fix + 4 en local).

## À reprendre plus tard
- Canapés sofa_02/sofa_03 = Chesterfield classiques, peu contemporains → canapé d'angle procédural moderne.
- Test escalier headless : feet y≈2.5 (fps bas en headless), à revérifier en vrai navigateur.
- Meubles placés sans test de collision en jeu réel.

- Herbe : répétition de tuile très visible au loin → variation macro / mélange de textures (Phase 3).
- Personnage Soldier (Mixamo) provisoire → chercher humain CC0 (Quaternius) avec idle/walk/run.
- Joystick et pinch non testés sur vrai mobile.
- Portes : ouvertures avec chambranles mais sans vantaux (Phase 6, porte pivotante d'entrée incluse).
- Verre : transparent simple (opacity) ; transmission/IOR physique en Phase 5. Intérieurs bleutés (pas de lumières intérieures avant Phase 5).
- Bardage bois du bureau encore un peu rouge de loin ; texture deck saturée (teintée).
- Pas de plinthes/interrupteurs/gouttières (détails Phases 4-5).
- CLAUDE.md cite `.project-memory/` alors que le dossier réel est `.projetmemory/`.

## Phases (cahier des charges §10)
- [x] 1 Init + moteur + perso jouable
- [x] 2 Gros œuvre (floorplan, murs, sols, escalier, toiture)
- [x] 3 Extérieurs (piscine, jardin, végétation vent, voitures)
- [x] 4 Intérieurs (ameublement, déco)
- [ ] 5 Éclairage avancé, lightmaps, reflets, post-FX, jour/nuit
- [ ] 6 Interactions, sons, UI, minimap, visite guidée
- [ ] 7 Optimisation, qualité, mobile, README

## Bloqué
- Rien.

## Snapshots auto (hook PreCompact)
<!-- Le hook ajoute ci-dessous un bloc horodaté à chaque compaction. Purger régulièrement. -->
