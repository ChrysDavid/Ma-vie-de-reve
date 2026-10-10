import * as THREE from 'three';
import { EXT, INT } from '@/data/floorplan';
import { room, type InteriorKit } from './kit';

const PI = Math.PI;
/** Half thickness of interior partitions / exterior walls (inner face offset from the wall centre line). */
const I = INT / 2;
const E = EXT / 2;

/**
 * Local frame against a wall: origin (x, z) on the wall's inner face, `rot` = Y rotation so that +v points
 * into the room (0: +z, PI: -z, -PI/2: -x, PI/2: +x), u runs along the wall. Heights `y` are above the floor.
 */
function frame(kit: InteriorKit, fy: number, x: number, z: number, rot: number) {
  const c = Math.cos(rot), s = Math.sin(rot);
  const p = (u: number, v: number): [number, number] => [x + u * c + v * s, z - u * s + v * c];
  return {
    fy, rot, pt: p,
    box(mat: THREE.Material, w: number, h: number, d: number, u: number, y: number, v: number, radius = 0) {
      const [px, pz] = p(u, v);
      return kit.box(mat, w, h, d, px, fy + y, pz, rot, radius);
    },
    cyl(mat: THREE.Material, r: number, h: number, u: number, y: number, v: number, rTop = r) {
      const [px, pz] = p(u, v);
      return kit.cyl(mat, r, h, px, fy + y, pz, 24, rTop);
    },
    /** Disc whose axis runs along v (front-facing); `y` is its centre. */
    disc(mat: THREE.Material, r: number, t: number, u: number, y: number, v: number) {
      const [px, pz] = p(u, v);
      return kit.add(new THREE.CylinderGeometry(r, r, t, 32).rotateX(PI / 2), mat, px, fy + y, pz, rot);
    },
    solid(w: number, h: number, d: number, u: number, y: number, v: number) {
      const [px, pz] = p(u, v);
      kit.collider(w, h, d, px, fy + y, pz, rot);
    },
    model(id: string, u: number, v: number, height: number, o: { y?: number; rot?: number; solid?: boolean } = {}) {
      const [px, pz] = p(u, v);
      return kit.model(id, { x: px, z: pz, y: fy + (o.y ?? 0), rot: rot + (o.rot ?? 0), height, solid: o.solid });
    },
  };
}
type Fr = ReturnType<typeof frame>;

/** Hanging picture, thin axis along the wall normal, 0.02 m off the wall, centred at height `yc`. */
function picture(kit: InteriorKit, f: Fr, id: string, u: number, yc: number, h: number) {
  const d = kit.dims(id);
  const thin = Math.min(d.x, d.z) * (h / d.y);
  f.model(id, u, thin / 2 + 0.02, h, { y: yc - h / 2, rot: d.x < d.z ? PI / 2 : 0 });
}

/** Small table lamp with a warm shade. */
function lamp(kit: InteriorKit, f: Fr, shade: THREE.Material, u: number, v: number, y: number) {
  f.cyl(kit.brass, 0.06, 0.015, u, y, v);
  f.cyl(kit.brass, 0.012, 0.2, u, y + 0.015, v);
  f.cyl(shade, 0.13, 0.2, u, y + 0.2, v, 0.09);
}

/** Wall-hung vanity: walnut cabinet, marble top, vessel basin, chrome tap. */
function vanity(kit: InteriorKit, f: Fr, w: number) {
  f.box(kit.walnut, w, 0.46, 0.46, 0, 0.33, 0.23);
  f.box(kit.graphite, w - 0.1, 0.01, 0.004, 0, 0.56, 0.462);
  f.box(kit.brass, 0.3, 0.012, 0.012, 0, 0.62, 0.48);
  f.box(kit.marble, w + 0.04, 0.03, 0.5, 0, 0.79, 0.25);
  f.cyl(kit.ceramic, 0.15, 0.11, 0, 0.82, 0.27, 0.2);
  f.cyl(kit.chrome, 0.012, 0.22, 0, 0.82, 0.07);
  f.box(kit.chrome, 0.016, 0.016, 0.14, 0, 1.02, 0.13);
  f.solid(w + 0.04, 0.5, 0.5, 0, 0.33, 0.25);
}

