import * as THREE from 'three';
import type { Assets } from '@/engine/assets';
import type { QualityProfile } from '@/engine/quality';
import type { PhysicsWorld } from '@/physics/PhysicsWorld';
import { MeshBatcher, type BoxFaces } from './geometry';
import { pbrMaterial, type PbrOptions } from './materials';
import {
  CARPORT, DRIVEWAY, FENCE, FOOTPRINT, FOUNTAIN, FRONT_PATHS, GATE, PLINTH, PLOT, POOL_DECK,
  POOL_HOUSE, ROOF, STEPPING_STONES, type Rect,
} from '@/data/floorplan';

// Local dimensions missing from floorplan.ts (candidates to move there).
const CAP = { h: 0.06, over: 0.04 }; // fence cap
const PILLAR = { w: 0.5, extra: 0.25 }; // gate pillars
const KERB = { w: 0.1, h: 0.03 };
const SLAB = { x: 1.3, z: 1.1, joint: 0.02 };
const BOLLARD = { spacing: 4, h: 0.5, w: 0.08 };
const POOLHOUSE = { wall: 0.2, door: 0.8, pier: 0.5, lintel: 0.35, roofT: 0.2, roofOver: 0.5, roofOverFront: 0.9, porch: 1.2 };
const FOUNTAIN_RIM = 0.25;

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Exteriors {
  readonly group = new THREE.Group();
  readonly ready: Promise<void> = Promise.resolve();

  private readonly materials: THREE.Material[] = [];
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly textures: THREE.Texture[] = [];
  private waterMat!: THREE.MeshPhysicalMaterial;
  private waterNormal!: THREE.DataTexture;
  private sculpture!: THREE.Mesh;

  constructor(private readonly assets: Assets, private readonly physics: PhysicsWorld, _quality: QualityProfile) {
    this.group.name = 'Exteriors';
    this.build();
  }

  private pbr(id: string, size: number, opts: Omit<PbrOptions, 'repeat'> = {}) {
    const m = pbrMaterial(this.assets, id, { ...opts, repeat: 1 / size });
    this.materials.push(m);
    return m;
  }

  private std(p: THREE.MeshStandardMaterialParameters) {
    const m = new THREE.MeshStandardMaterial(p);
    this.materials.push(m);
    return m;
  }

  private col(min: THREE.Vector3, max: THREE.Vector3, rot?: THREE.Quaternion) {
    const c = min.clone().add(max).multiplyScalar(0.5);
    const s = max.clone().sub(min);
    this.physics.addBox(c, s, rot);
  }

  private flush(b: MeshBatcher, shadows = true) {
    for (const m of b.build(shadows)) {
      this.geometries.push(m.geometry);
      this.group.add(m);
    }
  }

  private build() {
    const top = PLINTH.top;
    // Materials (repeat = 1 / size, consistent with Finishes so shared textures stay coherent).
    const render = this.pbr('white_plaster_02', 1, { color: 0xeeebe4, albedo: false, normalScale: 0.6 });
    const stone = this.pbr('castle_wall_slates', 2.5);
    const cap = this.pbr('castle_wall_slates', 2.5, { color: 0xd8d2c6 });
    const paving = this.pbr('rectangular_paving', 2);
    const slabMat = this.pbr('precast_stone_paving', 2.24, { color: 0xe4dfd5 });
    const poolStone = this.pbr('stone_tiles', 3.17, { color: 0xeee8dc });
    const concrete = this.pbr('concrete_floor_02', 2, { color: 0xd9d5cd });
    const oak = this.pbr('oak_wood_planks', 1.2, { color: 0xa89888 });
    const slatWood = this.pbr('wood_floor_deck', 1.8, { color: 0xb0a49a });
    const alu = this.std({ color: 0x2a2b2d, metalness: 0.75, roughness: 0.35 });
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0xeef4f2, roughness: 0.03, ior: 1.5, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide,
    });
    this.materials.push(glass);
    const bollardGlow = this.std({ color: 0x2b2a27, emissive: 0xffd9a0, emissiveIntensity: 0.3, roughness: 0.5 });

    const B = new MeshBatcher();
    const G = new MeshBatcher(); // glass (no shadows)
    const all = (m: THREE.Material): BoxFaces => ({ px: m, nx: m, py: m, ny: m, pz: m, nz: m });
    const sides = (m: THREE.Material): BoxFaces => ({ px: m, nx: m, pz: m, nz: m });

    // ---------------------------------------------------------------- Fence + gate pillars
    const H = FENCE.height - CAP.h;
    const wall = (x0: number, z0: number, x1: number, z1: number, mat: THREE.Material) => {
      B.box(V(x0, 0, z0), V(x1, H, z1), sides(mat));
      B.box(V(x0 - CAP.over, H, z0 - CAP.over), V(x1 + CAP.over, FENCE.height, z1 + CAP.over), all(cap));
      this.col(V(x0, 0, z0), V(x1, FENCE.height, z1));
    };
    const t = FENCE.t;
    wall(PLOT.x0, PLOT.z0, PLOT.x1, PLOT.z0 + t, render);
    wall(PLOT.x0, PLOT.z0 + t, PLOT.x0 + t, PLOT.z1 - t, render);
    wall(PLOT.x1 - t, PLOT.z0 + t, PLOT.x1, PLOT.z1 - t, render);
    wall(PLOT.x0, PLOT.z1 - t, GATE.x0, PLOT.z1, stone);
    wall(GATE.x1, PLOT.z1 - t, PLOT.x1, PLOT.z1, stone);
    const pH = FENCE.height + PILLAR.extra;
    for (const [px0, px1] of [[GATE.x0 - PILLAR.w, GATE.x0], [GATE.x1, GATE.x1 + PILLAR.w]]) {
      B.box(V(px0, 0, PLOT.z1 - PILLAR.w), V(px1, pH, PLOT.z1), all(stone));
      B.box(V(px0 - CAP.over, pH, PLOT.z1 - PILLAR.w - CAP.over), V(px1 + CAP.over, pH + CAP.h, PLOT.z1 + CAP.over), all(cap));
      this.col(V(px0, 0, PLOT.z1 - PILLAR.w), V(px1, pH + CAP.h, PLOT.z1));
    }

    // Sliding gate (closed): aluminium frame + horizontal wood slats, ground rail, motor box.
    const gz = PLOT.z1 - t - 0.08, gt = 0.06;
    const gw = GATE.x1 - GATE.x0;
    for (const x of [GATE.x0, GATE.x1 - 0.08]) B.box(V(x, 0.05, gz - 0.05), V(x + 0.08, GATE.height, gz + 0.05), all(alu));
    B.box(V(GATE.x0, GATE.height - 0.08, gz - 0.05), V(GATE.x1, GATE.height, gz + 0.05), all(alu));
    B.box(V(GATE.x0, 0.05, gz - 0.05), V(GATE.x1, 0.13, gz + 0.05), all(alu));
    const slatH = 0.14, slatPitch = 0.17;
    for (let y = 0.13; y + slatH <= GATE.height - 0.08; y += slatPitch) {
      B.box(V(GATE.x0 + 0.08, y, gz - gt / 2), V(GATE.x1 - 0.08, y + slatH, gz + gt / 2), all(slatWood));
    }
    B.box(V(GATE.x0, 0, gz - 0.03), V(GATE.x1 + gw, 0.03, gz + 0.03), all(alu));
    B.box(V(GATE.x1 + 0.6, 0, gz - 0.42), V(GATE.x1 + 1.0, 0.45, gz - 0.08), all(alu));
    this.col(V(GATE.x0, 0, gz - 0.07), V(GATE.x1, GATE.height, gz + 0.07));
    this.col(V(GATE.x1 + 0.6, 0, gz - 0.42), V(GATE.x1 + 1.0, 0.45, gz - 0.08));

    // ---------------------------------------------------------------- Hard surfaces
    const paved = (rc: Rect, mat: THREE.Material) => {
      B.box(V(rc.x0, 0, rc.z0), V(rc.x1, top, rc.z1), { px: mat, nx: mat, pz: mat, nz: mat, py: mat });
      this.col(V(rc.x0, 0, rc.z0), V(rc.x1, top, rc.z1));
    };
    const zEnd = PLOT.z1 - t;
    paved({ ...DRIVEWAY, z1: zEnd }, paving);
    paved({ x0: CARPORT.rect.x0, z0: CARPORT.rect.z0, x1: DRIVEWAY.x0, z1: CARPORT.rect.z1 }, paving);
    paved({ x0: DRIVEWAY.x1, z0: CARPORT.rect.z0, x1: CARPORT.rect.x1, z1: CARPORT.rect.z1 }, paving);
    // Kerbs along the driveway edges (kept open where the path joins and under the carport).
    const pathZ0 = Math.min(...FRONT_PATHS.map((p) => p.z0).filter((z) => z > CARPORT.rect.z1));
    const pathZ1 = Math.max(...FRONT_PATHS.map((p) => p.z1));
    const kerb = (x0: number, z0: number, z1: number) => {
      if (z1 > z0) B.box(V(x0, 0, z0), V(x0 + KERB.w, top + KERB.h, z1), all(concrete));
    };
    kerb(DRIVEWAY.x0 - KERB.w, CARPORT.rect.z1, pathZ0);
    kerb(DRIVEWAY.x0 - KERB.w, pathZ1, zEnd);
    kerb(DRIVEWAY.x1, CARPORT.rect.z1, zEnd);

    // Front paths: separate large slabs (joints show the lawn).
    for (const p of FRONT_PATHS) {
      const nx = Math.max(1, Math.round((p.x1 - p.x0) / SLAB.x));
      const nz = Math.max(1, Math.round((p.z1 - p.z0) / SLAB.z));
      const cx = (p.x1 - p.x0) / nx, cz = (p.z1 - p.z0) / nz, j = SLAB.joint / 2;
      for (let i = 0; i < nx; i++) {
        for (let k = 0; k < nz; k++) {
          B.box(
            V(p.x0 + i * cx + j, 0, p.z0 + k * cz + j),
            V(p.x0 + (i + 1) * cx - j, top, p.z0 + (k + 1) * cz - j),
            { px: slabMat, nx: slabMat, pz: slabMat, nz: slabMat, py: slabMat },
          );
        }
      }
      this.col(V(p.x0, 0, p.z0), V(p.x1, top, p.z1));
    }

    // Pool deck (pool rect itself is left open).
    for (const d of POOL_DECK) {
      B.box(V(d.x0, 0, d.z0), V(d.x1, top, d.z1), { px: poolStone, nx: poolStone, pz: poolStone, nz: poolStone, py: poolStone });
      this.col(V(d.x0, 0, d.z0), V(d.x1, top, d.z1));
    }

    // ---------------------------------------------------------------- Carport
    const C = CARPORT;
    const post = C.post;
    const xs = [C.rect.x0 + 0.3, (C.rect.x0 + C.rect.x1) / 2, C.rect.x1 - 0.3];
    for (const x of xs) {
      for (const z of [C.rect.z0 + 0.3, C.rect.z1 - 0.3]) {
        B.box(V(x - post / 2, top, z - post / 2), V(x + post / 2, C.height, z + post / 2), all(alu));
        this.col(V(x - post / 2, top, z - post / 2), V(x + post / 2, C.height, z + post / 2));
      }
    }
    B.box(V(C.rect.x0, C.height, C.rect.z0), V(C.rect.x1, C.height + C.roofT, C.rect.z1), {
      px: render, nx: render, pz: render, nz: render, py: render, ny: oak,
    });

    // ---------------------------------------------------------------- Pool house
    const P = POOL_HOUSE.rect, PH = POOL_HOUSE.height, w = POOLHOUSE.wall;
    const zc = (P.z0 + P.z1) / 2;
    const lintelY = PH - POOLHOUSE.lintel;
    B.box(V(P.x0, 0, P.z0), V(P.x0 + w, PH, P.z1), all(render));
    B.box(V(P.x0 + w, 0, P.z0), V(P.x1 - w, PH, P.z0 + w), all(render));
    B.box(V(P.x0 + w, 0, P.z1 - w), V(P.x1 - w, PH, P.z1), { ...all(render), pz: oak });
    this.col(V(P.x0, 0, P.z0), V(P.x0 + w, PH, P.z1));
    this.col(V(P.x0 + w, 0, P.z0), V(P.x1 - w, PH, P.z0 + w));
    this.col(V(P.x0 + w, 0, P.z1 - w), V(P.x1 - w, PH, P.z1));
    // Front (+x): piers, lintel, glass sliders with an open doorway in the middle.
    const fx0 = P.x1 - w;
    B.box(V(fx0, 0, P.z0), V(P.x1, PH, P.z0 + POOLHOUSE.pier), all(render));
    B.box(V(fx0, 0, P.z1 - POOLHOUSE.pier), V(P.x1, PH, P.z1), all(render));
    B.box(V(fx0, lintelY, P.z0 + POOLHOUSE.pier), V(P.x1, PH, P.z1 - POOLHOUSE.pier), all(render));
    this.col(V(fx0, 0, P.z0), V(P.x1, PH, P.z0 + POOLHOUSE.pier));
    this.col(V(fx0, 0, P.z1 - POOLHOUSE.pier), V(P.x1, PH, P.z1));
    const gx = P.x1 - w / 2;
    const panels: [number, number][] = [[P.z0 + POOLHOUSE.pier, zc - POOLHOUSE.door], [zc + POOLHOUSE.door, P.z1 - POOLHOUSE.pier]];
    for (const [a, b] of panels) {
      G.box(V(gx - 0.02, top, a), V(gx + 0.02, lintelY, b), all(glass));
      for (const z of [a, b - 0.05]) B.box(V(gx - 0.05, top, z), V(gx + 0.05, lintelY, z + 0.05), all(alu));
      B.box(V(gx - 0.05, lintelY - 0.05, a), V(gx + 0.05, lintelY, b), all(alu));
      B.box(V(gx - 0.05, top, a), V(gx + 0.05, top + 0.05, b), all(alu));
      this.col(V(gx - 0.04, 0, a), V(gx + 0.04, lintelY, b));
    }
    // Roof with overhang (longer toward the front) and wood soffit.
    B.box(
      V(P.x0 - POOLHOUSE.roofOver, PH, P.z0 - POOLHOUSE.roofOver),
      V(P.x1 + POOLHOUSE.roofOverFront, PH + POOLHOUSE.roofT, P.z1 + POOLHOUSE.roofOver),
      { ...all(render), ny: oak },
    );
    // Interior floor + porch.
    B.box(V(P.x0 + w, 0, P.z0 + w), V(P.x1, top, P.z1 - w), { py: oak, px: oak, pz: oak, nz: oak });
    this.col(V(P.x0 + w, 0, P.z0 + w), V(P.x1, top, P.z1 - w));
    B.box(V(P.x1, 0, zc - 1.4), V(P.x1 + POOLHOUSE.porch, top, zc + 1.4), all(concrete));
    this.col(V(P.x1, 0, zc - 1.4), V(P.x1 + POOLHOUSE.porch, top, zc + 1.4));

    // ---------------------------------------------------------------- Stepping stones
    const S = STEPPING_STONES;
    const rng = mulberry32(7);
    const dx = S.to.x - S.from.x, dz = S.to.z - S.from.z;
    const len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len;
    const count = Math.floor(len / S.spacing);
    const sh = 0.03, N = 7;
    for (let i = 0; i < count; i++) {
      const along = (i + 0.5) * S.spacing, side = (rng() - 0.5) * 0.2;
      const cx = S.from.x + ux * along - uz * side, cz = S.from.z + uz * along + ux * side;
      const rad = (S.size / 2) * (0.8 + rng() * 0.35), yaw = rng() * Math.PI * 2;
      const ring: [number, number][] = [];
      for (let k = 0; k < N; k++) {
        const a = yaw + (k / N) * Math.PI * 2 + (rng() - 0.5) * 0.4, r = rad * (0.85 + rng() * 0.3);
        ring.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
      }
      const c0 = V(cx, sh, cz);
      for (let k = 0; k < N; k++) {
        const [ax, az] = ring[k], [bx, bz] = ring[(k + 1) % N];
        const pa = V(ax, sh, az), pb = V(bx, sh, bz);
        B.quad(slabMat, c0, pa, pb, pb, V(0, 1, 0));
        const n = V(bz - az, 0, -(bx - ax)).normalize();
        const mx = (ax + bx) / 2 - cx, mz = (az + bz) / 2 - cz;
        if (n.x * mx + n.z * mz < 0) n.negate();
        B.quad(slabMat, V(ax, 0, az), V(bx, 0, bz), pb, pa, n);
      }
    }

    // ---------------------------------------------------------------- Landscape lighting
    const bollard = (x: number, z: number) => {
      B.box(V(x - BOLLARD.w / 2, 0, z - BOLLARD.w / 2), V(x + BOLLARD.w / 2, BOLLARD.h, z + BOLLARD.w / 2), all(alu));
      B.box(V(x - 0.05, BOLLARD.h, z - 0.05), V(x + 0.05, BOLLARD.h + 0.08, z + 0.05), all(bollardGlow));
      this.col(V(x - BOLLARD.w / 2, 0, z - BOLLARD.w / 2), V(x + BOLLARD.w / 2, BOLLARD.h + 0.08, z + BOLLARD.w / 2));
    };
    const [p1, p2] = FRONT_PATHS;
    for (let z = p1.z0 + 1; z < p1.z1 - 0.5; z += BOLLARD.spacing) {
      bollard(p1.x0 - 0.2, z);
      bollard(p1.x1 + 0.2, z);
    }
    for (let x = p2.x0 + 2.5; x < p2.x1 - 1; x += BOLLARD.spacing) bollard(x, p2.z1 + 0.2);
    for (let z = pathZ1 + 1.5; z < zEnd - 1; z += BOLLARD.spacing) {
      bollard(DRIVEWAY.x0 - KERB.w - 0.2, z);
      bollard(DRIVEWAY.x1 + KERB.w + 0.2, z);
    }
    // Rain leaders (8 cm anthracite aluminium) at the 4 corners + discreet gutter under the flat-roof edge.
    const DP = 0.08, GUT = { d: 0.07, h: 0.06 };
    const gx0 = FOOTPRINT.x0 + 0.5, gx1 = FOOTPRINT.x1 - 0.5;
    for (const [face, dir] of [[FOOTPRINT.z1, 1], [FOOTPRINT.z0, -1]] as const) {
      const a = face + (dir > 0 ? 0 : -DP), b = face + (dir > 0 ? DP : 0);
      for (const x of [gx0, gx1]) B.box(V(x - DP / 2, 0, a), V(x + DP / 2, ROOF.y0 - GUT.h, b), all(alu));
      const ga = face + (dir > 0 ? 0 : -GUT.d), gb = face + (dir > 0 ? GUT.d : 0);
      B.box(V(FOOTPRINT.x0, ROOF.y0 - GUT.h, ga), V(FOOTPRINT.x1, ROOF.y0, gb), all(alu));
    }
    this.flush(B);
    this.flush(G, false);
    this.group.children.forEach((o) => { if (o instanceof THREE.Mesh && o.material === glass) o.renderOrder = 2; });

    // Recessed uplight spots along the facade (emissive discs on the ground).
    const spotX: number[] = [];
    for (let x = FOOTPRINT.x0 + 1.5; x < FOOTPRINT.x1; x += 3) {
      if (!FRONT_PATHS.some((p) => x > p.x0 - 1.2 && x < p.x1 + 1.2)) spotX.push(x);
    }
    const spotGeo = new THREE.CircleGeometry(0.07, 16).rotateX(-Math.PI / 2);
    this.geometries.push(spotGeo);
    const spotMat = this.std({ color: 0x2b2a27, emissive: 0xffe2b0, emissiveIntensity: 0.4 });
    const spots = new THREE.InstancedMesh(spotGeo, spotMat, spotX.length);
    spotX.forEach((x, i) => spots.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, 0.012, FOOTPRINT.z1 + PLINTH.margin + 0.35)));
    this.group.add(spots);

    this.buildFountain(cap, stone, alu);
  }

  private buildFountain(_cap: THREE.Material, stone: THREE.MeshStandardMaterial, _alu: THREE.Material) {
    const { x, z, radius: ro, height: h } = FOUNTAIN;
    const ri = ro - FOUNTAIN_RIM;
    const g = new THREE.Group();
    g.position.set(x, 0, z);

    // Basin ring (lathe profile), UVs rescaled to metres.
    const prof = [V(ro, 0, 0), V(ro, h, 0), V(ri, h, 0), V(ri, 0.05, 0)].map((v) => new THREE.Vector2(v.x, v.y));
    const ring = new THREE.LatheGeometry(prof, 48);
    const uv = ring.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.PI * 2 * ro, uv.getY(i) * (h * 2 + FOUNTAIN_RIM));
    const ringMat = stone.clone();
    ringMat.side = THREE.DoubleSide;
    this.materials.push(ringMat);
    this.geometries.push(ring);
    const ringMesh = new THREE.Mesh(ring, ringMat);
    ringMesh.castShadow = ringMesh.receiveShadow = true;
    g.add(ringMesh);

    const floorGeo = new THREE.CircleGeometry(ri, 32).rotateX(-Math.PI / 2);
    const floorMat = this.std({ color: 0x8f8b82, roughness: 0.8 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = 0.05;
    floor.receiveShadow = true;
    this.geometries.push(floorGeo);
    g.add(floor);

    // Water with a procedural, slowly drifting normal map.
    const S = 64, data = new Uint8Array(S * S * 4), k = 0.35;
    for (let j = 0; j < S; j++) {
      for (let i = 0; i < S; i++) {
        const u = (i / S) * Math.PI * 2, v = (j / S) * Math.PI * 2;
        const dhu = 3 * Math.cos(3 * u) * Math.sin(3 * v) + 0.5 * 5 * Math.cos(5 * u + 2 * v);
        const dhv = 3 * Math.sin(3 * u) * Math.cos(3 * v) + 0.5 * 2 * Math.cos(5 * u + 2 * v);
        const n = new THREE.Vector3(-dhu * k, 1, -dhv * k).normalize();
        const o = (j * S + i) * 4;
        data[o] = (n.x * 0.5 + 0.5) * 255;
        data[o + 1] = (n.z * 0.5 + 0.5) * 255;
        data[o + 2] = (n.y * 0.5 + 0.5) * 255;
        data[o + 3] = 255;
      }
    }
    this.waterNormal = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
    this.waterNormal.wrapS = this.waterNormal.wrapT = THREE.RepeatWrapping;
    this.waterNormal.repeat.set(2, 2);
    this.waterNormal.magFilter = this.waterNormal.minFilter = THREE.LinearFilter;
    this.waterNormal.needsUpdate = true;
    this.textures.push(this.waterNormal);
    this.waterMat = new THREE.MeshPhysicalMaterial({
      color: 0x7fb2bf, roughness: 0.04, metalness: 0, ior: 1.33, clearcoat: 1,
      transparent: true, opacity: 0.8, normalMap: this.waterNormal, normalScale: new THREE.Vector2(0.15, 0.15),
    });
    this.materials.push(this.waterMat);
    const waterGeo = new THREE.CircleGeometry(ri - 0.01, 48).rotateX(-Math.PI / 2);
    this.geometries.push(waterGeo);
    const water = new THREE.Mesh(waterGeo, this.waterMat);
    water.position.y = h - 0.08;
    water.receiveShadow = true;
    water.renderOrder = 1;
    g.add(water);

    // Central pedestal + abstract knot sculpture.
    const pedH = h + 0.35;
    const pedGeo = new THREE.CylinderGeometry(0.2, 0.26, pedH - 0.05, 20);
    const ped = new THREE.Mesh(pedGeo, stone);
    ped.position.y = 0.05 + (pedH - 0.05) / 2;
    ped.castShadow = ped.receiveShadow = true;
    const knotGeo = new THREE.TorusKnotGeometry(0.26, 0.06, 96, 12, 2, 3);
    const metal = this.std({ color: 0xd8d4cc, metalness: 0.85, roughness: 0.25 });
    this.sculpture = new THREE.Mesh(knotGeo, metal);
    this.sculpture.position.y = pedH + 0.32;
    this.sculpture.castShadow = true;
    this.geometries.push(pedGeo, knotGeo);
    g.add(ped, this.sculpture);
    this.group.add(g);

    // Octagonal-ish collider ring around the basin.
    const seg = 12, chord = 2 * ro * Math.tan(Math.PI / seg) + 0.05, rim = ro - FOUNTAIN_RIM / 2;
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      this.physics.addBox(
        V(x + Math.cos(a) * rim, h / 2, z + Math.sin(a) * rim),
        V(chord, h, FOUNTAIN_RIM),
        new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), -(a + Math.PI / 2)),
      );
    }
  }

  update(_dt: number, t: number) {
    this.waterNormal.offset.set(t * 0.02, t * 0.013);
    this.waterMat.clearcoatRoughness = 0.05 + 0.03 * Math.sin(t * 0.8);
    this.sculpture.rotation.y = t * 0.3;
  }

  dispose() {
    this.group.removeFromParent();
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    for (const tx of this.textures) tx.dispose();
    this.geometries.length = this.materials.length = this.textures.length = 0;
    this.group.clear();
  }
}
