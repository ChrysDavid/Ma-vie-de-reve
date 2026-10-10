# État d'avancement

_Mis à jour : 2026-10-10 (Phase 5)_

## Fait
- Système mémoire/contexte Claude Code (`CLAUDE.md`, `.claude/`, `.projetmemory/`).
- Phase 1 : Vite+Vue+TS+Pinia, Engine (AgX, ombres), HDRI Poly Haven, TestGround (escaliers 17 cm, rampe, deck, murs, bornes carte), Rapier KCC, perso Soldier animé, caméra 3e/1re pers. anti-murs (5 rayons), joystick nipplejs **à droite** (demande user), E à gauche, écrans chargement/accueil/HUD. Captures : `screenshots/phase1/`, escalier gravi (y=1.04), 60 fps.
- Phase 2 : `src/data/floorplan.ts` (pièces, murs+ouvertures, dalles, escalier, garde-corps, pergola, `roomAt`), `src/world/Villa.ts` (MeshBatcher par matériau, UV monde, collider par pièce de mur), `Terrain.ts` (TestGround supprimé), finitions PBR (`Finishes`, 6 textures Poly Haven + CREDITS), HUD nom de pièce, README. Escalier gravi (y=3.47), 60 fps. Captures `screenshots/phase2/`.
- Phase 3 (5 agents Sonnet, 1 fichier chacun) : Pool.ts (Water2, caustiques), Vegetation.ts (palmiers procéduraux, jacaranda allégé via `npm run assets:optimize`, haies shrub_03, herbe instanciée), Exteriors.ts, OutdoorFurniture.ts, Cars.ts (CarConcept Khronos ×3). Manifests `scripts/assets/*.json`. Perf : 27 M → 3 M triangles/frame, jacaranda 208 → 16 Mo. `scripts/perf.mjs` = sonde draw calls/triangles. Poussé sur GitHub (commit 3a31199).
- Déployé sur Vercel : https://ma-vie-de-reve.vercel.app/ (base `/`, build `npm run build`, dist).
- Audit Phase 3 : pelouse `aerial_grass_rock` (terre) remplacée par `leafy_grass` + anti-répétition shader (Terrain.ts).
- Phase 4 (3 agents Sonnet) : `src/world/interiors/` — `kit.ts` (preload/model/box/cyl/collider + `finalize()` = fusion par matériau : 1447→470 meshes, fps 14→28), `living.ts` (salon/cuisine/salle à manger), `ground.ts` (hall, bureau, ch.4, douches, vestiaire, cellier, buanderie), `upper.ts` (suite, SdB, dressing, ch.2/3, douches, salon haut, terrasse, balcon). 36 modèles Poly Haven CC0 (`npm run assets:models` → GLB WebP 512 px, `npm run assets:simplify` → ≤6k tris) : 11 Mo. Captures `screenshots/phase4/`.

- Phase 5 (3 agents Sonnet, non commitée) : `engine/PostFX.ts` (postprocessing : N8AO, bloom, vignette, AgX, SMAA ; `quality.postfx`, low = rendu direct), `engine/timeOfDay.ts`, `Environment.setTimeOfDay` (jour/coucher/nuit, transition lissée), `world/Lighting.ts` (plafonniers RectArea 12 medium / 20 ultra, 8 Point en low ; 6 lumières ext. nuit : balises, spots façade, piscine), sélecteur HUD + `store.timeOfDay`, verre ior 1.5 (pas de transmission, trop cher). Typings `src/types/n8ao.d.ts` (node_modules illisible). `shots.mjs` : `SHOTS_VIEWS=a,b SHOTS_TOD=night`. Captures `screenshots/phase5/`.

- Phase 6 (4 agents) : `world/Doors.ts` (vantaux door/entrance pivotante, collider suivant la rotation, E à <1.8 m, `promptAt`), `audio/Audio.ts` + `surface.ts` (Web Audio 100 % procédural : vent, oiseaux/grillons, clapotis, pas par surface, filtre intérieur), UI `Minimap.vue`/`TeleportMenu.vue`/`GuidedTour.vue` + `data/tour.ts` (store : player, interactPrompt, muted, pendingTeleport, tourIndex), canapé d'angle procédural, `interiors/details.ts` (plinthes, interrupteurs, prises). Game.ts : HUD à 10 Hz, audio démarré au passage en `playing`.
- Phase 7 (3 agents) : fusion intérieurs par matériau × pièce + `Interiors.setViewer` (masque > 35 m), HDRI `belfast_sunset_puresky` / `satara_night_no_lamps` chargées à la demande, variation macro pelouse, README complet.

- Correctifs végétation/plantes : packs Poly Haven multi-variantes (pachira, calathea : `_a.._e` côte à côte) → `kit.model` ne garde qu'une variante (`Place.variant`, sinon choisie selon x/z) — c'était la cause des feuilles éparpillées/à travers les murs, plantes et meubles flottants et colliders géants ; `Place.pot` (pot graphite + terre) pour pachira. Pelouse : shader Terrain recolore la texture en vert gazon (luminance seule), touffes courtes denses sans DoubleSide (faces arrière noires), massifs = buis procéduraux (`boxwood`, texture feuillage canvas). Personnage : `adventurer.glb` (Quaternius CC0, low-poly stylisé). Miroirs `Reflector` (medium/ultra, max 6, pièce du joueur) + descentes EP/chéneau.

- Mobile : joystick nipplejs statique toujours visible (à droite, 190 px), bouton d'action contextuel à gauche (libellé = `store.interactPrompt` sans « E : », apparaît seulement à portée), mini-carte 108 px en tactile. Testé en émulation Pixel 7 paysage (porte ouverte au tap).

## En cours
- Toutes les phases du cahier des charges codées. Restes : interaction portes/sons/visite guidée non testés en vrai navigateur ; fps headless 15-30 (post-FX + culling à mesurer en vrai GPU) ; personnage Quaternius low-poly (pas photoréaliste) ; mobile réel non testé ; miroirs Reflector et lightmaps non faits.
- Phase 5 restes : ciel coucher de soleil = HDRI de jour assombri (pas de HDRI sunset/nuit dédiée) ; fps headless 40-55 → 22-36 avec post-FX medium ; miroirs `Reflector` et lightmaps non faits ; plafonds sombres la nuit (pas de rebond).
- Phases 3-fix + 4 poussées sur main (36dbdbb) ; remote = ChrysDavid/Ma-vie-de-reve.
- Perf (2 agents, f8142f7) : detectQuality() auto low/medium (localStorage mvdr.quality, store.setQuality), DPR plafonné + adaptatif (0.6→cap), pause onglet caché ; Vegetation chunkée 14 m, haies espacées par niveau, herbe 0/5k/15k. Mesure : 3,8 M → 1,3 M tris, 26-28 → 40-55 fps (headless). Reste : intérieurs fusionnés ≈ 800k tris sans culling (fusionner par pièce/niveau).

## À reprendre plus tard
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
- [x] 5 Éclairage avancé, lightmaps, reflets, post-FX, jour/nuit
- [x] 6 Interactions, sons, UI, minimap, visite guidée
- [x] 7 Optimisation, qualité, mobile, README

## Bloqué
- Rien.

## Snapshots auto (hook PreCompact)
<!-- Le hook ajoute ci-dessous un bloc horodaté à chaque compaction. Purger régulièrement. -->
