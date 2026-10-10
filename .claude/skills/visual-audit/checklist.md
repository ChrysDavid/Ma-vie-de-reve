# Checklist d'audit

## Points de vue standards
Façade avant (portail), carport, piscine depuis terrasse, salon bas, cuisine, hall/escalier, suite parentale, salle de bain, terrasse haute, jardin arrière, vue nuit.

## Réalisme
- Exposition/tone mapping cohérents, pas de blanc brûlé ni noirs bouchés.
- Ombres douces présentes, pas d'acné/peter-panning.
- Reflets visibles : vitres, miroirs, eau, sols brillants, carrosseries.
- Aucune surface plate non texturée ; textures non étirées (UV en mètres).

## Géométrie
- Proportions réalistes (plafond ~3 m, portes 0,9×2,1 m, marches ~17 cm).
- Aucun objet flottant ni interpénétré ; meubles posés au sol.
- Pas de z-fighting (sols/plinthes, carrelage).

## Jouabilité (si testée)
- Joueur ne traverse ni murs ni meubles ; caméra ne traverse pas les murs.
- Escaliers praticables ; impossible de sortir de la carte.

## Perf
- `renderer.info` : draw calls, triangles, textures ; FPS stats.js par profil.
