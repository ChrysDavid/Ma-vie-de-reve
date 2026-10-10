import * as THREE from 'three';
import type { Assets } from '@/engine/assets';
import type { PhysicsWorld } from '@/physics/PhysicsWorld';
import {
  FINISH, FOOTPRINT, FRAME, GLASS_THICKNESS, LEVELS, PERGOLA, PLINTH, RAILING_HEIGHT, RAILINGS, ROOF, ROOMS,
  SLABS, SLIDER_PANEL_MAX, STAIR, WALLS, type Opening, type Wall,
} from '@/data/floorplan';
import { MeshBatcher, type BoxFaces } from './geometry';
import { Finishes } from './materials';

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const EPS = 1e-3;

/** Structural shell of the villa (walls, floors, slabs, roof, stair, openings, railings, pergola) built from the floorplan. */
export class Villa {
  readonly group = new THREE.Group();
  private readonly f: Finishes;
  private readonly solid = new MeshBatcher();
  private readonly glass = new MeshBatcher();

  constructor(assets: Assets, private readonly physics: PhysicsWorld) {
    this.f = new Finishes(assets);
    this.buildPlinth();
    this.buildFloors();
    this.buildSlabs();
    for (const w of WALLS) this.buildWall(w);
    this.buildStair();
    for (const r of RAILINGS) this.buildRailing(r.level, r.ax, r.az, r.bx, r.bz);
    this.buildPergola();

    for (const m of this.solid.build()) this.group.add(m);
    for (const m of this.glass.build(false)) {
      m.renderOrder = 1;
      this.group.add(m);
    }
  }

  /** Box mesh + optional static collider. */
  private box(min: THREE.Vector3, max: THREE.Vector3, faces: BoxFaces, collide = true, target = this.solid) {
    target.box(min, max, faces);
    if (collide) this.physics.addBox(min.clone().add(max).multiplyScalar(0.5), max.clone().sub(min));
  }

  private all(m: THREE.Material, bottom = false): BoxFaces {
    return { px: m, nx: m, py: m, ny: bottom ? m : null, pz: m, nz: m };
  }

  private buildPlinth() {
    const c = this.f.get('concrete'), m = PLINTH.margin;
    this.box(V(FOOTPRINT.x0 - m, 0, FOOTPRINT.z0 - m), V(FOOTPRINT.x1 + m, PLINTH.top, FOOTPRINT.z1 + m), this.all(c));
  }

  private buildFloors() {
    for (const room of ROOMS) {
      const top = LEVELS[room.level].floor;
      const mat = this.f.get(room.floor);
      for (const r of room.rects) this.box(V(r.x0, top - FINISH, r.z0), V(r.x1, top, r.z1), this.all(mat));
    }
  }

  private buildSlabs() {
    const edge = this.f.get('concrete'), ceiling = this.f.get('paint'), fascia = this.f.get('render');
    for (const s of SLABS) {
      const side = s.y0 >= ROOF.y0 ? fascia : edge;
      this.box(V(s.rect.x0, s.y0, s.rect.z0), V(s.rect.x1, s.y1, s.rect.z1),
        { px: side, nx: side, pz: side, nz: side, py: edge, ny: ceiling });
    }
  }

  // --- Walls & openings -------------------------------------------------------------------------

  private buildWall(w: Wall) {
    const lv = LEVELS[w.level];
    const y0 = w.y0 ?? (w.level === 0 ? 0 : lv.floor - FINISH);
    const y1 = w.y1 ?? lv.ceiling;
    const ops = [...(w.openings ?? [])].sort((a, b) => a.c - b.c);
    // Openings sharing the same horizontal span (door + window above) are stacked vertically.
    const groups: Opening[][] = [];
    for (const op of ops) {
      const last = groups[groups.length - 1];
      if (last && Math.abs(last[0].c - op.c) < EPS && Math.abs(last[0].w - op.w) < EPS) last.push(op);
      else groups.push([op]);
    }

    let cursor = w.from;
    for (const g of groups) {
      const a = g[0].c - g[0].w / 2, b = g[0].c + g[0].w / 2;
      if (a > cursor + EPS) this.wallPiece(w, cursor, a, y0, y1);
      const spans = g.map((op) => ({ op, lo: lv.floor + (op.sill ?? 0), hi: lv.floor + (op.sill ?? 0) + op.h }))
        .sort((p, q) => p.lo - q.lo);
      let y = y0;
      for (const s of spans) {
        // Openings at floor level have no threshold piece (the floor finishes run through).
        if (s.lo > y + EPS && (s.op.sill ?? 0) > 0) this.wallPiece(w, a, b, y, s.lo, { top: true, bottom: y > y0 + EPS });
        this.fillOpening(w, s.op, a, b, s.lo, s.hi);
        y = s.hi;
      }
      if (y < y1 - EPS) this.wallPiece(w, a, b, y, y1, { bottom: true });
      cursor = b;
    }
    if (cursor < w.to - EPS) this.wallPiece(w, cursor, w.to, y0, y1);
  }

