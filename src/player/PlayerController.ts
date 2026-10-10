import * as THREE from 'three';
import { RAPIER, type PhysicsWorld } from '@/physics/PhysicsWorld';

const RADIUS = 0.3;
const HALF_HEIGHT = 0.6; // capsule total height = 2 * (0.6 + 0.3) = 1.8 m
const WALK_SPEED = 1.6;
const RUN_SPEED = 4.5;
const GRAVITY = 9.81;
const KILL_Y = -20;

/** Kinematic capsule driven by Rapier's KinematicCharacterController. Position = feet. */
export class PlayerController {
  readonly collider: RAPIER.Collider;
  private readonly body: RAPIER.RigidBody;
  private readonly kcc: RAPIER.KinematicCharacterController;
  private readonly velocity = new THREE.Vector3();
  private readonly prev = new THREE.Vector3();
  private readonly curr = new THREE.Vector3();
  private readonly spawn: THREE.Vector3;
  grounded = false;

  constructor(private readonly physics: PhysicsWorld, spawn: THREE.Vector3) {
    this.spawn = spawn.clone();
    const world = physics.world;
    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(spawn.x, spawn.y + HALF_HEIGHT + RADIUS, spawn.z),
    );
    this.collider = world.createCollider(RAPIER.ColliderDesc.capsule(HALF_HEIGHT, RADIUS), this.body);
    this.kcc = world.createCharacterController(0.02);
    this.kcc.setUp({ x: 0, y: 1, z: 0 });
    this.kcc.enableAutostep(0.35, 0.15, false);
    this.kcc.enableSnapToGround(0.4);
    this.kcc.setMaxSlopeClimbAngle(THREE.MathUtils.degToRad(50));
    this.kcc.setMinSlopeSlideAngle(THREE.MathUtils.degToRad(40));
    this.kcc.setSlideEnabled(true);
    this.prev.copy(spawn);
    this.curr.copy(spawn);
  }

  /** wishDir: horizontal unit-ish direction scaled by input magnitude (0..1). */
  fixedUpdate(dt: number, wishDir: THREE.Vector3, run: boolean) {
    const speed = (run ? RUN_SPEED : WALK_SPEED) * Math.min(wishDir.length(), 1);
    const target = wishDir.lengthSq() > 1e-4 ? wishDir.clone().setY(0).normalize().multiplyScalar(speed) : new THREE.Vector3();
    const accel = target.lengthSq() > this.horizontalSpeed ** 2 ? 10 : 14;
    const k = 1 - Math.exp(-accel * dt);
    this.velocity.x += (target.x - this.velocity.x) * k;
    this.velocity.z += (target.z - this.velocity.z) * k;
    this.velocity.y = this.grounded ? -0.5 : Math.max(this.velocity.y - GRAVITY * dt, -30);

    const desired = this.velocity.clone().multiplyScalar(dt);
    this.kcc.computeColliderMovement(this.collider, desired);
    const m = this.kcc.computedMovement();
    this.grounded = this.kcc.computedGrounded();
    if (this.grounded && this.velocity.y < 0) this.velocity.y = 0;

    const t = this.body.translation();
    const next = { x: t.x + m.x, y: t.y + m.y, z: t.z + m.z };
    if (next.y < KILL_Y) return this.teleport(this.spawn);
    this.body.setNextKinematicTranslation(next);
    this.prev.copy(this.curr);
    this.curr.set(next.x, next.y - HALF_HEIGHT - RADIUS, next.z);
  }

  teleport(p: THREE.Vector3) {
    this.body.setTranslation({ x: p.x, y: p.y + HALF_HEIGHT + RADIUS, z: p.z }, true);
    this.velocity.set(0, 0, 0);
    this.prev.copy(p);
    this.curr.copy(p);
  }

  /** Interpolated feet position for rendering. */
  getPosition(alpha: number, out: THREE.Vector3) {
    return out.lerpVectors(this.prev, this.curr, alpha);
  }

  get horizontalSpeed() {
    return Math.hypot(this.velocity.x, this.velocity.z);
  }

  get horizontalVelocity() {
    return new THREE.Vector3(this.velocity.x, 0, this.velocity.z);
  }

  dispose() {
    this.physics.world.removeCharacterController(this.kcc);
    this.physics.world.removeRigidBody(this.body);
  }
}
