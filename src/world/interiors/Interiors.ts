import * as THREE from 'three';
import type { Assets } from '@/engine/assets';
import type { QualityProfile } from '@/engine/quality';
import type { PhysicsWorld } from '@/physics/PhysicsWorld';
import { roomAt } from '@/data/floorplan';
import { InteriorKit } from './kit';
import { furnishLiving } from './living';
import { furnishGround } from './ground';
import { furnishUpper } from './upper';
import { buildDetails } from './details';

/** Phase 4 interiors: furniture, bathrooms, decoration (same lifecycle as exterior modules). */
export class Interiors {
  private readonly kit: InteriorKit;
  readonly group;
  readonly ready: Promise<void>;

  constructor(assets: Assets, physics: PhysicsWorld, profile: QualityProfile) {
    this.kit = new InteriorKit(assets, physics, profile);
    this.group = this.kit.group;
    this.ready = Promise.all([furnishLiving(this.kit), furnishGround(this.kit), furnishUpper(this.kit)]).then(() => { buildDetails(this.kit); this.kit.finalize(); this.kit.attachMirrors(); this.viewerDirty = true; });
  }

  private readonly viewer = new THREE.Vector3(1e6, 0, 1e6);
  private viewerDirty = false;
  private static readonly RANGE = 35;

  /** Player position; meshes of cells farther than ~35 m are hidden (applied in update). */
  setViewer(pos: THREE.Vector3) {
    if (this.viewer.distanceToSquared(pos) < 0.25) return;
    this.viewer.copy(pos);
    this.viewerDirty = true;
  }

  update(_dt: number, _elapsed: number) {
    if (!this.viewerDirty) return;
    this.viewerDirty = false;
    this.kit.cull(this.viewer, Interiors.RANGE);
    const rm = roomAt(this.viewer.x, this.viewer.y, this.viewer.z);
    this.kit.setMirrorRoom(rm ? rm.id : null);
  }

  dispose() {
    this.kit.dispose();
  }
}