/** Wall mirror in a thin black frame. */
function mirror(kit: InteriorKit, f: Fr, u: number, y: number, w: number, h: number) {
  f.box(kit.blackMetal, w + 0.04, h + 0.04, 0.012, u, y - 0.02, 0.006);
  const [px, pz] = f.pt(u, 0.012);
  kit.mirrorPlate(w, h, px, f.fy + y, pz, f.rot, 0.004);
}

/** Wall-hung toilet with concealed cistern and flush plate. */
function toilet(kit: InteriorKit, f: Fr) {
  f.box(kit.lacquer, 0.5, 1.0, 0.16, 0, 0, 0.08);
  f.box(kit.chrome, 0.2, 0.1, 0.006, 0, 0.8, 0.163);
  f.box(kit.ceramic, 0.36, 0.22, 0.52, 0, 0.2, 0.32, 0.1);
  f.box(kit.ceramic, 0.36, 0.025, 0.42, 0, 0.42, 0.3, 0.012);
  f.solid(0.4, 0.45, 0.56, 0, 0, 0.3);
}

/** Towel rail with two hanging towels. */
function towelBar(kit: InteriorKit, f: Fr, u: number, y: number) {
  f.box(kit.chrome, 0.8, 0.02, 0.02, u, y, 0.07);
  for (const s of [-1, 1]) f.box(kit.chrome, 0.02, 0.02, 0.06, u + s * 0.38, y, 0.03);
  for (const s of [-1, 1]) f.box(kit.towel, 0.34, 0.7, 0.03, u + s * 0.19, y - 0.66, 0.1, 0.01);
}

/** Walk-in shower: marble tray, glass screen along v=d (open at u=0), chrome rain head on the back wall. */
function shower(kit: InteriorKit, f: Fr, w: number, d: number, headU: number) {
  f.box(kit.marble, w, 0.03, d, w / 2, 0, d / 2);
  f.box(kit.glass, w, 2.0, 0.012, w / 2, 0.03, d);
  f.box(kit.chrome, w, 0.02, 0.02, w / 2, 2.03, d);
  f.solid(w, 2.0, 0.03, w / 2, 0, d);
  f.box(kit.chrome, 0.02, 0.02, 0.35, headU, 2.1, 0.175);
  f.cyl(kit.chrome, 0.13, 0.015, headU, 2.08, 0.36);
  f.box(kit.chrome, 0.14, 0.14, 0.03, headU, 1.15, 0.015);
}

/** Front-loading washer / dryer, 0.6 m, centred at u. */
function machine(kit: InteriorKit, f: Fr, u: number) {
  f.box(kit.lacquer, 0.6, 0.85, 0.6, u, 0, 0.3, 0.015);
  f.box(kit.graphite, 0.54, 0.08, 0.004, u, 0.74, 0.602);
  f.disc(kit.chrome, 0.02, 0.02, u + 0.2, 0.78, 0.612);
  f.disc(kit.chrome, 0.23, 0.04, u, 0.4, 0.61);
  f.disc(kit.screen, 0.19, 0.045, u, 0.4, 0.612);
}

/** Open shelving with jars, cans and boxes (seeded). */
function pantryUnit(kit: InteriorKit, f: Fr, len: number, rnd: () => number) {
  const depth = 0.34, top = 2.0;
  for (const u of [0.015, len - 0.015]) f.box(kit.walnut, 0.03, top, depth, u, 0, depth / 2);
  const mats = [kit.fabricBeige, kit.fabricBlue, kit.lacquer, kit.fabricGrey];
  for (const y of [0.12, 0.55, 0.98, 1.41, top - 0.03]) {
    f.box(kit.walnut, len, 0.03, depth, len / 2, y, depth / 2);
    if (y === top - 0.03) continue;
    for (let u = 0.1; u < len - 0.12;) {
      const k = rnd();
      if (k < 0.4) {
        const h = 0.14 + rnd() * 0.08;
        f.cyl(kit.ceramic, 0.045, h, u + 0.045, y + 0.03, 0.17);
        f.cyl(kit.brass, 0.047, 0.02, u + 0.045, y + 0.03 + h, 0.17);
        u += 0.11;
      } else if (k < 0.7) {
        f.cyl(mats[Math.floor(rnd() * mats.length)], 0.04, 0.12, u + 0.04, y + 0.03, 0.17);
        u += 0.1;
      } else {
        const h = 0.18 + rnd() * 0.12;
        f.box(mats[Math.floor(rnd() * mats.length)], 0.12, h, 0.09, u + 0.06, y + 0.03, 0.17, 0.005);
        u += 0.15;
      }
    }
  }
  f.solid(len, top, depth, len / 2, 0, depth / 2);
}

