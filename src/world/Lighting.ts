import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import type { QualityProfile } from '@/engine/quality';
import type { TimeOfDay } from '@/engine/timeOfDay';
import { DRIVEWAY, FOOTPRINT, GATE, LEVELS, PLOT, POOL, ROOMS, type Rect } from '@/data/floorplan';

/** Interior intensity multiplier per time of day (0 = off). */
const INTERIOR_K: Record<TimeOfDay, number> = { day: 0, sunset: 0.5, night: 1 };
const EXTERIOR_K: Record<TimeOfDay, number> = { day: 0, sunset: 0.15, night: 1 };

const WARM = new THREE.Color().setRGB(1.0, 0.72, 0.45); // ~2800K
const POOL_BLUE = 0x4fc8ff;
const MAX_RECT_LIGHTS = 20;
const MAX_POINT_ROOMS = 8;

interface IntLight {
  light: THREE.RectAreaLight | THREE.PointLight;
  base: number;
}
interface ExtLight {
  light: THREE.PointLight | THREE.SpotLight;
  base: number;
}

const rectArea = (r: Rect) => (r.x1 - r.x0) * (r.z1 - r.z0);

/** Warm ceiling lights, garden beacons, facade spots and pool light. No dynamic shadows. */
export class Lighting {
  private static uniformsReady = false;
  private readonly group = new THREE.Group();
  private readonly interior: IntLight[] = [];
  private readonly exterior: ExtLight[] = [];
  private readonly beacons: THREE.InstancedMesh;
  private readonly beaconMat = new THREE.MeshStandardMaterial({
    color: 0x2a2a2a, emissive: 0xffc58a, emissiveIntensity: 0, roughness: 0.5,
  });
  private readonly poolLight: ExtLight;
  private tod: TimeOfDay = 'day';
  private k = 0; // current eased interior factor
  private ke = 0; // current eased exterior factor
  private readonly disposables: { dispose(): void }[] = [];

  constructor(private readonly scene: THREE.Scene, profile: QualityProfile) {
    this.group.name = 'Lighting';
    const low = profile.level === 'low';

    if (!low && !Lighting.uniformsReady) {
      RectAreaLightUniformsLib.init();
      Lighting.uniformsReady = true;
    }

    // --- Interior ---
    const rooms = ROOMS.map((room) => {
      const main = room.rects.reduce((a, b) => (rectArea(b) > rectArea(a) ? b : a));
      return { room, main };
    }).sort((a, b) => rectArea(b.main) - rectArea(a.main));
    const chosen = rooms.slice(0, low ? MAX_POINT_ROOMS : profile.level === 'ultra' ? MAX_RECT_LIGHTS : 12);

    for (const { room, main } of chosen) {
      const w = main.x1 - main.x0;
      const d = main.z1 - main.z0;
      const cx = (main.x0 + main.x1) / 2;
      const cz = (main.z0 + main.z1) / 2;
      const y = LEVELS[room.level].ceiling - 0.06;
      if (low) {
        const p = new THREE.PointLight(WARM, 0, Math.max(w, d) * 1.6, 2);
        p.position.set(cx, y - 0.3, cz);
        p.castShadow = false;
        this.group.add(p);
        this.interior.push({ light: p, base: 10 + Math.min(20, rectArea(main) * 0.25) });
      } else {
        const lw = Math.max(0.6, Math.min(w * 0.45, 3));
        const ld = Math.max(0.6, Math.min(d * 0.45, 3));
        const l = new THREE.RectAreaLight(WARM, 0, lw, ld);
        l.position.set(cx, y, cz);
        l.lookAt(cx, y - 1, cz);
        this.group.add(l);
        this.interior.push({ light: l, base: 4 + Math.min(8, rectArea(main) * 0.08) });
      }
    }

    // --- Exterior: beacons along the driveway edges and the front fence ---
    const pts: THREE.Vector3[] = [];
    const zStart = FOOTPRINT.z1 + 2;
    for (let z = zStart; z < PLOT.z1 - 0.5; z += 3) {
      pts.push(new THREE.Vector3(DRIVEWAY.x0 - 0.4, 0.3, z), new THREE.Vector3(DRIVEWAY.x1 + 0.4, 0.3, z));
    }
    for (let x = PLOT.x0 + 2; x < PLOT.x1 - 1; x += 8) {
      if (x > GATE.x0 - 1 && x < GATE.x1 + 1) continue;
      pts.push(new THREE.Vector3(x, 0.3, PLOT.z1 - 1.2));
    }
    // Path from gate toward the house door line
    const bGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.6, 8);
    this.disposables.push(bGeo, this.beaconMat);
    this.beacons = new THREE.InstancedMesh(bGeo, this.beaconMat, pts.length);
    const m = new THREE.Matrix4();
    pts.forEach((p, i) => this.beacons.setMatrixAt(i, m.makeTranslation(p.x, p.y, p.z)));
    this.beacons.frustumCulled = false;
    this.group.add(this.beacons);

