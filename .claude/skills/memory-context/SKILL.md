---
name: memory-context
description: Gestion mémoire/contexte du projet. Utiliser en fin de tâche, avant /clear ou compaction, quand une décision technique est prise, ou quand une lecture massive de code est envisagée.
---

# Mémoire & contexte

## Quand écrire dans `.projetmemory/` (une seule passe, en fin de tâche)
- `state.md` : phase/tâche terminée, en cours, bloquée → mettre à jour les cases et sections.
- `decisions.md` : choix technique non évident (lib, archi, compromis perf/qualité) → 2-3 lignes Décision/Pourquoi.
- `stack.md` : nouvelle commande, dépendance majeure, nouveau module.
- `sessions/AAAA-MM-JJ-sujet.md` : seulement pour une session importante (phase finie, gros refactor) — 3-6 puces.

## Quand résumer
- Avant `/clear` suggéré : vérifier que `state.md` reflète l'état réel.
- Purger les snapshots auto de `state.md` dès qu'ils sont intégrés aux sections principales.

## Quand déléguer
- Sous-agents **uniquement sur demande explicite** de l'utilisateur (règle CLAUDE.md).
- Sinon : Grep/Glob ciblés + Read avec offset/limit.

Détails et gabarits : [reference.md](reference.md).