function hall(kit: InteriorKit) {
  const { r, y: fy } = room('hall');
  const xe = r.x1 - I, zs = r.z1 - E;
  const cz = r.z0 + 3.15;
  // Console on the east wall, between the cloakroom and WC doors.
  const c = frame(kit, fy, xe, cz, -PI / 2);
  c.box(kit.walnut, 1.4, 0.05, 0.36, 0, 0.72, 0.19);
  c.box(kit.walnut, 1.3, 0.03, 0.3, 0, 0.2, 0.19);
  for (const s of [-1, 1]) c.box(kit.blackMetal, 0.03, 0.72, 0.34, s * 0.66, 0, 0.19);
  c.solid(1.4, 0.77, 0.36, 0, 0, 0.19);
  c.model('brass_vase_01', -0.45, 0.19, 0.6, { y: 0.77 });
  c.model('ceramic_vase_03', 0.45, 0.19, 0.38, { y: 0.77 });
  c.model('wooden_bowl_01', 0, 0.2, 0.09, { y: 0.77 });
  picture(kit, c, 'hanging_picture_frame_02', 0, 1.65, 0.8);
  // Sculpture on a marble plinth in front of the tall slit window.
  const sx = r.x1 - 0.8, sz = zs - 0.45;
  kit.box(kit.marble, 0.5, 0.75, 0.5, sx, fy, sz, 0, 0.01);
  kit.collider(0.5, 0.75, 0.5, sx, fy, sz);
  kit.model('horse_statue_01', { x: sx, z: sz, y: fy + 0.75, height: 0.7, rot: -0.5 });
  // Big plant in the north-east corner, entrance rug.
  kit.model('pachira_aquatica_01', { x: r.x1 - 0.65, z: r.z0 + 0.6, height: 1.9, pot: true });
  kit.box(kit.fabricBeige, 1.4, 0.012, 2.6, r.x0 + 2.5, fy, zs - 1.6, 0, 0.004);
}

function hallway(kit: InteriorKit) {
  const { r, y: fy } = room('hallway0');
  const f = frame(kit, fy, r.x0 + 2.2, r.z0 + I, 0);
  f.box(kit.walnut, 1.2, 0.05, 0.3, 0, 0.74, 0.16);
  f.box(kit.blackMetal, 1.1, 0.74, 0.28, 0, 0, 0.16);
  f.solid(1.2, 0.79, 0.3, 0, 0, 0.16);
  f.model('ceramic_vase_01', -0.3, 0.16, 0.34, { y: 0.79 });
  f.model('wooden_bowl_01', 0.25, 0.17, 0.09, { y: 0.79 });
  picture(kit, f, 'hanging_picture_frame_01', 0, 1.5, 0.75);
  // Runner along the passage.
  kit.box(kit.fabricGrey, 4.2, 0.012, 0.8, r.x0 + 4.0, fy, r.z0 + 1.2, 0, 0.004);
}

