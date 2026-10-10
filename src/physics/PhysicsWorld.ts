import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

export { RAPIER };
export const FIXED_DT = 1 / 60;

/** Rapier world wrapper: static colliders + fixed-step simulation with accumulator. */
export class PhysicsWorld {
  readonly world: RAPIER.World;
  private accumulator = 0;

  private constructor() {
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = FIXED_DT;
  }

  static async create(): Promise<PhysicsWorld> {
    await RAPIER.init();
    return new PhysicsWorld();
  }

  /** Static oriented box. `center` and `size` in metres (full extents). */
  addBox(center: THREE.Vector3, size: THREE.Vector3, rotation?: THREE.Quaternion) {
    const desc = RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2).setTranslation(center.x, center.y, center.z);
    if (rotation) desc.setRotation({ x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w });
    return this.world.createCollider(desc);
  }

  /** Static collider matching a box mesh's world transform (BoxGeometry only). */
  addBoxFromMesh(mesh: THREE.Mesh) {
    const params = (mesh.geometry as THREE.BoxGeometry).parameters;
    mesh.updateWorldMatrix(true, false);
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    mesh.matrixWorld.decompose(pos, quat, scale);
    return this.addBox(pos, new THREE.Vector3(params.width * scale.x, params.height * scale.y, params.depth * scale.z), quat);
  }

  /** Runs `fixedUpdate` at a constant rate; returns interpolation alpha for rendering. */
  step(dt: number, fixedUpdate: (dt: number) => void): number {
    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < 5) {
      fixedUpdate(FIXED_DT);
      this.world.step();
      this.accumulator -= FIXED_DT;
      steps++;
    }
    if (steps === 5) this.accumulator = 0;
    return this.accumulator / FIXED_DT;
  }

  dispose() {
    this.world.free();
  }
}
