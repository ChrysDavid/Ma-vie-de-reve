import * as THREE from 'three';
import type { Assets } from '@/engine/assets';
import type { PhysicsWorld } from '@/physics/PhysicsWorld';
import { worldBox } from './geometry';
import { pbrMaterial } from './materials';

export const WORLD_HALF_SIZE = 90;

/**
 * Phase 1 test level: textured terrain, a stair block (17 cm risers), a ramp,
 * a deck and walls to validate the character controller and the camera.
 * Replaced by the villa in Phase 2.
 */
export class TestGround {
  readonly group = new THREE.Group();

  constructor(assets: Assets, private readonly physics: PhysicsWorld) {
    const grass = pbrMaterial(assets, 'aerial_grass_rock', { repeat: 1 / 4 });
    const concrete = pbrMaterial(assets, 'concrete_floor_02', { repeat: 1 / 2 });
    const wood = pbrMaterial(assets, 'wood_floor_deck', { repeat: 1 / 2 });

    // Terrain: a thin slab so the collider and the visual match exactly.
    const size = WORLD_HALF_SIZE * 2 + 20;
    const ground = new THREE.Mesh(worldBox(size, 1, size), grass);
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    this.addStatic(ground);

    // Stair block: 6 steps of 0.17 m x 0.30 m up to a 1.02 m platform.
    const rise = 0.17, run = 0.3, width = 2.4, steps = 6;
    for (let i = 0; i < steps; i++) {
      const h = rise * (i + 1);
      this.addStatic(this.mesh(worldBox(width, h, run), concrete, 6, h / 2, -4 + i * run));
    }
    const top = rise * steps;
    this.addStatic(this.mesh(worldBox(width, top, 4), concrete, 6, top / 2, -4 + steps * run + 2));

    // Ramp ~15°.
    const ramp = this.mesh(worldBox(2.4, 0.2, 6), concrete, -6, 0.68, -2);
    ramp.rotation.x = THREE.MathUtils.degToRad(15);
    this.addStatic(ramp);

    // Wooden deck 0.15 m high (auto-step) and two walls for camera collision tests.
    this.addStatic(this.mesh(worldBox(6, 0.15, 4), wood, 0, 0.075, 6));
    this.addStatic(this.mesh(worldBox(8, 3, 0.25), concrete, -2, 1.5, -10));
    this.addStatic(this.mesh(worldBox(0.25, 3, 6), concrete, 2, 1.5, -7));

    this.addBounds();
  }

  private mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    return m;
  }

  private addStatic(mesh: THREE.Mesh) {
    this.group.add(mesh);
    this.physics.addBoxFromMesh(mesh);
  }

  /** Invisible walls so the player can never leave the map. */
  private addBounds() {
    const h = 20, t = 1, s = WORLD_HALF_SIZE;
    const walls: [number, number, number, number][] = [
      [0, s, s * 2, t], [0, -s, s * 2, t], [s, 0, t, s * 2], [-s, 0, t, s * 2],
    ];
    for (const [x, z, w, d] of walls) this.physics.addBox(new THREE.Vector3(x, h / 2, z), new THREE.Vector3(w, h, d));
  }
}
