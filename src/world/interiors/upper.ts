import * as THREE from 'three';
import { EXT, INT, LEVELS, PERGOLA } from '@/data/floorplan';
import { floorY, room, type InteriorKit, type Place } from './kit';

/** Half thickness of interior partitions / exterior walls (faces sit this far from the centre line). */
const IN = INT / 2;
const EX = EXT / 2;
const F = floorY(1);
const H = LEVELS[1].ceiling - F;
const PI = Math.PI;

/**
 * Local frame: origin (cx, cz), rotated by `rot` about Y. `v` runs along the facing direction
 * (sin rot, cos rot), `u` along the side axis (cos rot, -sin rot). Heights `y` are relative to the level floor.
 */
class Frame {
  constructor(readonly k: InteriorKit, readonly cx: number, readonly cz: number, readonly rot = 0) {}

  pt(u: number, v: number): [number, number] {
    const c = Math.cos(this.rot), s = Math.sin(this.rot);
    return [this.cx + u * c + v * s, this.cz - u * s + v * c];
  }
  box(mat: THREE.Material, w: number, h: number, d: number, u: number, y: number, v: number, radius = 0) {
    const [x, z] = this.pt(u, v);
    return this.k.box(mat, w, h, d, x, F + y, z, this.rot, radius);
  }
  cyl(mat: THREE.Material, r: number, h: number, u: number, y: number, v: number, seg = 20, rTop = r) {
    const [x, z] = this.pt(u, v);
    return this.k.cyl(mat, r, h, x, F + y, z, seg, rTop);
  }
  /** Horizontal bar along the side axis (centre at y). */
  rail(mat: THREE.Material, r: number, len: number, u: number, y: number, v: number) {
    const [x, z] = this.pt(u, v);
    return this.k.add(new THREE.CylinderGeometry(r, r, len, 10).rotateZ(PI / 2), mat, x, F + y, z, this.rot);
  }
  col(w: number, h: number, d: number, u: number, v: number, y = 0) {
    const [x, z] = this.pt(u, v);
    this.k.collider(w, h, d, x, F + y, z, this.rot);
  }
  model(id: string, u: number, v: number, o: Omit<Place, 'x' | 'z' | 'level'> = {}) {
    const [x, z] = this.pt(u, v);
    const { y, rot = 0, ...rest } = o;
    return this.k.model(id, { ...rest, x, z, level: 1, rot: this.rot + rot, ...(y !== undefined ? { y: F + y } : {}) });
  }
}

/** World-aligned frame: u = x, v = z. */
const world = (k: InteriorKit) => new Frame(k, 0, 0, 0);

/** Footprint depth of a prop once scaled to `height` (assumes it faces +Z). */
const depthOf = (k: InteriorKit, id: string, height: number) => {
  const d = k.dims(id);
  return (d.z * height) / d.y;
};

const PROPS = [
  'sofa_03', 'modern_arm_chair_01', 'mid_century_lounge_chair', 'Ottoman_01', 'modern_coffee_table_01', 'side_table_01',
  'side_table_tall_01', 'drawer_cabinet', 'dining_chair_02', 'desk_lamp_arm_01', 'modern_ceiling_lamp_01', 'potted_plant_04',
  'pachira_aquatica_01', 'ceramic_vase_01', 'ceramic_vase_03', 'wooden_bowl_01', 'hanging_picture_frame_01',
  'hanging_picture_frame_02', 'concrete_cat_statue', 'bronze_whale_statue',
];

/** Upper floor: master suite, dressing, bedrooms, bathrooms, lounge, terrace and balcony. */
export async function furnishUpper(kit: InteriorKit): Promise<void> {
  await kit.preload(PROPS);
  master(kit);
  masterBath(kit);
  dressing(kit);
  hallway(kit);
  showerRoom2(kit);
  showerRoom3(kit);
  bedroom(kit, 'bedroom2', 4.65, 6.2, 4.7);
  bedroom(kit, 'bedroom3', 5.4, 3.6, 5.0);
  upperLounge(kit);
  terrace(kit);
  balcony(kit);
}

// --- Shared pieces --------------------------------------------------------------------------------

