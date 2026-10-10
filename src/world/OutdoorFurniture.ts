import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Assets } from '@/engine/assets';
import type { QualityProfile } from '@/engine/quality';
import type { PhysicsWorld } from '@/physics/PhysicsWorld';
import { FIRE_PIT, LOUNGERS, OUTDOOR_KITCHEN, PLINTH } from '@/data/floorplan';
import { MeshBatcher, worldBox } from './geometry';
import { pbrMaterial } from './materials';

// Local dimensions (metres) not in floorplan.ts.
const COUNTER = { depth: 0.65, h: 0.86, bar: 1.0, top: 0.06, overhang: 0.05, inset: 0.4, ret: 2.3, barDepth: 1.05 };
const TABLE = { len: 2.6, wid: 0.95, h: 0.75, offX: -0.4, fromFront: 3.4 };
const PERGOLA = { post: 0.14, inset: 0.2, beamH: 0.24, slat: 0.06, slatPitch: 0.3 };
const BENCH = { depth: 0.5, base: 0.42, spanDeg: 100, segs: 4, centersDeg: [105, 225, 345] };
const PARASOL = { half: 1.98, pole: 2.5 };

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const Y = new THREE.Vector3(0, 1, 0);

interface Part { mat: THREE.Material; geo: THREE.BufferGeometry }

/** Box with metric UVs, optionally rotated, centred at (x, y, z). */
function box(w: number, h: number, d: number, x: number, y: number, z: number, rx = 0, ry = 0) {
  const g = worldBox(w, h, d);
  if (rx) g.rotateX(rx);
  if (ry) g.rotateY(ry);
  return g.translate(x, y, z);
}
function rbox(w: number, h: number, d: number, x: number, y: number, z: number, rx = 0, ry = 0) {
  const g = new RoundedBoxGeometry(w, h, d, 2, 0.03);
  if (rx) g.rotateX(rx);
  if (ry) g.rotateY(ry);
  return g.translate(x, y, z);
}
function cyl(r0: number, r1: number, h: number, x: number, y: number, z: number, seg = 16) {
  return new THREE.CylinderGeometry(r0, r1, h, seg).translate(x, y, z);
}
function placement(x: number, y: number, z: number, ry = 0) {
  return new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromAxisAngle(Y, ry), V(1, 1, 1));
}

export class OutdoorFurniture {
  readonly group = new THREE.Group();
  readonly ready: Promise<void> = Promise.resolve();

  private readonly mats: THREE.Material[] = [];
  private readonly geos: THREE.BufferGeometry[] = [];
  private readonly instances: THREE.InstancedMesh[] = [];
  private ember!: THREE.MeshStandardMaterial;
  private fireLight?: THREE.PointLight;

  private readonly shadows: boolean;
  private readonly wood: THREE.MeshStandardMaterial;
  private readonly stone: THREE.MeshStandardMaterial;
  private readonly marble: THREE.MeshStandardMaterial;
  private readonly concrete: THREE.MeshStandardMaterial;
  private readonly steel = this.track(new THREE.MeshStandardMaterial({ color: 0xc9ccce, metalness: 1, roughness: 0.25 }));
  private readonly darkSteel = this.track(new THREE.MeshStandardMaterial({ color: 0x1c1d1f, metalness: 0.8, roughness: 0.4 }));
  private readonly alu = this.track(new THREE.MeshStandardMaterial({ color: 0xe6e3dc, metalness: 0.3, roughness: 0.5 }));
  private readonly cushion = this.track(new THREE.MeshStandardMaterial({ color: 0xb9ae9a, roughness: 0.95 }));
  private readonly canvas = this.track(new THREE.MeshStandardMaterial({ color: 0xece5d4, roughness: 0.9, side: THREE.DoubleSide }));

  constructor(
    assets: Assets,
    private readonly physics: PhysicsWorld,
    quality: QualityProfile,
  ) {
    this.shadows = quality.level !== 'low';
    this.wood = this.track(pbrMaterial(assets, 'oak_wood_planks', { repeat: 1 / 1.2, color: 0x9a7a58 }));
    this.stone = this.track(pbrMaterial(assets, 'castle_wall_slates', { repeat: 1 / 2.5, color: 0xd8d2c8 }));
    this.marble = this.track(pbrMaterial(assets, 'marble_01', { repeat: 1 / 1.5, roughness: 0.55 }));
    this.concrete = this.track(pbrMaterial(assets, 'concrete_floor_02', { repeat: 1 / 2, color: 0x8f8c86 }));
    this.concrete.side = THREE.DoubleSide;

    this.buildKitchen();
    this.buildLoungers();
    this.buildFirePit();
  }

