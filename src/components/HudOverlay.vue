<script setup lang="ts">
import { useGameStore } from '@/stores/game';
import type { Game } from '@/Game';

const props = defineProps<{ game: Game }>();
const store = useGameStore();
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
.fps { font-size: 0.7rem; color: var(--ink-soft); font-variant-numeric: tabular-nums; }
.pill { padding: 8px 14px; border-radius: 999px; font-size: 0.75rem; letter-spacing: 0.05em; }
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