/** Bed with the headboard against a wall: frame origin at the wall face, v towards the foot. */
function bed(k: InteriorKit, hx: number, hz: number, rot: number, width: number, len: number, king: boolean): Frame {
  const f = new Frame(k, hx, hz, rot);
  const panelW = king ? width + 1.1 : width + 0.3;
  f.box(k.walnut, panelW, king ? 1.25 : 0.95, 0.06, 0, 0, 0.03);
  f.box(k.walnut, width + 0.08, 0.25, len - 0.06, 0, 0.06, 0.06 + (len - 0.06) / 2);
  const ml = len - 0.14;
  f.box(k.towel, width, 0.22, ml, 0, 0.31, 0.09 + ml / 2, 0.05);
  const dl = ml * 0.7, end = 0.09 + ml + 0.02;
  f.box(k.linen, width + 0.06, 0.09, dl, 0, 0.53, end - dl / 2, 0.04);
  f.box(k.fabricBlue, width + 0.08, 0.03, 0.5, 0, 0.62, end - 0.55);
  for (const s of [-1, 1]) {
    f.box(k.towel, width * 0.42, 0.13, 0.38, s * width * 0.24, 0.53, 0.32, 0.05);
    f.box(k.fabricBlue, 0.38, 0.12, 0.2, s * width * 0.24, 0.66, 0.4, 0.04);
  }
  f.col(width + 0.1, 0.62, len - 0.06, 0, 0.03 + len / 2);
  const off = width / 2 + 0.38;
  for (const s of [-1, 1]) {
    f.model('side_table_01', s * off, 0.3, { height: 0.5 });
    f.model('desk_lamp_arm_01', s * off, 0.3, { y: 0.5, height: 0.42, rot: -s * 0.4 });
  }
  f.box(k.fabricGrey, width + 1.5, 0.012, len + 0.5, 0, 0, len * 0.55);
  f.model('hanging_picture_frame_01', 0, 0.09, { y: king ? 1.38 : 1.2, height: king ? 0.7 : 0.6 });
  return f;
}

/** Open-front wardrobe unit: shelves with folded linen on one half, hanging rail on the other. */
function wardrobe(k: InteriorKit, f: Frame, w: number, d: number, h: number, mat: THREE.Material, i: number) {
  const cols = [k.fabricBeige, k.fabricGrey, k.fabricBlue];
  f.box(mat, w, h, 0.03, 0, 0, -d / 2 + 0.015);
  for (const s of [-1, 1]) f.box(mat, 0.03, h, d, s * (w / 2 - 0.015), 0, 0);
  f.box(mat, w, 0.03, d, 0, h - 0.03, 0);
  f.box(k.graphite, w - 0.06, 0.08, d - 0.04, 0, 0, 0);
  f.box(mat, 0.02, h - 0.11, d - 0.04, 0, 0.08, 0);
  const iw = w / 2 - 0.04;
  for (let j = 0; j < 5; j++) {
    const y = 0.08 + j * 0.42;
    f.box(mat, iw, 0.02, d - 0.04, -w / 4, y, 0);
    if (j < 4) f.box(cols[(i + j) % 3], 0.3, 0.14, 0.3, -w / 4 + (j % 2 ? 0.08 : -0.08), y + 0.02, 0, 0.02);
  }
  f.rail(k.chrome, 0.012, iw, w / 4, 1.78, 0);
  f.box(mat, iw, 0.02, d - 0.04, w / 4, 1.95, 0);
  const n = Math.floor(iw / 0.07);
  for (let c = 0; c < n; c++) f.box(cols[(i + c) % 3], 0.035, 0.95, 0.38, w / 4 - iw / 2 + 0.05 + c * 0.07, 0.8, 0);
  f.col(w, h, d, 0, 0);
}

/** Wall-hung vanity with marble top, vessel basins, chrome taps and mirror. Frame origin at the centre, back at v = -d/2. */
function vanity(k: InteriorKit, f: Frame, w: number, d: number, basins: number[]) {
  f.box(k.walnut, w, 0.68, d, 0, 0.12, 0);
  f.box(k.marble, w + 0.04, 0.04, d + 0.02, 0, 0.8, 0.01);
  f.col(w, 0.84, d, 0, 0);
  for (const u of basins) {
    f.cyl(k.ceramic, 0.15, 0.12, u, 0.84, 0.02, 28, 0.2);
    f.cyl(k.chrome, 0.012, 0.2, u, 0.84, -d / 2 + 0.07);
    f.box(k.chrome, 0.015, 0.015, 0.13, u, 1.02, -d / 2 + 0.13);
    f.box(k.chrome, 0.3, 0.015, 0.015, u, 0.66, d / 2 + 0.008);
  }
  f.box(k.mirror, Math.min(w, 2.3) * 0.95, 1.05, 0.02, 0, 1.15, -d / 2 + 0.012);
}

