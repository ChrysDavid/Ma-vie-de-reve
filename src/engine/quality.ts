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
  low: { level: 'low', pixelRatio: 1, antialias: false, shadowMapSize: 512, shadowDistance: 20, textureRes: '1k' },
  medium: { level: 'medium', pixelRatio: 1, antialias: false, shadowMapSize: 1024, shadowDistance: 30, textureRes: '1k' },
  ultra: { level: 'ultra', pixelRatio: 1.5, antialias: true, shadowMapSize: 2048, shadowDistance: 40, textureRes: '2k' },
};

const STORAGE_KEY = 'mvdr.quality';

export function isTouchDevice(): boolean {
  // Primary pointer only: a Windows laptop with a touchscreen keeps the desktop UI.
  return matchMedia('(pointer: coarse)').matches;
}

/** Persisted user choice, if any. */
export function loadQuality(): QualityLevel | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'low' || v === 'medium' || v === 'ultra' ? v : null;
  } catch {
    return null;
  }
}

/** Persists the user's quality choice. */
export function saveQuality(level: QualityLevel) {
  try {
    localStorage.setItem(STORAGE_KEY, level);
  } catch {
    /* storage unavailable */
  }
}

/** GPU renderer string (unmasked when available), lowercased. */
function gpuRenderer(): string {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    if (!gl) return '';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const r = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER)).toLowerCase();
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return r;
  } catch {
    return '';
  }
}

/** Auto level from device capabilities (never 'ultra'); a saved user choice wins. */
export function detectQuality(): QualityLevel {
  const saved = loadQuality();
  if (saved) return saved;
  const cores = navigator.hardwareConcurrency ?? 4;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const gpu = gpuRenderer();
  if (isTouchDevice() || /mali|adreno|powervr|apple gpu.*mobile/.test(gpu)) return cores >= 8 && mem >= 6 ? 'medium' : 'low';
  if (/intel|integrated|uhd|iris|swiftshader|llvmpipe/.test(gpu)) return cores >= 8 && mem >= 8 ? 'medium' : 'low';
  if (/nvidia|geforce|rtx|gtx|radeon|amd|apple m\d/.test(gpu)) return cores >= 4 ? 'medium' : 'low';
  return cores >= 8 && mem >= 8 ? 'medium' : 'low';
}

export function getProfile(level: QualityLevel): QualityProfile {
  const p = QUALITY_PROFILES[level];
  return { ...p, pixelRatio: Math.min(p.pixelRatio, window.devicePixelRatio || 1) };
}
