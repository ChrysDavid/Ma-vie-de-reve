import * as THREE from 'three';
import type { QualityProfile } from './quality';

import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import type { TimeOfDay } from './timeOfDay';

const SKY_FILES: Partial<Record<TimeOfDay, string>> = {
  sunset: 'belfast_sunset_puresky_2k.hdr',
  night: 'satara_night_no_lamps_1k.hdr',
};
interface Sky { bg: THREE.Texture; env: THREE.Texture }

interface Preset { sun: number; color: THREE.Color; dir: THREE.Vector3; env: number; bg: number; exposure: number }
const PRESETS: Record<TimeOfDay, Preset> = {
  day: { sun: 3.2, color: new THREE.Color(0xfff1dc), dir: new THREE.Vector3(-0.55, 0.7, 0.45).normalize(), env: 0.9, bg: 1.0, exposure: 1.0 },
  sunset: { sun: 2.0, color: new THREE.Color(0xffa060), dir: new THREE.Vector3(0.77, 0.12, 0.64).normalize(), env: 0.4, bg: 0.55, exposure: 0.9 },
  night: { sun: 0.25, color: new THREE.Color(0x8fa8ff), dir: new THREE.Vector3(-0.4, 0.6, 0.5).normalize(), env: 0.08, bg: 0.05, exposure: 0.9 },
};

/** HDRI sky + image-based lighting + a shadow-casting sun that follows the player. */
export class Environment {
  readonly sun = new THREE.DirectionalLight(0xfff1dc, 3.2);
  // Sun direction roughly matching the kloofendal HDRI (afternoon sun).
  private readonly sunDir = new THREE.Vector3(-0.55, 0.7, 0.45).normalize();
  private readonly texel: number;

  private readonly pmrem: THREE.PMREMGenerator;
  private readonly skies: Partial<Record<TimeOfDay, Sky>> = {};
  private loading = new Set<TimeOfDay>();
  private skyKey: TimeOfDay = 'day';
  private wantSky: TimeOfDay | null = null;
  private swapDist = 0;
  private disposed = false;

  private goal = PRESETS.day;
  private cur: Preset = { ...PRESETS.day, dir: PRESETS.day.dir.clone(), color: PRESETS.day.color.clone() };

  constructor(
    private readonly scene: THREE.Scene,
    private readonly renderer: THREE.WebGLRenderer,
    hdr: THREE.DataTexture,
    quality: QualityProfile,
  ) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const dayEnv = pmrem.fromEquirectangular(hdr).texture;
    this.pmrem = pmrem;
    this.skies.day = { bg: hdr, env: dayEnv };
    scene.environment = dayEnv;
    scene.environmentIntensity = 0.9;
    scene.background = hdr;
    scene.backgroundIntensity = 1.0;

    const d = quality.shadowDistance;
    const s = this.sun.shadow;
    this.sun.castShadow = true;
    s.mapSize.setScalar(quality.shadowMapSize);
    s.camera.left = s.camera.bottom = -d;
    s.camera.right = s.camera.top = d;
    s.camera.near = 1;
    s.camera.far = 200;
    s.bias = -0.0003;
    s.normalBias = 0.03;
    s.radius = 3;
    this.texel = (2 * d) / quality.shadowMapSize;
    scene.add(this.sun, this.sun.target);
  }

  /** Keeps the shadow frustum centred on the player, snapped to texels to avoid shimmering. */
  setTimeOfDay(t: TimeOfDay, instant = false) {
    this.goal = PRESETS[t];
    this.wantSky = t;
    this.swapDist = Math.abs(this.cur.bg - this.goal.bg);
    this.loadSky(t);
    if (instant) {
      this.trySwap(true);
      this.cur = { ...this.goal, dir: this.goal.dir.clone(), color: this.goal.color.clone() };
      this.apply();
    }
  }

  private loadSky(t: TimeOfDay) {
    const file = SKY_FILES[t];
    if (!file || this.skies[t] || this.loading.has(t)) return;
    this.loading.add(t);
    new HDRLoader().loadAsync(`${import.meta.env.BASE_URL}assets/hdri/${file}`).then((tex) => {
      if (this.disposed) { tex.dispose(); return; }
      tex.mapping = THREE.EquirectangularReflectionMapping;
      this.skies[t] = { bg: tex, env: this.pmrem.fromEquirectangular(tex).texture };
      this.trySwap(this.wantSky === t && this.swapDist === 0);
    }).catch(() => this.loading.delete(t));
  }

  /** Swaps the sky textures once the fade is past halfway (or immediately if forced). */
  private trySwap(force = false) {
    const t = this.wantSky;
    if (!t || t === this.skyKey) return;
    const sky = this.skies[t];
    if (!sky) return;
    if (!force && Math.abs(this.cur.bg - this.goal.bg) > this.swapDist * 0.5) return;
    this.scene.background = sky.bg;
    this.scene.environment = sky.env;
    this.skyKey = t;
  }

  dispose() {
    this.disposed = true;
    for (const k of Object.keys(this.skies) as TimeOfDay[]) {
      this.skies[k]!.env.dispose();
      if (k !== 'day') this.skies[k]!.bg.dispose();
    }
    this.pmrem.dispose();
  }

  /** Smooth transition toward the current preset. */
  update(dt: number) {
    this.trySwap();
    const k = 1 - Math.exp(-dt * 2.5);
    const c = this.cur, g = this.goal;
    if (c.dir.distanceToSquared(g.dir) + Math.abs(c.sun - g.sun) + Math.abs(c.env - g.env) + Math.abs(c.bg - g.bg) + Math.abs(c.exposure - g.exposure) < 1e-4) return;
    c.sun += (g.sun - c.sun) * k;
    c.env += (g.env - c.env) * k;
    c.bg += (g.bg - c.bg) * k;
    c.exposure += (g.exposure - c.exposure) * k;
    c.color.lerp(g.color, k);
    c.dir.lerp(g.dir, k).normalize();
    this.apply();
  }

  private apply() {
    const c = this.cur;
    this.sun.intensity = c.sun;
    this.sun.color.copy(c.color);
    this.sunDir.copy(c.dir);
    this.scene.environmentIntensity = c.env;
    this.scene.backgroundIntensity = c.bg;
    this.renderer.toneMappingExposure = c.exposure;
  }

  follow(target: THREE.Vector3) {
    const snap = (v: number) => Math.round(v / this.texel) * this.texel;
    const c = new THREE.Vector3(snap(target.x), snap(target.y), snap(target.z));
    this.sun.target.position.copy(c);
    this.sun.position.copy(c).addScaledVector(this.sunDir, 80);
  }
}
