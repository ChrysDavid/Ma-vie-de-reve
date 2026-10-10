import * as THREE from 'three';
import type { Assets } from '@/engine/assets';
import type { QualityProfile } from '@/engine/quality';
import type { PhysicsWorld } from '@/physics/PhysicsWorld';
import type { RAPIER } from '@/physics/PhysicsWorld';
import { FRAME, LEVELS, WALLS } from '@/data/floorplan';

const LEAF_T = 0.04;
const OPEN_ANGLE = Math.PI / 2;
const OPEN_TIME = 0.6;
const REACH = 1.8;
const GAP = 0.01;

interface Door {
  group: THREE.Group;
  collider: RAPIER.Collider;
  level: 0 | 1;
  cx: number;
  cz: number;
  /** Local offset (along u) of the leaf centre from the pivot, and leaf size. */
  off: number;
  size: THREE.Vector3;
  /** Rotation base: 0 for x-walls, -PI/2 for z-walls; s = swing side sign. */
  base: number;
  s: number;
  axis: 'x' | 'z';
  y: number;
  angle: number;
  open: boolean;
}

/** Hinged door leaves for every `door` / `entrance` opening of the floorplan. */
export class Doors {
  readonly group = new THREE.Group();
  readonly ready: Promise<void>;
  private readonly doors: Door[] = [];
  private readonly geos: THREE.BufferGeometry[] = [];
  private readonly mats: THREE.Material[] = [];

  constructor(
    _assets: Assets,
    private readonly physics: PhysicsWorld,
    _profile: QualityProfile,
  ) {
    this.group.name = 'Doors';
    this.build();
    this.ready = Promise.resolve();
  }

  private build(): void {
    const light = new THREE.MeshStandardMaterial({ color: 0xf1efe9, roughness: 0.55, metalness: 0 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x3a2618, roughness: 0.5, metalness: 0 });
    const steel = new THREE.MeshStandardMaterial({ color: 0xc8cacc, roughness: 0.3, metalness: 0.9 });
    this.mats.push(light, dark, steel);
    const knob = new THREE.BoxGeometry(0.12, 0.025, 0.03);
    const bar = new THREE.BoxGeometry(0.03, 0.9, 0.03);
    this.geos.push(knob, bar);

    for (const w of WALLS) {
      for (const op of w.openings ?? []) {
        if (op.kind !== 'door' && op.kind !== 'entrance') continue;
        const ent = op.kind === 'entrance';
        const lv = LEVELS[w.level];
        const y = lv.floor + (op.sill ?? 0);
        const pivotU = ent ? op.c - op.w / 2 + op.w / 4 : op.c - op.w / 2 + FRAME.profile * 0.5;
        const leafW = ent ? op.w - GAP * 2 : op.w - FRAME.profile - GAP;
        const leafH = op.h - GAP * 2;
        const off = ent ? leafW / 2 - op.w / 4 : leafW / 2;
        const size = new THREE.Vector3(leafW, leafH, LEAF_T);
        // Swing toward the building centre (axis centre = 0).
        const s = w.at < 0 ? 1 : -1;

        const geo = new THREE.BoxGeometry(leafW, leafH, LEAF_T);
        this.geos.push(geo);
        const g = new THREE.Group();
        const leaf = new THREE.Mesh(geo, ent ? dark : light);
        leaf.position.set(off, leafH / 2 + GAP, 0);
        leaf.castShadow = true;
        g.add(leaf);
        // Handles on both faces, at the free edge.
        const hx = off + leafW / 2 - 0.1;
        for (const side of [-1, 1]) {
          const hnd = new THREE.Mesh(ent ? bar : knob, steel);
          hnd.position.set(ent ? off + leafW / 2 - 0.12 : hx, ent ? leafH * 0.5 : 1.0, side * (LEAF_T / 2 + 0.02));
          g.add(hnd);
        }
        const base = w.axis === 'x' ? 0 : -Math.PI / 2;
        g.position.set(w.axis === 'x' ? pivotU : w.at, y, w.axis === 'x' ? w.at : pivotU);
        this.group.add(g);

        const collider = this.physics.addBox(g.position.clone(), size);
        const d: Door = {
          group: g, collider, level: w.level,
          cx: w.axis === 'x' ? op.c : w.at, cz: w.axis === 'x' ? w.at : op.c,
          off, size, base, s, axis: w.axis, y, angle: 0, open: false,
        };
        this.apply(d);
        this.doors.push(d);
      }
    }
  }

  private apply(d: Door): void {
    d.group.rotation.y = d.axis === 'x' ? -d.s * d.angle : d.base + d.s * d.angle;
    d.group.updateMatrixWorld(true);
    const c = new THREE.Vector3(d.off, d.size.y / 2 + GAP, 0).applyMatrix4(d.group.matrixWorld);
    const q = d.group.quaternion;
    d.collider.setTranslation({ x: c.x, y: c.y, z: c.z });
    d.collider.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
  }

  private nearest(feet: THREE.Vector3): Door | null {
    const level = feet.y >= LEVELS[1].floor - 0.5 ? 1 : 0;
    let best: Door | null = null, bd = REACH;
    for (const d of this.doors) {
      if (d.level !== level) continue;
      const dist = Math.hypot(feet.x - d.cx, feet.z - d.cz);
      if (dist < bd) { bd = dist; best = d; }
    }
    return best;
  }

  interact(feet: THREE.Vector3): boolean {
    const d = this.nearest(feet);
    if (!d) return false;
    d.open = !d.open;
    return true;
  }

  promptAt(feet: THREE.Vector3): string | null {
    const d = this.nearest(feet);
    if (!d) return null;
    return d.open ? 'E : fermer la porte' : 'E : ouvrir la porte';
  }

  update(dt: number, _t: number): void {
    const step = (OPEN_ANGLE / OPEN_TIME) * dt;
    for (const d of this.doors) {
      const target = d.open ? OPEN_ANGLE : 0;
      if (d.angle === target) continue;
      // Eased: speed scaled by a smooth profile of progress.
      const k = d.angle / OPEN_ANGLE;
      const ease = 0.35 + 1.3 * Math.sin(Math.PI * Math.min(Math.max(k, 0), 1));
      const dir = Math.sign(target - d.angle);
      d.angle += dir * step * ease;
      if ((dir > 0 && d.angle >= target) || (dir < 0 && d.angle <= target)) d.angle = target;
      this.apply(d);
    }
  }

  dispose(): void {
    for (const d of this.doors) this.physics.world.removeCollider(d.collider, true);
    this.doors.length = 0;
    this.geos.forEach((g) => g.dispose());
    this.mats.forEach((m) => m.dispose());
    this.group.clear();
  }
}
