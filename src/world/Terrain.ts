import * as THREE from 'three';
import type { Assets } from '@/engine/assets';
import type { PhysicsWorld } from '@/physics/PhysicsWorld';
import { POOL, SITE } from '@/data/floorplan';
import { MeshBatcher } from './geometry';
import { pbrMaterial } from './materials';

/** Site ground (top at y = 0) and invisible bounds so the player can never leave the map. */
export class Terrain {
  readonly group = new THREE.Group();
  private readonly material: THREE.MeshStandardMaterial;

  constructor(assets: Assets, private readonly physics: PhysicsWorld) {
    this.material = pbrMaterial(assets, 'aerial_grass_rock', { repeat: 1 / 4 });
    // 1 m thick slab (top at y = 0) with a rectangular hole for the pool and its catch basin.
    const s = SITE.halfSize + 10;
    const hx0 = POOL.rect.x0, hx1 = POOL.rect.x1, hz0 = POOL.basin.z0, hz1 = POOL.rect.z1;
    const parts: [number, number, number, number][] = [
      [-s, -s, s, hz0], [-s, hz1, s, s], [-s, hz0, hx0, hz1], [hx1, hz0, s, hz1],
    ];
    const batch = new MeshBatcher();
    const m = this.material;
    for (const [x0, z0, x1, z1] of parts) {
      const min = new THREE.Vector3(x0, -1, z0), max = new THREE.Vector3(x1, 0, z1);
      batch.box(min, max, { py: m, px: m, nx: m, pz: m, nz: m });
      this.physics.addBox(min.clone().add(max).multiplyScalar(0.5), max.clone().sub(min));
    }
    for (const mesh of batch.build()) {
      mesh.castShadow = false;
      this.group.add(mesh);
    }
    this.addBounds();
  }

  private addBounds() {
    const h = 20, t = 1, s = SITE.halfSize;
    const walls: [number, number, number, number][] = [
      [0, s, s * 2, t], [0, -s, s * 2, t], [s, 0, t, s * 2], [-s, 0, t, s * 2],
    ];
    for (const [x, z, w, d] of walls) this.physics.addBox(new THREE.Vector3(x, h / 2, z), new THREE.Vector3(w, h, d));
  }

  dispose() {
    for (const o of this.group.children) (o as THREE.Mesh).geometry.dispose();
    this.material.dispose();
  }
}
