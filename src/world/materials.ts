import * as THREE from 'three';
import type { Assets } from '@/engine/assets';

export interface PbrOptions {
  /** Texture repeat (UVs are in metres / tile, so usually 1). */
  repeat?: number;
  normalScale?: number;
  roughness?: number;
  color?: THREE.ColorRepresentation;
}

/** MeshStandardMaterial from a Poly Haven texture set (albedo, normal, roughness, AO). */
export function pbrMaterial(assets: Assets, id: string, opts: PbrOptions = {}): THREE.MeshStandardMaterial {
  const maps = assets.loadPbrSet(id);
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
