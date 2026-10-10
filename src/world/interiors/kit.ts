import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Assets } from '@/engine/assets';
import type { QualityProfile } from '@/engine/quality';
import type { PhysicsWorld } from '@/physics/PhysicsWorld';
import { LEVELS, ROOMS, roomAt, type Rect } from '@/data/floorplan';
import { pbrMaterial } from '../materials';

const Y = new THREE.Vector3(0, 1, 0);

export interface Place {
  x: number;
  z: number;
  /** Bottom of the object (default: floor of `level`). */
  y?: number;
  level?: 0 | 1;
  /** Rotation around Y (radians). */
  rot?: number;
  /** Uniform scale so the model is this tall (m); or `scale` directly. */
  height?: number;
  scale?: number;
  /** Adds a box collider from the placed bounding box. */
  solid?: boolean;
  /** Variant letter for packs holding several props side by side (`<id>_a`, `<id>_b`…); default picked from x/z. */
  variant?: string;
  /** Plants shipped without a pot: adds a ceramic planter and sets the plant in it (`height` = total). */
  pot?: boolean;
}

/** Floor top (finished) of a level. */
export const floorY = (level: 0 | 1) => LEVELS[level].floor;

/** Rectangles and floor height of a room from floorplan.ts. */
export function room(id: string): { rects: Rect[]; r: Rect; y: number; level: 0 | 1 } {
  const rm = ROOMS.find((o) => o.id === id);
  if (!rm) throw new Error(`unknown room ${id}`);
  return { rects: rm.rects, r: rm.rects[0], y: floorY(rm.level), level: rm.level };
}

/**
 * Shared toolkit for interior modules: Poly Haven GLB props (models/interior/<id>.glb, preloaded,
 * snapped to the floor, optionally solid), procedural parts with shared materials, colliders.
 */
export class InteriorKit {
  readonly group = new THREE.Group();
  /** Props cast shadows except on the low profile. */
  private get shadows() { return this.profile.level !== 'low'; }
  private readonly protos = new Map<string, THREE.Object3D>();
  private readonly variants = new Map<string, THREE.Object3D>();
  private readonly geos: THREE.BufferGeometry[] = [];
  private readonly mats: THREE.Material[] = [];

  // Shared materials for procedural furniture.
  readonly oak: THREE.MeshStandardMaterial;
  readonly walnut: THREE.MeshStandardMaterial;
  readonly marble: THREE.MeshStandardMaterial;
  readonly lacquer = this.mat({ color: 0xf1eee8, roughness: 0.35 });
  readonly graphite = this.mat({ color: 0x2b2c2e, roughness: 0.5 });
  readonly chrome = this.mat({ color: 0xdfe2e4, metalness: 1, roughness: 0.12 });
  readonly brass = this.mat({ color: 0xc9a46a, metalness: 1, roughness: 0.3 });
  readonly blackMetal = this.mat({ color: 0x18191b, metalness: 0.7, roughness: 0.4 });
  readonly ceramic = this.mat({ color: 0xf7f7f5, roughness: 0.15 });
  readonly linen = this.mat({ color: 0xece6dc, roughness: 0.95 });
  readonly fabricBeige = this.mat({ color: 0xc8b9a2, roughness: 0.95 });
  readonly fabricGrey = this.mat({ color: 0x8a8782, roughness: 0.95 });
  readonly fabricBlue = this.mat({ color: 0x3d5468, roughness: 0.95 });
  readonly towel = this.mat({ color: 0xf2efe8, roughness: 1 });
  readonly screen = this.mat({ color: 0x050607, roughness: 0.08, metalness: 0.2 });
  readonly soil = this.mat({ color: 0x2b2019, roughness: 1 });
  readonly mirror = this.mat({ color: 0xffffff, metalness: 1, roughness: 0.02 });
  readonly glass = this.track(new THREE.MeshPhysicalMaterial({
    color: 0xeef4f2, roughness: 0.03, ior: 1.5, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide,
  }));

  constructor(private readonly assets: Assets, private readonly physics: PhysicsWorld, readonly profile: QualityProfile) {
    this.oak = this.track(pbrMaterial(assets, 'oak_wood_planks', { repeat: 1 / 1.2, color: 0xd8c8b4 }));
    this.walnut = this.track(pbrMaterial(assets, 'oak_wood_planks', { repeat: 1 / 1.2, color: 0x6e5240 }));
    this.marble = this.track(pbrMaterial(assets, 'marble_01', { repeat: 1 / 1.5, roughness: 0.3 }));
  }

  private track<M extends THREE.Material>(m: M): M {
    this.mats.push(m);
    return m;
  }
  mat(p: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
    return this.track(new THREE.MeshStandardMaterial(p));
  }