    const addExt = (l: THREE.PointLight | THREE.SpotLight, base: number) => {
      this.group.add(l);
      if (l instanceof THREE.SpotLight) this.group.add(l.target);
      this.exterior.push({ light: l, base });
    };
    // 3 real beacon lights spread along the driveway/fence
    const realBeacons = [pts[0], pts[Math.floor(pts.length / 2)], pts[pts.length - 1]].filter(Boolean);
    for (const p of realBeacons) {
      const l = new THREE.PointLight(0xffc58a, 0, 9, 2);
      l.position.set(p.x, 0.9, p.z);
      addExt(l, 6);
    }
    // 2 facade spots washing the front wall
    for (const fx of [FOOTPRINT.x0 * 0.5, FOOTPRINT.x1 * 0.5]) {
      const s = new THREE.SpotLight(0xffd2a0, 0, 14, Math.PI / 4, 0.6, 2);
      s.position.set(fx, 0.2, FOOTPRINT.z1 + 2.5);
      s.target.position.set(fx, LEVELS[1].floor + 1, FOOTPRINT.z1);
      s.castShadow = false;
      addExt(s, 40);
    }
    // Pool light under the water
    const pc = new THREE.PointLight(POOL_BLUE, 0, 16, 1.6);
    pc.position.set((POOL.rect.x0 + POOL.rect.x1) / 2, POOL.waterY - POOL.depth * 0.6, (POOL.rect.z0 + POOL.rect.z1) / 2);
    this.poolLight = { light: pc, base: 14 };
    this.group.add(pc);
    this.exterior.push(this.poolLight);

    scene.add(this.group);
    this.apply();
  }

  setTimeOfDay(t: TimeOfDay): void {
    this.tod = t;
  }

  update(dt: number, _t: number): void {
    const a = 1 - Math.exp(-dt * 2.5);
    const ki = INTERIOR_K[this.tod];
    const ke = EXTERIOR_K[this.tod];
    if (Math.abs(ki - this.k) < 0.002 && Math.abs(ke - this.ke) < 0.002) {
      if (this.k === ki && this.ke === ke) return;
      this.k = ki;
      this.ke = ke;
    } else {
      this.k += (ki - this.k) * a;
      this.ke += (ke - this.ke) * a;
    }
    this.apply();
  }

  private apply() {
    for (const i of this.interior) {
      i.light.intensity = i.base * this.k;
      i.light.visible = this.k > 0.001;
    }
    for (const e of this.exterior) {
      e.light.intensity = e.base * this.ke;
      e.light.visible = this.ke > 0.001;
    }
    this.beaconMat.emissiveIntensity = 2.5 * this.ke;
    this.beacons.visible = true; // bollard bodies stay visible by day; emissive scales with ke
  }

  dispose(): void {
    this.scene.remove(this.group);
    for (const d of this.disposables) d.dispose();
    this.beacons.dispose();
  }
}
