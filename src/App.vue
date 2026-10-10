<script setup lang="ts">
import { markRaw, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { Game } from './Game';
import { useGameStore } from './stores/game';
import { detectQuality, isTouchDevice } from './engine/quality';
import LoadingScreen from './components/LoadingScreen.vue';
import HomeScreen from './components/HomeScreen.vue';
import HudOverlay from './components/HudOverlay.vue';
import TouchControls from './components/TouchControls.vue';

const store = useGameStore();
const canvas = ref<HTMLCanvasElement>();
const game = shallowRef<Game>();

onMounted(async () => {
  store.isTouch = isTouchDevice();
  store.quality = detectQuality();
  const g = markRaw(new Game(canvas.value!, store, store.quality));
  game.value = g;
  if (import.meta.env.DEV) Object.assign(window, { __game: g, __store: store });
  try {
    await g.load();
    store.phase = 'home';
  } catch (e) {
    store.error = e instanceof Error ? e.message : String(e);
    console.error(e);
  }
});

onBeforeUnmount(() => game.value?.dispose());

function visit() {
  store.phase = 'playing';
}
</script>

<template>
  <canvas ref="canvas" class="scene" />
  <Transition name="fade">
    <LoadingScreen v-if="store.phase === 'loading'" />
  </Transition>
  <Transition name="fade">
    <HomeScreen v-if="store.phase === 'home'" @visit="visit" />
  </Transition>
  <template v-if="store.phase === 'playing' && game">
    <HudOverlay :game="game" />
    <TouchControls v-if="store.isTouch" :game="game" />
  </template>
</template>

<style>
.scene {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  outline: none;
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.9s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