  private track<M extends THREE.Material>(m: M): M {
    this.mats.push(m);
    return m;
  }

  private col(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, ry = 0) {
    const q = ry ? new THREE.Quaternion().setFromAxisAngle(Y, ry) : undefined;
    this.physics.addBox(V(cx, cy, cz), V(sx, sy, sz), q);
  }

  private addMesh(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = this.shadows;
    m.receiveShadow = true;
    this.geos.push(geo);
    this.group.add(m);
    return m;
  }

  /** Merge parts per material and add them as one InstancedMesh per material. */
  private instanced(parts: Part[], matrices: THREE.Matrix4[]) {
    const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
    for (const p of parts) {
      const l = byMat.get(p.mat) ?? [];
      l.push(p.geo);
      byMat.set(p.mat, l);
    }
    for (const [mat, list] of byMat) {
      const geo = mergeGeometries(list)!;
      list.forEach((g) => g.dispose());
      const im = new THREE.InstancedMesh(geo, mat, matrices.length);
      matrices.forEach((m, i) => im.setMatrixAt(i, m));
      im.castShadow = this.shadows;
      im.receiveShadow = true;
      this.geos.push(geo);
      this.instances.push(im);
      this.group.add(im);
    }
  }

  // ------------------------------------------------------------------ outdoor kitchen
  private buildKitchen() {
    const K = OUTDOOR_KITCHEN.rect, H = OUTDOOR_KITCHEN.pergolaHeight, T = PLINTH.top;
    const b = new MeshBatcher();
    const solid = (m: THREE.Material, a: number[], c: number[]) =>
      b.box(V(a[0], a[1], a[2]), V(c[0], c[1], c[2]), { px: m, nx: m, py: m, ny: m, pz: m, nz: m });

    // Stone slab
    solid(this.stone, [K.x0, 0, K.z0], [K.x1, T, K.z1]);
    this.col((K.x0 + K.x1) / 2, T / 2, (K.z0 + K.z1) / 2, K.x1 - K.x0, T, K.z1 - K.z0);

    // L counter: main run along the back + higher bar return on the east side
    const cz0 = K.z0 + 0.15, cz1 = cz0 + COUNTER.depth;
    const cx0 = K.x0 + COUNTER.inset, cx1 = K.x1 - COUNTER.inset;
    const topY = T + COUNTER.h;
    const bbq0 = cx0 + 1.5, bbq1 = bbq0 + 1.6; // stone-based barbecue module
    const cuts: [number, number, THREE.Material][] = [
      [cx0, bbq0, this.wood], [bbq0, bbq1, this.stone], [bbq1, bbq1 + 1.6, this.wood],
      [bbq1 + 1.6, bbq1 + 3.0, this.wood], [bbq1 + 3.0, cx1, this.wood],
    ];
    for (const [xa, xb, m] of cuts) {
      solid(m, [xa + 0.01, T, cz0 + 0.02], [xb - 0.01, topY, cz1 - 0.02]);
      if (m === this.wood) {
        const xm = (xa + xb) / 2; // door handle
        solid(this.steel, [xm - 0.15, T + 0.62, cz1 - 0.02], [xm + 0.15, T + 0.65, cz1 + 0.03]);
      }
    }
    solid(this.marble, [cx0 - 0.02, topY, cz0 - 0.02], [cx1, topY + COUNTER.top, cz1 + COUNTER.overhang]);
    this.col((cx0 + cx1) / 2, T + (COUNTER.h + COUNTER.top) / 2, (cz0 + cz1) / 2 + 0.02,
      cx1 - cx0, COUNTER.h + COUNTER.top, COUNTER.depth + 0.05);

    // Bar return, stools sit on its west overhang
    const bz0 = cz1 + COUNTER.overhang, bz1 = cz1 + COUNTER.ret;
    const bTop = T + COUNTER.bar;
    solid(this.wood, [cx1 - 0.65, T, cz1], [cx1 - 0.05, bTop, bz1]);
    solid(this.marble, [cx1 - COUNTER.barDepth, bTop, bz0], [cx1, bTop + COUNTER.top, bz1]);
    this.col(cx1 - COUNTER.barDepth / 2, T + (COUNTER.bar + COUNTER.top) / 2, (bz0 + bz1) / 2,
      COUNTER.barDepth, COUNTER.bar + COUNTER.top, bz1 - bz0);

    // Built-in barbecue on the stone module
    const y0 = topY + COUNTER.top, bx0 = bbq0 + 0.05, bx1 = bbq1 - 0.05;
    solid(this.steel, [bx0, y0, cz0 + 0.02], [bx1, y0 + 0.14, cz1 - 0.02]);
    solid(this.steel, [bx0, y0 + 0.14, cz0 + 0.02], [bx1, y0 + 0.36, cz0 + 0.38]); // hood
    solid(this.steel, [bx0 + 0.2, y0 + 0.27, cz0 + 0.38], [bx1 - 0.2, y0 + 0.30, cz0 + 0.45]); // handle
    solid(this.darkSteel, [bx0 + 0.05, y0 + 0.14, cz0 + 0.38], [bx1 - 0.05, y0 + 0.145, cz1 - 0.06]);
    for (let i = 0; i < 8; i++) { // grill bars
      const z = cz0 + 0.42 + i * 0.03;
      solid(this.darkSteel, [bx0 + 0.05, y0 + 0.145, z], [bx1 - 0.05, y0 + 0.16, z + 0.012]);
    }
    for (let i = 0; i < 4; i++) { // control knobs
      const x = bx0 + 0.25 + i * ((bx1 - bx0 - 0.5) / 3);
      solid(this.darkSteel, [x - 0.025, y0 + 0.04, cz1 - 0.02], [x + 0.025, y0 + 0.09, cz1 + 0.015]);
    }

    // Sink + tap in the last wood module
    const sx = bbq1 + 2.3;
    solid(this.steel, [sx - 0.45, y0, cz0 + 0.08], [sx + 0.45, y0 + 0.012, cz1 - 0.06]);
    solid(this.darkSteel, [sx - 0.35, y0 + 0.012, cz0 + 0.14], [sx + 0.35, y0 + 0.015, cz1 - 0.12]);
    solid(this.steel, [sx - 0.02, y0, cz0 + 0.09], [sx + 0.02, y0 + 0.3, cz0 + 0.13]);
    solid(this.steel, [sx - 0.02, y0 + 0.27, cz0 + 0.09], [sx + 0.02, y0 + 0.30, cz0 + 0.33]);

    // Dining table for 8
    const tcx = (K.x0 + K.x1) / 2 + TABLE.offX, tcz = K.z1 - TABLE.fromFront;
    const tTop = T + TABLE.h;
    solid(this.wood, [tcx - TABLE.len / 2, tTop - 0.05, tcz - TABLE.wid / 2], [tcx + TABLE.len / 2, tTop, tcz + TABLE.wid / 2]);
    for (const sx2 of [-1, 1]) for (const sz of [-1, 1]) {
      const lx = tcx + sx2 * (TABLE.len / 2 - 0.15), lz = tcz + sz * (TABLE.wid / 2 - 0.12);
      solid(this.steel, [lx - 0.04, T, lz - 0.04], [lx + 0.04, tTop - 0.05, lz + 0.04]);
    }
    this.col(tcx, T + TABLE.h / 2, tcz, TABLE.len, TABLE.h, TABLE.wid);

    // Pergola: posts, beams, slats
    const p = PERGOLA, pxs = [K.x0 + p.inset, K.x1 - p.inset], mid = (K.x0 + K.x1) / 2;
    const pzs = [K.z0 + p.inset, K.z1 - p.inset];
    const posts: [number, number][] = [[pxs[0], pzs[0]], [pxs[1], pzs[0]], [pxs[0], pzs[1]], [pxs[1], pzs[1]], [mid, pzs[1]]];
    for (const [x, z] of posts) {
      solid(this.wood, [x - p.post / 2, T, z - p.post / 2], [x + p.post / 2, H, z + p.post / 2]);
      this.col(x, (T + H) / 2, z, p.post, H - T, p.post);
    }
    for (const z of pzs) solid(this.wood, [K.x0, H - p.beamH, z - 0.06], [K.x1, H, z + 0.06]);
    for (let x = K.x0 + 0.1; x < K.x1; x += p.slatPitch) {
      solid(this.wood, [x, H, K.z0 - 0.1], [x + p.slat, H + 0.08, K.z1 + 0.1]);
    }
    for (const m of b.build(this.shadows)) {
      this.geos.push(m.geometry);
      this.group.add(m);
    }

    // Chairs (8) around the table; local +z = facing direction
    const chair: Part[] = [];
    for (const sx2 of [-1, 1]) {
      chair.push({ mat: this.steel, geo: box(0.035, 0.45, 0.035, sx2 * 0.2, 0.225, 0.2) });
      chair.push({ mat: this.steel, geo: box(0.035, 0.88, 0.035, sx2 * 0.2, 0.44, -0.2) });
    }
    chair.push({ mat: this.wood, geo: box(0.46, 0.04, 0.46, 0, 0.47, 0) });
    for (const y of [0.62, 0.72, 0.82]) chair.push({ mat: this.wood, geo: box(0.42, 0.07, 0.025, 0, y, -0.21) });
    chair.push({ mat: this.cushion, geo: rbox(0.4, 0.04, 0.4, 0, 0.51, 0.01) });
    const cm: THREE.Matrix4[] = [];
    for (const dx of [-0.8, 0, 0.8]) {
      cm.push(placement(tcx + dx, T, tcz - 0.6, 0), placement(tcx + dx, T, tcz + 0.6, Math.PI));
    }
    cm.push(placement(tcx - 1.42, T, tcz, Math.PI / 2), placement(tcx + 1.42, T, tcz, -Math.PI / 2));
    this.instanced(chair, cm);

    // Bar stools (4)
    const stool: Part[] = [
      { mat: this.wood, geo: cyl(0.19, 0.19, 0.05, 0, 0.745, 0, 24) },
      { mat: this.steel, geo: new THREE.TorusGeometry(0.14, 0.01, 6, 20).rotateX(Math.PI / 2).translate(0, 0.26, 0) },
    ];
    for (const sx2 of [-1, 1]) for (const sz of [-1, 1]) {
      stool.push({ mat: this.steel, geo: cyl(0.015, 0.015, 0.72, sx2 * 0.12, 0.36, sz * 0.12, 8) });
    }
    const stoolX = cx1 - COUNTER.barDepth + 0.2;
    const sm: THREE.Matrix4[] = [];
    for (let i = 0; i < 4; i++) sm.push(placement(stoolX, T, bz0 + 0.3 + i * ((bz1 - bz0 - 0.6) / 3)));
    this.instanced(stool, sm);
  }

