import * as THREE from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';

type Locomotion = 'Idle' | 'Walk' | 'Run';

const TARGET_HEIGHT = 1.78;
// Ground speed (m/s) at which each clip plays at timeScale 1 — avoids foot sliding.
const CLIP_SPEED: Record<Locomotion, number> = { Idle: 1, Walk: 1.5, Run: 4.2 };
// Model forward axis correction (Quaternius Adventurer faces +Z).
const MODEL_YAW_OFFSET = 0;
// Meshes hidden for a civilian look.
const HIDDEN_MESHES = ['Backpack'];

/** Animated character visual: scaling, animation blending and facing. */
export class Character {
  readonly root = new THREE.Group();
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions = new Map<Locomotion, THREE.AnimationAction>();
  private current: Locomotion = 'Idle';
  private yaw = 0;

  constructor(gltf: GLTF) {
    const model = gltf.scene;
    model.traverse((o) => {
      if (HIDDEN_MESHES.includes(o.name)) o.visible = false;
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        // Skinned meshes are culled with their bind-pose bounds otherwise.
        o.frustumCulled = false;
      }
    });
    const box = new THREE.Box3().setFromObject(model);
    const h = box.max.y - box.min.y;
    model.scale.setScalar(TARGET_HEIGHT / h);
    model.position.y = (-box.min.y * TARGET_HEIGHT) / h;
    model.rotation.y = MODEL_YAW_OFFSET;
    this.root.add(model);

    this.mixer = new THREE.AnimationMixer(model);
    for (const name of ['Idle', 'Walk', 'Run'] as Locomotion[]) {
      const clip = gltf.animations.find((c) => c.name === name || c.name.split('|').pop() === name);
      if (!clip) continue;
      const action = this.mixer.clipAction(clip);
      action.enabled = true;
      action.setEffectiveWeight(name === 'Idle' ? 1 : 0);
      action.play();
      this.actions.set(name, action);
    }
  }

  /** speed: horizontal ground speed (m/s); dir: horizontal movement direction. */
  update(dt: number, speed: number, dir: THREE.Vector3) {
    const next: Locomotion = speed < 0.2 ? 'Idle' : speed < 2.6 ? 'Walk' : 'Run';
    if (next !== this.current) this.crossFade(next);
    const action = this.actions.get(next);
    if (action && next !== 'Idle') action.timeScale = THREE.MathUtils.clamp(speed / CLIP_SPEED[next], 0.5, 1.6);

    if (speed > 0.1) {
      const target = Math.atan2(dir.x, dir.z);
      let delta = target - this.yaw;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      this.yaw += delta * (1 - Math.exp(-12 * dt));
      this.root.rotation.y = this.yaw;
    }
    this.mixer.update(dt);
  }

  get facing() {
    return this.yaw;
  }

  setVisible(v: boolean) {
    this.root.visible = v;
  }

  private crossFade(next: Locomotion) {
    const from = this.actions.get(this.current);
    const to = this.actions.get(next);
    if (!to) return;
    to.reset().setEffectiveWeight(1).play();
    if (from) from.crossFadeTo(to, 0.25, true);
    this.current = next;
  }
}
