/**
 * Villa floorplan — single source of truth for every architectural dimension (metres, Y-up).
 * X = west(-) → east(+), Z = back/pool(-) → front/street(+). Walls are axis-aligned and centred on
 * their line; exterior x-walls run to the outer corners, exterior z-walls stop at the x-walls' faces.
 */

export type FinishId =
  | 'render' // exterior smooth render
  | 'paint' // interior painted plaster
  | 'stone' // natural stone cladding
  | 'woodClad' // wood cladding
  | 'marble' // bathroom walls/floors
  | 'tiles' // ground-floor large tiles
  | 'oak' // wood flooring
  | 'deck' // terrace decking
  | 'concrete'; // slab edges, plinth

export type Axis = 'x' | 'z';
export type OpeningKind = 'door' | 'pass' | 'window' | 'slider' | 'entrance';

export interface Rect { x0: number; z0: number; x1: number; z1: number }

export interface Opening {
  /** Centre along the wall axis (absolute coordinate). */
  c: number;
  w: number;
  h: number;
  /** Height of the bottom above the level's finished floor. */
  sill?: number;
  kind: OpeningKind;
}

export interface Wall {
  level: 0 | 1;
  /** Wall runs along this axis, at `at` on the other axis, from `from` to `to`. */
  axis: Axis;
  at: number;
  from: number;
  to: number;
  t: number;
  /** Finish on the + side (+z for x-walls, +x for z-walls) and on the − side. */
  pos: FinishId;
  neg: FinishId;
  openings?: Opening[];
  /** Absolute vertical extent override (double-height walls, upper parts above voids). */
  y0?: number;
  y1?: number;
}

export interface Room { id: string; name: string; level: 0 | 1; rects: Rect[]; floor: FinishId }

export interface Slab { rect: Rect; y0: number; y1: number }

export interface Railing { level: 0 | 1; ax: number; az: number; bx: number; bz: number }

// --- Construction constants -------------------------------------------------------------------
export const EXT = 0.3; // exterior wall thickness
export const INT = 0.12; // interior partition thickness
export const FINISH = 0.02; // floor finish thickness
export const DOOR = { w: 0.9, h: 2.1 };
export const DOOR_SMALL = { w: 0.8, h: 2.1 };
export const RAILING_HEIGHT = 1.05;
export const GLASS_THICKNESS = 0.012;
export const FRAME = { profile: 0.06, depth: 0.08, doorDepth: 0.16 };
export const SLIDER_PANEL_MAX = 2.5;
export const PLINTH = { top: 0.13, margin: 0.2 };

export const LEVELS = [
  { floor: 0.15, ceiling: 3.15 },
  { floor: 3.45, ceiling: 6.45 },
] as const;
export const ROOF = { y0: 6.45, y1: 6.8 };

/** Outer faces of the building. */
export const FOOTPRINT: Rect = { x0: -12.15, z0: -7.15, x1: 12.15, z1: 7.15 };
const X0 = FOOTPRINT.x0, X1 = FOOTPRINT.x1, Z0 = FOOTPRINT.z0, Z1 = FOOTPRINT.z1;
/** Exterior z-walls stop at the inner faces of the exterior x-walls. */
const ZI0 = Z0 + EXT, ZI1 = Z1 - EXT;
/** Back overhang of the first-floor slab (balcony + canopy over the living-room sliders). */
const BACK_EDGE = -8.5;

export const SITE = { halfSize: 90, spawn: { x: 1, z: 13, yaw: 0 } };

// --- Rooms --------------------------------------------------------------------------------------
const r = (x0: number, z0: number, x1: number, z1: number): Rect => ({ x0, z0, x1, z1 });