/** Walk-in shower: marble tray and back panel, fixed glass with a `gap`-wide entry on side `gapSide`, rain head. Origin at the stall centre, back wall at v = -d/2. */
function stall(k: InteriorKit, f: Frame, w: number, d: number, gapSide: 1 | -1) {
  const gap = 0.8, gl = w - gap, uc = -gapSide * (gap / 2);
  f.box(k.marble, w, 0.03, d, 0, 0, 0);
  f.box(k.marble, w, 2.4, 0.02, 0, 0, -d / 2 + 0.01);
  f.box(k.glass, gl, 2.1, 0.012, uc, 0.03, d / 2 - 0.01);
  f.col(gl, 2.1, 0.05, uc, d / 2 - 0.01, 0.03);
  f.box(k.chrome, 0.02, 0.02, d - 0.02, gapSide * (w / 2 - gap), 2.1, -0.01);
  f.cyl(k.chrome, 0.012, 2.4, 0, 0, -d / 2 + 0.05);
  f.box(k.chrome, 0.02, 0.02, 0.3, 0, 2.28, -d / 2 + 0.2);
  f.cyl(k.chrome, 0.15, 0.025, 0, 2.26, -d / 2 + 0.35);
}

/** Close-coupled toilet, back at v = -0.38. */
function toilet(k: InteriorKit, f: Frame) {
  f.box(k.ceramic, 0.36, 0.4, 0.55, 0, 0, -0.1, 0.06);
  f.box(k.ceramic, 0.38, 0.4, 0.2, 0, 0.4, -0.28, 0.03);
  f.box(k.chrome, 0.06, 0.015, 0.05, 0, 0.8, -0.28);
  f.col(0.4, 0.8, 0.6, 0, -0.1);
}

/** Linen ceiling pendant hanging from the ceiling. */
const pendant = (f: Frame, u: number, v: number) => f.model('modern_ceiling_lamp_01', u, v, { y: H - 0.6, height: 0.6 });

// --- Rooms ----------------------------------------------------------------------------------------

function master(k: InteriorKit) {
  const m = room('master').r;
  const cz = (m.z0 + m.z1) / 2, hx = m.x1 - IN, wx0 = m.x0 + IN;
  const f = bed(k, hx, cz, -PI / 2, 1.8, 2.1, true);
  f.model('Ottoman_01', 0, 2.5, { height: 0.42 });
  pendant(f, 0, 1.3);
  const w = world(k);
  w.model('mid_century_lounge_chair', wx0 + 0.45, cz + 0.6, { rot: PI / 2, height: 0.85 });
  w.model('potted_plant_04', wx0 + 0.3, cz - 0.2, { height: 1.1 });
  const dz = m.z1 - IN - 0.25;
  w.model('drawer_cabinet', -5.3, dz, { rot: PI, height: 0.8, solid: true });
  w.model('ceramic_vase_03', -5.3, dz, { y: 0.8, height: 0.3 });
}

