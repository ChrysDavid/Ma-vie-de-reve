import { defineStore } from 'pinia';
import { saveQuality, type QualityLevel } from '@/engine/quality';

import { TOUR } from '@/data/tour';
import type { TimeOfDay } from '@/engine/timeOfDay';

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
    timeOfDay: 'day' as TimeOfDay,
    player: { x: 0, z: 0, level: 0, yaw: 0 },
    interactPrompt: '' as string,
    muted: false,
    pendingTeleport: null as null | { x: number; y: number; z: number; yaw: number; pitch: number },
    tourIndex: -1,
  }),
  actions: {
    toggleMute() {
      this.muted = !this.muted;
    },
    teleport(t: { x: number; y: number; z: number; yaw: number; pitch: number }) {
      this.pendingTeleport = t;
    },
    startTour() {
      this.tourIndex = 0;
      this.teleport(TOUR[0]);
    },
    nextTour() {
      if (this.tourIndex < 0) return;
      if (this.tourIndex >= TOUR.length - 1) return this.stopTour();
      this.tourIndex++;
      this.teleport(TOUR[this.tourIndex]);
    },
    prevTour() {
      if (this.tourIndex <= 0) return;
      this.tourIndex--;
      this.teleport(TOUR[this.tourIndex]);
    },
    stopTour() {
      this.tourIndex = -1;
    },
    setTimeOfDay(t: TimeOfDay) {
      this.timeOfDay = t;
    },
    /** Sets the quality level and persists the user's choice. */
    setQuality(level: QualityLevel) {
      this.quality = level;
      saveQuality(level);
    },
  },
});
