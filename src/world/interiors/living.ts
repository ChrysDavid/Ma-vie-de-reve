import * as THREE from 'three';
import { LEVELS } from '@/data/floorplan';
import { room, type InteriorKit } from './kit';

/** Clearance kept between furniture and the wall faces. */
const M = 0.15;
const PI = Math.PI;

/** Open ground-floor space: kitchen (west), dining (centre), living (east) along the pool facade. */
export async function furnishLiving(kit: InteriorKit): Promise<void> {
  await kit.preload([
    'sofa_02', 'sofa_03', 'modern_arm_chair_01', 'mid_century_lounge_chair', 'modern_coffee_table_01', 'side_table_01',
    'modern_wooden_cabinet', 'dining_chair_02', 'bar_chair_round_01', 'modern_ceiling_lamp_01', 'throw_pillows_01',
    'pachira_aquatica_01', 'potted_plant_04', 'calathea_orbifolia_01', 'ceramic_vase_01', 'ceramic_vase_03',
    'brass_vase_01', 'wooden_bowl_01', 'tea_set_01', 'wicker_basket_01', 'marble_bust_01', 'bronze_whale_statue',
  ]);
  kitchen(kit);
  dining(kit);
  living(kit);
}

function kitchen(kit: InteriorKit) {
  const { r, y: fy } = room('kitchen');
  const ceil = LEVELS[0].ceiling - fy;
  const x0 = r.x0 + M;
  const z0 = r.z0 + M;
  const at = (rel: number) => fy + rel;

  // West wall run: fridge + oven columns, then base cabinets (sink under the window, cooktop near the columns).
  const fridgeW = 0.78, ovenW = 0.7, depth = 0.64;
  const fz = z0 + fridgeW / 2;
  kit.box(kit.lacquer, depth, 2.3, fridgeW, x0 + depth / 2, fy, fz);
  kit.box(kit.chrome, 0.03, 2.0, fridgeW - 0.04, x0 + depth + 0.015, fy + 0.04, fz, 0, 0.01);
  kit.box(kit.blackMetal, 0.02, 2.0, 0.01, x0 + depth + 0.035, fy + 0.04, fz);
  kit.box(kit.chrome, 0.04, 0.9, 0.03, x0 + depth + 0.04, fy + 0.9, fz + fridgeW / 2 - 0.08, 0, 0.01);
  const oz = z0 + fridgeW + ovenW / 2;
  kit.box(kit.walnut, depth, 2.3, ovenW, x0 + depth / 2, fy, oz);
  kit.box(kit.graphite, 0.03, 0.55, ovenW - 0.1, x0 + depth + 0.015, at(0.85), oz, 0, 0.01);
  kit.box(kit.chrome, 0.03, 0.03, ovenW - 0.2, x0 + depth + 0.045, at(1.3), oz);
  kit.box(kit.graphite, 0.03, 0.4, ovenW - 0.1, x0 + depth + 0.015, at(1.55), oz, 0, 0.01);
  kit.collider(depth, 2.3, fridgeW + ovenW, x0 + depth / 2, fy, z0 + (fridgeW + ovenW) / 2);

  const bz0 = z0 + fridgeW + ovenW;
  const bz1 = -0.6;
  const bl = bz1 - bz0;
  const bc = (bz0 + bz1) / 2;
  kit.box(kit.graphite, depth - 0.06, 0.1, bl, x0 + (depth - 0.06) / 2, fy, bc);
  kit.box(kit.lacquer, depth - 0.02, 0.76, bl, x0 + (depth - 0.02) / 2, fy + 0.1, bc);
  kit.box(kit.marble, depth + 0.03, 0.04, bl, x0 + (depth + 0.03) / 2, at(0.86), bc);
  kit.collider(depth, 0.9, bl, x0 + depth / 2, fy, bc);
  const segs = 6;
  const sw = bl / segs;
  for (let i = 0; i < segs; i++) {
    const zc = bz0 + sw * (i + 0.5);
    for (const [h, yb] of [[0.3, 0.12], [0.38, 0.45]] as const) {
      kit.box(kit.walnut, 0.02, h, sw - 0.05, x0 + depth - 0.01 + 0.02, at(yb), zc);
    }
  }
  // Cooktop + hood.
  const cz = bz0 + sw * 0.5;
  kit.box(kit.graphite, 0.54, 0.01, 0.58, x0 + 0.32, at(0.9), cz);
  for (const dz of [-0.14, 0.14]) for (const dx of [-0.1, 0.1]) kit.cyl(kit.blackMetal, 0.07, 0.006, x0 + 0.32 + dx, at(0.91), cz + dz);
  kit.box(kit.chrome, 0.5, 0.14, 0.9, x0 + 0.3, at(1.7), cz, 0, 0.02);
  kit.box(kit.graphite, 0.3, ceil - 1.84, 0.4, x0 + 0.2, at(1.84), cz);
  // Sink under the window (west wall, z = -3).
  const sz = -3;
  kit.box(kit.chrome, 0.5, 0.008, 0.85, x0 + 0.34, at(0.905), sz);
  kit.box(kit.graphite, 0.42, 0.01, 0.77, x0 + 0.34, at(0.912), sz);
  kit.cyl(kit.chrome, 0.016, 0.28, x0 + 0.1, at(0.9), sz, 12);
  kit.box(kit.chrome, 0.2, 0.02, 0.025, x0 + 0.2, at(1.16), sz, 0, 0.008);

  // Island (marble top, walnut body), stools on the east side, pendants above.
  const ix = r.x0 + 3.0;
  const iz = -3;
  const il = 2.8;
  kit.box(kit.walnut, 0.85, 0.86, il, ix, fy, iz);
  kit.box(kit.marble, 1.15, 0.04, il + 0.2, ix + 0.075, at(0.86), iz, 0, 0.005);
  kit.collider(1.15, 0.9, il + 0.2, ix + 0.075, fy, iz);
  const sx = ix + 0.075 + 0.575 - 0.3;
  for (let i = 0; i < 4; i++) {
    const z = iz + (i - 1.5) * 0.75;
    kit.model('bar_chair_round_01', { x: sx, z, height: 0.78, rot: -PI / 2 + (i % 2 ? 0.15 : -0.1) });
  }
  kit.model('wooden_bowl_01', { x: ix + 0.1, z: iz + 0.45, y: at(0.9), height: 0.1 });
  kit.model('potted_plant_04', { x: ix + 0.05, z: iz - 0.75, y: at(0.9), height: 0.32 });
  kit.model('wicker_basket_01', { x: ix + 0.2, z: iz + 1.0, y: at(0.9), height: 0.22 });

  const bulb = kit.mat({ color: 0xfff2d0, emissive: 0xffd9a0, emissiveIntensity: 2 });
  const shadeBottom = 1.95, shadeH = 0.24;
  for (const dz of [-0.9, 0, 0.9]) {
    const x = ix + 0.075, z = iz + dz;
    kit.cyl(kit.blackMetal, 0.006, ceil - shadeBottom - shadeH, x, at(shadeBottom + shadeH), z, 6);
    kit.cyl(kit.brass, 0.18, shadeH, x, at(shadeBottom), z, 32, 0.07);
    kit.add(new THREE.SphereGeometry(0.05, 12, 8), bulb, x, at(shadeBottom + 0.08), z);
  }
}