  // ------------------------------------------------------------------ loungers + parasols
  private buildLoungers() {
    const T = PLINTH.top, z = LOUNGERS.z, tilt = (-35 * Math.PI) / 180;
    const lounger: Part[] = [];
    for (const sx of [-1, 1]) {
      const x = sx * 0.3;
      lounger.push({ mat: this.alu, geo: box(0.04, 0.05, 1.2, x, 0.28, -0.35) });
      lounger.push({ mat: this.alu, geo: box(0.04, 0.04, 0.8, x, 0.51, 0.53, tilt) });
      lounger.push({ mat: this.alu, geo: box(0.04, 0.28, 0.04, x, 0.14, -0.9) });
      lounger.push({ mat: this.alu, geo: box(0.04, 0.28, 0.04, x, 0.14, 0.15) });
      lounger.push({ mat: this.alu, geo: box(0.04, 0.5, 0.04, x, 0.25, 0.53) });
    }
    lounger.push({ mat: this.alu, geo: box(0.6, 0.04, 0.04, 0, 0.28, -0.9) });
    lounger.push({ mat: this.cushion, geo: rbox(0.6, 0.07, 1.15, 0, 0.335, -0.375) });
    lounger.push({ mat: this.cushion, geo: rbox(0.6, 0.07, 0.78, 0, 0.555, 0.498, tilt) });
    this.instanced(lounger, LOUNGERS.xs.map((x) => placement(x, T, z)));
    for (const x of LOUNGERS.xs) this.col(x, T + 0.25, z, 0.7, 0.5, 1.9);

    // Parasols: pole, base, square canopy
    const parasol: Part[] = [
      { mat: this.alu, geo: cyl(0.025, 0.025, PARASOL.pole, 0, PARASOL.pole / 2, 0, 10) },
      { mat: this.stone, geo: cyl(0.3, 0.32, 0.06, 0, 0.03, 0, 20) },
      { mat: this.canvas, geo: new THREE.ConeGeometry(PARASOL.half, 0.5, 4, 1, true).rotateY(Math.PI / 4).translate(0, PARASOL.pole - 0.25, 0) },
      { mat: this.alu, geo: cyl(0.02, 0.02, 0.15, 0, PARASOL.pole + 0.08, 0, 8) },
    ];
    this.instanced(parasol, LOUNGERS.parasolXs.map((x) => placement(x, T, z)));

    // Side tables between each lounger pair
    const side: Part[] = [
      { mat: this.stone, geo: cyl(0.16, 0.16, 0.4, 0, 0.2, 0, 20) },
      { mat: this.wood, geo: cyl(0.22, 0.22, 0.03, 0, 0.415, 0, 24) },
    ];
    this.instanced(side, LOUNGERS.parasolXs.map((x) => placement(x + 0.3, T, z + 0.35)));
  }

