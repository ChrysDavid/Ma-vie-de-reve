import * as THREE from 'three';
import type { Assets } from '@/engine/assets';
import type { FinishId } from '@/data/floorplan';

export interface PbrOptions {
  /** Texture repeat (UVs are in metres / tile, so usually 1). */
  repeat?: number;
  normalScale?: number;
  roughness?: number;
  color?: THREE.ColorRepresentation;
  /** false: keep relief (normal/roughness/AO) but use a flat colour — for painted surfaces. */
  albedo?: boolean;
}

/** MeshStandardMaterial from a Poly Haven texture set (albedo, normal, roughness, AO). */
export function pbrMaterial(assets: Assets, id: string, opts: PbrOptions = {}): THREE.MeshStandardMaterial {
  const maps = assets.loadPbrSet(id, opts.albedo === false ? ['nor', 'rough'] : undefined);
  const repeat = opts.repeat ?? 1;
  for (const t of Object.values(maps)) t.repeat.setScalar(repeat);
  return new THREE.MeshStandardMaterial({
    map: maps.diff,
    normalMap: maps.nor,
    normalScale: new THREE.Vector2(opts.normalScale ?? 1, opts.normalScale ?? 1),
    roughnessMap: maps.rough,
    roughness: opts.roughness ?? 1,
    aoMap: maps.ao,
    aoMapIntensity: 1,
    color: opts.color ?? 0xffffff,
  });
}

interface FinishSpec extends Omit<PbrOptions, 'repeat'> { tex: string; size: number }

/** Finish → Poly Haven texture set and its real-world size in metres (texture repeat = 1 / size). */
const FINISH_SPECS: Record<FinishId, FinishSpec> = {
  render: { tex: 'white_plaster_02', size: 1, color: 0xeeebe4, albedo: false, normalScale: 0.6 },
  paint: { tex: 'white_plaster_02', size: 1, color: 0xf2efe9, albedo: false, normalScale: 0.25 },
  stone: { tex: 'castle_wall_slates', size: 2.5 },
  woodClad: { tex: 'oak_wood_planks', size: 1.2, color: 0xa89888 },
  marble: { tex: 'marble_01', size: 1.5, roughness: 0.55 },
  tiles: { tex: 'large_floor_tiles_02', size: 3, roughness: 0.75 },
  oak: { tex: 'laminate_floor_02', size: 1.7 },
  deck: { tex: 'wood_floor_deck', size: 1.8, color: 0xb0a49a },
  concrete: { tex: 'concrete_floor_02', size: 2, color: 0xd9d5cd },
};

/** One shared material per architectural finish, plus untextured trims (aluminium, glass). */
export class Finishes {
  private readonly cache = new Map<FinishId, THREE.MeshStandardMaterial>();
  readonly aluminium = new THREE.MeshStandardMaterial({ color: 0x2a2b2d, metalness: 0.75, roughness: 0.35 });
  readonly trim = new THREE.MeshStandardMaterial({ color: 0xefece6, roughness: 0.45 });
  readonly glass = new THREE.MeshPhysicalMaterial({
    color: 0xeef4f2, metalness: 0, roughness: 0.03, ior: 1.5, specularIntensity: 1,
    transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide,
  });

  constructor(private readonly assets: Assets) {}

  get(id: FinishId): THREE.MeshStandardMaterial {
    let m = this.cache.get(id);
    if (!m) {
      const s = FINISH_SPECS[id];
      m = pbrMaterial(this.assets, s.tex, { ...s, repeat: 1 / s.size });
      this.cache.set(id, m);
    }
    return m;
  }

  dispose() {
    for (const m of this.cache.values()) m.dispose();
    this.aluminium.dispose();
    this.trim.dispose();
    this.glass.dispose();
  }
}
