---
name: asset-pipeline
description: Pipeline d'assets 3D/textures/HDRI/sons (téléchargement Poly Haven/ambientCG/Quaternius, compression gltf-transform Draco/Meshopt + KTX2, CREDITS.md, Blender headless). Utiliser pour ajouter, compresser ou créditer un asset.
paths: ["scripts/**", "public/assets/**", "CREDITS.md"]
---

# Pipeline d'assets

- **Licence d'abord** : CC0 ou permissive uniquement ; chaque asset ajouté → ligne dans `CREDITS.md` (nom, auteur, lien, licence) dans la même tâche.
- **Téléchargement scripté** dans `scripts/` (jamais à la main) ; Poly Haven via `https://api.polyhaven.com/files/<id>`, résolution 1k (Bas) / 2k (Ultra).
- **Compression** : `gltf-transform optimize in.glb out.glb --compress meshopt --texture-compress ktx2` ; textures couleur en ETC1S, normal/roughness en UASTC.
- **Ranger** : `public/assets/{models,textures,hdri,audio}/` ; noms en `kebab-case`.
- **Ne jamais lire** les binaires (.glb/.ktx2/.hdr) — inspecter via `gltf-transform inspect | head -40`.

Commandes et options détaillées, Blender headless : [reference.md](reference.md).