export const ROOMS: Room[] = [
  // Ground floor — open living space along the pool facade.
  { id: 'kitchen', name: 'Cuisine', level: 0, rects: [r(-12, -7, -5, 0.5)], floor: 'tiles' },
  { id: 'dining', name: 'Salle à manger', level: 0, rects: [r(-5, -7, 1, 0.5)], floor: 'tiles' },
  { id: 'living', name: 'Salon', level: 0, rects: [r(1, -7, 12, 0.5)], floor: 'tiles' },
  { id: 'pantry', name: 'Cellier', level: 0, rects: [r(-12, 0.5, -10, 3)], floor: 'tiles' },
  { id: 'laundry', name: 'Buanderie', level: 0, rects: [r(-12, 3, -10, 7)], floor: 'tiles' },
  { id: 'hallway0', name: 'Dégagement', level: 0, rects: [r(-10, 0.5, -1.5, 2)], floor: 'tiles' },
  { id: 'shower4', name: 'Salle de douche 4', level: 0, rects: [r(-10, 2, -7.5, 7)], floor: 'marble' },
  { id: 'bedroom4', name: "Chambre d'amis", level: 0, rects: [r(-7.5, 2, -1.5, 7)], floor: 'oak' },
  { id: 'hall', name: 'Hall', level: 0, rects: [r(-1.5, 0.5, 3.5, 7)], floor: 'tiles' },
  { id: 'cloakroom', name: 'Vestiaire', level: 0, rects: [r(3.5, 0.5, 6, 3.5)], floor: 'tiles' },
  { id: 'guestWc', name: 'Douche / WC invités', level: 0, rects: [r(3.5, 3.5, 6, 7)], floor: 'marble' },
  { id: 'office', name: 'Bureau', level: 0, rects: [r(6, 0.5, 12, 7)], floor: 'oak' },
  // First floor.
  { id: 'master', name: 'Suite parentale', level: 1, rects: [r(-7, -7, -1.5, -1)], floor: 'oak' },
  { id: 'masterBath', name: 'Salle de bain', level: 1, rects: [r(-12, -7, -7, -3.5)], floor: 'marble' },
  { id: 'dressing', name: 'Dressing', level: 1, rects: [r(-12, -3.5, -7, -1)], floor: 'oak' },
  { id: 'hallway1', name: 'Couloir', level: 1, rects: [r(-12, -1, -1.5, 0.5)], floor: 'oak' },
  { id: 'shower2', name: 'Salle de douche 2', level: 1, rects: [r(-12, 0.5, -9, 2.5)], floor: 'marble' },
  { id: 'bedroom2', name: 'Chambre 2', level: 1, rects: [r(-12, 2.5, -7, 7), r(-9, 0.5, -7, 2.5)], floor: 'oak' },
  { id: 'bedroom3', name: 'Chambre 3', level: 1, rects: [r(-7, 2.5, -1.5, 7), r(-7, 0.5, -5, 2.5)], floor: 'oak' },
  { id: 'shower3', name: 'Salle de douche 3', level: 1, rects: [r(-5, 0.5, -1.5, 2.5)], floor: 'marble' },
  { id: 'upperLounge', name: 'Salon du haut', level: 1, rects: [r(-1.5, -7, 3.5, 1)], floor: 'oak' },
  { id: 'terrace', name: 'Terrasse', level: 1, rects: [r(3.5, BACK_EDGE, X1, Z1)], floor: 'deck' },
  { id: 'balcony', name: 'Balcon', level: 1, rects: [r(X0, BACK_EDGE, 3.5, -7)], floor: 'deck' },
];

// --- Walls --------------------------------------------------------------------------------------
const L0 = LEVELS[0], L1 = LEVELS[1];
const door = (c: number, small = false): Opening => ({ c, ...(small ? DOOR_SMALL : DOOR), kind: 'door' });
const win = (c: number, w: number, sill: number, h: number): Opening => ({ c, w, h, sill, kind: 'window' });
const slider = (c: number, w: number, h = 2.7): Opening => ({ c, w, h, kind: 'slider' });

