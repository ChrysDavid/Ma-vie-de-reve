import * as THREE from 'three';
import {
  BloomEffect,
  EffectComposer,
  EffectPass,
  RenderPass,
  SMAAEffect,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect,
} from 'postprocessing';
import { N8AOPostPass } from 'n8ao';
import type { QualityProfile } from './quality';
import type { TimeOfDay } from './timeOfDay';

const BLOOM: Record<TimeOfDay, { intensity: number; threshold: number }> = {
  day: { intensity: 0.12, threshold: 1.1 },
  sunset: { intensity: 0.25, threshold: 0.95 },
  night: { intensity: 0.7, threshold: 0.8 },
};

/** EffectComposer chain: render -> N8AO -> bloom/vignette/AgX -> SMAA. */
export class PostFX {
  private readonly composer: EffectComposer;
  private readonly ao?: N8AOPostPass;
  private readonly bloom?: BloomEffect;
  private readonly prevToneMapping: THREE.ToneMapping;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    quality: QualityProfile,
    width: number,
    height: number,
  ) {
    this.prevToneMapping = renderer.toneMapping;
    renderer.toneMapping = THREE.NoToneMapping;
    this.composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
    this.composer.addPass(new RenderPass(scene, camera));

    const fx = quality.postfx;
    if (fx.ao) {
      this.ao = new N8AOPostPass(scene, camera, width, height);
      const c = this.ao.configuration;
      c.aoRadius = 1.2;
      c.distanceFalloff = 0.8;
      c.intensity = 2.5;
      c.halfRes = quality.level !== 'ultra';
      this.ao.setQualityMode(quality.level === 'ultra' ? 'High' : 'Low');
      this.composer.addPass(this.ao);
    }

    const effects: ConstructorParameters<typeof EffectPass>[1][] = [];
    if (fx.bloom) {
      this.bloom = new BloomEffect({ mipmapBlur: true, intensity: BLOOM.day.intensity, luminanceThreshold: BLOOM.day.threshold, luminanceSmoothing: 0.2, radius: 0.7 });
      effects.push(this.bloom);
    }
    effects.push(new VignetteEffect({ offset: 0.35, darkness: 0.45 }));
    effects.push(new ToneMappingEffect({ mode: ToneMappingMode.AGX }));
    this.composer.addPass(new EffectPass(camera, ...effects));

    if (fx.smaa) this.composer.addPass(new EffectPass(camera, new SMAAEffect()));
    this.composer.setSize(width, height, false);
  }

  setTimeOfDay(t: TimeOfDay) {
    if (!this.bloom) return;
    const b = BLOOM[t];
    this.bloom.intensity = b.intensity;
    this.bloom.luminanceMaterial.threshold = b.threshold;
  }

  render(dt: number) {
    this.composer.render(dt);
  }

  setSize(w: number, h: number) {
    this.composer.setSize(w, h, false);
  }

  dispose() {
    this.composer.dispose();
    this.renderer.toneMapping = this.prevToneMapping;
  }
}
