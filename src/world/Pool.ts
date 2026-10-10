import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water2.js';
import { ASSET_BASE, type Assets } from '@/engine/assets';
import type { QualityProfile } from '@/engine/quality';
import type { PhysicsWorld } from '@/physics/PhysicsWorld';
import { PLINTH, POOL } from '@/data/floorplan';
import { MeshBatcher } from './geometry';
import { pbrMaterial } from './materials';

// Local dimensions missing from floorplan.ts (candidates to move there).
const FLOOR_T = 0.2; // slab thickness under pool/basin floors
const LIP_T = 0.1; // basin lip thickness
const WEIR_DROP = 0.01; // weir top under the water line
const COPING_SKIRT = 0.2; // coping thickness below the water line
const STEP_COUNT = 7; // enough 0.19 m risers to climb from the floor to the coping
const STEP_TREAD = 0.3;
const STEP_WIDTH = 2;
const STEP_TOP_BELOW_WATER = 0.15;
const BASIN_WATER_H = 0.12; // basin water depth
const WATER_SIZE: Record<QualityProfile['level'], number> = { low: 0, medium: 512, ultra: 1024 };

const CAUSTIC_VERT = /* glsl */ `
varying vec3 vCPos;
`;
const CAUSTIC_FRAG = /* glsl */ `
varying vec3 vCPos;
uniform float uTime;
uniform float uWaterY;
uniform float uBasinZ;
uniform float uBasinY;
float cHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float cNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(cHash(i), cHash(i + vec2(1.0, 0.0)), f.x), mix(cHash(i + vec2(0.0, 1.0)), cHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
// Two scrolling noise layers; the min of |n - 0.5| draws a bright network of lines.
float caustics(vec2 p, float t) {
  float a = cNoise(p * 1.6 + vec2(t * 0.25, t * 0.18));
  float b = cNoise(p * 2.2 - vec2(t * 0.2, -t * 0.27) + 7.3);
  float m = min(abs(a - 0.5), abs(b - 0.5));
  return pow(1.0 - clamp(m * 5.0, 0.0, 1.0), 5.0);
}
`;

export class Pool {
  readonly group = new THREE.Group();
  readonly ready: Promise<void>;

  private readonly tile: THREE.MeshStandardMaterial;
  private readonly coping: THREE.MeshStandardMaterial;
  private readonly spillMat: THREE.MeshPhysicalMaterial;
  private readonly uTime = { value: 0 };
  private cheapMat: THREE.MeshPhysicalMaterial | null = null;
  private water: Water | null = null;
  private readonly disposables: { dispose(): void }[] = [];
  private normals: THREE.Texture[] = [];
  private spillNormal: THREE.Texture | null = null;
  private disposed = false;