  // ------------------------------------------------------------------ fire pit
  private buildFirePit() {
    const { x, z, radius: R, benchRadius } = FIRE_PIT;

    // Concrete bowl (lathe profile)
    const pts = [[0.5, 0], [R, 0], [R + 0.02, 0.1], [R, 0.45], [R - 0.1, 0.47], [R - 0.14, 0.4], [R - 0.16, 0.3]]
      .map(([r, y]) => new THREE.Vector2(r, y));
    this.addMesh(new THREE.LatheGeometry(pts, 40), this.concrete, x, 0, z);
    this.col(x, 0.24, z, 2 * R * 0.92, 0.48, 2 * R * 0.92);
    this.col(x, 0.24, z, 2 * R * 0.92, 0.48, 2 * R * 0.92, Math.PI / 4);

    // Ember bed
    this.ember = this.track(new THREE.MeshStandardMaterial({
      color: 0x1a0d08, roughness: 1, emissive: 0xff4a10, emissiveIntensity: 0.8,
    }));
    this.addMesh(new THREE.CircleGeometry(R - 0.16, 32).rotateX(-Math.PI / 2), this.ember, x, 0.3, z).castShadow = false;
    const lumps = new THREE.DodecahedronGeometry(0.08, 0);
    const em = new THREE.InstancedMesh(lumps, this.ember, 14);
    for (let i = 0; i < 14; i++) {
      const a = (i * 2.399) % (Math.PI * 2), rr = 0.08 + ((i * 0.137) % 1) * (R - 0.32);
      const s = 0.7 + ((i * 0.31) % 1) * 0.7;
      em.setMatrixAt(i, new THREE.Matrix4().compose(
        V(x + Math.cos(a) * rr, 0.32, z + Math.sin(a) * rr),
        new THREE.Quaternion().setFromAxisAngle(Y, i), V(s, s * 0.7, s)));
    }
    this.geos.push(lumps);
    this.instances.push(em);
    this.group.add(em);
    this.fireLight = new THREE.PointLight(0xff7a30, 1.5, 8, 2);
    this.fireLight.position.set(x, 0.7, z);
    this.group.add(this.fireLight);

    // Curved benches: straight segments along an arc (stone base, wood top, cushion)
    const parts: Part[] = [];
    const span = (BENCH.spanDeg * Math.PI) / 180, dA = span / BENCH.segs;
    const len = 2 * benchRadius * Math.sin(dA / 2) + 0.03;
    for (const cDeg of BENCH.centersDeg) {
      for (let i = 0; i < BENCH.segs; i++) {
        const a = (cDeg * Math.PI) / 180 - span / 2 + dA * (i + 0.5);
        const px = x + Math.cos(a) * benchRadius, pz = z + Math.sin(a) * benchRadius;
        const th = -a - Math.PI / 2;
        parts.push({ mat: this.stone, geo: box(len, BENCH.base, BENCH.depth, 0, BENCH.base / 2, 0, 0, th).translate(px, 0, pz) });
        parts.push({ mat: this.wood, geo: box(len + 0.01, 0.05, BENCH.depth + 0.06, 0, BENCH.base + 0.025, 0, 0, th).translate(px, 0, pz) });
        parts.push({ mat: this.cushion, geo: rbox(len * 0.92, 0.08, BENCH.depth - 0.08, 0, BENCH.base + 0.09, 0, 0, th).translate(px, 0, pz) });
        this.col(px, (BENCH.base + 0.05) / 2, pz, len, BENCH.base + 0.05, BENCH.depth, th);
      }
    }
    this.instanced(parts, [new THREE.Matrix4()]);
  }

  update(_dt: number, t: number): void {
    const f = 0.5 + 0.5 * Math.sin(t * 7.3) * Math.sin(t * 3.1 + 1.7);
    this.ember.emissiveIntensity = 0.6 + 0.5 * f;
    if (this.fireLight) this.fireLight.intensity = 1.2 + 0.8 * f;
  }

  dispose(): void {
    this.group.removeFromParent();
    for (const m of this.instances) m.dispose();
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
    this.fireLight?.dispose();
    this.group.clear();
    this.instances.length = this.geos.length = this.mats.length = 0;
  }
}