export const WALLS: Wall[] = [
  // ---- Ground floor, exterior ----
  { level: 0, axis: 'x', at: -7, from: X0, to: X1, t: EXT, pos: 'paint', neg: 'render',
    openings: [win(-9.5, 3, 1.05, 1.3), slider(-2.5, 6), slider(6.5, 9)] },
  { level: 0, axis: 'x', at: 7, from: X0, to: -10, t: EXT, pos: 'render', neg: 'paint', openings: [win(-11, 1, 1.2, 1)] },
  { level: 0, axis: 'x', at: 7, from: -10, to: -7.5, t: EXT, pos: 'render', neg: 'marble', openings: [win(-8.75, 1.2, 1.5, 0.7)] },
  { level: 0, axis: 'x', at: 7, from: -7.5, to: -1.5, t: EXT, pos: 'render', neg: 'paint', openings: [win(-4.5, 3, 0.45, 2.25)] },
  // Double-height stone-clad hall facade.
  { level: 0, axis: 'x', at: 7, from: -1.5, to: 3.35, t: EXT, pos: 'stone', neg: 'paint', y0: 0, y1: L1.ceiling,
    openings: [{ c: 1, w: 1.6, h: 2.8, kind: 'entrance' }, win(1, 1.6, 3.2, 2.7), win(2.6, 0.9, 0, 6)] },
  { level: 0, axis: 'x', at: 7, from: 3.35, to: 6, t: EXT, pos: 'render', neg: 'marble', openings: [win(4.75, 0.8, 1.5, 0.6)] },
  { level: 0, axis: 'x', at: 7, from: 6, to: X1, t: EXT, pos: 'woodClad', neg: 'paint', openings: [win(9, 4, 0.5, 2.2)] },
  { level: 0, axis: 'z', at: -12, from: ZI0, to: ZI1, t: EXT, pos: 'paint', neg: 'render',
    openings: [win(-3, 2.5, 1.05, 1.3), win(5, 1, 1.2, 1)] },
  { level: 0, axis: 'z', at: 12, from: ZI0, to: ZI1, t: EXT, pos: 'stone', neg: 'paint', openings: [win(4, 1.6, 0.5, 2.2)] },

  // ---- Ground floor, partitions ----
  { level: 0, axis: 'x', at: 0.5, from: -12, to: -1.5, t: INT, pos: 'paint', neg: 'paint',
    openings: [door(-11, true), { c: -4, w: 1.6, h: 2.4, kind: 'pass' }] },
  { level: 0, axis: 'z', at: -10, from: 0.5, to: 2, t: INT, pos: 'paint', neg: 'paint' },
  { level: 0, axis: 'z', at: -10, from: 2, to: 7, t: INT, pos: 'marble', neg: 'paint' },
  { level: 0, axis: 'x', at: 3, from: -12, to: -10, t: INT, pos: 'paint', neg: 'paint', openings: [door(-11, true)] },
  { level: 0, axis: 'x', at: 2, from: -10, to: -7.5, t: INT, pos: 'marble', neg: 'paint' },
  { level: 0, axis: 'x', at: 2, from: -7.5, to: -1.5, t: INT, pos: 'paint', neg: 'paint', openings: [door(-6.5)] },
  { level: 0, axis: 'z', at: -7.5, from: 2, to: 7, t: INT, pos: 'paint', neg: 'marble', openings: [door(3, true)] },
  { level: 0, axis: 'z', at: -1.5, from: 0.5, to: 7, t: INT, pos: 'paint', neg: 'paint' },
  { level: 0, axis: 'z', at: 3.5, from: 0.5, to: 3.5, t: INT, pos: 'paint', neg: 'paint', openings: [door(2, true)] },
  { level: 0, axis: 'z', at: 3.5, from: 3.5, to: 7, t: INT, pos: 'marble', neg: 'paint', openings: [door(5.25, true)] },
  { level: 0, axis: 'x', at: 3.5, from: 3.5, to: 6, t: INT, pos: 'marble', neg: 'paint' },
  { level: 0, axis: 'z', at: 6, from: 0.5, to: 3.5, t: INT, pos: 'paint', neg: 'paint' },
  { level: 0, axis: 'z', at: 6, from: 3.5, to: 7, t: INT, pos: 'paint', neg: 'marble' },
  { level: 0, axis: 'x', at: 0.5, from: 3.5, to: 12, t: INT, pos: 'paint', neg: 'paint', openings: [door(7.5)] },

  // ---- Walls bounding the hall void (from the ground-floor ceiling up to the roof) ----
  { level: 1, axis: 'z', at: -1.5, from: 1, to: 2.5, t: INT, pos: 'paint', neg: 'marble', y0: L0.ceiling },
  { level: 1, axis: 'z', at: -1.5, from: 2.5, to: 7, t: INT, pos: 'paint', neg: 'paint', y0: L0.ceiling },
  // East facade of the upper volume, facing the terrace (also closes the void above the hall).
  { level: 1, axis: 'z', at: 3.5, from: ZI0, to: Z1, t: EXT, pos: 'render', neg: 'paint', y0: L0.ceiling,
    openings: [slider(-3.5, 4.5, 2.6)] },

  // ---- First floor, exterior ----
  { level: 1, axis: 'x', at: -7, from: X0, to: -7, t: EXT, pos: 'marble', neg: 'render', openings: [win(-9.5, 2, 1.1, 1.2)] },
  { level: 1, axis: 'x', at: -7, from: -7, to: 3.5 + EXT / 2, t: EXT, pos: 'paint', neg: 'render',
    openings: [slider(-4.25, 4, 2.6), slider(1, 4, 2.6)] },
  { level: 1, axis: 'x', at: 7, from: X0, to: -1.5, t: EXT, pos: 'render', neg: 'paint',
    openings: [win(-9.5, 2.4, 0.5, 2.2), win(-4.25, 2.4, 0.5, 2.2)] },
  { level: 1, axis: 'z', at: -12, from: ZI0, to: -3.5, t: EXT, pos: 'marble', neg: 'render' },
  { level: 1, axis: 'z', at: -12, from: -3.5, to: 0.5, t: EXT, pos: 'paint', neg: 'render', openings: [win(-0.25, 0.8, 0.6, 1.8)] },
  { level: 1, axis: 'z', at: -12, from: 0.5, to: 2.5, t: EXT, pos: 'marble', neg: 'render', openings: [win(1.5, 0.8, 1.5, 0.7)] },
  { level: 1, axis: 'z', at: -12, from: 2.5, to: ZI1, t: EXT, pos: 'paint', neg: 'render', openings: [win(4.75, 1.2, 0.5, 2.2)] },

  // ---- First floor, partitions ----
  { level: 1, axis: 'z', at: -7, from: -7, to: -3.5, t: INT, pos: 'paint', neg: 'marble', openings: [door(-5, true)] },
  { level: 1, axis: 'z', at: -7, from: -3.5, to: -1, t: INT, pos: 'paint', neg: 'paint', openings: [door(-2.25, true)] },
  { level: 1, axis: 'x', at: -3.5, from: -12, to: -7, t: INT, pos: 'paint', neg: 'marble' },
  { level: 1, axis: 'x', at: -1, from: -12, to: -7, t: INT, pos: 'paint', neg: 'paint' },
  { level: 1, axis: 'x', at: -1, from: -7, to: -1.5, t: INT, pos: 'paint', neg: 'paint', openings: [door(-3)] },
  { level: 1, axis: 'x', at: 0.5, from: -12, to: -9, t: INT, pos: 'marble', neg: 'paint' },
  { level: 1, axis: 'x', at: 0.5, from: -9, to: -5, t: INT, pos: 'paint', neg: 'paint', openings: [door(-8), door(-6)] },
  { level: 1, axis: 'x', at: 0.5, from: -5, to: -1.5, t: INT, pos: 'marble', neg: 'paint' },
  { level: 1, axis: 'z', at: -9, from: 0.5, to: 2.5, t: INT, pos: 'paint', neg: 'marble' },
  { level: 1, axis: 'x', at: 2.5, from: -12, to: -9, t: INT, pos: 'paint', neg: 'marble', openings: [door(-10.5, true)] },
  { level: 1, axis: 'z', at: -7, from: 0.5, to: 7, t: INT, pos: 'paint', neg: 'paint' },
  { level: 1, axis: 'z', at: -5, from: 0.5, to: 2.5, t: INT, pos: 'marble', neg: 'paint' },
  { level: 1, axis: 'x', at: 2.5, from: -5, to: -1.5, t: INT, pos: 'paint', neg: 'marble', openings: [door(-3.25, true)] },
  { level: 1, axis: 'z', at: -1.5, from: -7, to: -1, t: INT, pos: 'paint', neg: 'paint' },
  { level: 1, axis: 'z', at: -1.5, from: -1, to: 0.5, t: INT, pos: 'paint', neg: 'paint', openings: [{ c: -0.25, w: 1.4, h: 2.4, kind: 'pass' }] },
  { level: 1, axis: 'z', at: -1.5, from: 0.5, to: 1, t: INT, pos: 'paint', neg: 'marble' },
];