  constructor(
    private readonly assets: Assets,
    physics: PhysicsWorld,
    private readonly quality: QualityProfile,
  ) {
    const R = POOL.rect;
    const B = POOL.basin;
    const C = POOL.coping;
    const F = POOL.waterY - POOL.depth; // pool floor
    const FB = POOL.waterY - POOL.basinDrop; // basin floor
    const TOP = PLINTH.top;
    const wallTop = POOL.waterY - COPING_SKIRT;
    const ix0 = R.x0 + C, ix1 = R.x1 - C, iz1 = R.z1 - C; // water-side edges of the coping
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

    this.tile = pbrMaterial(assets, 'floor_tiles_09', { repeat: 1 / 2, color: 0xb9e4ee, roughness: 0.35 });
    this.coping = pbrMaterial(assets, 'concrete_floor_02', { repeat: 1 / 2, color: 0xe6e1d6 });
    this.addCaustics(this.tile);

    const tile = this.tile, stone = this.coping;
    const batch = new MeshBatcher();
    const solid = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, faces: Parameters<MeshBatcher['box']>[2]) => {
      batch.box(V(x0, y0, z0), V(x1, y1, z1), faces);
      physics.addBox(V((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), V(x1 - x0, y1 - y0, z1 - z0));
    };
    // Collider spanning a whole wall column (tile + coping) without extra visuals.
    const col = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) =>
      physics.addBox(V((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), V(x1 - x0, y1 - y0, z1 - z0));

    // Floors (pool, basin).
    solid(R.x0, F - FLOOR_T, B.z1, R.x1, F, R.z1, { py: tile });
    solid(B.x0, FB - FLOOR_T, B.z0, B.x1, FB, B.z1, { py: tile });

    // Side walls x0 / x1 (tile below the water line, coping above), z B.z1 -> iz1.
    for (const side of [0, 1]) {
      const [wx0, wx1] = side === 0 ? [R.x0, ix0] : [ix1, R.x1];
      const inward = side === 0 ? 'px' : 'nx';
      batch.box(V(wx0, F, B.z1), V(wx1, wallTop, iz1), { [inward]: tile, nz: tile });
      batch.box(V(wx0, wallTop, B.z1), V(wx1, TOP, iz1), { [inward]: stone, py: stone, nz: stone });
      col(wx0, F, B.z1, wx1, TOP, iz1);
    }
    // Back wall z1 (house side).
    batch.box(V(R.x0, F, iz1), V(R.x1, wallTop, R.z1), { nz: tile });
    batch.box(V(R.x0, wallTop, iz1), V(R.x1, TOP, R.z1), { nz: stone, py: stone });
    col(R.x0, F, iz1, R.x1, TOP, R.z1);

    // Vanishing edge: weir wall just under the water line, spilling into the basin.
    const weirTop = POOL.waterY - WEIR_DROP;
    solid(ix0, F, B.z1, ix1, weirTop, R.z0, { pz: tile, nz: tile, py: tile });

    // Basin lips (x sides + back) up to the plinth height.
    solid(B.x0, FB, B.z0, B.x0 + LIP_T, TOP, B.z1, { px: tile, py: stone });
    solid(B.x1 - LIP_T, FB, B.z0, B.x1, TOP, B.z1, { nx: tile, py: stone });
    solid(B.x0, FB, B.z0, B.x1, TOP, B.z0 + LIP_T, { pz: tile, py: stone });

    // Roman steps in the (x1, z1) corner, rising toward the back wall.
    const stepTop = POOL.waterY - STEP_TOP_BELOW_WATER;
    const rise = (stepTop - F) / STEP_COUNT;
    for (let k = 1; k <= STEP_COUNT; k++) {
      solid(ix1 - STEP_WIDTH, F, iz1 - (STEP_COUNT - k + 1) * STEP_TREAD, ix1, F + k * rise, iz1, { nz: tile, py: tile, nx: tile });
    }

    for (const m of batch.build(true)) {
      this.group.add(m);
      this.disposables.push(m.geometry);
    }

    // Thin sheet of water falling over the weir.
    const basinWaterY = FB + BASIN_WATER_H;
    const spillGeo = new THREE.PlaneGeometry(ix1 - ix0, POOL.waterY - basinWaterY);
    this.spillMat = new THREE.MeshPhysicalMaterial({
      color: 0xbdeff2, roughness: 0.05, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide,
    });
    const spill = new THREE.Mesh(spillGeo, this.spillMat);
    spill.position.set((ix0 + ix1) / 2, (POOL.waterY + basinWaterY) / 2, B.z1 - 0.005);
    spill.rotation.y = Math.PI; // face -z (toward the basin)
    this.group.add(spill);
    this.disposables.push(spillGeo, this.spillMat);

    // Basin water surface.
    const basinGeo = new THREE.PlaneGeometry(B.x1 - B.x0 - 2 * LIP_T, B.z1 - B.z0 - LIP_T);
    basinGeo.rotateX(-Math.PI / 2);
    const basinMat = new THREE.MeshPhysicalMaterial({
      color: 0x58cdd4, roughness: 0.05, transparent: true, opacity: 0.75, depthWrite: false,
    });
    const basinWater = new THREE.Mesh(basinGeo, basinMat);
    basinWater.position.set(0, basinWaterY, (B.z0 + LIP_T + B.z1) / 2);
    this.group.add(basinWater);
    this.disposables.push(basinGeo, basinMat);

    this.ready = this.buildWater(ix0, ix1, B.z1, iz1);
  }

