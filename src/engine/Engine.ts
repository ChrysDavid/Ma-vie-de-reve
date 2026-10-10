import * as THREE from 'three';
import type { QualityProfile } from './quality';
import { PostFX } from './PostFX';
import type { TimeOfDay } from './timeOfDay';

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
  private maxRatio = 1;
  private ratio = 1;
  private perfFrames = 0;
  private perfTime = 0;
  private lastChange = 0;
  private running = false;
  private readonly onVisibility = () => {
    if (document.hidden) this.pause();
    else if (this.running) this.resume();
  };
  readonly postfx?: PostFX;
  onFps?: (fps: number) => void;

  constructor(readonly canvas: HTMLCanvasElement, quality: QualityProfile) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: quality.antialias, powerPreference: quality.level === 'ultra' ? 'high-performance' : 'default' });
    this.maxRatio = Math.min(window.devicePixelRatio || 1, quality.pixelRatio);
    this.ratio = this.maxRatio;
    this.renderer.setPixelRatio(this.ratio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.AgXToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.timer.connect(document);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    const fx = quality.postfx;
    if (fx.ao || fx.bloom || fx.smaa) {
      this.postfx = new PostFX(this.renderer, this.scene, this.camera, quality, this.canvas.clientWidth || 1, this.canvas.clientHeight || 1);
    }
    this.resize();
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  onFrame(cb: FrameCallback) {
    this.callbacks.push(cb);
  }

  start() {
    this.running = true;
    if (!document.hidden) this.resume();
  }

  /** Stops rendering (hidden tab) so the GPU is released. */
  private pause() {
    this.renderer.setAnimationLoop(null);
  }

  private resume() {
    this.perfFrames = 0;
    this.perfTime = 0;
    this.renderer.setAnimationLoop((t) => this.frame(t));
  }

  /** Adaptive resolution: ~2 s window, hysteresis (<40 down, >58 up), min 3 s between changes. */
  private adapt(dt: number, elapsed: number) {
    this.perfFrames++;
    this.perfTime += dt;
    if (this.perfTime < 2) return;
    const fps = this.perfFrames / this.perfTime;
    this.perfFrames = 0;
    this.perfTime = 0;
    if (elapsed - this.lastChange < 3) return;
    let next = this.ratio;
    if (fps < 40) next = Math.max(0.6, this.ratio - 0.1);
    else if (fps > 58) next = Math.min(this.maxRatio, this.ratio + 0.1);
    next = Math.round(next * 10) / 10;
    if (next === this.ratio) return;
    this.ratio = next;
    this.lastChange = elapsed;
    this.renderer.setPixelRatio(next);
    this.resize();
  }

  private frame(timestamp: number) {
    this.timer.update(timestamp);
    const dt = Math.min(this.timer.getDelta(), 0.1);
    const elapsed = this.timer.getElapsed();
    for (const cb of this.callbacks) cb(dt, elapsed);
    if (this.postfx) this.postfx.render(dt);
    else this.renderer.render(this.scene, this.camera);
    this.adapt(dt, elapsed);
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
    this.postfx?.setSize(w, h);
  }

  setTimeOfDay(t: TimeOfDay) {
    this.postfx?.setTimeOfDay(t);
  }

  dispose() {
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    this.postfx?.dispose();
    this.timer.dispose();
    this.renderer.dispose();
  }
}