// --- Slabs ----------------------------------------------------------------------------------------
const SLAB_TOP = L1.floor - FINISH;
export const SLABS: Slab[] = [
  // Ground-floor ceiling / first floor, minus the double-height hall void x[-1.5, 3.5] z[1, 7].
  { rect: r(X0, BACK_EDGE, -1.5, Z1), y0: L0.ceiling, y1: SLAB_TOP },
  { rect: r(-1.5, BACK_EDGE, X1, 1), y0: L0.ceiling, y1: SLAB_TOP },
  { rect: r(3.5, 1, X1, Z1), y0: L0.ceiling, y1: SLAB_TOP },
  // Flat roof over the upper volume, generous overhangs.
  { rect: r(-13.2, -9.2, 4.7, 8.2), y0: ROOF.y0, y1: ROOF.y1 },
];

// --- Stair (floating treads along the hall's west wall, climbing toward the back) -------------
export const STAIR = {
  x0: -1.5 + INT / 2, // wall side
  x1: -0.3, // open side (glass guard)
  zTop: 1, // edge of the first-floor slab
  risers: 20,
  run: 0.27,
  treadThickness: 0.06,
  nosing: 0.02,
  /** The glass guard starts at this tread so the stair can also be reached from the hall side. */
  guardFrom: 4,
};

