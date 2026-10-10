import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Assets } from '@/engine/assets';
import type { QualityProfile } from '@/engine/quality';
import type { PhysicsWorld } from '@/physics/PhysicsWorld';
import { pbrMaterial } from './materials';
import {
  CARPORT, DRIVEWAY, FIRE_PIT, FOOTPRINT, FOUNTAIN, FRONT_PATHS, OUTDOOR_KITCHEN, PLOT, POOL, POOL_DECK,
  POOL_HOUSE, STEPPING_STONES, type Rect,
} from '@/data/floorplan';

// Local tuning constants (not in floorplan.ts).
const FENCE_INSET = 0.8; // keep-out strip inside the fence
const FOOTPRINT_EXTRA = 1; // keep-out around the building
const STONE_CORRIDOR = 0.6; // stepping-stone corridor width
const GRASS_RADIUS = 25; // grass scatter distance from the house
const HEDGE_INSET = 1.3; // hedge centre line distance from the fence
const HEDGE_HEIGHT = 1.6;
const PALM_HEIGHT = 7; // nominal; instance scale gives 6..9 m
const TREE_HEIGHT = 6; // nominal; instance scale gives 5..7 m
const TRUNK_SIZE = 0.4;
const GRASS_COUNTS = { low: 0, medium: 9000, ultra: 20000 } as const;
// Per-level triangle budget knobs (ultra = original look).
const LEAF_TRIS_BY = { low: 20000, medium: 50000, ultra: 80000 } as const;
const TREE_COUNT = { low: 2, medium: 3, ultra: 5 } as const;
const HEDGE_STEP = { low: 6, medium: 2.8, ultra: 1.2 } as const;
const SHRUB_PARTS = { low: 1, medium: 3, ultra: 99 } as const; // sub-meshes kept per shrub
const BED_KEEP = { low: 0.35, medium: 1, ultra: 1 } as const; // share of bed shrubs kept
const CHUNK = 14; // m, spatial cell of an instanced batch (frustum culling)
const MODEL_DIR = 'models/vegetation';

interface Part { geo: THREE.BufferGeometry; mat: THREE.MeshStandardMaterial }
interface Place { x: number; z: number; yaw: number; s: number; sxz?: number }

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const inRect = (x: number, z: number, q: Rect, m: number) =>
  x > q.x0 - m && x < q.x1 + m && z > q.z0 - m && z < q.z1 + m;

function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

/** True when (x, z) is clear of every hard surface by `margin` and `inset` m inside the fence. */
export function isFree(x: number, z: number, margin: number, inset = FENCE_INSET): boolean {
  if (x < PLOT.x0 + inset || x > PLOT.x1 - inset || z < PLOT.z0 + inset || z > PLOT.z1 - inset) return false;
  if (inRect(x, z, FOOTPRINT, margin + FOOTPRINT_EXTRA)) return false;
  if (inRect(x, z, POOL.rect, margin) || inRect(x, z, POOL.basin, margin)) return false;
  for (const d of POOL_DECK) if (inRect(x, z, d, margin)) return false;
  if (inRect(x, z, DRIVEWAY, margin) || inRect(x, z, CARPORT.rect, margin)) return false;
  for (const p of FRONT_PATHS) if (inRect(x, z, p, margin)) return false;
  if (Math.hypot(x - FOUNTAIN.x, z - FOUNTAIN.z) < FOUNTAIN.radius + margin) return false;
  if (inRect(x, z, OUTDOOR_KITCHEN.rect, margin) || inRect(x, z, POOL_HOUSE.rect, margin)) return false;
  if (Math.hypot(x - FIRE_PIT.x, z - FIRE_PIT.z) < FIRE_PIT.benchRadius + margin) return false;
  const { from, to } = STEPPING_STONES;
  if (distToSegment(x, z, from.x, from.z, to.x, to.z) < STONE_CORRIDOR / 2 + margin) return false;
  return true;
}

