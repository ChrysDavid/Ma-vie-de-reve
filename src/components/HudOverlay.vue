<script setup lang="ts">
import { useGameStore } from '@/stores/game';
import type { Game } from '@/Game';
import { TIME_OF_DAY_LABELS, type TimeOfDay } from '@/engine/timeOfDay';

import Minimap from './Minimap.vue';
import TeleportMenu from './TeleportMenu.vue';
import GuidedTour from './GuidedTour.vue';

const props =defineProps<{ game: Game }>();
const store = useGameStore();
const times = Object.keys(TIME_OF_DAY_LABELS) as TimeOfDay[];
</script>

<template>
  <div class="hud">
    <div class="room glass">{{ store.roomName }}</div>
    <div class="top-right">
      <span class="fps">{{ store.fps }} fps</span>
      <button class="glass pill" @click="props.game.toggleView()">
        {{ store.cameraMode === 'third' ? '1re personne' : '3e personne' }}
      </button>
    </div>
    <div class="left-tools">
      <TeleportMenu />
      <GuidedTour />
      <button class="glass pill" :title="store.muted ? 'Activer le son' : 'Couper le son'" @click="store.toggleMute()">
        {{ store.muted ? '🔇' : '🔈' }}
      </button>
    </div>
    <Minimap />
    <div v-if="store.interactPrompt && !store.isTouch" class="prompt glass">{{ store.interactPrompt }}</div>
    <div class="tod glass">
      <button v-for="t in times" :key="t" :class="{ on: store.timeOfDay === t }" @click="store.setTimeOfDay(t)">
        {{ TIME_OF_DAY_LABELS[t] }}
      </button>
    </div>
    <div v-if="!store.isTouch" class="hint glass">
      ZQSD / WASD se déplacer · Maj courir · Glisser la souris pour regarder · Molette zoom · V vue · E interagir
    </div>
  </div>
</template>

<style scoped>
.hud { position: fixed; inset: 0; pointer-events: none; z-index: 5; }
.hud > *, .top-right > * { pointer-events: auto; }
.room {
  position: absolute;
  top: max(16px, env(safe-area-inset-top));
  left: 16px;
  padding: 8px 16px;
  border-radius: 999px;
  font-family: var(--serif);
  font-size: 1.15rem;
  letter-spacing: 0.03em;
}
.top-right {
  position: absolute;
  top: max(16px, env(safe-area-inset-top));
  right: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
  pointer-events: none;
}
.left-tools {
  position: absolute;
  top: calc(max(16px, env(safe-area-inset-top)) + 52px);
  left: 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-width: 50vw;
}
.left-tools .pill { cursor: pointer; border: 0; color: inherit; }
.prompt {
  position: absolute;
  bottom: 64px;
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 18px;
  border-radius: 999px;
  font-size: 0.85rem;
  white-space: nowrap;
}
.fps { font-size: 0.7rem; color: var(--ink-soft); font-variant-numeric: tabular-nums; }
.pill { padding: 8px 14px; border-radius: 999px; font-size: 0.75rem; letter-spacing: 0.05em; }
.tod {
  position: absolute;
  top: calc(max(16px, env(safe-area-inset-top)) + 52px);
  right: 16px;
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: 999px;
}
.tod button {
  min-height: 36px;
  padding: 6px 12px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--ink-soft);
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  cursor: pointer;
}
.tod button.on { background: rgba(255, 255, 255, 0.25); color: inherit; }
.hint {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 16px;
  border-radius: 10px;
  font-size: 0.72rem;
  color: var(--ink-soft);
  white-space: nowrap;
  max-width: calc(100vw - 32px);
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
