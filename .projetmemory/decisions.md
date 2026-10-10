# Décisions techniques

Format : `## AAAA-MM-JJ — Titre` puis **Décision** / **Pourquoi** (2-3 lignes max).

## 2026-10-10 — Mémoire projet hors conversation
**Décision** : état durable dans `.projetmemory/`, `CLAUDE.md` court qui y renvoie, hooks PreCompact + SessionStart(compact).
**Pourquoi** : réduire les tokens par session et survivre aux compactions/`/clear`.

## 2026-10-10 — Three.js direct plutôt que TresJS (par défaut)
**Décision** : moteur Three.js impératif dans `src/engine/`, Vue limité à l'UI.
**Pourquoi** : contrôle total sur post-FX, onBeforeCompile, CSM, Rapier ; évite la réactivité Vue sur les objets 3D.

## 2026-10-10 — Personnage provisoire Soldier.glb
**Décision** : Soldier (Mixamo, exemples three.js) pour la Phase 1 ; facteur d'échelle auto à 1,78 m, timeScale lié à la vitesse.
**Pourquoi** : humain réaliste avec idle/walk/run disponible immédiatement ; licence Mixamo non CC0 → à remplacer.

## 2026-10-10 — Physique à pas fixe 1/60 + interpolation
**Décision** : KCC dans `fixedUpdate`, rendu interpolé (`prev/curr`), capsule 1,8 m, autostep 0,35 m, snap 0,4 m.
**Pourquoi** : mouvement stable indépendant du framerate (écrans 120 Hz, mobiles).
