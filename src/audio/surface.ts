import { FOOTPRINT, PLINTH, POOL, POOL_DECK, roomAt, type Rect } from '@/data/floorplan';

export type Surface = 'tile' | 'wood' | 'grass' | 'stone' | 'water';

const inRect = (rc: Rect, x: number, z: number, m = 0) =>
  x >= rc.x0 - m && x <= rc.x1 + m && z >= rc.z0 - m && z <= rc.z1 + m;

export function surfaceAt(x: number, y: number, z: number): Surface {
  const room = roomAt(x, y, z);
  if (room) {
    switch (room.floor) {
      case 'oak':
      case 'deck':
        return 'wood';
      case 'tiles':
      case 'marble':
        return 'tile';
      default:
        return 'stone';
    }
  }
  if (inRect(POOL.rect, x, z)) return 'water';
  if (inRect(POOL.rect, x, z, POOL.coping)) return 'stone';
  for (const d of POOL_DECK) if (inRect(d, x, z)) return 'stone';
  if (inRect(FOOTPRINT, x, z, PLINTH.margin)) return 'stone';
  return 'grass';
}