  private async buildWater(x0: number, x1: number, z0: number, z1: number): Promise<void> {
    const loader = new THREE.TextureLoader(this.assets.manager);
    const load = async (name: string) => {
      const t = await loader.loadAsync(`${ASSET_BASE}textures/water/${name}`);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.colorSpace = THREE.NoColorSpace;
      return t;
    };
    const [n0, n1] = await Promise.all([load('Water_1_M_Normal.jpg'), load('Water_2_M_Normal.jpg')]);
    if (this.disposed) { n0.dispose(); n1.dispose(); return; }
    this.normals = [n0, n1];

    // Spill sheet: scrolling normal map clone.
    this.spillNormal = n1.clone();
    this.spillNormal.needsUpdate = true;
    this.spillNormal.repeat.set(6, 1);
    this.spillMat.normalMap = this.spillNormal;
    this.spillMat.needsUpdate = true;

    const w = x1 - x0, d = z1 - z0;
    const geo = new THREE.PlaneGeometry(w, d);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;

    if (this.quality.level === 'low') {
      // Cheap water: transparent physical material with a scrolling normal map.
      n0.repeat.set(w / 3, d / 3);
      this.cheapMat = new THREE.MeshPhysicalMaterial({
        color: 0x3ccfd2, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.6,
        normalMap: n0, normalScale: new THREE.Vector2(0.3, 0.3), depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, this.cheapMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(cx, POOL.waterY, cz);
      this.group.add(mesh);
      this.disposables.push(geo, this.cheapMat);
      return;
    }

    // UVs in metres so the wave scale is independent of the pool size.
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 2.5, uv.getY(i) * d / 2.5);
    const size = WATER_SIZE[this.quality.level];
    const water = new Water(geo, {
      color: 0x8fe6ea,
      scale: 1,
      flowDirection: new THREE.Vector2(0, -1),
      flowSpeed: 0.03,
      reflectivity: 0.4,
      textureWidth: size,
      textureHeight: size,
      normalMap0: n0,
      normalMap1: n1,
    });
    water.rotation.x = -Math.PI / 2;
    water.position.set(cx, POOL.waterY, cz);
    this.water = water;
    this.group.add(water);
    this.disposables.push(geo);
  }

  /** Animated procedural caustics under the water line (tile material only). */
  private addCaustics(mat: THREE.MeshStandardMaterial) {
    const FB = POOL.waterY - POOL.basinDrop;
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.uTime;
      shader.uniforms.uWaterY = { value: POOL.waterY };
      shader.uniforms.uBasinZ = { value: POOL.basin.z1 };
      shader.uniforms.uBasinY = { value: FB + BASIN_WATER_H };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${CAUSTIC_VERT}`)
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${CAUSTIC_FRAG}`)
        .replace('#include <color_fragment>', `#include <color_fragment>
{
  float wy = vCPos.z < uBasinZ + 0.002 ? uBasinY : uWaterY;
  float depthB = wy - vCPos.y;
  float mask = smoothstep(0.0, 0.06, depthB);
  vec3 cn = normalize(cross(dFdx(vCPos), dFdy(vCPos)));
  vec2 cp = abs(cn.y) > 0.5 ? vCPos.xz : (abs(cn.x) > abs(cn.z) ? vCPos.zy : vCPos.xy);
  float cc = caustics(cp, uTime);
  diffuseColor.rgb *= 1.0 + mask * cc * (0.9 * exp(-depthB * 0.35) + 0.15);
}`);
    };
  }

  update(dt: number, t: number) {
    this.uTime.value = t;
    if (this.cheapMat?.normalMap) {
      const o = this.cheapMat.normalMap.offset;
      o.x += dt * 0.012;
      o.y += dt * 0.008;
    }
    if (this.spillNormal) this.spillNormal.offset.y -= dt * 0.9;
  }

  dispose() {
    this.disposed = true;
    const w = this.water as unknown as {
      reflector?: { dispose?(): void; getRenderTarget?(): THREE.RenderTarget };
      refractor?: { dispose?(): void; getRenderTarget?(): THREE.RenderTarget };
      material: THREE.ShaderMaterial;
    } | null;
    if (w) {
      for (const r of [w.reflector, w.refractor]) {
        r?.dispose?.();
        r?.getRenderTarget?.().dispose();
      }
      w.material.dispose();
    }
    for (const d of this.disposables) d.dispose();
    for (const t of this.normals) t.dispose();
    this.spillNormal?.dispose();
    this.tile.dispose();
    this.coping.dispose();
    this.group.removeFromParent();
  }
}