/** Procedural palm: curved tapered trunk + crown of drooping serrated fronds (aFlex = 0 at crown, 1 at tips). */
function buildPalm(H: number, bend: number, rnd: () => number) {
  const R = 8, N = 16;
  const tp: number[] = [], tuv: number[] = [], ti: number[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, cx = bend * H * t * t, y = H * t;
    const rad = 0.2 * (1 - 0.45 * t) + 0.12 * Math.max(0, 1 - t * 8);
    for (let j = 0; j <= R; j++) {
      const a = (j / R) * Math.PI * 2;
      tp.push(cx + Math.cos(a) * rad, y, Math.sin(a) * rad);
      tuv.push((j / R) * 1.26, y);
    }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < R; j++) {
    const a = i * (R + 1) + j, b = a + 1, c = a + R + 1, d = c + 1;
    ti.push(a, c, b, b, c, d);
  }
  const trunk = new THREE.BufferGeometry();
  trunk.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3));
  trunk.setAttribute('uv', new THREE.Float32BufferAttribute(tuv, 2));
  trunk.setIndex(ti);
  trunk.computeVertexNormals();

  const p: number[] = [], col: number[] = [], flex: number[] = [], idx: number[] = [];
  const topX = bend * H, K = 18, FR = 14;
  for (let f = 0; f < FR; f++) {
    const phi = f * 2.399963 + rnd() * 0.4;
    const e0 = f < 4 ? 1.05 : f < 9 ? 0.45 : -0.05;
    const droop = 0.9 + rnd() * 0.6, L = 3.1 + rnd() * 0.9;
    const hx = Math.cos(phi), hz = Math.sin(phi), sx = -Math.sin(phi), sz = Math.cos(phi);
    let px = topX, py = H;
    const base = p.length / 3;
    for (let k = 0; k <= K; k++) {
      const s = k / K;
      const w = 0.5 * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.75)), 0.9) * (k % 2 ? 0.6 : 1);
      const h = Math.hypot(px - topX, 0);
      const rows: [number, number, number][] = [[-w, -w * 0.3, 0], [0, 0.05, 0], [w, -w * 0.3, 0]];
      for (const [side, dy] of rows) {
        p.push(topX + hx * (h * 0) + (px - topX) * hx + sx * side, py + dy, (px - topX) * hz + sz * side);
        const g = s;
        col.push(0.05 + 0.12 * g, 0.15 + 0.28 * g, 0.03 + 0.04 * g);
        flex.push(s);
      }
      const th = e0 - droop * Math.pow(s, 1.4);
      px += Math.cos(th) * (L / K);
      py += Math.sin(th) * (L / K);
    }
    for (let k = 0; k < K; k++) {
      const l0 = base + k * 3, l1 = l0 + 3;
      idx.push(l0, l0 + 1, l1, l0 + 1, l1 + 1, l1);
      idx.push(l0 + 1, l0 + 2, l1 + 1, l0 + 2, l1 + 2, l1 + 1);
    }
  }
  const crown = new THREE.BufferGeometry();
  crown.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  crown.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  crown.setAttribute('aFlex', new THREE.Float32BufferAttribute(flex, 1));
  crown.setIndex(idx);
  crown.computeVertexNormals();
  return { trunk, crown };
}

/** Cross-quad tuft (3 quads at 60 deg), up-facing normals for soft lighting. */
const LITE_MODELS = ['jacaranda_tree'];

function triCount(g: THREE.BufferGeometry) {
  return (g.index ? g.index.count : g.attributes.position.count) / 3;
}

/** Keeps one leaf card (triangle pair) in k, enlarged around its centre to keep the crown dense. */
function thinCards(src: THREE.BufferGeometry, k: number): THREE.BufferGeometry {
  const g = src.index ? src.toNonIndexed() : src;
  const names = Object.keys(g.attributes);
  const out: Record<string, number[]> = Object.fromEntries(names.map((n) => [n, []]));
  const pos = g.attributes.position, grow = Math.min(Math.sqrt(k) * 0.5, 3);
  const c = new THREE.Vector3(), v = new THREE.Vector3();
  for (let t = 0; t + 6 <= pos.count; t += 6 * k) {
    c.set(0, 0, 0);
    for (let i = 0; i < 6; i++) c.add(v.fromBufferAttribute(pos, t + i));
    c.divideScalar(6);
    for (let i = 0; i < 6; i++) {
      for (const n of names) {
        const a = g.attributes[n];
        if (n === 'position') { v.fromBufferAttribute(a, t + i).sub(c).multiplyScalar(grow).add(c); out[n].push(v.x, v.y, v.z); }
        else for (let j = 0; j < a.itemSize; j++) out[n].push(a.array[(t + i) * a.itemSize + j]);
      }
    }
  }
  const res = new THREE.BufferGeometry();
  for (const n of names) res.setAttribute(n, new THREE.Float32BufferAttribute(out[n], g.attributes[n].itemSize));
  if (g !== src) g.dispose();
  src.dispose();
  return res;
}

