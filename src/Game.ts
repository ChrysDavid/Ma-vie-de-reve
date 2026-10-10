import * as THREE from 'three';
import { Engine } from '@/engine/Engine';
import { Assets } from '@/engine/assets';
import { Environment } from '@/engine/Environment';
import { getProfile, type QualityLevel } from '@/engine/quality';
import { PhysicsWorld } from '@/physics/PhysicsWorld';
import { Terrain } from '@/world/Terrain';
import { Villa } from '@/world/Villa';
import { Pool } from '@/world/Pool';
import { Vegetation } from '@/world/Vegetation';
import { Exteriors } from '@/world/Exteriors';
import { OutdoorFurniture } from '@/world/OutdoorFurniture';
import { Cars } from '@/world/Cars';
import { Interiors } from '@/world/interiors/Interiors';
import { POOL, SITE, roomAt } from '@/data/floorplan';
import { Doors } from '@/world/Doors';
import { Audio } from '@/audio/Audio';
import { surfaceAt } from '@/audio/surface';
import { Input } from '@/player/Input';
import { Character } from '@/player/Character';
import { PlayerController } from '@/player/PlayerController';
import { CameraRig } from '@/player/CameraRig';
import { watch } from 'vue';
import { Lighting } from '@/world/Lighting';
import type { TimeOfDay } from '@/engine/timeOfDay';
import type { useGameStore } from '@/stores/game';

type GameStore = ReturnType<typeof useGameStore>;

const SPAWN = new THREE.Vector3(SITE.spawn.x, 0, SITE.spawn.z);
const HDRI = 'hdri/kloofendal_48d_partly_cloudy_puresky_2k.hdr';
const CHARACTER = 'models/character/adventurer.glb';

/** Orchestrates engine, physics, world and player. Lives outside Vue reactivity. */
export class Game {
  readonly input: Input;
  private readonly engine: Engine;
  private physics!: PhysicsWorld;
  private env!: Environment;
  private lighting!: Lighting;
  private stopTod?: () => void;
  private terrain!: Terrain;
  private villa!: Villa;
  /** Phase 3 exterior modules (same lifecycle: ready / update / dispose). */
  private outdoors: (Pool | Vegetation | Exteriors | OutdoorFurniture | Cars | Interiors | Doors)[] = [];
  private doors!: Doors;
  private readonly audio = new Audio();
  private stopWatches: (() => void)[] = [];
  private uiClock = 0;
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
    this.input.onInteract = () => {
      if (this.store.phase === 'playing' && this.doors) this.doors.interact(this.feet);
    };
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
    this.terrain = new Terrain(assets, this.physics);
    this.villa = new Villa(assets, this.physics);
    const profile = getProfile(store.quality);
    this.outdoors = [Pool, Vegetation, Exteriors, OutdoorFurniture, Cars, Interiors].map((M) => new M(assets, this.physics, profile));
    this.doors = new Doors(assets, this.physics, profile);
    this.outdoors.push(this.doors);
    const [hdr, gltf] = await Promise.all([assets.loadHDR(HDRI), assets.loadGLTF(CHARACTER), allLoaded]);

    this.env = new Environment(engine.scene, engine.renderer, hdr, getProfile(store.quality));
    this.lighting = new Lighting(engine.scene, profile);
    this.stopTod = watch(() => store.timeOfDay, (t) => this.applyTimeOfDay(t, false));
    this.applyTimeOfDay(store.timeOfDay, true);
    this.stopWatches.push(
      // AudioContext needs a user gesture: the "visit" click switches the phase to playing.
      watch(() => store.phase, (p) => p === 'playing' && this.audio.start(), { immediate: true }),
      watch(() => store.muted, (m) => this.audio.setMuted(m), { immediate: true }),
    );
    await Promise.all(this.outdoors.map((o) => o.ready));
    engine.scene.add(this.terrain.group, this.villa.group, ...this.outdoors.map((o) => o.group));

    this.player = new PlayerController(this.physics, SPAWN);
    this.character = new Character(gltf);
    engine.scene.add(this.character.root);
    this.rig = new CameraRig(engine.camera, this.physics, this.player.collider);
    this.rig.yaw = SITE.spawn.yaw;

    store.loadingLabel = 'Compilation des shaders…';
    await engine.renderer.compileAsync(engine.scene, engine.camera);
    store.progress = 1;

    engine.onFrame((dt, t) => this.update(dt, t));
    engine.start();
  }

  private applyTimeOfDay(t: TimeOfDay, instant: boolean) {
    this.env.setTimeOfDay(t, instant);
    this.lighting.setTimeOfDay(t);
    this.audio.setTimeOfDay(t);
    this.engine.setTimeOfDay(t);
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

    const tp = this.store.pendingTeleport;
    if (tp) {
      this.store.pendingTeleport = null;
      this.debugTeleport(tp.x, tp.y, tp.z, tp.yaw, tp.pitch);
    }

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
    this.env.update(dt);
    this.env.follow(this.feet);
    this.lighting.update(dt, elapsed);
    for (const o of this.outdoors) {
      if (o instanceof Interiors) o.setViewer(this.feet);
      o.update(dt, elapsed);
    }
    const room = roomAt(this.feet.x, this.feet.y, this.feet.z);
    this.store.roomName = room?.name ?? 'Jardin';
    const { x, y, z } = this.feet;
    const pr = POOL.rect;
    const poolDistance = Math.hypot(Math.max(pr.x0 - x, 0, x - pr.x1), Math.max(pr.z0 - z, 0, z - pr.z1));
    const speed = playing ? this.player.horizontalSpeed : 0;
    this.audio.update(dt, this.feet, speed, this.input.run, surfaceAt(x, y, z), !!room, poolDistance);

    // HUD state at ~10 Hz to keep Vue reactivity cheap.
    this.uiClock += dt;
    if (this.uiClock >= 0.1) {
      this.uiClock = 0;
      this.store.player = { x, z, level: room?.level ?? (y > 3 ? 1 : 0), yaw: this.rig.yaw };
      this.store.interactPrompt = (playing && this.doors.promptAt(this.feet)) || '';
    }

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
    cam.position.set(Math.sin(a) * 30, 7 + Math.sin(t * 0.2) * 0.5, Math.cos(a) * 30);
    cam.lookAt(0, 3, 0);
  }

  dispose() {
    this.stopTod?.();
    for (const stop of this.stopWatches) stop();
    this.audio.dispose();
    this.lighting?.dispose();
    this.env?.dispose();
    this.input.dispose();
    this.player?.dispose();
    this.villa?.dispose();
    for (const o of this.outdoors) o.dispose();
    this.terrain?.dispose();
    this.physics?.dispose();
    this.engine.dispose();
  }
}