function dining(kit: InteriorKit) {
  const { r, y: fy } = room('dining');
  const tx = (r.x0 + r.x1) / 2;
  const tz = -3.2;
  const tw = 2.6, td = 1.0, top = 0.76;
  kit.box(kit.walnut, tw, 0.05, td, tx, fy + top - 0.05, tz, 0, 0.01);
  for (const s of [-1, 1]) kit.box(kit.blackMetal, 0.06, top - 0.05, td - 0.25, tx + s * (tw / 2 - 0.35), fy, tz);
  kit.box(kit.blackMetal, tw - 0.7, 0.04, 0.04, tx, fy + 0.5, tz);
  kit.collider(tw, top, td, tx, fy, tz);

  const ch = 0.9, off = td / 2 + 0.08;
  for (const dx of [-0.85, 0, 0.85]) {
    kit.model('dining_chair_02', { x: tx + dx, z: tz - off, height: ch, rot: 0 });
    kit.model('dining_chair_02', { x: tx + dx, z: tz + off, height: ch, rot: PI });
  }
  kit.model('dining_chair_02', { x: tx - tw / 2 - 0.08, z: tz, height: ch, rot: PI / 2 });
  kit.model('dining_chair_02', { x: tx + tw / 2 + 0.08, z: tz, height: ch, rot: -PI / 2 });

  const ty = fy + top;
  kit.model('wooden_bowl_01', { x: tx, z: tz, y: ty, height: 0.1 });
  kit.model('ceramic_vase_03', { x: tx - 0.6, z: tz + 0.05, y: ty, height: 0.36 });
  kit.model('brass_vase_01', { x: tx + 0.6, z: tz - 0.05, y: ty, height: 0.32 });

  const lampH = 0.95;
  for (const dx of [-0.65, 0.65]) kit.model('modern_ceiling_lamp_01', { x: tx + dx, z: tz, y: LEVELS[0].ceiling - lampH, height: lampH });
}

