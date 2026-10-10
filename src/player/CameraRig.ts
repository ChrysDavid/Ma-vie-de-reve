import * as THREE from 'three';
import { RAPIER, type PhysicsWorld } from '@/physics/PhysicsWorld';
import type { CameraMode } from '@/stores/game';

const EYE_HEIGHT = 1.65;
const PIVOT_HEIGHT = 1.55;
const MIN_DIST = 1.2;
const MAX_DIST = 8;
const WALL_MARGIN = 0.25;

/**
 * Third/first person camera. In third person the boom is shortened by raycasts
 * (centre + near-plane corners) so the camera never ends up behind a wall.
 */
export class CameraRig {
  yaw = Math.PI;
  pitch = 0.25;
  mode: CameraMode = 'third';
  private distance = 4;
  private currentDist = 4;
  private readonly pivot = new THREE.Vector3();
  private readonly ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly physics: PhysicsWorld,
    private readonly exclude: RAPIER.Collider,
  ) {}

  /** Horizontal forward direction of the camera (for camera-relative movement). */
  get forward() {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  get right() {
    return new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
  }

  /** Current effective boom length (shortened by walls). */
  get boomLength() {
    return this.mode === 'first' ? 0 : this.currentDist;
  }

  rotate(dx: number, dy: number) {
    this.yaw -= dx;
    const [min, max] = this.mode === 'first' ? [-1.4, 1.4] : [-0.35, 1.25];
    this.pitch = THREE.MathUtils.clamp(this.pitch + (this.mode === 'first' ? -dy : dy), min, max);
  }

  zoom(delta: number) {
    this.distance = THREE.MathUtils.clamp(this.distance + delta * this.distance, MIN_DIST, MAX_DIST);
  }

  setMode(mode: CameraMode) {
    if (mode === this.mode) return;
    // Keep the same look direction when switching (third pitch looks down, first looks forward).
    this.pitch = mode === 'first' ? -this.pitch * 0.5 : Math.max(-this.pitch * 2, 0.15);
    this.mode = mode;
  }

  update(dt: number, feet: THREE.Vector3) {
    if (this.mode === 'first') {
      this.camera.position.set(feet.x, feet.y + EYE_HEIGHT, feet.z);
      const dir = new THREE.Vector3(
        -Math.sin(this.yaw) * Math.cos(this.pitch),
        Math.sin(this.pitch),
        -Math.cos(this.yaw) * Math.cos(this.pitch),
      );
      this.camera.lookAt(this.camera.position.clone().add(dir));
      return;
    }

    this.pivot.set(feet.x, feet.y + PIVOT_HEIGHT, feet.z);
    const back = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch),
    );
    const allowed = this.obstructedDistance(back, this.distance);
    // Pull in instantly when blocked, ease back out when free.
    const k = allowed < this.currentDist ? 1 : 1 - Math.exp(-4 * dt);
    this.currentDist += (allowed - this.currentDist) * k;
    this.camera.position.copy(this.pivot).addScaledVector(back, this.currentDist);
    this.camera.lookAt(this.pivot);
  }

  private obstructedDistance(dir: THREE.Vector3, max: number): number {
    const right = new THREE.Vector3().crossVectors(dir, THREE.Object3D.DEFAULT_UP).normalize();
    const up = new THREE.Vector3().crossVectors(right, dir).normalize();
    const n = 0.18; // half size of the probe pattern ≈ near plane footprint + margin
    const offsets: [number, number][] = [[0, 0], [n, n], [-n, n], [n, -n], [-n, -n]];
    let best = max;
    for (const [ox, oy] of offsets) {
      const o = this.pivot.clone().addScaledVector(right, ox).addScaledVector(up, oy);
      this.ray.origin = { x: o.x, y: o.y, z: o.z };
      this.ray.dir = { x: dir.x, y: dir.y, z: dir.z };
      const hit = this.physics.world.castRay(this.ray, max + WALL_MARGIN, true, undefined, undefined, this.exclude);
      if (hit) best = Math.min(best, hit.timeOfImpact - WALL_MARGIN);
    }
    return Math.max(best, 0.1);
  }
}
