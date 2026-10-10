// Downloads Poly Haven models (glTF + textures, 1k) and packs each into one self-contained GLB.
// Manifests: scripts/assets/*.json = { polyhavenModels?: { id, dir }[] } → public/assets/models/<dir>/<id>.glb
// Usage: node scripts/fetch-models.mjs
import { NodeIO } from '@gltf-transform/core';
import { dedup, prune, textureCompress } from '@gltf-transform/functions';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import sharp from 'sharp';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', 'public', 'assets', 'models');
const MANIFEST_DIR = join(import.meta.dirname, 'assets');
const RES = '1k';

const list = [];
for (const file of readdirSync(MANIFEST_DIR).filter((n) => n.endsWith('.json'))) {
  const m = JSON.parse(readFileSync(join(MANIFEST_DIR, file), 'utf8'));
  for (const e of m.polyhavenModels ?? []) list.push(e);
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const { id, dir } of list) {
  const out = join(ROOT, dir, `${id}.glb`);
  if (existsSync(out)) { console.log(`skip ${id}`); continue; }
  const res = await fetch(`https://api.polyhaven.com/files/${id}`);
  if (!res.ok) throw new Error(`Poly Haven: unknown model ${id}`);
  const gltf = (await res.json()).gltf;
  const entry = (gltf?.[RES] ?? gltf?.['2k'])?.gltf;
  if (!entry) { console.log(`none ${id} (no glTF)`); continue; }
  const tmp = join(tmpdir(), 'mvdr-models', id);
  mkdirSync(tmp, { recursive: true });
  const gltfPath = join(tmp, `${id}.gltf`);
  writeFileSync(gltfPath, Buffer.from(await (await fetch(entry.url)).arrayBuffer()));
  for (const [rel, f] of Object.entries(entry.include)) {
    const dest = join(tmp, rel);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, Buffer.from(await (await fetch(f.url)).arrayBuffer()));
  }
  const doc = await io.read(gltfPath);
  // Interior props are seen from a few metres: 512 px WebP textures are enough.
  await doc.transform(dedup(), prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [512, 512], quality: 82 }));
  let tris = 0;
  for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) {
    const idx = p.getIndices();
    tris += (idx ? idx.getCount() : p.getAttribute('POSITION').getCount()) / 3;
  }
  mkdirSync(dirname(out), { recursive: true });
  await io.write(out, doc);
  rmSync(tmp, { recursive: true, force: true });
  console.log(`ok   ${id}  ${(statSync(out).size / 1e6).toFixed(1)} Mo  ${Math.round(tris / 1000)}k tris`);
}
