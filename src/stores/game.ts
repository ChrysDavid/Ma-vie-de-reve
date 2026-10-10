import { defineStore } from 'pinia';
import { saveQuality, type QualityLevel } from '@/engine/quality';

export type GamePhase = 'loading' | 'home' | 'playing';
export type CameraMode = 'third' | 'first';

export const useGameStore = defineStore('game', {
  state: () => ({
    phase: 'loading' as GamePhase,
    progress: 0,
    loadingLabel: 'Préparation…',
    error: '' as string,
    quality: 'medium' as QualityLevel,
    cameraMode: 'third' as CameraMode,
    isTouch: false,
    roomName: 'Jardin',
    fps: 0,
  }),
  actions: {
    /** Sets the quality level and persists the user's choice. */
    setQuality(level: QualityLevel) {
      this.quality = level;
      saveQuality(level);
    },
  },
});
