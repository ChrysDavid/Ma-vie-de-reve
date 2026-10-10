// Turns Poly Haven hero tree models (hundreds of MB, millions of triangles) into real-time GLBs:
// drops twig primitives, keeps one leaf card in K (enlarged), simplifies the trunk.
// Usage: node scripts/optimize-vegetation.mjs  (after npm run assets:fetch)
import { NodeIO } from '@gltf-transform/core';
import { prune, simplifyPrimitive, weldPrimitive } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import { existsSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(import.meta.dirname, '..', 'public', 'assets', 'models', 'vegetation');
const MODELS = [{ id: 'jacaranda_tree', leafTris: 80000, trunkRatio: 0.15 }];

/** Keeps one triangle pair in `k` of a non-indexed card soup, scaled around each card's centre. */
function thinCards(doc, prim, k) {
  const index = prim.getIndices();
  const attrs = prim.listSemantics().map((s) => [s, prim.getAttribute(s)]);
  const tri = (i) => (index ? index.getScalar(i) : i);
  const count = index ? index.getCount() : prim.getAttribute('POSITION').getCount();
  const grow = Math.min(Math.sqrt(k) * 0.5, 3);
  const out = Object.fromEntries(attrs.map(([s, a]) => [s, []]));
  const pos = prim.getAttribute('POSITION'), v = [0, 0, 0];
  for (let t = 0; t + 6 <= count; t += 6 * k) {
    const c = [0, 0, 0];
    for (let i = 0; i < 6; i++) { pos.getElement(tri(t + i), v); c[0] += v[0] / 6; c[1] += v[1] / 6; c[2] += v[2] / 6; }
    for (let i = 0; i < 6; i++) {
      for (const [s, a] of attrs) {
        const e = a.getElement(tri(t + i), []);
        if (s === 'POSITION') out[s].push(...e.map((x, j) => c[j] + (x - c[j]) * grow));
        else out[s].push(...e);
      }
    }
  }
  for (const [s, a] of attrs) {
    const acc = doc.createAccessor().setType(a.getType()).setArray(new Float32Array(out[s])).setBuffer(a.getBuffer());
    prim.setAttribute(s, acc);
  }
  prim.setIndices(null);
}

const io = new NodeIO();
await MeshoptSimplifier.ready;
for (const { id, leafTris, trunkRatio } of MODELS) {
  const src = join(DIR, id, `${id}_1k.gltf`), dst = join(DIR, id, `${id}_lite.glb`);
  if (!existsSync(src)) { console.log(`skip ${id} (source missing)`); continue; }
  const doc = await io.read(src);
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const name = prim.getMaterial()?.getName() ?? '';
      const tris = (prim.getIndices()?.getCount() ?? prim.getAttribute('POSITION').getCount()) / 3;
      if (/branch/i.test(name)) { mesh.removePrimitive(prim); prim.dispose(); }
      else if (/lea(f|ves)/i.test(name)) { if (tris > leafTris) thinCards(doc, prim, Math.ceil(tris / leafTris)); }
      else { weldPrimitive(prim); simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio: trunkRatio, error: 0.002 }); }
    }
  }
  await doc.transform(prune());
  await io.write(dst, doc);
  console.log(`ok   ${id}_lite.glb ${(statSync(dst).size / 1e6).toFixed(1)} MB`);
  // The source (.gltf + .bin + textures) is re-downloadable with assets:fetch; never ship it.
  rmSync(join(DIR, id, `${id}_1k.gltf`));
  rmSync(join(DIR, id, `${id}.bin`));
  rmSync(join(DIR, id, 'textures'), { recursive: true });
}
