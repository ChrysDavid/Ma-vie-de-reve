# Référence mémoire

## Hiérarchie de chargement (coût tokens)
- `CLAUDE.md` : chargé à chaque session → garder < 200 lignes, liens plutôt que copie.
- Skills : seul le frontmatter est chargé ; le corps l'est si pertinent ; `reference.md` seulement si lu.
- Hooks : exécutés par le harnais, coût nul en contexte (sauf stdout SessionStart, plafonné à 6000 car.).

## Hooks en place (`.claude/settings.json`)
- `PreCompact` → `.claude/hooks/pre-compact.mjs` : ajoute à `state.md` un snapshot (dernière demande, todos, fichiers modifiés <3h, git status).
- `SessionStart` (`compact|clear`) → `.claude/hooks/session-context.mjs` : réinjecte `state.md` (+ dernier snapshot).

## Gabarit session
```
# AAAA-MM-JJ — Sujet
- Fait : ...
- Décisions : voir decisions.md#...
- Suite : ...
```

## Lecture économe
- `Grep` avec `glob` + `head_limit` ; `Read` avec `offset/limit` sur la zone utile.
- Ne jamais lire `node_modules/`, `dist/`, binaires (`.glb`, `.ktx2`, `.hdr`) — déjà en deny.
- Logs build/test : `| tail -30` ou `| grep -E "error|warn"`.