// --- Glass railings -------------------------------------------------------------------------------
const inset = 0.05;
export const RAILINGS: Railing[] = [
  // Gallery over the hall.
  { level: 1, ax: STAIR.x1, az: 1 + inset, bx: 3.5 - EXT / 2, bz: 1 + inset },
  // Balcony + terrace perimeter.
  { level: 1, ax: X0 + inset, az: BACK_EDGE + inset, bx: X1 - inset, bz: BACK_EDGE + inset },
  { level: 1, ax: X0 + inset, az: BACK_EDGE + inset, bx: X0 + inset, bz: Z0 },
  { level: 1, ax: X1 - inset, az: BACK_EDGE + inset, bx: X1 - inset, bz: Z1 - inset },
  { level: 1, ax: 3.5 + EXT / 2, az: Z1 - inset, bx: X1 - inset, bz: Z1 - inset },
];

/** Room containing a point (feet position), or undefined outside. */
export function roomAt(x: number, y: number, z: number): Room | undefined {
  const level = y > (LEVELS[0].ceiling + LEVELS[1].floor) / 2 ? 1 : 0;
  return ROOMS.find((room) => room.level === level && room.rects.some((q) => x >= q.x0 && x <= q.x1 && z >= q.z0 && z <= q.z1));
}

// --- Terrace pergola ------------------------------------------------------------------------------
export const PERGOLA = {
  rect: r(6.5, BACK_EDGE + 0.3, X1 - 0.3, -2),
  height: 2.6, // underside of the beams above the deck
  post: 0.14,
  beam: { w: 0.1, h: 0.25 },
  slat: { w: 0.05, h: 0.16, spacing: 0.3 },
};

