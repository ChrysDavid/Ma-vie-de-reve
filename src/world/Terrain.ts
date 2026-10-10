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
    this.material = pbrMaterial(assets, 'leafy_grass', { repeat: 1 / 2.5, color: 0xd8e0c8 });
    // Break tile repetition: blend in a second, larger-scale sample of the same albedo.
    this.material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vTerrXZ;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTerrXZ = (modelMatrix * vec4(transformed, 1.0)).xz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vTerrXZ;')
        .replace(
          '#include <map_fragment>',
          `vec4 texA = texture2D(map, vMapUv);
        vec4 texB = texture2D(map, vMapUv * 0.173 + vec2(0.37, 0.61));
        vec4 texC = texture2D(map, vMapUv * 0.047 + vec2(0.71, 0.23));
        // Low-frequency world-space noise (sum of sines) drives hue/brightness and 2nd-scale mix.
        vec2 q = vTerrXZ;
        float n = 0.5 + 0.25 * sin(q.x * 0.045 + sin(q.y * 0.031) * 2.0) + 0.25 * sin(q.y * 0.057 + sin(q.x * 0.023 + 1.3) * 2.0);
        float n2 = 0.5 + 0.5 * sin(q.x * 0.11 + q.y * 0.083 + sin(q.x * 0.07) * 1.5);
        vec4 mixed = mix(mix(texA, texB, 0.45), texC, 0.25 + 0.35 * n);
        // Recolour the (brownish, leaf-littered) texture into a lush mown lawn: keep only its luminance detail.
        float lum = dot(mixed.rgb, vec3(0.299, 0.587, 0.114));
        vec3 lawn = mix(vec3(0.045, 0.15, 0.018), vec3(0.085, 0.21, 0.03), n2);
        diffuseColor.rgb = lawn * clamp(lum * 4.0, 0.55, 1.5) * (0.85 + 0.3 * n);`,
        );
    };
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
