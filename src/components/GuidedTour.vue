<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { useGameStore } from '@/stores/game';
import { TOUR } from '@/data/tour';

const store = useGameStore();
const stop = computed(() => (store.tourIndex >= 0 ? TOUR[store.tourIndex] : null));

function onKey(e: KeyboardEvent) {
  if (store.tourIndex < 0) return;
  if (e.key === 'ArrowRight') store.nextTour();
  else if (e.key === 'ArrowLeft') store.prevTour();
  else if (e.key === 'Escape') store.stopTour();
}
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <button v-if="!stop" class="glass pill" @click="store.startTour()">Visite guidée</button>
  <div v-else class="card glass">
    <div class="step">{{ store.tourIndex + 1 }} / {{ TOUR.length }}</div>
    <h3>{{ stop.title }}</h3>
    <p>{{ stop.text }}</p>
    <div class="actions">
      <button :disabled="store.tourIndex === 0" @click="store.prevTour()">Précédent</button>
      <button @click="store.nextTour()">{{ store.tourIndex === TOUR.length - 1 ? 'Terminer' : 'Suivant' }}</button>
      <button @click="store.stopTour()">Quitter</button>
    </div>
  </div>
</template>

<style scoped>
.pill { padding: 8px 14px; border-radius: 999px; font-size: 0.75rem; letter-spacing: 0.05em; cursor: pointer; border: 0; color: inherit; }
.card {
  position: fixed; top: calc(max(16px, env(safe-area-inset-top)) + 100px); left: 50%; transform: translateX(-50%);
  width: min(360px, calc(100vw - 32px)); padding: 14px 18px; border-radius: 14px; pointer-events: auto; z-index: 8;
}
.step { font-size: 0.7rem; color: var(--ink-soft); }
h3 { margin: 2px 0 6px; font-family: var(--serif); font-size: 1.2rem; font-weight: 500; }
p { margin: 0 0 12px; font-size: 0.85rem; line-height: 1.4; }
.actions { display: flex; gap: 6px; }
.actions button {
  flex: 1; min-height: 36px; border: 0; border-radius: 999px; background: rgba(255, 255, 255, 0.2);
  color: inherit; font-size: 0.75rem; cursor: pointer;
}
.actions button:disabled { opacity: 0.4; cursor: default; }
</style>
