export type QualityLevel = 'low' | 'medium' | 'ultra';

export interface QualityProfile {
  level: QualityLevel;
  pixelRatio: number;
  antialias: boolean;
  shadowMapSize: number;
  shadowDistance: number;
  textureRes: '1k' | '2k';
}

export const QUALITY_PROFILES: Record<QualityLevel, QualityProfile> = {
  low: { level: 'low', pixelRatio: 1, antialias: false, shadowMapSize: 1024, shadowDistance: 20, textureRes: '1k' },
  medium: { level: 'medium', pixelRatio: 1.5, antialias: true, shadowMapSize: 2048, shadowDistance: 30, textureRes: '1k' },
  ultra: { level: 'ultra', pixelRatio: 2, antialias: true, shadowMapSize: 4096, shadowDistance: 40, textureRes: '2k' },
};

export function isTouchDevice(): boolean {
  // Primary pointer only: a Windows laptop with a touchscreen keeps the desktop UI.
  return matchMedia('(pointer: coarse)').matches;
}

/** Initial guess from device capabilities; refined later from measured FPS. */
export function detectQuality(): QualityLevel {
  const cores = navigator.hardwareConcurrency ?? 4;
  if (isTouchDevice()) return cores >= 8 ? 'medium' : 'low';
  return cores >= 8 ? 'ultra' : 'medium';
}

export function getProfile(level: QualityLevel): QualityProfile {
  const p = QUALITY_PROFILES[level];
  return { ...p, pixelRatio: Math.min(p.pixelRatio, window.devicePixelRatio || 1) };
}
