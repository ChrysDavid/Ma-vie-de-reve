import * as THREE from 'three';
import type { QualityProfile } from './quality';

export type FrameCallback = (dt: number, elapsed: number) => void;

/** Owns the WebGL renderer, scene, camera and the frame loop. */
export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(60, 1, 0.05, 1500);
  private readonly timer = new THREE.Timer();
  private readonly callbacks: FrameCallback[] = [];
  private readonly resizeObserver: ResizeObserver;
  private fpsFrames = 0;
  private fpsTime = 0;
  onFps?: (fps: number) => void;

  constructor(readonly canvas: HTMLCanvasElement, quality: QualityProfile) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: quality.antialias, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(quality.pixelRatio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.AgXToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.timer.connect(document);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  onFrame(cb: FrameCallback) {
    this.callbacks.push(cb);
  }

  start() {
    this.renderer.setAnimationLoop((t) => this.frame(t));
  }

  private frame(timestamp: number) {
    this.timer.update(timestamp);
    const dt = Math.min(this.timer.getDelta(), 0.1);
    const elapsed = this.timer.getElapsed();
    for (const cb of this.callbacks) cb(dt, elapsed);
    this.renderer.render(this.scene, this.camera);
    this.fpsFrames++;
    this.fpsTime += dt;
    if (this.fpsTime >= 1) {
      this.onFps?.(Math.round(this.fpsFrames / this.fpsTime));
      this.fpsFrames = 0;
      this.fpsTime = 0;
    }
  }

  private resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    this.timer.dispose();
    this.renderer.dispose();
  }
}
