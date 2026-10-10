import * as THREE from 'three';

/**
 * Box whose UVs are expressed in metres / `tile`, so textures keep a constant
 * real-world scale whatever the box size (no stretching).
 */
export function worldBox(w: number, h: number, d: number, tile = 1): THREE.BoxGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  // Face order: +x, -x, +y, -y, +z, -z — 4 vertices each.
  const faceSize: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    const [su, sv] = faceSize[f];
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, (uv.getX(k) * su) / tile, (uv.getY(k) * sv) / tile);
    }
  }
  return g;
}

export type FaceKey = 'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz';
export type BoxFaces = Partial<Record<FaceKey, THREE.Material | null>>;

interface Bucket { p: number[]; n: number[]; uv: number[] }

/**
 * Accumulates quads per material and builds one merged mesh per material (few draw calls).
 * Geometry is in world space; UVs are world metres projected on the face's dominant plane, so
 * textures stay continuous across adjacent pieces (material repeat = 1 / texture size).
 */
export class MeshBatcher {
  private readonly buckets = new Map<THREE.Material, Bucket>();
  private readonly e1 = new THREE.Vector3();
  private readonly e2 = new THREE.Vector3();

  /** Quad a-b-c-d (any winding: it is fixed to face `normal`). */
  quad(mat: THREE.Material, a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, normal: THREE.Vector3) {
    let bucket = this.buckets.get(mat);
    if (!bucket) this.buckets.set(mat, (bucket = { p: [], n: [], uv: [] }));
    const flip = this.e1.subVectors(b, a).cross(this.e2.subVectors(c, a)).dot(normal) < 0;
    const tris = flip ? [a, c, b, a, d, c] : [a, b, c, a, c, d];
    const ax = Math.abs(normal.x), ay = Math.abs(normal.y), az = Math.abs(normal.z);
    for (const v of tris) {
      bucket.p.push(v.x, v.y, v.z);
      bucket.n.push(normal.x, normal.y, normal.z);
      if (ay >= ax && ay >= az) bucket.uv.push(v.x, -v.z);
      else if (ax >= az) bucket.uv.push(-Math.sign(normal.x) * v.z, v.y);
      else bucket.uv.push(Math.sign(normal.z) * v.x, v.y);
    }
  }

  /** Axis-aligned box; faces left undefined/null are skipped. */
  box(min: THREE.Vector3, max: THREE.Vector3, faces: BoxFaces) {
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    const [x0, y0, z0, x1, y1, z1] = [min.x, min.y, min.z, max.x, max.y, max.z];
    const f = faces;
    if (f.px) this.quad(f.px, V(x1, y0, z0), V(x1, y0, z1), V(x1, y1, z1), V(x1, y1, z0), V(1, 0, 0));
    if (f.nx) this.quad(f.nx, V(x0, y0, z0), V(x0, y0, z1), V(x0, y1, z1), V(x0, y1, z0), V(-1, 0, 0));
    if (f.py) this.quad(f.py, V(x0, y1, z0), V(x1, y1, z0), V(x1, y1, z1), V(x0, y1, z1), V(0, 1, 0));
    if (f.ny) this.quad(f.ny, V(x0, y0, z0), V(x1, y0, z0), V(x1, y0, z1), V(x0, y0, z1), V(0, -1, 0));
    if (f.pz) this.quad(f.pz, V(x0, y0, z1), V(x1, y0, z1), V(x1, y1, z1), V(x0, y1, z1), V(0, 0, 1));
    if (f.nz) this.quad(f.nz, V(x0, y0, z0), V(x1, y0, z0), V(x1, y1, z0), V(x0, y1, z0), V(0, 0, -1));
  }

  build(shadows = true): THREE.Mesh[] {
    const meshes: THREE.Mesh[] = [];
    for (const [mat, b] of this.buckets) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, mat);
      m.castShadow = m.receiveShadow = shadows;
      meshes.push(m);
    }
    this.buckets.clear();
    return meshes;
  }
}
