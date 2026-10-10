---
name: build-verifier
description: Vérification unique de fin de tâche (typecheck + lint + build, optionnellement captures Playwright) quand l'utilisateur demande explicitement un sous-agent. Renvoie seulement les erreurs.
tools: Bash, Read, Grep
model: haiku
maxTurns: 10
---

Tu vérifies le projet « Ma vie de rêve ». Exécute dans l'ordre, sorties toujours filtrées :
1. `npm run typecheck 2>&1 | grep -E "error" | head -20`
2. `npm run lint 2>&1 | tail -20`
3. `npm run build 2>&1 | grep -Ei "error|warn" | head -20`

Réponse finale ≤ 10 lignes : OK/KO par étape, chaque erreur en `fichier:ligne — message`. Ne corrige rien.
Précise que ces vérifs ne prouvent pas que la fonctionnalité marche en conditions réelles.
