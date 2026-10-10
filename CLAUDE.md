# CLAUDE.md — Ma vie de rêve

## Règles permanentes

## Localisation & lecture
- Chercher d'abord dans `.project-memory/*.md`, jamais relire un fichier déjà cartographié en entier — bloc ciblé (offset/limit) uniquement.
- Jamais relire un fichier déjà lu plus tôt dans la même conversation, même après un Edit/Write dessus.

## Modification
- Patch ciblé (ancre courte, unique), jamais de réécriture complète sauf demande explicite.
- Périmètre strict : n'appliquer un changement qu'au rôle/interface explicitement demandé (ex. "côté client" = jamais toucher chauffeur/établissement).
- Chercher la cause racine avant de patcher un symptôme.

## Exécution
- Une demande vaut accord : exécuter directement, pas de confirmation sauf action destructrice réelle (suppression définitive, force-push, reset --hard...).
- Sous-agents interdits sauf demande explicite.

## Vérification
- Une seule vérif par tâche (`manage.py check` / `flutter analyze`), à la fin, en boucle jusqu'au succès — pas après chaque micro-edit.
- Backend : après tout changement, `docker compose up -d --force-recreate web` (le conteneur peut tourner sur du code périmé), pas juste le check.
- Ces vérifs prouvent l'absence d'erreur de compilation/lint, PAS que la fonctionnalité marche réellement — le dire explicitement si non testé en conditions réelles.

## Réponses
- 1-2 lignes max : quoi + fichier(s) + résultat de vérif. Jamais de récapitulatif, même après une tâche longue.
- Zéro préambule/reformulation/transition. Sorties shell filtrées (jamais de dump brut).

## Mémoire
- Mise à jour `.project-memory` groupée en une seule passe à la fin de la tâche.

## Commits
- Jamais de mention Claude / Co-Authored-By.

## Fin de tâche
- Suggérer `/clear`, sans récapitulatif avant.

<!-- Note : dans ce projet le dossier mémoire est `.projetmemory/` (= `.project-memory` ci-dessus). Pas de Django/Flutter/Docker ici : la vérif unique = `npm run typecheck && npm run build` (voir Commandes). -->

---

## Règles de comportement (toutes sessions, tout projet)

**Communication :**
- Réponses ≤ 3-5 lignes. Zéro préambule, zéro résumé final.
- Jamais de questions multiples enchaînées : si un choix est nécessaire, choisir soi-même l'option recommandée et l'exécuter.
- Exécuter directement, sans demander confirmation avant d'agir.

**Économie de tokens (cross-projet) :**
- Sortie shell toujours filtrée (grep/head/tail ciblés), jamais de dump brut.
- Un seul build/agent de vérification par tâche, pas plus.
- Pas de relecture de fichier après un edit : Edit/Write font foi.
- Suggérer `/clear` en fin de tâche.
- Explorer avec scope précis uniquement, jamais "va voir tout le code" ; déléguer à un sous-agent si lecture massive nécessaire.
- État durable écrit dans `.projetmemory/`, jamais gardé seulement en conversation.
- Hook PreCompact configuré pour sauvegarder l'état critique dans `.projetmemory/state.md` avant toute compaction.

**Git :**
- Jamais de commit ou push sans demande explicite, à chaque fois (pas d'autorisation implicite d'une fois sur l'autre).
- Jamais de mention "Co-Authored-By Claude".
- Commits en anglais, préfixe conventionnel (feat/fix/chore/refactor/docs/test).
- Branches empilées, jamais créées depuis main/develop directement.

<!-- En cas de conflit, le bloc "Règles permanentes" (plus récent) prime : réponses 1-2 lignes, sous-agents seulement sur demande explicite. -->

---

## Projet

Visite 3D photoréaliste d'une villa contemporaine (3e/1re personne, joystick mobile). Cahier des charges complet : `prompt-ma-vie-de-reve.md` (lire par section, jamais en entier).

Mémoire : [.projetmemory/state.md](.projetmemory/state.md) (avancement) · [decisions.md](.projetmemory/decisions.md) · [stack.md](.projetmemory/stack.md) · `sessions/`.

## Commandes
<!-- Prévues : à corriger dans stack.md + ici après le scaffolding Phase 1. -->
- `npm install` · `npm run dev` · `npm run build`
- Vérif unique de fin de tâche : `npm run typecheck 2>&1 | grep error | head -20 && npm run build 2>&1 | grep -Ei "error|warn" | head -20`
- Captures : `npm run shots` (Playwright) — Assets : `npm run assets:fetch` / `assets:compress`

## Architecture (une phrase par module)
- `src/engine/` — renderer, scène, post-processing, profils qualité.
- `src/world/` — villa générée depuis le floorplan : archi, intérieurs, extérieurs, piscine, végétation, voitures.
- `src/player/` — personnage, contrôleur, caméra anti-murs, inputs clavier/joystick.
- `src/physics/` — monde Rapier, colliders, KinematicCharacterController.
- `src/audio/` — ambiances et pas selon surface.
- `src/data/floorplan.ts` — source de vérité du plan (mètres).
- `src/components/` — UI Vue ; `src/stores/` — Pinia.
- `scripts/` — assets + Blender ; `public/assets/` — binaires (ne jamais lire).

## Toujours vrai
- Three.js hors de la réactivité Vue (`markRaw`) ; Vue = UI seulement.
- Aucune cote en dur hors `floorplan.ts`.
- Tout asset ajouté → `CREDITS.md` dans la même tâche, licence CC0/permissive.
- Fin de phase → skill `visual-audit`.

## Skills projet
`vue-three-conventions` (code src/) · `asset-pipeline` (assets, CREDITS) · `visual-audit` (fin de phase) · `memory-context` (mémoire, fin de tâche).
Agents (sur demande explicite seulement) : `code-explorer`, `build-verifier`.
