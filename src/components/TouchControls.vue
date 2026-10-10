<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { create } from 'nipplejs';
import type { Game } from '@/Game';

type MoveEvent = { data: { vector: { x: number; y: number }; force: number } };

const props = defineProps<{ game: Game }>();
const zone = ref<HTMLDivElement>();
let joystick: ReturnType<typeof create> | undefined;

onMounted(() => {
  joystick = create({ zone: zone.value!, mode: 'dynamic', color: 'rgba(246,241,231,0.8)', size: 120 });
  // Analog: vector is normalized direction, force is tilt (0..1+).
  joystick.on('move', (e: MoveEvent) => {
    const f = Math.min(e.data.force, 1);
    props.game.input.setJoystick(e.data.vector.x * f, e.data.vector.y * f);
  });
  joystick.on('end', () => props.game.input.setJoystick(0, 0));
});

onBeforeUnmount(() => {
  joystick?.destroy();
  props.game.input.setJoystick(0, 0);
});
</script>

<template>
  <div ref="zone" class="joystick-zone" />
  <div class="buttons">
    <button class="glass round" aria-label="Interagir" @click="props.game.input.onInteract?.()">E</button>
  </div>
</template>

<style scoped>
.joystick-zone {
  position: fixed;
  right: 0;
  bottom: 0;
  width: 45vw;
  height: 60vh;
  z-index: 6;
}
.buttons {
  position: fixed;
  left: max(20px, env(safe-area-inset-left));
  bottom: max(28px, env(safe-area-inset-bottom));
  z-index: 6;
}
.round { width: 64px; height: 64px; border-radius: 50%; font-size: 1.1rem; font-weight: 500; }
</style>