// =================================================================================================
// Exteriors (Phase 3). Ground top at y = 0; outdoor hard surfaces top at PLINTH.top (flush with sliders).
// =================================================================================================

/** Plot enclosure (fence walls) — the player stays inside. */
export const PLOT: Rect = r(-32, -42, 32, 32);
export const FENCE = { height: 2.2, t: 0.25 };
/** Motorised sliding gate in the front fence (z = PLOT.z1). */
export const GATE = { x0: 15, x1: 21, height: 1.9 };

/** Front yard. */
export const DRIVEWAY: Rect = r(15, 9, 21, PLOT.z1);
export const CARPORT = { rect: r(13.5, 9, 24.5, 17), height: 2.6, roofT: 0.25, post: 0.18 };
/** Parked cars: centre (x, z), heading yaw (0 = nose toward −z), kind. */
export const CARS = [
  { x: 16, z: 13, yaw: 0, kind: 'sedan' },
  { x: 19, z: 13, yaw: 0, kind: 'suv' },
  { x: 22.5, z: 13, yaw: 0, kind: 'sport' },
] as const;
/** Paved pedestrian path: entrance door → driveway. */
export const FRONT_PATHS: Rect[] = [r(0.2, FOOTPRINT.z1 + PLINTH.margin, 1.8, 20), r(1.8, 18.4, 15, 20)];
export const FOUNTAIN = { x: -8, z: 19, radius: 1.6, height: 0.5 };

/** Back yard — infinity pool facing the garden (overflow edge on its −z side). */
export const POOL = {
  rect: r(-8, -21, 8, -12),
  depth: 1.5, // water depth
  waterY: 0.08, // just below the coping
  coping: 0.3, // stone edge width
  /** Catch basin below the vanishing edge. */
  basin: r(-8, -22, 8, -21.3),
  basinDrop: 0.5,
};
/** Stone pool deck between house and pool, and around the pool. */
export const POOL_DECK: Rect[] = [
  r(FOOTPRINT.x0 - PLINTH.margin, POOL.rect.z1, FOOTPRINT.x1 + PLINTH.margin, FOOTPRINT.z0 - PLINTH.margin),
  r(-10, POOL.rect.z0, POOL.rect.x0, POOL.rect.z1),
  r(POOL.rect.x1, POOL.rect.z0, 10, POOL.rect.z1),
];
/** Sun loungers + parasols on the deck (z between pool and house). */
export const LOUNGERS = { z: -10.2, xs: [-6, -4, 3, 5], parasolXs: [-5, 4] };

export const OUTDOOR_KITCHEN = { rect: r(14, -15, 22, -8), pergolaHeight: 2.6 };
export const POOL_HOUSE = { rect: r(-26, -15, -19, -9), height: 3.0 };
export const FIRE_PIT = { x: -18, z: -26, radius: 0.8, benchRadius: 2.6 };
/** Japanese stepping stones: pool deck → fire pit. */
export const STEPPING_STONES = { from: { x: -10, z: -17 }, to: { x: -16.5, z: -24.5 }, spacing: 0.7, size: 0.5 };

/** Garden planting zones (vegetation agent): trees/palms avoid every hard surface above. */
export const LAWNS: Rect[] = [r(PLOT.x0, PLOT.z0, PLOT.x1, PLOT.z1)];