function living(kit: InteriorKit) {
  const { r, y: fy } = room('living');
  const east = r.x1 - M;
  const at = (rel: number) => fy + rel;

  // TV wall (east): walnut panel, cabinet, screen, decor.
  const tvz = -3.4;
  kit.box(kit.walnut, 0.03, 2.7, 3.6, east - 0.015, fy, tvz);
  const cabH = 0.55, cabD = 0.54;
  const cabX = east - 0.03 - cabD / 2;
  kit.model('modern_wooden_cabinet', { x: cabX, z: tvz, height: cabH, rot: -PI / 2, solid: true });
  kit.box(kit.screen, 0.04, 1.1, 1.9, east - 0.05, at(cabH + 0.5), tvz);
  kit.box(kit.graphite, 0.03, 0.08, 0.5, east - 0.055, at(cabH + 0.42), tvz);
  kit.model('bronze_whale_statue', { x: cabX, z: tvz - 0.7, y: at(cabH), height: 0.3, rot: -PI / 2 });
  kit.model('potted_plant_04', { x: cabX, z: tvz + 0.75, y: at(cabH), height: 0.3 });
  kit.model('ceramic_vase_01', { x: cabX, z: tvz + 0.35, y: at(cabH), height: 0.28 });

  // Corner sofa facing the TV: sofa_03 on the west, sofa_02 return toward the pool.
  const sx = east - 5.0;
  kit.model('sofa_03', { x: sx, z: tvz, height: 0.95, rot: PI / 2, solid: true });
  kit.model('sofa_02', { x: sx + 0.95, z: tvz - 1.16 - 0.47, height: 0.8, rot: 0, solid: true });
  kit.model('throw_pillows_01', { x: sx + 0.05, z: tvz + 0.7, y: at(0.42), height: 0.32, rot: PI / 2 + 0.3 });
  kit.model('throw_pillows_01', { x: sx + 0.05, z: tvz - 0.8, y: at(0.42), height: 0.3, rot: PI / 2 - 0.2 });

  // Rug, coffee table and tea set.
  const rx = sx + 1.75, rz = tvz - 0.3;
  kit.box(kit.fabricGrey, 2.5, 0.015, 3.5, rx, fy, rz, 0, 0.005);
  kit.model('modern_coffee_table_01', { x: rx + 0.15, z: tvz, rot: 0, solid: true });
  const cy = at(0.39);
  kit.model('tea_set_01', { x: rx + 0.15, z: tvz + 0.25, y: cy, height: 0.14, rot: 0.6 });
  kit.model('wooden_bowl_01', { x: rx + 0.15, z: tvz - 0.3, y: cy, height: 0.07 });

  // Armchairs around the table.
  kit.model('modern_arm_chair_01', { x: rx + 1.2, z: tvz + 2.2, height: 0.85, rot: PI + 0.45, solid: true });
  kit.model('mid_century_lounge_chair', { x: sx - 0.9, z: tvz + 2.5, height: 0.85, rot: 2.4, solid: true });
  // Side table with vase next to the sofa.
  const stz = tvz + 1.16 + 0.45;
  kit.model('side_table_01', { x: sx, z: stz, height: 0.5, solid: true });
  kit.model('ceramic_vase_01', { x: sx, z: stz, y: at(0.5), height: 0.32 });

  // Plants and sculpture.
  kit.model('pachira_aquatica_01', { x: east - 0.55, z: 0.5 - M - 0.5, height: 1.7, solid: true });
  kit.model('calathea_orbifolia_01', { x: r.x0 + M + 0.4, z: r.z0 + M + 0.4, height: 0.85 });
  const px = east - 0.3, pz = r.z0 + M + 0.3;
  kit.box(kit.lacquer, 0.4, 0.9, 0.4, px, fy, pz, 0, 0.01);
  kit.collider(0.4, 0.9, 0.4, px, fy, pz);
  kit.model('marble_bust_01', { x: px, z: pz, y: at(0.9), height: 0.5, rot: -PI / 2 });
}