function office(kit: InteriorKit, shade: THREE.Material) {
  const { r, y: fy } = room('office');
  const xw = r.x0 + I, xe = r.x1 - E, zn = r.z0 + I, zs = r.z1 - E;
  // Walnut desk in front of the south window, facing the room.
  const d = frame(kit, fy, r.x0 + 3.0, zs, PI);
  d.box(kit.walnut, 1.8, 0.04, 0.8, 0, 0.72, 0.5);
  for (const s of [-1, 1]) d.box(kit.walnut, 0.04, 0.72, 0.76, s * 0.88, 0, 0.5);
  d.box(kit.walnut, 1.7, 0.4, 0.02, 0, 0.3, 0.2);
  d.box(kit.walnut, 0.45, 0.55, 0.7, 0.62, 0.15, 0.5);
  d.solid(1.8, 0.76, 0.8, 0, 0, 0.5);
  d.box(kit.graphite, 0.22, 0.015, 0.16, -0.1, 0.76, 0.3);
  d.box(kit.graphite, 0.04, 0.26, 0.03, -0.1, 0.775, 0.26);
  d.box(kit.graphite, 0.64, 0.38, 0.015, -0.1, 1.0, 0.24);
  d.box(kit.screen, 0.62, 0.36, 0.01, -0.1, 1.01, 0.25);
  d.box(kit.lacquer, 0.4, 0.015, 0.13, -0.1, 0.76, 0.6, 0.004);
  d.model('desk_lamp_arm_01', -0.72, 0.4, 0.55, { y: 0.76, rot: 0.4 });
  d.model('tea_set_01', 0.6, 0.55, 0.16, { y: 0.76 });
  d.model('modern_arm_chair_01', 0, 1.4, 0.95, { rot: PI });
  // Display shelves on the west wall (front assumed along +x), drawer cabinet with a bust.
  const w = frame(kit, fy, xw, r.z0 + 4.5, PI / 2);
  const sd = kit.dims('wooden_display_shelves_01');
  const ss = 1.9 / sd.y;
  w.model('wooden_display_shelves_01', 0, sd.x * ss / 2 + 0.02, 1.9, { rot: -PI / 2, solid: true });
  w.model('ceramic_vase_01', -0.3, sd.x * ss / 2, 0.38, { y: 1.9 });
  w.model('brass_vase_01', 0.3, sd.x * ss / 2, 0.5, { y: 1.9 });
  const dc = frame(kit, fy, xw, r.z0 + 2.0, PI / 2);
  const dd = kit.dims('drawer_cabinet');
  dc.model('drawer_cabinet', 0, dd.z * (1.4 / dd.y) / 2 + 0.02, 1.4, { solid: true });
  dc.model('marble_bust_01', 0, dd.z * (1.4 / dd.y) / 2, 0.4, { y: 1.4 });
  // Lounge corner: rug, lounge chair, side table with lamp, plant.
  kit.box(kit.fabricGrey, 2.8, 0.012, 2.0, r.x1 - 2.3, fy, r.z0 + 1.9, 0, 0.004);
  kit.model('mid_century_lounge_chair', { x: r.x1 - 1.6, z: r.z0 + 1.7, height: 0.85, rot: -1.0 });
  kit.model('side_table_01', { x: r.x1 - 0.6, z: r.z0 + 2.6, height: 0.5, solid: true });
  const o = frame(kit, fy, 0, 0, 0);
  lamp(kit, o, shade, r.x1 - 0.6, r.z0 + 2.6, 0.5);
  kit.model('potted_plant_04', { x: r.x1 - 0.55, z: r.z0 + 0.75, height: 1.0 });
  picture(kit, frame(kit, fy, r.x1 - 2.3, zn, 0), 'hanging_picture_frame_02', 0, 1.55, 0.7);
  picture(kit, frame(kit, fy, xe, r.z1 - 1.3, -PI / 2), 'hanging_picture_frame_01', 0, 1.5, 0.8);
}

function bedroom4(kit: InteriorKit, shade: THREE.Material) {
  const { r, y: fy } = room('bedroom4');
  const xe = r.x1 - I, zn = r.z0 + I, zs = r.z1 - E, xw = r.x0 + I;
  const cz = r.z0 + 2.6;
  // Bed, headboard on the east wall.
  const b = frame(kit, fy, xe, cz, -PI / 2);
  b.box(kit.walnut, 2.0, 1.15, 0.1, 0, 0, 0.06);
  b.box(kit.walnut, 1.9, 0.24, 2.15, 0, 0.08, 1.185);
  b.box(kit.linen, 1.8, 0.27, 2.0, 0, 0.3, 1.14, 0.04);
  b.box(kit.linen, 1.9, 0.1, 1.45, 0, 0.565, 1.445, 0.04);
  b.box(kit.fabricBlue, 1.92, 0.115, 0.45, 0, 0.565, 1.9, 0.03);
  for (const s of [-1, 1]) {
    b.box(kit.linen, 0.62, 0.14, 0.38, s * 0.45, 0.57, 0.38, 0.05);
    b.box(kit.fabricGrey, 0.4, 0.12, 0.3, s * 0.3, 0.71, 0.5, 0.05);
  }
  b.solid(2.0, 0.6, 2.3, 0, 0, 1.15);
  for (const s of [-1, 1]) {
    b.model('side_table_01', s * 1.27, 0.33, 0.5, { solid: true });
    lamp(kit, b, shade, s * 1.27, 0.33, 0.5);
  }
  picture(kit, b, 'hanging_picture_frame_02', 0, 1.65, 0.7);
  b.model('Ottoman_01', 0, 2.75, 0.42, { rot: PI });
  kit.box(kit.fabricBeige, 2.6, 0.012, 2.6, xe - 1.9, fy, cz, 0, 0.004);
  // Wardrobe on the north wall: tall lacquer box with door seams and brass pulls.
  const w = frame(kit, fy, r.x0 + 3.3, zn, 0);
  w.box(kit.lacquer, 2.2, 2.4, 0.6, 0, 0, 0.3, 0.01);
  for (const u of [-0.55, 0, 0.55]) w.box(kit.graphite, 0.008, 2.3, 0.004, u, 0.05, 0.602);
  for (const u of [-0.5, 0.05, 0.6, -0.05, -0.6, 0.5]) w.box(kit.brass, 0.014, 0.3, 0.02, u, 1.0, 0.612);
  w.solid(2.2, 2.4, 0.6, 0, 0, 0.3);
  kit.model('calathea_orbifolia_01', { x: xw + 0.55, z: zs - 0.55, height: 0.7 });
}

