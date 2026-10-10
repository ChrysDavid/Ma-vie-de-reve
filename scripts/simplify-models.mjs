// Caps the triangle count of interior props (meshopt simplification) so a furnished villa stays real-time.
// Usage: node scripts/simplify-models.mjs [dir=public/assets/models/interior] [maxTris=6000]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, simplify, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] ?? join(import.meta.dirname, '..', 'public', 'assets', 'models', 'interior');
const MAX_TRIS = Number(process.argv[3] ?? 6000);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

const triCount = (doc) => doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives())
  .reduce((n, p) => n + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0);

await MeshoptSimplifier.ready;
for (const f of readdirSync(dir).filter((n) => n.endsWith('.glb'))) {
  const path = join(dir, f);
  const doc = await io.read(path);
  const before = triCount(doc);
  if (before <= MAX_TRIS) continue;
  await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: MAX_TRIS / before, error: 0.01 }), prune());
  await io.write(path, doc);
  console.log(`${f}: ${Math.round(before / 1000)}k → ${Math.round(triCount(doc) / 1000)}k tris`);
}