function masterBath(k: InteriorKit) {
  const b = room('masterBath').r;
  const x0 = b.x0 + EX, x1 = b.x1 - IN, z0 = b.z0 + EX, z1 = b.z1 - IN;
  // Freestanding oval tub under the window.
  const cx = (b.x0 + b.x1) / 2, cz = z0 + 0.6;
  k.cyl(k.ceramic, 0.5, 0.6, cx, F, cz, 40).scale.set(1.7, 1, 0.9);
  k.cyl(k.mat({ color: 0xcfe3e6, roughness: 0.05 }), 0.43, 0.01, cx, F + 0.6, cz, 40).scale.set(1.7, 1, 0.9);
  k.collider(1.75, 0.6, 0.95, cx, F, cz);
  k.cyl(k.chrome, 0.015, 0.75, cx + 1.05, F, cz);
  k.add(new THREE.CylinderGeometry(0.013, 0.013, 0.3, 8).rotateZ(PI / 2), k.chrome, cx + 0.92, F + 0.75, cz);
  // Walk-in shower in the south-west corner (open on its north end).
  stall(k, new Frame(k, x0 + 0.75, z1 - 0.75, PI / 2), 1.5, 1.5, 1);
  // Double vanity along the south wall.
  vanity(k, new Frame(k, x1 - 0.5 - 1.2, z1 - 0.275, PI), 2.4, 0.55, [0.55, -0.55]);
  const vf = new Frame(k, x1 - 0.5 - 1.2, z1 - 0.275, PI);
  vf.box(k.towel, 0.28, 0.07, 0.36, 1.0, 0.84, 0);
  vf.box(k.fabricBeige, 0.26, 0.06, 0.34, 1.0, 0.91, 0);
  vf.model('ceramic_vase_01', -1.0, 0, { y: 0.84, height: 0.25 });
  // Towel on a chrome bar by the door-side wall, plant in the corner.
  k.box(k.chrome, 0.04, 0.02, 0.5, x1 - 0.02, F + 1.85, z1 - 0.3);
  k.box(k.towel, 0.04, 0.8, 0.35, x1 - 0.03, F + 1.03, z1 - 0.3);
  world(k).model('potted_plant_04', x1 - 0.3, z0 + 0.3, { height: 1.0 });
}

function dressing(k: InteriorKit) {
  const d = room('dressing').r;
  const x0 = d.x0 + EX, x1 = d.x1 - IN, z0 = d.z0 + IN, z1 = d.z1 - IN;
  const n = 4, uw = (x1 - x0) / n;
  for (let i = 0; i < n; i++) wardrobe(k, new Frame(k, x0 + uw * (i + 0.5), z0 + 0.275, 0), uw, 0.55, 2.4, i % 2 ? k.lacquer : k.walnut, i);
  const wz0 = z0 + 0.6;
  for (let i = 0; i < 2; i++) {
    const uz = (z1 - wz0) / 2;
    wardrobe(k, new Frame(k, x0 + 0.2, wz0 + uz * (i + 0.5), PI / 2), uz, 0.4, 2.4, i ? k.walnut : k.lacquer, i + 1);
  }
  // Central island with drawers.
  const cx = -9.4, cz = (z0 + 0.55 + z1) / 2 + 0.05;
  k.box(k.walnut, 2.4, 0.9, 0.55, cx, F, cz, 0, 0.01);
  k.box(k.marble, 2.5, 0.04, 0.65, cx, F + 0.9, cz);
  k.collider(2.5, 0.94, 0.65, cx, F, cz);
  for (const s of [-1, 1]) for (let c = -1; c <= 1; c++) for (const y of [0.1, 0.5]) {
    const x = cx + c * 0.78, z = cz + s * 0.28;
    k.box(k.lacquer, 0.76, 0.36, 0.012, x, F + y, z);
    k.box(k.brass, 0.2, 0.012, 0.015, x, F + y + 0.28, z + s * 0.012);
  }
  world(k).model('wooden_bowl_01', cx - 0.6, cz, { y: 0.94, height: 0.1 });
  k.box(k.mirror, 1.6, 1.9, 0.02, -10, F + 0.2, z1 - 0.011);
}

function hallway(k: InteriorKit) {
  const h = room('hallway1').r;
  const w = world(k), z0 = h.z0 + IN;
  const cd = depthOf(k, 'drawer_cabinet', 0.8);
  w.model('drawer_cabinet', -10, z0 + cd / 2, { height: 0.8, solid: true });
  w.model('ceramic_vase_01', -10.3, z0 + 0.2, { y: 0.8, height: 0.35 });
  w.model('hanging_picture_frame_02', -10, z0 + 0.03, { y: 1.3, height: 0.7 });
  w.model('potted_plant_04', h.x0 + EX + 0.3, -0.5, { height: 1.1 });
  w.box(k.fabricGrey, 7.5, 0.01, 0.8, -7.25, 0, -0.1);
}