function shower4(kit: InteriorKit) {
  const { r, y: fy } = room('shower4');
  const xw = r.x0 + I, xe = r.x1 - I, zn = r.z0 + I, zs = r.z1 - E;
  shower(kit, frame(kit, fy, xw + 1.6, zs, PI), 1.6, 1.7, 1.1);
  const v = frame(kit, fy, xw, r.z0 + 2.0, PI / 2);
  vanity(kit, v, 1.2);
  mirror(kit, v, 0, 1.15, 0.9, 0.9);
  v.box(kit.towel, 0.3, 0.06, 0.2, 0.35, 0.82, 0.25, 0.01);
  v.model('ceramic_vase_03', -0.4, 0.3, 0.25, { y: 0.82 });
  toilet(kit, frame(kit, fy, xw + 0.75, zn, 0));
  towelBar(kit, frame(kit, fy, xe, r.z0 + 2.3, -PI / 2), 0, 1.3);
}

function guestWc(kit: InteriorKit) {
  const { r, y: fy } = room('guestWc');
  const xw = r.x0 + I, xe = r.x1 - I, zn = r.z0 + I, zs = r.z1 - E;
  shower(kit, frame(kit, fy, xe - 1.45, zn, 0), 1.45, 1.45, 1.0);
  const v = frame(kit, fy, xe, r.z1 - 1.1, -PI / 2);
  vanity(kit, v, 1.0);
  mirror(kit, v, 0, 1.15, 0.8, 0.9);
  v.model('ceramic_vase_03', 0.3, 0.3, 0.25, { y: 0.82 });
  toilet(kit, frame(kit, fy, r.x0 + 0.8, zs, PI));
  towelBar(kit, frame(kit, fy, xw + 0.55, zn, 0), 0, 1.3);
}

function cloakroom(kit: InteriorKit) {
  const { r, y: fy } = room('cloakroom');
  const xe = r.x1 - I, zn = r.z0 + I, zs = r.z1 - I;
  // Bench with basket and cushions under a picture.
  const b = frame(kit, fy, r.x0 + 1.3, zn, 0);
  b.box(kit.walnut, 1.5, 0.05, 0.42, 0, 0.41, 0.23);
  for (const s of [-1, 1]) b.box(kit.blackMetal, 0.04, 0.41, 0.38, s * 0.7, 0, 0.23);
  b.solid(1.5, 0.46, 0.42, 0, 0, 0.23);
  b.model('wicker_basket_01', -0.4, 0.23, 0.22, { y: 0.46 });
  b.model('throw_pillows_01', 0.4, 0.23, 0.3, { y: 0.46 });
  picture(kit, b, 'hanging_picture_frame_01', 0, 1.5, 0.75);
  // Coat rail, hanging coats and shoe shelves on the east wall.
  const e = frame(kit, fy, xe, r.z0 + 1.7, -PI / 2);
  e.box(kit.chrome, 2.2, 0.03, 0.03, 0, 1.75, 0.3);
  e.box(kit.walnut, 2.3, 0.03, 0.35, 0, 1.95, 0.175);
  const coats = [kit.fabricGrey, kit.fabricBlue, kit.fabricBeige, kit.graphite, kit.fabricGrey];
  coats.forEach((m, i) => {
    const u = -0.85 + i * 0.42;
    e.box(kit.brass, 0.02, 0.05, 0.02, u, 1.72, 0.3);
    e.box(m, 0.4, 1.0, 0.08, u, 0.72, 0.3, 0.03);
  });
  for (const y of [0.1, 0.4]) {
    e.box(kit.walnut, 2.2, 0.025, 0.32, 0, y, 0.18);
    for (let k = 0; k < 5; k++) e.box(k % 2 ? kit.graphite : kit.lacquer, 0.1, 0.09, 0.27, -0.85 + k * 0.42, y + 0.025, 0.18, 0.03);
  }
  for (const s of [-1, 1]) e.box(kit.walnut, 0.025, 0.42, 0.32, s * 1.1, 0, 0.18);
  e.solid(2.3, 2.0, 0.35, 0, 0, 0.18);
  mirror(kit, frame(kit, fy, r.x0 + 1.1, zs, PI), 0, 0.4, 0.7, 1.7);
}