  /** Loads GLB props once; await before placing them. */
  async preload(ids: string[]) {
    await Promise.all(ids.filter((id) => !this.protos.has(id)).map(async (id) => {
      const gltf = await this.assets.loadGLTF(`models/interior/${id}.glb`);
      gltf.scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) m.castShadow = m.receiveShadow = this.shadows;
      });
      this.protos.set(id, gltf.scene);
    }));
  }

  /** Native size (m) of a preloaded prop. */
  dims(id: string): THREE.Vector3 {
    return new THREE.Box3().setFromObject(this.proto(id)).getSize(new THREE.Vector3());
  }

  private proto(id: string) {
    const p = this.protos.get(id);
    if (!p) throw new Error(`prop ${id} not preloaded`);
    return p;
  }

  /**
   * Some Poly Haven packs (pachira, calathea…) lay several variants side by side, meshes suffixed
   * `_a`, `_b`… Keeping them all scatters plants over metres and through walls: keep only one.
   */
  private variant(id: string, p: Place): THREE.Object3D {
    const src = this.proto(id);
    const letters = new Set<string>();
    src.traverse((o) => {
      const m = /_([a-z])$/.exec(o.name);
      if ((o as THREE.Mesh).isMesh && m) letters.add(m[1]);
    });
    if (letters.size < 2) return src;
    const list = [...letters].sort();
    const v = p.variant && letters.has(p.variant) ? p.variant : list[Math.abs(Math.round(p.x * 7 + p.z * 13)) % list.length];
    const key = `${id}|${v}`;
    let out = this.variants.get(key);
    if (!out) {
      out = src.clone();
      const drop: THREE.Object3D[] = [];
      out.traverse((o) => {
        const m = /_([a-z])$/.exec(o.name);
        if ((o as THREE.Mesh).isMesh && m && m[1] !== v) drop.push(o);
      });
      for (const o of drop) o.removeFromParent();
      this.variants.set(key, out);
    }
    return out;
  }

  /** Places a clone of a prop, its bottom on the floor (or `y`), centred on (x, z). */
  model(id: string, p: Place): THREE.Object3D {
    if (p.pot) {
      const total = p.height ?? 1;
      const ph = Math.min(0.45, total * 0.24), pr = ph * 0.62, y0 = p.y ?? floorY(p.level ?? 0);
      this.cyl(this.graphite, pr * 0.78, ph, p.x, y0, p.z, 28, pr);
      this.cyl(this.soil, pr * 0.95, 0.01, p.x, y0 + ph - 0.04, p.z, 24);
      if (p.solid) this.collider(pr * 2, ph, pr * 2, p.x, y0, p.z);
      return this.model(id, { ...p, pot: false, solid: false, y: y0 + ph - 0.05, height: total - ph + 0.05 });
    }
    const src = this.variant(id, p);
    const box = new THREE.Box3().setFromObject(src);
    const size = box.getSize(new THREE.Vector3());
    const s = p.scale ?? (p.height ? p.height / size.y : 1);
    const pivot = new THREE.Group();
    const obj = src.clone();
    const c = box.getCenter(new THREE.Vector3());
    obj.position.set(-c.x, -box.min.y, -c.z);
    pivot.add(obj);
    pivot.scale.setScalar(s);
    pivot.rotation.y = p.rot ?? 0;
    pivot.position.set(p.x, p.y ?? floorY(p.level ?? 0), p.z);
    this.group.add(pivot);
    if (p.solid) {
      const q = new THREE.Quaternion().setFromAxisAngle(Y, p.rot ?? 0);
      this.physics.addBox(new THREE.Vector3(p.x, pivot.position.y + (size.y * s) / 2, p.z), size.clone().multiplyScalar(s), q);
    }
    return pivot;
  }

  /** Procedural box (centre x, z; bottom at y). Rounded corners if `radius` > 0. */
  box(mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number, rot = 0, radius = 0): THREE.Mesh {
    const g = radius > 0 ? new RoundedBoxGeometry(w, h, d, 2, radius) : new THREE.BoxGeometry(w, h, d);
    return this.add(g, mat, x, y + h / 2, z, rot);
  }

  /** Procedural cylinder (centre x, z; bottom at y). */
  cyl(mat: THREE.Material, r: number, h: number, x: number, y: number, z: number, seg = 24, rTop = r): THREE.Mesh {
    return this.add(new THREE.CylinderGeometry(rTop, r, h, seg), mat, x, y + h / 2, z, 0);
  }

  /** Adds any geometry centred at (x, y, z). */
  add(g: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, rot = 0): THREE.Mesh {
    this.geos.push(g);
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, y, z);
    m.rotation.y = rot;
    m.castShadow = m.receiveShadow = this.shadows;
    this.group.add(m);
    return m;
  }

  private readonly reflectors: { mesh: Reflector; roomId: string | null }[] = [];
  private static readonly MAX_MIRRORS = 6;

  /**
   * Mirror plate (centre x, z; bottom at y; facing (sin rot, cos rot)). Real planar Reflector on medium/ultra
   * (max 6, kept out of the merge, shown only when the viewer is in its room); metal plate otherwise.
   */
  mirrorPlate(w: number, h: number, x: number, y: number, z: number, rot: number, depth = 0.02) {
    if (this.profile.level === 'low' || this.reflectors.length >= InteriorKit.MAX_MIRRORS) {
      this.box(this.mirror, w, h, depth, x, y, z, rot);
      return;
    }
    const res = (this.profile.level === 'ultra' ? 512 : 256) * this.profile.pixelRatio;
    const mesh = new Reflector(new THREE.PlaneGeometry(w, h), {
      textureWidth: Math.round(res), textureHeight: Math.round(res), clipBias: 0.003, color: 0xd9dede,
    });
    const sx = Math.sin(rot), cz = Math.cos(rot);
    mesh.position.set(x + sx * (depth / 2 + 0.001), y + h / 2, z + cz * (depth / 2 + 0.001));
    mesh.rotation.y = rot;
    mesh.visible = false;
    const rm = roomAt(x + sx * 0.4, y + h / 2, z + cz * 0.4);
    this.reflectors.push({ mesh, roomId: rm ? rm.id : null });
  }

  /** Adds the real mirrors to the group (call after finalize, which clears the group). */
  attachMirrors() {
    for (const r of this.reflectors) this.group.add(r.mesh);
  }

  /** Only the mirrors of the viewer's room render their reflection. */
  setMirrorRoom(roomId: string | null) {
    for (const r of this.reflectors) r.mesh.visible = roomId !== null && r.roomId === roomId;
  }

  /** Box collider (centre x, z; bottom at y). */
  collider(w: number, h: number, d: number, x: number, y: number, z: number, rot = 0) {
    this.physics.addBox(new THREE.Vector3(x, y + h / 2, z), new THREE.Vector3(w, h, d), new THREE.Quaternion().setFromAxisAngle(Y, rot));
  }

  /**
   * Bakes every static mesh into one merged mesh per material (hundreds of props → a few dozen
   * draw calls, shadow pass included). Call once, after all rooms are furnished.
   */
  finalize() {
    this.group.updateMatrixWorld(true);
    const byMat = new Map<string, { mat: THREE.Material; list: THREE.BufferGeometry[] }>();
    const matIds = new Map<THREE.Material, number>();
    const c = new THREE.Vector3();
    const bb = new THREE.Box3();
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || Array.isArray(m.material)) return;
      const src = m.geometry;
      const g = new THREE.BufferGeometry();
      for (const name of ['position', 'normal', 'uv'] as const) {
        const a = src.getAttribute(name);
        if (a) g.setAttribute(name, a.clone());
      }
      const n = g.getAttribute('position').count;
      if (!g.getAttribute('normal')) g.computeVertexNormals();
      if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
      g.setIndex(src.index ? Array.from(src.index.array) : Array.from({ length: n }, (_, i) => i));
      g.applyMatrix4(m.matrixWorld);
      g.computeBoundingBox();
      g.boundingBox!.getCenter(c);
      const lvl = c.y > (LEVELS[0].ceiling + LEVELS[1].floor) / 2 ? 1 : 0;
      const rm = roomAt(c.x, c.y, c.z);
      const cell = rm ? `r:${rm.id}` : `g:${lvl}:${Math.floor(c.x / 6)}:${Math.floor(c.z / 6)}`;
      let mid = matIds.get(m.material);
      if (mid === undefined) { mid = matIds.size; matIds.set(m.material, mid); }
      const key = `${mid}|${cell}`;
      const e = byMat.get(key) ?? { mat: m.material, list: [] };
      e.list.push(g);
      byMat.set(key, e);
    });
    for (const g of this.geos) g.dispose();
    this.geos.length = 0;
    this.group.clear();
    for (const { mat, list } of byMat.values()) {
      const merged = mergeGeometries(list);
      for (const g of list) g.dispose();
      if (!merged) continue;
      merged.computeBoundingBox();
      merged.computeBoundingSphere();
      bb.copy(merged.boundingBox!);
      const mesh = this.add(merged, mat, 0, 0, 0);
      mesh.userData.box = bb.clone();
      if (!this.mats.includes(mat)) this.mats.push(mat);
    }
  }

  /** Hides merged meshes whose bbox is farther than `range` m from `pos` (also skips their shadow pass). */
  cull(pos: THREE.Vector3, range: number) {
    for (const o of this.group.children) {
      const b = o.userData.box as THREE.Box3 | undefined;
      if (b) o.visible = b.distanceToPoint(pos) <= range;
    }
  }

  dispose() {
    for (const r of this.reflectors) { r.mesh.geometry.dispose(); r.mesh.dispose(); }
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
  }
}
