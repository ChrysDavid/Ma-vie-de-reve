import * as THREE from 'three';
import { Engine } from '@/engine/Engine';
import { Assets } from '@/engine/assets';
import { Environment } from '@/engine/Environment';
import { getProfile, type QualityLevel } from '@/engine/quality';
import { PhysicsWorld } from '@/physics/PhysicsWorld';
import { TestGround } from '@/world/TestGround';
import { Input } from '@/player/Input';
import { Character } from '@/player/Character';
import { PlayerController } from '@/player/PlayerController';
import { CameraRig } from '@/player/CameraRig';
import type { useGameStore } from '@/stores/game';

type GameStore = ReturnType<typeof useGameStore>;

const SPAWN = new THREE.Vector3(0, 0, 3);
const HDRI = 'hdri/kloofendal_48d_partly_cloudy_puresky_2k.hdr';
const CHARACTER = 'models/character/soldier.glb';

/** Orchestrates engine, physics, world and player. Lives outside Vue reactivity. */
export class Game {
  readonly input: Input;
  private readonly engine: Engine;
  private physics!: PhysicsWorld;
  private env!: Environment;
  private player!: PlayerController;
  private character!: Character;
  private rig!: CameraRig;
  private readonly feet = new THREE.Vector3();

  constructor(canvas: HTMLCanvasElement, private readonly store: GameStore, quality: QualityLevel) {
    const profile = getProfile(quality);
    this.engine = new Engine(canvas, profile);
    this.engine.onFps = (fps) => (this.store.fps = fps);
    this.input = new Input(canvas);
    this.input.onToggleView = () => this.toggleView();
    canvas.addEventListener('click', () => {
      if (this.store.cameraMode === 'first' && !this.store.isTouch) this.input.requestPointerLock();
    });
  }

  async load() {
    const { engine, store } = this;
    const assets = new Assets(engine.renderer.capabilities.getMaxAnisotropy());
    assets.manager.onProgress = (_url, loaded, total) => {
      store.progress = 0.1 + 0.9 * (loaded / total);
    };

    store.loadingLabel = 'Moteur physique…';
    this.physics = await PhysicsWorld.create();
    store.progress = 0.1;

    store.loadingLabel = 'Ciel, textures et personnage…';
    // All requests below are queued in the same tick, so onLoad fires once everything is in.
    const allLoaded = new Promise<void>((resolve) => (assets.manager.onLoad = resolve));
    const ground = new TestGround(assets, this.physics);
    const [hdr, gltf] = await Promise.all([assets.loadHDR(HDRI), assets.loadGLTF(CHARACTER), allLoaded]);

    this.env = new Environment(engine.scene, engine.renderer, hdr, getProfile(store.quality));
    engine.scene.add(ground.group);

    this.player = new PlayerController(this.physics, SPAWN);
    this.character = new Character(gltf);
    engine.scene.add(this.character.root);
    this.rig = new CameraRig(engine.camera, this.physics, this.player.collider);

    store.loadingLabel = 'Compilation des shaders…';
    await engine.renderer.compileAsync(engine.scene, engine.camera);
    store.progress = 1;

    engine.onFrame((dt, t) => this.update(dt, t));
    engine.start();
  }

  toggleView() {
    if (this.store.phase !== 'playing') return;
    const mode = this.rig.mode === 'third' ? 'first' : 'third';
    this.rig.setMode(mode);
    this.store.cameraMode = mode;
    if (mode === 'third') this.input.exitPointerLock();
  }

  get playerPosition() {
    return this.feet.clone();
  }

  /** Dev/test helper (screenshots): place the player and orient the camera. */
  debugTeleport(x: number, y: number, z: number, yaw: number, pitch = 0.25) {
    this.player.teleport(new THREE.Vector3(x, y, z));
    this.rig.yaw = yaw;
    this.rig.pitch = pitch;
  }

  private update(dt: number, elapsed: number) {
    const playing = this.store.phase === 'playing';
    this.input.update();

    const wish = new THREE.Vector3();
    if (playing) {
      const look = this.input.consumeLook();
      this.rig.rotate(look.x, look.y);
      this.rig.zoom(this.input.consumeZoom());
      wish.addScaledVector(this.rig.forward, this.input.move.y).addScaledVector(this.rig.right, this.input.move.x);
    }

    const alpha = this.physics.step(dt, (fdt) => this.player.fixedUpdate(fdt, wish, this.input.run));
    this.player.getPosition(alpha, this.feet);
    this.character.root.position.copy(this.feet);
    this.character.update(dt, this.player.horizontalSpeed, this.player.horizontalVelocity);
    this.env.follow(this.feet);

    if (playing) {
      this.rig.update(dt, this.feet);
      // Camera squeezed against a wall would end up inside the head: hide the body.
      this.character.setVisible(this.rig.boomLength > 0.75);
    } else this.cinematic(elapsed);
  }

  /** Slow orbit used behind the home screen. */
  private cinematic(t: number) {
    const cam = this.engine.camera;
    const a = t * 0.06;
    cam.position.set(Math.sin(a) * 16, 4.5 + Math.sin(t * 0.2) * 0.5, Math.cos(a) * 16);
    cam.lookAt(0, 1.2, 0);
  }

  dispose() {
    this.input.dispose();
    this.player?.dispose();
    this.physics?.dispose();
    this.engine.dispose();
  }
}
