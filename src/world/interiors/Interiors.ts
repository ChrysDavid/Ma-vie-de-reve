import type { Assets } from '@/engine/assets';
import type { QualityProfile } from '@/engine/quality';
import type { PhysicsWorld } from '@/physics/PhysicsWorld';
import { InteriorKit } from './kit';
import { furnishLiving } from './living';
import { furnishGround } from './ground';
import { furnishUpper } from './upper';

/** Phase 4 interiors: furniture, bathrooms, decoration (same lifecycle as exterior modules). */
export class Interiors {
  private readonly kit: InteriorKit;
  readonly group;
  readonly ready: Promise<void>;

  constructor(assets: Assets, physics: PhysicsWorld, profile: QualityProfile) {
    this.kit = new InteriorKit(assets, physics, profile);
    this.group = this.kit.group;
    this.ready = Promise.all([furnishLiving(this.kit), furnishGround(this.kit), furnishUpper(this.kit)]).then(() => this.kit.finalize());
  }

  update(_dt: number, _elapsed: number) {}

  dispose() {
    this.kit.dispose();
  }
}
