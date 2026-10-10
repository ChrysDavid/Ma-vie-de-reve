import * as THREE from 'three';
import type { QualityProfile } from './quality';

/** HDRI sky + image-based lighting + a shadow-casting sun that follows the player. */
export class Environment {
  readonly sun = new THREE.DirectionalLight(0xfff1dc, 3.2);
  // Sun direction roughly matching the kloofendal HDRI (afternoon sun).
  private readonly sunDir = new THREE.Vector3(-0.55, 0.7, 0.45).normalize();
  private readonly texel: number;

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer, hdr: THREE.DataTexture, quality: QualityProfile) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromEquirectangular(hdr).texture;
    scene.environmentIntensity = 0.9;
    scene.background = hdr;
    scene.backgroundIntensity = 1.0;
    pmrem.dispose();

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
  follow(target: THREE.Vector3) {
    const snap = (v: number) => Math.round(v / this.texel) * this.texel;
    const c = new THREE.Vector3(snap(target.x), snap(target.y), snap(target.z));
    this.sun.target.position.copy(c);
    this.sun.position.copy(c).addScaledVector(this.sunDir, 80);
  }
}