function pantry(kit: InteriorKit) {
  const { r, y: fy } = room('pantry');
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const len = 2.2;
  pantryUnit(kit, frame(kit, fy, r.x1 - I, r.z0 + 0.15, -PI / 2), len, rnd);
  pantryUnit(kit, frame(kit, fy, r.x0 + E, r.z0 + 0.15 + len, PI / 2), len, rnd);
}

function laundry(kit: InteriorKit) {
  const { r, y: fy } = room('laundry');
  const xe = r.x1 - I, zs = r.z1 - E;
  const f = frame(kit, fy, xe, zs, PI);
  machine(kit, f, 0.38);
  machine(kit, f, 0.99);
  f.box(kit.marble, 1.79, 0.04, 0.62, 0.895, 0.85, 0.31);
  f.solid(1.79, 0.89, 0.62, 0.895, 0, 0.31);
  for (let k = 0; k < 3; k++) f.box(kit.towel, 0.3, 0.05, 0.22, 1.55, 0.89 + k * 0.05, 0.3, 0.012);
  f.cyl(kit.lacquer, 0.06, 0.26, 0.25, 0.89, 0.3);
  f.cyl(kit.fabricBlue, 0.05, 0.22, 0.4, 0.89, 0.32);
  f.model('wicker_basket_01', 1.55, 0.35, 0.22, { rot: PI });
  // Open shelves on the east wall.
  const s = frame(kit, fy, xe, r.z0 + 1.1, -PI / 2);
  for (const y of [1.35, 1.75]) s.box(kit.walnut, 1.5, 0.03, 0.3, 0.75, y, 0.15);
  s.model('wicker_basket_01', 0.4, 0.15, 0.2, { y: 1.38 });
  s.model('wicker_basket_01', 1.0, 0.15, 0.2, { y: 1.38 });
  s.box(kit.fabricBeige, 0.3, 0.2, 0.22, 0.35, 1.78, 0.15, 0.01);
  s.box(kit.lacquer, 0.3, 0.2, 0.22, 0.75, 1.78, 0.15, 0.01);
  s.box(kit.fabricGrey, 0.3, 0.2, 0.22, 1.15, 1.78, 0.15, 0.01);
}

/** Furnishes the ground-floor rooms except the open living space (hall, office, guest suite, service rooms). */
export async function furnishGround(kit: InteriorKit): Promise<void> {
  await kit.preload([
    'horse_statue_01', 'brass_vase_01', 'ceramic_vase_01', 'ceramic_vase_03', 'wooden_bowl_01', 'pachira_aquatica_01',
    'hanging_picture_frame_01', 'hanging_picture_frame_02', 'desk_lamp_arm_01', 'modern_arm_chair_01',
    'mid_century_lounge_chair', 'wooden_display_shelves_01', 'drawer_cabinet', 'side_table_01', 'potted_plant_04',
    'marble_bust_01', 'tea_set_01', 'calathea_orbifolia_01', 'Ottoman_01', 'wicker_basket_01', 'throw_pillows_01',
  ]);
  const shade = kit.mat({ color: 0xf4ead8, emissive: 0xffd9a0, emissiveIntensity: 0.4, roughness: 0.9, side: THREE.DoubleSide });
  hall(kit);
  hallway(kit);
  office(kit, shade);
  bedroom4(kit, shade);
  shower4(kit);
  guestWc(kit);
  cloakroom(kit);
  pantry(kit);
  laundry(kit);
}
