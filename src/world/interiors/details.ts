import { LEVELS, ROOMS, WALLS, type Opening, type Rect, type Wall } from '@/data/floorplan';
import type { InteriorKit } from './kit';

const BASE = { h: 0.08, t: 0.015 };
const PLATE = { s: 0.08, t: 0.01, switchY: 1.05, socketY: 0.3, gap: 0.2 };
const EPS = 0.02;

interface Edge { axis: 'x' | 'z'; at: number; a: number; b: number; side: 1 | -1 }

/** Edges of a rect; `side` = direction (on the perpendicular axis) pointing into the room. */
function edges(r: Rect): Edge[] {
  return [
    { axis: 'x', at: r.z0, a: r.x0, b: r.x1, side: 1 },
    { axis: 'x', at: r.z1, a: r.x0, b: r.x1, side: -1 },
    { axis: 'z', at: r.x0, a: r.z0, b: r.z1, side: 1 },
    { axis: 'z', at: r.x1, a: r.z0, b: r.z1, side: -1 },
  ];
}

/** Subtracts [lo, hi] gaps from [a, b]. */
function cut(a: number, b: number, gaps: [number, number][]): [number, number][] {
  let segs: [number, number][] = [[a, b]];
  for (const [lo, hi] of gaps) {
    segs = segs.flatMap(([s, e]): [number, number][] => (hi <= s || lo >= e ? [[s, e]] : [[s, lo], [hi, e]]).filter(([x, y]) => y - x > 0.02) as [number, number][]);
  }
  return segs;
}

/** Skirting boards along interior wall faces (interrupted at openings), switches and sockets near doors. */
export function buildDetails(kit: InteriorKit) {
  const white = kit.mat({ color: 0xf4f2ee, roughness: 0.6 });
  const plate = kit.mat({ color: 0xf7f7f5, roughness: 0.35 });

  for (const room of ROOMS) {
    if (room.floor === 'deck') continue;
    const fy = LEVELS[room.level].floor;
    for (const rect of room.rects) {
      for (const e of edges(rect)) {
        const walls = WALLS.filter((w: Wall) => w.level === room.level && w.axis === e.axis && Math.abs(w.at - e.at) < EPS);
        for (const w of walls) {
          const lo = Math.max(e.a, w.from), hi = Math.min(e.b, w.to);
          if (hi - lo < 0.05) continue;
          const face = w.at + e.side * w.t / 2;
          const ops: Opening[] = (w.openings ?? []).filter((o) => o.kind !== 'window' || (o.sill ?? 0) < BASE.h + 0.02);
          const gaps = ops.map((o): [number, number] => [o.c - o.w / 2, o.c + o.w / 2]);
          for (const [s, t] of cut(lo, hi, gaps)) {
            const mid = (s + t) / 2, len = t - s;
            const p = face + e.side * BASE.t / 2;
            if (e.axis === 'x') kit.box(white, len, BASE.h, BASE.t, mid, fy, p);
            else kit.box(white, BASE.t, BASE.h, len, p, fy, mid);
          }
          // Switch and socket beside each door of this wall, on the room side.
          for (const o of ops.filter((d) => d.kind === 'door' && d.c > lo && d.c < hi)) {
            const place = (off: number, y: number) => {
              const u = o.c + off;
              if (u < lo + 0.15 || u > hi - 0.15) return;
              if (gaps.some(([g0, g1]) => u > g0 - 0.1 && u < g1 + 0.1)) return;
              const p = face + e.side * PLATE.t / 2;
              if (e.axis === 'x') kit.box(plate, PLATE.s, PLATE.s, PLATE.t, u, fy + y, p);
              else kit.box(plate, PLATE.t, PLATE.s, PLATE.s, p, fy + y, u);
            };
            const d = o.w / 2 + PLATE.gap;
            place(d, PLATE.switchY);
            place(-d, PLATE.socketY);
            place(d, PLATE.socketY);
          }
        }
      }
    }
  }
}
