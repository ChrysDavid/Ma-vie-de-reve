---
name: visual-audit
description: Méthodologie d'audit visuel de fin de phase (captures Playwright multi-points de vue, critique réalisme/proportions/collisions). Utiliser à la fin de chaque phase ou quand l'utilisateur demande de vérifier le rendu.
---

# Audit visuel de fin de phase

1. `npm run build` une seule fois (filtrer : `| grep -Ei "error|warn" | head -20`).
2. `npm run dev` en arrière-plan, puis `npm run shots` (Playwright) → captures dans `screenshots/<phase>/`.
3. Examiner chaque capture avec la checklist [checklist.md](checklist.md).
4. Corriger la cause racine, recapturer uniquement les vues concernées.
5. Consigner les défauts restants dans `.projetmemory/state.md` (section Bloqué ou En cours).

Rappel : une capture correcte ≠ fonctionnalité testée (contrôles, collisions) — le signaler si non testé.
