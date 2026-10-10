import * as THREE from 'three';
import type { Assets } from '@/engine/assets';
import type { QualityProfile } from '@/engine/quality';
import type { PhysicsWorld } from '@/physics/PhysicsWorld';
import { CARS } from '@/data/floorplan';

// Not in floorplan.ts: tune here (metres).
const CARS_GROUND_Y = 0.13; // carport slab top
const MODEL_URL = 'models/cars/CarConcept.glb';
interface Spec {
  length: number;
  height: number; // vertical stretch vs uniform scale
  width: number; // lateral stretch vs uniform scale
  paint: number;
  metalness: number;
}
const SPECS: Record<string, Spec> = {
  sedan: { length: 5.1, height: 1.0, width: 1.0, paint: 0x0a0a0c, metalness: 0.8 },
  suv: { length: 4.9, height: 1.2, width: 1.05, paint: 0xeeeae0, metalness: 0.6 },
  sport: { length: 4.6, height: 0.88, width: 1.0, paint: 0x9a0d14, metalness: 0.85 },
};

export class Cars {
  readonly group = new THREE.Group();
  readonly ready: Promise<void>;
  private readonly materials: THREE.Material[] = [];
  private source: THREE.Object3D | null = null;

  constructor(
    private readonly assets: Assets,
    private readonly physics: PhysicsWorld,
    _quality: QualityProfile,
  ) {
    this.group.name = 'Cars';
    this.ready = this.build();
  }

  update(_dt: number, _t: number): void {}

  private async build(): Promise<void> {
    const gltf = await this.assets.loadGLTF(MODEL_URL);
    this.source = gltf.scene;
    const nose = this.noseDirection(gltf.scene);
    for (const c of CARS) {
      const spec = SPECS[c.kind] ?? SPECS.sedan;
      this.addCar(gltf.scene, nose, spec, c.x, c.z, c.yaw);
    }
  }

  /** Unit axis (model space, xz) pointing from the car centre toward the headlights. */
  private noseDirection(root: THREE.Object3D): THREE.Vector2 {
    root.updateMatrixWorld(true);
    const whole = new THREE.Box3().setFromObject(root);
    const size = whole.getSize(new THREE.Vector3());
    const ctr = whole.getCenter(new THREE.Vector3());
    const alongX = size.x > size.z;
    const centreOf = (key: string) => {
      let box: THREE.Box3 | null = null;
      root.traverse((o) => {
        if (o.name.toLowerCase().includes(key)) {
          const b = new THREE.Box3().setFromObject(o);
          box = box ? box.union(b) : b;
        }
      });
      return box ? (box as THREE.Box3).getCenter(new THREE.Vector3()) : null;
    };
    const head = centreOf('headlights');
    const tail = centreOf('taillights');
    let sign = 1;
    if (head) sign = Math.sign((alongX ? head.x - ctr.x : head.z - ctr.z) || 1);
    else if (tail) sign = -Math.sign((alongX ? tail.x - ctr.x : tail.z - ctr.z) || 1);
    return alongX ? new THREE.Vector2(sign, 0) : new THREE.Vector2(0, sign);
  }

  private addCar(src: THREE.Object3D, nose: THREE.Vector2, spec: Spec, x: number, z: number, yaw: number): void {
    const model = src.clone(true);
    this.restyle(model, spec);

    // Nose -> -z.
    const pivot = new THREE.Group();
    pivot.add(model);
    pivot.rotation.y = Math.atan2(nose.x, -nose.y);
    pivot.updateMatrixWorld(true);
    const raw = new THREE.Box3().setFromObject(pivot);
    const k = spec.length / (raw.max.z - raw.min.z);
    pivot.scale.set(k * spec.width, k * spec.height, k);
    pivot.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(pivot);
    const c = box.getCenter(new THREE.Vector3());
    pivot.position.set(-c.x, -box.min.y, -c.z);

    const car = new THREE.Group();
    car.add(pivot);
    car.position.set(x, CARS_GROUND_Y, z);
    car.rotation.y = yaw;
    car.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    this.group.add(car);

    const size = box.getSize(new THREE.Vector3());
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    this.physics.addBox(new THREE.Vector3(x, CARS_GROUND_Y + size.y / 2, z), size, q);
  }

  /** Replace materials by lowercase name match; each car gets its own instances. */
  private restyle(root: THREE.Object3D, spec: Spec): void {
    const paint = new THREE.MeshPhysicalMaterial({
      color: spec.paint,
      metalness: spec.metalness,
      roughness: 0.25,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      envMapIntensity: 1.2,
    });
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0x0b1014,
      metalness: 0,
      roughness: 0.04,
      transparent: true,
      opacity: 0.4,
      clearcoat: 1,
      clearcoatRoughness: 0,
      depthWrite: false,
    });
    const tyre = new THREE.MeshStandardMaterial({ color: 0x0d0d0e, roughness: 0.92, metalness: 0 });
    this.materials.push(paint, glass, tyre);
    const chromeCache = new Map<THREE.Material, THREE.Material>();

    const pick = (m: THREE.Material): THREE.Material => {
      const n = m.name.toLowerCase();
      if (n.includes('paint')) return paint;
      if (n.includes('glass') || n.includes('windshield') || n.includes('window')) return glass;
      if (n.includes('tire') || n.includes('tyre') || n.includes('rubber')) return tyre;
      if (n.includes('light') || n.includes('license') || n.includes('signal')) return m; // keep emissive/decals
      if (/(rim|hardware|mirror|chrome|disc|trim)/.test(n)) {
        let ch = chromeCache.get(m);
        if (!ch) {
          const s = m.clone() as THREE.MeshStandardMaterial;
          s.metalness = 1;
          s.roughness = n.includes('disc') ? 0.35 : 0.1;
          if (s.color) s.color.lerp(new THREE.Color(0xdddddd), 0.6);
          chromeCache.set(m, s);
          this.materials.push(s);
          ch = s;
        }
        return ch;
      }
      return m;
    };

    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(pick) : pick(mesh.material);
    });
  }

  dispose(): void {
    this.group.removeFromParent();
    const geos = new Set<THREE.BufferGeometry>();
    const mats = new Set<THREE.Material>(this.materials);
    const tex = new Set<THREE.Texture>();
    const scan = (o: THREE.Object3D) =>
      o.traverse((n) => {
        const m = n as THREE.Mesh;
        if (!m.isMesh) return;
        geos.add(m.geometry);
        for (const mat of Array.isArray(m.material) ? m.material : [m.material]) mats.add(mat);
      });
    scan(this.group);
    if (this.source) scan(this.source);
    for (const m of mats) {
      for (const v of Object.values(m)) if (v instanceof THREE.Texture) tex.add(v);
      m.dispose();
    }
    tex.forEach((t) => t.dispose());
    geos.forEach((g) => g.dispose());
    this.group.clear();
    this.source = null;
  }
}