function buildTuft(w: number, h: number): THREE.BufferGeometry {
  const p: number[] = [], n: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let q = 0; q < 3; q++) {
    const a = (q * Math.PI) / 3, cx = Math.cos(a) * w / 2, cz = Math.sin(a) * w / 2, b = p.length / 3;
    p.push(-cx, 0, -cz, cx, 0, cz, cx, h, cz, -cx, h, -cz);
    uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    for (let i = 0; i < 4; i++) n.push(0, 1, 0);
    // Both windings with up normals: a DoubleSide material would flip the back normal down and render it black.
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3, b, b + 2, b + 1, b, b + 3, b + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

function grassTexture(rnd: () => number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  // Dense, short, evenly green blades: a mown lawn, not wild tufts.
  for (let i = 0; i < 34; i++) {
    const bx = 8 + rnd() * 240, tx = bx + (rnd() - 0.5) * 40, ty = 30 + rnd() * 90, wd = 3 + rnd() * 3;
    const grad = g.createLinearGradient(0, 256, 0, ty);
    grad.addColorStop(0, '#4a7a28');
    grad.addColorStop(1, rnd() > 0.5 ? '#7cb544' : '#6aa63a');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(bx - wd, 256);
    g.quadraticCurveTo(bx - 2, 150, tx, ty);
    g.quadraticCurveTo(bx + 4, 150, bx + wd, 256);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export class Vegetation {
  readonly group = new THREE.Group();
  readonly ready: Promise<void>;
  private readonly uTime = { value: 0 };
  private readonly geos: THREE.BufferGeometry[] = [];
  private readonly mats: THREE.Material[] = [];
  private readonly textures: THREE.Texture[] = [];
  private readonly meshes: THREE.InstancedMesh[] = [];
  private rnd = mulberry32(20240611);
  private readonly leafTris: number;

  constructor(private readonly assets: Assets, private readonly physics: PhysicsWorld, private readonly quality: QualityProfile) {
    this.group.name = 'Vegetation';
    this.leafTris = LEAF_TRIS_BY[quality.level];
    this.ready = this.build();
  }

  update(_dt: number, t: number): void {
    this.uTime.value = t;
  }

  dispose(): void {
    for (const m of this.meshes) { m.dispose(); m.removeFromParent(); }
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
    for (const t of this.textures) t.dispose();
    this.meshes.length = this.geos.length = this.mats.length = this.textures.length = 0;
  }

  // ---- build -------------------------------------------------------------------------------

  private async build() {
    let [tree, shrubA, shrubB] = await Promise.all([
      this.loadModel('jacaranda_tree', TREE_HEIGHT, 'tree'),
      this.loadModel('shrub_03', 0.9, 'shrub'),
      this.loadModel('shrub_03', 1, 'shrub'),
    ]);
    let hedge = await this.loadModel('shrub_03', HEDGE_HEIGHT, 'shrub');
    const keep = SHRUB_PARTS[this.quality.level];
    shrubA = this.biggest(shrubA, keep);
    shrubB = this.biggest(shrubB, keep);
    hedge = this.biggest(hedge, keep);
    this.placePalms();
    this.placeTrees(tree);
    this.placeHedges(hedge);
    this.placeBeds(shrubA, shrubB);
    this.placeGrass();
  }

  /** Keeps the n sub-meshes with the most triangles. */
  private biggest(parts: Part[], n: number): Part[] {
    return parts.length <= n ? parts : [...parts].sort((a, b) => triCount(b.geo) - triCount(a.geo)).slice(0, n);
  }

  private async loadModel(id: string, height: number, kind: 'tree' | 'shrub'): Promise<Part[]> {
    try {
      // Hero trees are pre-decimated by scripts/optimize-vegetation.mjs.
      const file = LITE_MODELS.includes(id) ? `${id}_lite.glb` : `${id}_1k.gltf`;
      const gltf = await this.assets.loadGLTF(`${MODEL_DIR}/${id}/${file}`);
      return this.extractParts(gltf.scene, height, kind);
    } catch {
      return this.fallback(height, kind);
    }
  }

  /** Bake every mesh of a glTF into one local frame: base at y = 0, centred on xz, `height` tall. */
  private extractParts(scene: THREE.Object3D, height: number, kind: 'tree' | 'shrub' = 'tree'): Part[] {
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const s = height / Math.max(size.y, 1e-3);
    const norm = new THREE.Matrix4().makeScale(s, s, s).multiply(new THREE.Matrix4().makeTranslation(-c.x, -box.min.y, -c.z));
    const parts: Part[] = [];
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      // Poly Haven hero trees are millions of triangles: drop twigs, thin leaf cards.
      const label = m.name + ' ' + ((Array.isArray(m.material) ? m.material[0] : m.material).name ?? '');
      if (/branch/i.test(label)) return;
      const src = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial;
      let geo = m.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(norm, m.matrixWorld));
      const mat = src.clone();
      if (/leaf|leaves/i.test(label) && triCount(geo) > this.leafTris) geo = thinCards(geo, Math.ceil(triCount(geo) / this.leafTris));
      mat.side = THREE.DoubleSide;
      if (mat.transparent || mat.alphaTest > 0) { mat.transparent = false; mat.alphaTest = mat.alphaTest || 0.5; mat.depthWrite = true; }
      mat.metalness = 0;
      // shrub_03's albedo reads dry and brown: push hedges and beds toward a well-watered green.
      if (kind === 'shrub' && !/bark|trunk|stem/i.test(label)) mat.color.setRGB(0.6, 0.95, 0.45);
      this.geos.push(geo);
      this.mats.push(mat);
      parts.push({ geo, mat });
    });
    return parts;
  }

  /** Procedural stand-in if a model fails to load. */
  private fallback(height: number, kind: 'tree' | 'shrub'): Part[] {
    const leaf = new THREE.MeshStandardMaterial({ color: 0x3f7a2c, roughness: 0.85, flatShading: true });
    this.mats.push(leaf);
    const parts: Part[] = [];
    if (kind === 'tree') {
      const trunk = new THREE.CylinderGeometry(0.12, 0.2, height * 0.5, 7).translate(0, height * 0.25, 0);
      const bark = new THREE.MeshStandardMaterial({ color: 0x5a4636, roughness: 1 });
      const crown = new THREE.IcosahedronGeometry(height * 0.32, 1).scale(1, 0.85, 1).translate(0, height * 0.7, 0);
      this.geos.push(trunk, crown);
      this.mats.push(bark);
      parts.push({ geo: trunk, mat: bark }, { geo: crown, mat: leaf });
    } else {
      const g = new THREE.IcosahedronGeometry(height * 0.5, 1).scale(1, 0.8, 1).translate(0, height * 0.4, 0);
      this.geos.push(g);
      parts.push({ geo: g, mat: leaf });
    }
    return parts;
  }

  /** Vertex wind sway (grows with local height) on `mat` + a matching depth material for shadows. */
  private wind(mat: THREE.MeshStandardMaterial, amp: number, flex = 0): THREE.MeshDepthMaterial {
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: mat.side });
    if (mat.alphaTest > 0 && mat.map) { depth.map = mat.map; depth.alphaTest = mat.alphaTest; }
    const patch = (shader: { uniforms: Record<string, { value: unknown }>; vertexShader: string }) => {
      shader.uniforms.uTime = this.uTime;
      shader.uniforms.uAmp = { value: amp };
      shader.uniforms.uFlex = { value: flex };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
uniform float uTime; uniform float uAmp; uniform float uFlex;
${flex > 0 ? 'attribute float aFlex;' : ''}`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
{
  vec3 ip = instanceMatrix[3].xyz;
  float h = max(position.y, 0.0);
  float ph = dot(ip.xz, vec2(0.31, 0.23));
  float gust = 0.5 + 0.5 * sin(uTime * 0.35 + ip.x * 0.045 + ip.z * 0.03);
  float w = sin(uTime * 1.4 + ph) + 0.45 * sin(uTime * 2.9 + ph * 1.9);
  float sw = w * (0.5 + gust) * uAmp * h * h;
  transformed.x += sw * 0.8;
  transformed.z += sw * 0.6;
  ${flex > 0 ? `float fl = sin(uTime * 4.0 + position.x * 3.0 + ph) * aFlex * uFlex * (0.5 + gust);
  transformed.y += fl * 0.5; transformed.x += fl * 0.3;` : ''}
}`);
    };
    const key = `veg-wind-${amp}-${flex}`;
    mat.onBeforeCompile = patch;
    mat.customProgramCacheKey = () => key;
    depth.onBeforeCompile = patch;
    depth.customProgramCacheKey = () => key + '-d';
    this.mats.push(depth);
    return depth;
  }

  private instanced(part: Part, mats: THREE.Matrix4[], cast: boolean, amp: number, flex = 0): THREE.InstancedMesh {
    const m = new THREE.InstancedMesh(part.geo, part.mat, mats.length);
    mats.forEach((mx, i) => m.setMatrixAt(i, mx));
    m.instanceMatrix.needsUpdate = true;
    m.castShadow = cast;
    m.receiveShadow = true;
    if (amp > 0) m.customDepthMaterial = this.wind(part.mat, amp, flex);
    m.computeBoundingSphere();
    m.boundingSphere!.radius += 1.5; // wind slack
    this.group.add(m);
    this.meshes.push(m);
    return m;
  }

  private matrices(places: Place[]): THREE.Matrix4[] {
    const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    return places.map((p) => new THREE.Matrix4().compose(
      new THREE.Vector3(p.x, 0, p.z), q.setFromAxisAngle(up, p.yaw),
      new THREE.Vector3(p.s * (p.sxz ?? 1), p.s, p.s * (p.sxz ?? 1)),
    ));
  }

  private place(model: Part[], places: Place[], cast: boolean, amp: number) {
    if (!places.length) return;
    const mx = this.matrices(places);
    // Spatial chunks so frustum culling works per batch.
    const cells = new Map<string, number[]>();
    places.forEach((p, i) => {
      const k = `${Math.floor(p.x / CHUNK)},${Math.floor(p.z / CHUNK)}`;
      const l = cells.get(k);
      if (l) l.push(i); else cells.set(k, [i]);
    });
    for (const ids of cells.values()) {
      const sub = ids.map((i) => mx[i]);
      for (const part of model) this.instanced(part, sub, cast, amp);
    }
  }

  private trunkCollider(x: number, z: number, h: number) {
    this.physics.addBox(new THREE.Vector3(x, h / 2, z), new THREE.Vector3(TRUNK_SIZE, h, TRUNK_SIZE));
  }

  // ---- palms -------------------------------------------------------------------------------

  private placePalms() {
    const rnd = this.rnd;
    // Anchors: pool sides, back lawn, front lawn.
    const anchors: [number, number][] = [
      [-12, -18], [12, -17], [-11.5, -27], [12, -27], [-5, -31], [6, -32],
      [-14, 21], [-4, 25], [8, 24], [-24, 18], [26, -2], [-27, -3],
    ];
    const pts: Place[] = [];
    for (const [ax, az] of anchors) {
      const x = ax + (rnd() - 0.5) * 2, z = az + (rnd() - 0.5) * 2;
      if (isFree(x, z, 1.5)) pts.push({ x, z, yaw: rnd() * Math.PI * 2, s: 0.86 + rnd() * 0.42 });
    }
    for (let tries = 0; pts.length < 8 && tries < 400; tries++) {
      const x = PLOT.x0 + rnd() * (PLOT.x1 - PLOT.x0), z = PLOT.z0 + rnd() * (PLOT.z1 - PLOT.z0);
      if (isFree(x, z, 2)) pts.push({ x, z, yaw: rnd() * Math.PI * 2, s: 0.86 + rnd() * 0.42 });
    }
    const bark = pbrMaterial(this.assets, 'bark_brown_02', { repeat: 1 / 1.2, color: 0xb8a898 });
    bark.side = THREE.DoubleSide;
    const leaf = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65, side: THREE.DoubleSide });
    this.mats.push(bark, leaf);
    const variants = [0.1, -0.14, 0.2].map((b) => buildPalm(PALM_HEIGHT, b, rnd));
    variants.forEach((v) => this.geos.push(v.trunk, v.crown));
    variants.forEach((v, vi) => {
      const mine = pts.filter((_, i) => i % 3 === vi);
      if (!mine.length) return;
      const mx = this.matrices(mine);
      this.instanced({ geo: v.trunk, mat: bark }, mx, true, 0.0055);
      this.instanced({ geo: v.crown, mat: leaf }, mx, true, 0.0055, 0.35);
    });
    for (const p of pts) this.trunkCollider(p.x, p.z, 3);
  }

  // ---- broadleaf trees ---------------------------------------------------------------------

  private placeTrees(model: Part[]) {
    const rnd = this.rnd, pts: Place[] = [];
    const n = TREE_COUNT[this.quality.level], span = PLOT.x1 - PLOT.x0 - 12;
    for (let i = 0; i < n; i++) {
      const x = PLOT.x0 + 6 + (span * (i + 0.5)) / n + (rnd() - 0.5) * 3;
      const z = PLOT.z0 + 3.4 + rnd() * 1.6;
      if (isFree(x, z, 1.5)) pts.push({ x, z, yaw: rnd() * Math.PI * 2, s: 0.85 + rnd() * 0.32 });
    }
    this.place(model, pts, true, 0.0022);
    for (const p of pts) this.trunkCollider(p.x, p.z, 3);
  }

  // ---- hedges ------------------------------------------------------------------------------

  private placeHedges(model: Part[]) {
    const rnd = this.rnd, pts: Place[] = [], step = HEDGE_STEP[this.quality.level], thick = 0.9;
    const widen = 1 + (step / 1.2 - 1) * 0.5; // fewer bushes -> wider ones, hedge stays continuous
    const c = HEDGE_INSET;
    const sides: { a: [number, number]; b: [number, number] }[] = [
      { a: [PLOT.x0 + c, PLOT.z0 + c], b: [PLOT.x1 - c, PLOT.z0 + c] },
      { a: [PLOT.x0 + c, PLOT.z1 - c], b: [PLOT.x1 - c, PLOT.z1 - c] },
      { a: [PLOT.x0 + c, PLOT.z0 + c], b: [PLOT.x0 + c, PLOT.z1 - c] },
      { a: [PLOT.x1 - c, PLOT.z0 + c], b: [PLOT.x1 - c, PLOT.z1 - c] },
    ];
    for (const { a, b } of sides) {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.floor(len / step);
      const alongX = a[1] === b[1];
      let run: [number, number][] = [];
      const flush = () => {
        if (run.length) {
          const first = run[0], last = run[run.length - 1];
          const cx = (first[0] + last[0]) / 2, cz = (first[1] + last[1]) / 2;
          const lx = alongX ? Math.abs(last[0] - first[0]) + step : thick;
          const lz = alongX ? thick : Math.abs(last[1] - first[1]) + step;
          this.physics.addBox(new THREE.Vector3(cx, HEDGE_HEIGHT / 2, cz), new THREE.Vector3(lx, HEDGE_HEIGHT, lz));
        }
        run = [];
      };
      for (let i = 0; i <= n; i++) {
        const t = i / n, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
        if (!isFree(x, z, 0.5, 0)) { flush(); continue; }
        pts.push({ x, z, yaw: rnd() * Math.PI * 2, s: 0.95 + rnd() * 0.15, sxz: (1.15 + rnd() * 0.2) * widen });
        run.push([x, z]);
      }
      flush();
    }
    this.place(model, pts, false, 0.02);
  }

  // ---- beds near the facade and paths ------------------------------------------------------

  /** Clipped boxwood: a few jittered, overlapping spheres (reads dense and tended, unlike the sparse scan). */
  private boxwood(seed: number): Part[] {
    const rnd = mulberry32(seed), parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 4; i++) {
      const r = 0.28 + rnd() * 0.12;
      const g = mergeVertices(new THREE.IcosahedronGeometry(r, 3));
      const p = g.getAttribute('position');
      for (let k = 0; k < p.count; k++) {
        const f = 1 + (rnd() - 0.5) * 0.18;
        p.setXYZ(k, p.getX(k) * f, p.getY(k) * f * 0.85, p.getZ(k) * f);
      }
      g.translate((rnd() - 0.5) * 0.35, r * 0.8, (rnd() - 0.5) * 0.35);
      parts.push(g);
    }
    const geo = mergeGeometries(parts)!;
    for (const g of parts) g.dispose();
    geo.computeVertexNormals();
    const tex = this.leafNoise(rnd);
    const mat = new THREE.MeshStandardMaterial({ color: rnd() > 0.5 ? 0x5c8f3e : 0x6a9a46, map: tex, bumpMap: tex, bumpScale: 2.5, roughness: 0.9 });
    this.geos.push(geo);
    this.mats.push(mat);
    return [{ geo, mat }];
  }

  /** Speckled leaf mass (canvas), used as albedo and bump so the bush reads as foliage, not a blob. */
  private leafNoise(rnd: () => number): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    g.fillStyle = '#6f8f5a';
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 900; i++) {
      const l = 35 + rnd() * 50;
      g.fillStyle = `hsl(${95 + rnd() * 25}, 45%, ${l}%)`;
      g.beginPath();
      g.ellipse(rnd() * 128, rnd() * 128, 1.5 + rnd() * 2.5, 1 + rnd() * 1.5, rnd() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 3);
    this.textures.push(t);
    return t;
  }

  private placeBeds(_a: Part[], _b: Part[]) {
    const a = this.boxwood(11), b = this.boxwood(23);
    const rnd = this.rnd, pa: Place[] = [], pb: Place[] = [];
    const add = (x: number, z: number) => {
      x += (rnd() - 0.5) * 0.6; z += (rnd() - 0.5) * 0.6;
      if (!isFree(x, z, 0.5)) return;
      if (rnd() > BED_KEEP[this.quality.level]) return;
      (rnd() > 0.5 ? pa : pb).push({ x, z, yaw: rnd() * Math.PI * 2, s: 0.7 + rnd() * 0.6 });
    };
    const fz = FOOTPRINT.z1 + FOOTPRINT_EXTRA + 0.7;
    for (let x = FOOTPRINT.x0 - 1; x <= FOOTPRINT.x1 + 1; x += 1.3) {
      if (rnd() > 0.25) add(x, fz);
      if (rnd() > 0.5) add(x, fz + 0.9);
    }
    for (const sx of [FOOTPRINT.x0 - FOOTPRINT_EXTRA - 0.7, FOOTPRINT.x1 + FOOTPRINT_EXTRA + 0.7]) {
      for (let z = FOOTPRINT.z0; z <= FOOTPRINT.z1; z += 1.4) if (rnd() > 0.3) add(sx, z);
    }
    for (const p of FRONT_PATHS) {
      const alongZ = p.z1 - p.z0 > p.x1 - p.x0;
      if (alongZ) for (let z = p.z0 + 1; z < p.z1; z += 1.8) { add(p.x0 - 0.8, z); add(p.x1 + 0.8, z); }
      else for (let x = p.x0 + 1; x < p.x1; x += 1.8) { add(x, p.z0 - 0.8); add(x, p.z1 + 0.8); }
    }
    this.place(a, pa, false, 0.02);
    this.place(b, pb, false, 0.02);
  }

  // ---- grass tufts -------------------------------------------------------------------------

  private placeGrass() {
    const count = GRASS_COUNTS[this.quality.level];
    if (!count) return;
    const rnd = this.rnd;
    const tex = grassTexture(rnd);
    this.textures.push(tex);
    const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, roughness: 1, metalness: 0 });
    const geo = buildTuft(0.4, 0.12);
    this.geos.push(geo);
    this.mats.push(mat);
    const x0 = Math.max(PLOT.x0, FOOTPRINT.x0 - GRASS_RADIUS), x1 = Math.min(PLOT.x1, FOOTPRINT.x1 + GRASS_RADIUS);
    const z0 = Math.max(PLOT.z0, FOOTPRINT.z0 - GRASS_RADIUS), z1 = Math.min(PLOT.z1, FOOTPRINT.z1 + GRASS_RADIUS);
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3(), sc = new THREE.Vector3(), col = new THREE.Color();
    let n = 0;
    for (let tries = 0; n < count && tries < count * 8; tries++) {
      const x = x0 + rnd() * (x1 - x0), z = z0 + rnd() * (z1 - z0);
      const dx = Math.max(FOOTPRINT.x0 - x, 0, x - FOOTPRINT.x1), dz = Math.max(FOOTPRINT.z0 - z, 0, z - FOOTPRINT.z1);
      if (Math.hypot(dx, dz) > GRASS_RADIUS || !isFree(x, z, 0.3, 0.3)) continue;
      const s = 0.7 + rnd() * 0.8;
      m.compose(pos.set(x, 0, z), q.setFromAxisAngle(up, rnd() * Math.PI), sc.set(s, s * (0.8 + rnd() * 0.5), s));
      mesh.setMatrixAt(n, m);
      mesh.setColorAt(n, col.setRGB(0.85 + rnd() * 0.15, 0.9 + rnd() * 0.1, 0.75 + rnd() * 0.15));
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.receiveShadow = true;
    this.wind(mat, 0.28);
    mesh.frustumCulled = false;
    this.group.add(mesh);
    this.meshes.push(mesh);
  }
}