  /** World box for a span [u0, u1] along the wall, thickness `t` centred on the wall line (or offset). */
  private wallBox(w: Wall, u0: number, u1: number, y0: number, y1: number, t = w.t, offset = 0) {
    const c = w.at + offset;
    return w.axis === 'x'
      ? { min: V(u0, y0, c - t / 2), max: V(u1, y1, c + t / 2) }
      : { min: V(c - t / 2, y0, u0), max: V(c + t / 2, y1, u1) };
  }

  private wallPiece(w: Wall, u0: number, u1: number, y0: number, y1: number, cap: { top?: boolean; bottom?: boolean } = {}) {
    const pos = this.f.get(w.pos), neg = this.f.get(w.neg);
    const reveal = this.f.get(w.pos === 'paint' || w.neg === 'paint' ? 'paint' : w.pos);
    const { min, max } = this.wallBox(w, u0, u1, y0, y1);
    const faces: BoxFaces = w.axis === 'x'
      ? { pz: pos, nz: neg, px: reveal, nx: reveal }
      : { px: pos, nx: neg, pz: reveal, nz: reveal };
    if (cap.top) faces.py = reveal;
    if (cap.bottom) faces.ny = reveal;
    this.box(min, max, faces);
  }

  private fillOpening(w: Wall, op: Opening, a: number, b: number, lo: number, hi: number) {
    if (op.kind === 'pass') return;
    const p = FRAME.profile;
    if (op.kind === 'door' || op.kind === 'entrance') {
      // Casing proud of both wall faces; leaves are added with the door interactions (Phase 6).
      const mat = op.kind === 'door' ? this.f.trim : this.f.aluminium;
      const d = w.t + 0.02;
      this.frameBox(w, a, a + p, lo, hi, d, mat);
      this.frameBox(w, b - p, b, lo, hi, d, mat);
      this.frameBox(w, a + p, b - p, hi - p, hi, d, mat);
      return;
    }
    // Aluminium frame centred in the wall.
    const fd = FRAME.depth, al = this.f.aluminium;
    this.frameBox(w, a, a + p, lo, hi, fd, al);
    this.frameBox(w, b - p, b, lo, hi, fd, al);
    this.frameBox(w, a + p, b - p, hi - p, hi, fd, al);
    this.frameBox(w, a + p, b - p, lo, lo + p, fd, al);

    if (op.kind === 'window') {
      this.pane(w, a + p, b - p, lo + p, hi - p, 0);
      this.physics.addBox(...this.colliderOf(w, a, b, lo, hi));
      return;
    }
    // Slider: half of the panels closed, the other half slid behind them (open half on the + side).
    const n = Math.max(2, Math.ceil(op.w / SLIDER_PANEL_MAX));
    const closed = Math.ceil(n / 2);
    const pw = (b - a - 2 * p) / n;
    const split = a + p + closed * pw;
    for (let i = 0; i < closed; i++) {
      const u0 = a + p + i * pw;
      this.frameBox(w, u0, u0 + p / 2, lo + p, hi - p, fd / 2, al, -fd / 4);
      this.frameBox(w, u0 + pw - p / 2, u0 + pw, lo + p, hi - p, fd / 2, al, -fd / 4);
      this.pane(w, u0 + p / 2, u0 + pw - p / 2, lo + p, hi - p, -fd / 4);
      if (i < n - closed) this.pane(w, u0 + p / 2, u0 + pw - p / 2, lo + p, hi - p, fd / 4);
    }
    this.physics.addBox(...this.colliderOf(w, a, split, lo, hi));
  }

  private frameBox(w: Wall, u0: number, u1: number, y0: number, y1: number, depth: number, mat: THREE.Material, offset = 0) {
    const { min, max } = this.wallBox(w, u0, u1, y0, y1, depth, offset);
    this.solid.box(min, max, this.all(mat, true));
  }

  private pane(w: Wall, u0: number, u1: number, y0: number, y1: number, offset: number) {
    const { min, max } = this.wallBox(w, u0, u1, y0, y1, GLASS_THICKNESS, offset);
    const g = this.f.glass;
    this.glass.box(min, max, w.axis === 'x' ? { pz: g, nz: g } : { px: g, nx: g });
  }

  private colliderOf(w: Wall, u0: number, u1: number, y0: number, y1: number): [THREE.Vector3, THREE.Vector3] {
    const { min, max } = this.wallBox(w, u0, u1, y0, y1, 0.1);
    return [min.clone().add(max).multiplyScalar(0.5), max.clone().sub(min)];
  }

