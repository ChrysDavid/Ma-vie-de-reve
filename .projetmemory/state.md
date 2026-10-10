# État d'avancement

_Mis à jour : 2026-10-10 (fin Phase 2)_

## Fait
- Système mémoire/contexte Claude Code (`CLAUDE.md`, `.claude/`, `.projetmemory/`).
- Phase 1 : Vite+Vue+TS+Pinia, Engine (AgX, ombres), HDRI Poly Haven, TestGround (escaliers 17 cm, rampe, deck, murs, bornes carte), Rapier KCC, perso Soldier animé, caméra 3e/1re pers. anti-murs (5 rayons), joystick nipplejs **à droite** (demande user), E à gauche, écrans chargement/accueil/HUD. Captures : `screenshots/phase1/`, escalier gravi (y=1.04), 60 fps.
- Phase 2 : `src/data/floorplan.ts` (pièces, murs+ouvertures, dalles, escalier, garde-corps, pergola, `roomAt`), `src/world/Villa.ts` (MeshBatcher par matériau, UV monde, collider par pièce de mur), `Terrain.ts` (TestGround supprimé), finitions PBR (`Finishes`, 6 textures Poly Haven + CREDITS), HUD nom de pièce, README. Escalier gravi (y=3.47), 60 fps. Captures `screenshots/phase2/`.

## En cours
- Prochaine étape : **Phase 3** (extérieurs : piscine, cours, jardin, végétation, voitures, cuisine ext.).

## À reprendre plus tard
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
- [ ] 3 Extérieurs (piscine, jardin, végétation vent, voitures)
- [ ] 4 Intérieurs (ameublement, déco)
- [ ] 5 Éclairage avancé, lightmaps, reflets, post-FX, jour/nuit
- [ ] 6 Interactions, sons, UI, minimap, visite guidée
- [ ] 7 Optimisation, qualité, mobile, README

## Bloqué
- Rien.

## Snapshots auto (hook PreCompact)
<!-- Le hook ajoute ci-dessous un bloc horodaté à chaque compaction. Purger régulièrement. -->
