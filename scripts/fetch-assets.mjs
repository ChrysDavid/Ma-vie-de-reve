// Downloads CC0 assets (Poly Haven API + three.js example models) into public/assets/.
// Usage: node scripts/fetch-assets.mjs [--res 2k]
import { mkdirSync, existsSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', 'public', 'assets');
const resArg = process.argv.indexOf('--res');
const TEX_RES = resArg > 0 ? process.argv[resArg + 1] : '1k';

const HDRIS = [{ id: 'kloofendal_48d_partly_cloudy_puresky', res: '2k' }];
// Poly Haven map key -> local suffix
const MAPS = { Diffuse: 'diff', nor_gl: 'nor', Rough: 'rough', AO: 'ao' };
const TEXTURES = [
  'concrete_floor_02', 'wood_floor_deck',
  'white_plaster_02', 'castle_wall_slates', 'oak_wood_planks', 'large_floor_tiles_02', 'laminate_floor_02', 'marble_01',
];
const MODELS = [
  { url: 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/Soldier.glb', out: 'models/character/soldier.glb' },
];

// Extra manifests (one per feature): scripts/assets/*.json = { textures?: string[], models?: { url, out }[] }.
const MANIFEST_DIR = join(import.meta.dirname, 'assets');
if (existsSync(MANIFEST_DIR)) {
  for (const file of readdirSync(MANIFEST_DIR).filter((n) => n.endsWith('.json'))) {
    const m = JSON.parse(readFileSync(join(MANIFEST_DIR, file), 'utf8'));
    for (const t of m.textures ?? []) if (!TEXTURES.includes(t)) TEXTURES.push(t);
    for (const mod of m.models ?? []) MODELS.push(mod);
  }
}

async function download(url, out) {
  const dest = join(ROOT, out);
  if (existsSync(dest)) return console.log(`skip ${out}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  console.log(`ok   ${out}`);
}

async function files(id) {
  const res = await fetch(`https://api.polyhaven.com/files/${id}`);
  if (!res.ok) throw new Error(`Poly Haven: unknown asset ${id}`);
  return res.json();
}

for (const { id, res } of HDRIS) {
  const f = await files(id);
  await download(f.hdri[res].hdr.url, `hdri/${id}_${res}.hdr`);
}

for (const id of TEXTURES) {
  const f = await files(id);
  for (const [key, suffix] of Object.entries(MAPS)) {
    const url = f[key]?.[TEX_RES]?.jpg?.url;
    if (url) await download(url, `textures/${id}/${suffix}.jpg`);
  }
}

for (const m of MODELS) await download(m.url, m.out);
