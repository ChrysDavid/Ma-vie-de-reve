# Référence pipeline

## Sources
- Poly Haven : API `https://api.polyhaven.com/assets?t=hdris|textures|models`, `.../files/<id>` → URLs par résolution/format.
- ambientCG : `https://ambientcg.com/api/v2/full_json?id=<id>&include=downloadData`.
- Quaternius / Kenney / Poly Pizza : CC0, GLB/FBX ; personnage animé (idle/walk/run).
- Three.js examples : `Soldier.glb`, `Xbot.glb` (vérifier licence dans le dépôt three.js).

## gltf-transform
- `npx gltf-transform inspect file.glb | head -40`
- `npx gltf-transform optimize in.glb out.glb --compress meshopt --texture-compress ktx2 --texture-size 2048`
- Côté runtime : `GLTFLoader` + `MeshoptDecoder` + `KTX2Loader.setTranscoderPath('/basis/')` + `detectSupport(renderer)`.

## Blender headless (si installé)
- `blender -b -P scripts/blender/build_villa.py -- --floorplan src/data/floorplan.json --out public/assets/models/villa.glb`
- Lightmaps : UV2 via Smart UV Project, bake Cycles (Diffuse, direct+indirect), export en `.ktx2`/`.webp`, appliqué en `material.lightMap` (canal `uv1`).
- Exporter le floorplan TS en JSON (`scripts/export-floorplan.ts`) pour partager la source de vérité.
