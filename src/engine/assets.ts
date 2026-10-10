import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

export const ASSET_BASE = `${import.meta.env.BASE_URL}assets/`;

export type PbrMapName = 'diff' | 'nor' | 'rough' | 'ao';

/** Central loader: one LoadingManager so the loading bar reflects every request. */
export class Assets {
  readonly manager = new THREE.LoadingManager();
  private readonly gltf = new GLTFLoader(this.manager);
  private readonly hdr = new HDRLoader(this.manager);
  private readonly tex = new THREE.TextureLoader(this.manager);
  private readonly cache = new Map<string, THREE.Texture>();

  constructor(private readonly maxAnisotropy: number) {}

  loadGLTF(path: string): Promise<GLTF> {
    return this.gltf.loadAsync(ASSET_BASE + path);
  }

  async loadHDR(path: string): Promise<THREE.DataTexture> {
    const t = await this.hdr.loadAsync(ASSET_BASE + path);
    t.mapping = THREE.EquirectangularReflectionMapping;
    return t;
  }

  /** Loads a PBR texture set from public/assets/textures/<id>/<map>.jpg. Color maps sRGB, data maps linear. */
  loadPbrSet(id: string, maps: PbrMapName[] = ['diff', 'nor', 'rough', 'ao']) {
    const out: Partial<Record<PbrMapName, THREE.Texture>> = {};
    for (const m of maps) out[m] = this.loadTexture(`textures/${id}/${m}.jpg`, m === 'diff');
    return out as Record<PbrMapName, THREE.Texture>;
  }

  private loadTexture(path: string, srgb: boolean): THREE.Texture {
    const hit = this.cache.get(path);
    if (hit) return hit;
    const t = this.tex.load(ASSET_BASE + path);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = this.maxAnisotropy;
    this.cache.set(path, t);
    return t;
  }
}