function showerRoom2(k: InteriorKit) {
  const s = room('shower2').r;
  const x0 = s.x0 + EX, x1 = s.x1 - IN, z0 = s.z0 + IN, z1 = s.z1 - IN;
  stall(k, new Frame(k, x1 - 0.45, (z0 + z1) / 2, -PI / 2), z1 - z0, 0.9, 1);
  const vf = new Frame(k, -11.1, z0 + 0.225, 0);
  vanity(k, vf, 1.1, 0.45, [0]);
  vf.box(k.towel, 0.24, 0.1, 0.3, 0.38, 0.84, 0);
  toilet(k, new Frame(k, x0 + 0.38, 1.75, PI / 2));
  world(k).box(k.fabricGrey, 0.6, 0.012, 0.7, -10.3, 0, z1 - 0.4);
}

function showerRoom3(k: InteriorKit) {
  const s = room('shower3').r;
  const x0 = s.x0 + IN, x1 = s.x1 - IN, z0 = s.z0 + IN, z1 = s.z1 - IN;
  stall(k, new Frame(k, x0 + 0.475, (z0 + z1) / 2, PI / 2), z1 - z0, 0.95, -1);
  const vf = new Frame(k, -2.8, z0 + 0.225, 0);
  vanity(k, vf, 1.1, 0.45, [0]);
  vf.box(k.towel, 0.24, 0.1, 0.3, 0.38, 0.84, 0);
  toilet(k, new Frame(k, x1 - 0.38, 1.55, -PI / 2));
  world(k).box(k.fabricGrey, 0.6, 0.012, 0.7, -3.4, 0, z1 - 0.4);
}

/** Bedroom with the bed head on the east wall, desk + wardrobe on the west wall. */
function bedroom(k: InteriorKit, id: string, deskZ: number, wardZ: number, bedZ: number) {
  const r = room(id).r;
  const x0 = r.x0 + (id === 'bedroom2' ? EX : IN), x1 = r.x1 - IN, z1 = r.z1 - EX;
  bed(k, x1, bedZ, -PI / 2, 1.6, 2.05, false);
  // Desk (top + four legs), chair, lamp.
  const dk = new Frame(k, x0 + 0.34, deskZ, PI / 2);
  dk.box(k.walnut, 1.4, 0.04, 0.65, 0, 0.72, 0);
  for (const sx of [-1, 1]) for (const sv of [-1, 1]) dk.box(k.blackMetal, 0.04, 0.72, 0.04, sx * 0.64, 0, sv * 0.28);
  dk.col(1.4, 0.76, 0.65, 0, 0);
  dk.model('dining_chair_02', 0, 0.8, { rot: PI, height: 0.88 });
  dk.model('desk_lamp_arm_01', 0.5, -0.15, { y: 0.76, height: 0.45, rot: 0.5 });
  // Wardrobe.
  wardrobe(k, new Frame(k, x0 + 0.3, wardZ, PI / 2), 1.2, 0.6, 2.3, k.lacquer, 0);
  if (id === 'bedroom3') world(k).model('potted_plant_04', x0 + 0.4, z1 - 0.3, { height: 0.95 });
  pendant(new Frame(k, x1 - 2.6, bedZ, 0), 0, 0);
}

function upperLounge(k: InteriorKit) {
  const l = room('upperLounge').r;
  const lx0 = l.x0 + IN, ex = l.x1 - EX, tvz = -4;
  // TV wall (west): floating cabinet, 2.2 m screen, soundbar, ornaments.
  const tv = new Frame(k, lx0, tvz, PI / 2);
  tv.box(k.walnut, 2.6, 0.4, 0.45, 0, 0.1, 0.225, 0.01);
  for (let c = -1; c <= 1; c++) tv.box(k.lacquer, 0.84, 0.34, 0.012, c * 0.86, 0.13, 0.456);
  tv.col(2.6, 0.5, 0.45, 0, 0.225);
  tv.box(k.graphite, 2.24, 1.28, 0.03, 0, 0.93, 0.015);
  tv.box(k.screen, 2.2, 1.24, 0.01, 0, 0.95, 0.04);
  tv.box(k.blackMetal, 1.2, 0.07, 0.1, 0, 0.5, 0.2);
  tv.model('concrete_cat_statue', 1.05, 0.22, { y: 0.5, height: 0.32, rot: -PI / 2 });
  tv.model('ceramic_vase_03', -1.05, 0.22, { y: 0.5, height: 0.38 });
  new Frame(k, lx0, -6.2, PI / 2).model('hanging_picture_frame_02', 0, 0.03, { y: 1.35, height: 0.8 });
  // Seating area.
  const sd = k.dims('sofa_03'), sw = Math.max(sd.x, sd.z), ss = 2.6 / sw, sdepth = Math.min(sd.x, sd.z) * ss;
  const w = world(k);
  w.model('sofa_03', ex - 0.9 - sdepth / 2, tvz, { rot: -PI / 2, scale: ss, solid: true });
  w.box(k.fabricBeige, 3.2, 0.012, 3.4, 0.55, 0, tvz);
  w.model('modern_coffee_table_01', 0.5, tvz, { height: 0.4 });
  w.model('bronze_whale_statue', 0.5, tvz, { y: 0.4, height: 0.22, rot: PI / 2 });
  w.model('modern_arm_chair_01', 0.6, -2.0, { rot: PI, height: 0.8, solid: true });
  w.model('side_table_tall_01', 2.2, -2.4, { height: 0.55 });
  w.model('desk_lamp_arm_01', 2.2, -2.4, { y: 0.55, height: 0.42, rot: -PI / 2 });
  w.model('pachira_aquatica_01', ex - 0.3, l.z0 + EX + 0.4, { height: 1.8 });
  pendant(w, 0.5, tvz);
}

