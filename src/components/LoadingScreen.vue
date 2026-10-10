<script setup lang="ts">
import { computed } from 'vue';
import { useGameStore } from '@/stores/game';

const store = useGameStore();
const percent = computed(() => Math.round(store.progress * 100));
</script>

<template>
  <div class="loading">
    <h1>Ma vie de rêve</h1>
    <div class="bar" role="progressbar" :aria-valuenow="percent" aria-valuemin="0" aria-valuemax="100">
      <div class="fill" :style="{ transform: `scaleX(${store.progress})` }" />
    </div>
    <p v-if="!store.error">{{ store.loadingLabel }} <span>{{ percent }}%</span></p>
    <p v-else class="error">Erreur de chargement : {{ store.error }}</p>
  </div>
</template>

<style scoped>
.loading {
  position: fixed;
  inset: 0;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 28px;
  background: radial-gradient(ellipse at center, #1c1915 0%, #0e0d0b 70%);
  z-index: 20;
}
h1 {
  font-family: var(--serif);
  font-weight: 500;
  font-size: clamp(2.4rem, 7vw, 4.5rem);
  letter-spacing: 0.04em;
  margin: 0;
}
.bar {
  width: min(320px, 70vw);
  height: 2px;
  background: rgba(246, 241, 231, 0.15);
  overflow: hidden;
}
.fill {
  height: 100%;
  background: var(--gold);
  transform-origin: left;
  transition: transform 0.3s ease;
}
p { margin: 0; font-size: 0.8rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-soft); }
span { color: var(--gold); margin-left: 6px; }
.error { color: #f0a090; text-transform: none; letter-spacing: 0; max-width: 80vw; text-align: center; }
</style>
