import * as THREE from 'three';

// Letters by `event.key` (layout-aware: ZQSD on AZERTY, WASD on QWERTY) + arrows.
const FORWARD = ['z', 'w', 'arrowup'];
const BACK = ['s', 'arrowdown'];
const LEFT = ['q', 'a', 'arrowleft'];
const RIGHT = ['d', 'arrowright'];

/**
 * Unified input: keyboard, mouse drag / pointer lock, wheel, touch look + pinch,
 * and an analog vector injected by the on-screen joystick.
 */
export class Input {
  /** x = strafe right, y = forward; magnitude 0..1. */
  readonly move = new THREE.Vector2();
  run = false;
  sensitivity = 1;
  onToggleView?: () => void;
  onInteract?: () => void;

  private readonly keys = new Set<string>();
  private readonly joystick = new THREE.Vector2();
  private lookX = 0;
  private lookY = 0;
  private zoom = 0;
  private dragId: number | null = null;
  private lastX = 0;
  private lastY = 0;
  private readonly touches = new Map<number, { x: number; y: number }>();
  private pinchDist = 0;
  private readonly ac = new AbortController();

  constructor(private readonly el: HTMLElement) {
    const o = { signal: this.ac.signal };
    window.addEventListener('keydown', (e) => this.onKey(e, true), o);
    window.addEventListener('keyup', (e) => this.onKey(e, false), o);
    window.addEventListener('blur', () => this.keys.clear(), o);
    el.addEventListener('pointerdown', (e) => this.onPointerDown(e), o);
    window.addEventListener('pointermove', (e) => this.onPointerMove(e), o);
    window.addEventListener('pointerup', (e) => this.onPointerUp(e), o);
    window.addEventListener('pointercancel', (e) => this.onPointerUp(e), o);
    el.addEventListener('wheel', (e) => { e.preventDefault(); this.zoom += e.deltaY * 0.002; }, { ...o, passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault(), o);
  }

  setJoystick(x: number, y: number) {
    this.joystick.set(x, y);
  }

  /** Accumulated look delta in radians since last call. */
  consumeLook(): { x: number; y: number } {
    const r = { x: this.lookX, y: this.lookY };
    this.lookX = this.lookY = 0;
    return r;
  }

  consumeZoom(): number {
    const z = this.zoom;
    this.zoom = 0;
    return z;
  }

  update() {
    const has = (list: string[]) => list.some((k) => this.keys.has(k));
    const kx = (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0);
    const ky = (has(FORWARD) ? 1 : 0) - (has(BACK) ? 1 : 0);
    if (kx || ky) {
      this.move.set(kx, ky).normalize();
    } else {
      this.move.copy(this.joystick);
      if (this.move.lengthSq() > 1) this.move.normalize();
    }
    this.run = this.keys.has('shift') || this.joystick.length() > 0.9;
  }

  requestPointerLock() {
    if (!document.pointerLockElement) this.el.requestPointerLock?.();
  }

  exitPointerLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  private onKey(e: KeyboardEvent, down: boolean) {
    if (e.target instanceof HTMLInputElement) return;
    const k = e.key.toLowerCase();
    if (down) {
      if (!e.repeat && k === 'v') this.onToggleView?.();
      if (!e.repeat && k === 'e') this.onInteract?.();
      this.keys.add(k);
    } else {
      this.keys.delete(k);
    }
  }

  private addLook(dx: number, dy: number, scale: number) {
    this.lookX += dx * scale * this.sensitivity;
    this.lookY += dy * scale * this.sensitivity;
  }

  private onPointerDown(e: PointerEvent) {
    if (e.pointerType === 'touch') {
      this.touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.touches.size === 2) this.pinchDist = this.touchDistance();
      return;
    }
    this.dragId = e.pointerId;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  }

  private onPointerMove(e: PointerEvent) {
    if (document.pointerLockElement === this.el) {
      this.addLook(e.movementX, e.movementY, 0.0025);
      return;
    }
    const t = this.touches.get(e.pointerId);
    if (t) {
      if (this.touches.size === 1) this.addLook(e.clientX - t.x, e.clientY - t.y, 0.005);
      t.x = e.clientX;
      t.y = e.clientY;
      if (this.touches.size === 2) {
        const d = this.touchDistance();
        this.zoom -= (d - this.pinchDist) * 0.01;
        this.pinchDist = d;
      }
      return;
    }
    if (e.pointerId !== this.dragId) return;
    this.addLook(e.clientX - this.lastX, e.clientY - this.lastY, 0.004);
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  }

  private onPointerUp(e: PointerEvent) {
    this.touches.delete(e.pointerId);
    if (e.pointerId === this.dragId) this.dragId = null;
  }

  private touchDistance() {
    const [a, b] = [...this.touches.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  dispose() {
    this.ac.abort();
  }
}
