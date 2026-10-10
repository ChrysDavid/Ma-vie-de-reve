# Patrons techniques

## Rapier character controller
- `await RAPIER.init()` une fois ; `world.createCharacterController(0.01)`.
- `enableAutostep(0.3, 0.2, true)` (marches ≤ 30 cm), `setMaxSlopeClimbAngle(45°)`, `enableSnapToGround(0.3)`.
- Collider joueur : capsule (r 0.3, demi-hauteur 0.6). Pas fixe 1/60 avec accumulateur ; interpoler le rendu.
- Colliders statiques générés depuis le floorplan (cuboïdes murs/sols) + trimesh simplifié pour meubles.

## Caméra 3e personne anti-murs
- Pivot à hauteur d'épaule ; raycast Rapier (`castRay`/`castShape` sphère r 0.2) pivot → position désirée ; placer à `hit.toi - marge`.
- Lissage : `damp` exponentiel (`1 - exp(-k·dt)`), plus rapide en rapprochement qu'en éloignement.

## Vent (végétation)
- `material.onBeforeCompile` : uniforms `uTime`, `uWind` ; déplacement dans `<begin_vertex>` pondéré par `position.y` normalisée (ou couleur de vertex) ; bruit sinusoïdal multi-fréquence + phase par instance (`instanceMatrix[3].xz`).
- Mettre `customProgramCacheKey` pour éviter les collisions de programmes.

## Eau piscine
- `Water` (addons) ou shader maison : réflexion (Reflector/planar ou envMap), réfraction (render target de profondeur), normal maps doubles défilantes, caustiques projetées au fond (texture animée en `lightMap`/décal additif).

## Post-processing (pmndrs)
- `EffectComposer` (HalfFloat) → `RenderPass` → N8AO → SSR (Ultra) → Bloom léger → Vignette → SMAA. Tone mapping dans `ToneMappingEffect` si composer actif.

## Qualité
- Bas : pas de SSR/AO, ombres 1024, pixelRatio 1, herbe réduite. Moyen : AO, ombres 2048. Ultra : tout, CSM 3 cascades, pixelRatio ≤ 2.
- Détection auto : `navigator.hardwareConcurrency`, mobile UA/touch, mesure FPS 3 s puis ajustement.