  // --- Stair --------------------------------------------------------------------------------------

  private buildStair() {
    const { x0, x1, zTop, risers, run, treadThickness, nosing, guardFrom } = STAIR;
    const base = LEVELS[0].floor, rise = (LEVELS[1].floor - base) / risers;
    const wood = this.f.get('woodClad');
    for (let i = 1; i < risers; i++) {
      const top = base + i * rise;
      const z0 = zTop + (risers - 1 - i) * run;
      const z1 = z0 + run;
      // Floating tread cantilevered from the wall; the collider is a solid step block below it.
      this.solid.box(V(x0, top - treadThickness, z0), V(x1, top, z1 + nosing), this.all(wood, true));
      this.physics.addBox(V((x0 + x1) / 2, top / 2, (z0 + z1) / 2), V(x1 - x0, top, run));
      // Guard collider following the steps.
      if (i >= guardFrom) this.physics.addBox(V(x1, top + RAILING_HEIGHT / 2, (z0 + z1) / 2), V(0.1, RAILING_HEIGHT, run));
    }
    // Inclined glass guard on the open side.
    const zLow = zTop + (risers - guardFrom) * run, yLow = base + guardFrom * rise;
    const yHigh = LEVELS[1].floor;
    const x = x1 - GLASS_THICKNESS;
    const g = this.f.glass;
    const n = V(1, 0, 0);
    this.glass.quad(g, V(x, yLow, zLow + run), V(x, yHigh, zTop), V(x, yHigh + RAILING_HEIGHT, zTop), V(x, yLow + RAILING_HEIGHT, zLow + run), n);
    // Stainless handrail on top of the glass.
    const len = Math.hypot(zLow + run - zTop, yHigh - yLow);
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, len, 12), this.f.aluminium);
    rail.position.set(x, (yLow + yHigh) / 2 + RAILING_HEIGHT, (zLow + run + zTop) / 2);
    rail.rotation.x = Math.atan2(zTop - zLow - run, yHigh - yLow);
    rail.castShadow = true;
    this.group.add(rail);
  }

  // --- Railings & pergola -------------------------------------------------------------------------

  private buildRailing(level: 0 | 1, ax: number, az: number, bx: number, bz: number) {
    const y = LEVELS[level].floor;
    const shoe = 0.08, t = 0.06;
    const alongX = Math.abs(az - bz) < EPS;
    const [u0, u1] = alongX ? [Math.min(ax, bx), Math.max(ax, bx)] : [Math.min(az, bz), Math.max(az, bz)];
    const c = alongX ? az : ax;
    const mk = (h0: number, h1: number, thick: number) => alongX
      ? { min: V(u0, h0, c - thick / 2), max: V(u1, h1, c + thick / 2) }
      : { min: V(c - thick / 2, h0, u0), max: V(c + thick / 2, h1, u1) };
    const s = mk(y, y + shoe, t);
    this.solid.box(s.min, s.max, this.all(this.f.aluminium));
    const gl = mk(y + shoe, y + RAILING_HEIGHT, GLASS_THICKNESS);
    const g = this.f.glass;
    this.glass.box(gl.min, gl.max, alongX ? { pz: g, nz: g } : { px: g, nx: g });
    const col = mk(y, y + RAILING_HEIGHT + 0.05, 0.12);
    this.physics.addBox(col.min.clone().add(col.max).multiplyScalar(0.5), col.max.clone().sub(col.min));
  }

  private buildPergola() {
    const { rect, height, post, beam, slat } = PERGOLA;
    const y = LEVELS[1].floor, wood = this.f.get('woodClad');
    const top = y + height + beam.h;
    for (const [x, z] of [[rect.x0, rect.z0], [rect.x1, rect.z0], [rect.x0, rect.z1], [rect.x1, rect.z1]]) {
      this.box(V(x - post / 2, y, z - post / 2), V(x + post / 2, top, z + post / 2), this.all(wood));
    }
    // Main beams along z on both sides, slats along x on top.
    for (const x of [rect.x0, rect.x1]) {
      this.solid.box(V(x - beam.w / 2, y + height, rect.z0 - post), V(x + beam.w / 2, top, rect.z1 + post), this.all(wood, true));
    }
    for (let z = rect.z0 + slat.spacing / 2; z < rect.z1; z += slat.spacing) {
      this.solid.box(V(rect.x0 - 0.2, top, z - slat.w / 2), V(rect.x1 + 0.2, top + slat.h, z + slat.w / 2), this.all(wood, true));
    }
  }

  dispose() {
    this.group.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    this.f.dispose();
  }
}