function terrace(k: InteriorKit) {
  const p = PERGOLA.rect, w = world(k), mat = k.fabricBeige;
  /** Outdoor sofa block: walnut base, seat and back cushions. */
  const sofa = (f: Frame, len: number) => {
    f.box(k.walnut, len, 0.3, 0.9, 0, 0.05, 0);
    const n = Math.round(len / 0.9), cw = len / n - 0.04;
    for (let i = 0; i < n; i++) {
      const u = -len / 2 + (i + 0.5) * (len / n);
      f.box(mat, cw, 0.18, 0.66, u, 0.35, 0.1, 0.04);
      f.box(mat, cw, 0.4, 0.2, u, 0.53, -0.3, 0.05);
    }
    f.col(len, 0.75, 0.9, 0, 0, 0.05);
  };
  const bz = p.z0 + 0.75, ex = p.x1 - 0.57;
  sofa(new Frame(k, (p.x0 + 0.5 + p.x1 - 1.1) / 2, bz, 0), p.x1 - 1.1 - (p.x0 + 0.5));
  sofa(new Frame(k, ex, bz + 0.5 + 1.825, -PI / 2), 3.65);
  const tx = 9.2, tz = -5.7;
  w.box(k.fabricGrey, 3.0, 0.012, 2.4, tx, 0, tz + 0.1);
  w.box(k.walnut, 1.3, 0.04, 0.8, tx, 0.32, tz, 0.01);
  w.box(k.blackMetal, 1.1, 0.3, 0.6, tx, 0.02, tz);
  w.model('wooden_bowl_01', tx, tz, { y: 0.36, height: 0.1 });
  for (const x of [8.8, 9.7]) {
    w.cyl(mat, 0.25, 0.4, x, 0, -3.9, 24);
  }
  for (const x of [p.x0 + 0.5, p.x1 - 0.35]) {
    w.box(k.graphite, 0.5, 0.45, 0.5, x, 0, p.z1 - 0.7);
    w.model('potted_plant_04', x, p.z1 - 0.7, { y: 0.45, height: 0.85 });
    k.collider(0.5, 0.45, 0.5, x, F, p.z1 - 0.7);
  }
}

function balcony(k: InteriorKit) {
  const b = room('balcony').r, w = world(k);
  const z = b.z0 + 0.65, x = -10;
  // Bistro set: pedestal table and two chairs facing each other.
  w.cyl(k.blackMetal, 0.22, 0.02, x, 0, z, 24);
  w.cyl(k.blackMetal, 0.03, 0.7, x, 0, z, 12);
  w.cyl(k.walnut, 0.32, 0.03, x, 0.7, z, 28);
  k.collider(0.64, 0.73, 0.64, x, F, z);
  w.model('dining_chair_02', x - 0.75, z, { rot: PI / 2, height: 0.85 });
  w.model('dining_chair_02', x + 0.75, z, { rot: -PI / 2, height: 0.85 });
  for (const px of [-11.4, -8.4]) {
    w.box(k.graphite, 0.5, 0.45, 0.5, px, 0, z);
    w.model('potted_plant_04', px, z, { y: 0.45, height: 0.85 });
    k.collider(0.5, 0.45, 0.5, px, F, z);
  }
}
