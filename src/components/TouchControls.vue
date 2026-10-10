<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { create } from 'nipplejs';
import type { Game } from '@/Game';
import { useGameStore } from '@/stores/game';

type MoveEvent = { data: { vector: { x: number; y: number }; force: number } };

const props = defineProps<{ game: Game }>();
const zone = ref<HTMLDivElement>();
const store = useGameStore();
/** Contextual action ("E : ouvrir la porte" → "Ouvrir la porte"), shown only when something is in reach. */
const action = computed(() => {
  const t = store.interactPrompt.replace(/^E\s*:\s*/i, '');
  return t ? t[0].toUpperCase() + t.slice(1) : '';
});
let joystick: ReturnType<typeof create> | undefined;

onMounted(() => {
  // Static stick: always visible, so the player sees where to move from.
  joystick = create({ zone: zone.value!, mode: 'static', position: { left: '50%', top: '50%' }, color: 'rgba(246,241,231,0.9)', size: 130, restOpacity: 0.75 });
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
  <Transition name="pop">
    <button v-if="action" class="glass action" @click="props.game.input.onInteract?.()">{{ action }}</button>
  </Transition>
</template>

<style scoped>
.joystick-zone {
  position: fixed;
  right: max(12px, env(safe-area-inset-right));
  bottom: max(12px, env(safe-area-inset-bottom));
  width: 190px;
  height: 190px;
  z-index: 6;
  touch-action: none;
}
.joystick-zone :deep(.back) { background: rgba(20, 20, 22, 0.35) !important; border: 2px solid rgba(246, 241, 231, 0.6); opacity: 1 !important; }
.joystick-zone :deep(.front) { box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35); }
.action {
  position: fixed;
  left: max(20px, env(safe-area-inset-left));
  bottom: max(28px, env(safe-area-inset-bottom));
  z-index: 6;
  min-width: 150px;
  height: 64px;
  padding: 0 22px;
  border-radius: 32px;
  font-size: 1rem;
  font-weight: 600;
  touch-action: manipulation;
}
.pop-enter-active, .pop-leave-active { transition: opacity 0.2s, transform 0.2s; }
.pop-enter-from, .pop-leave-to { opacity: 0; transform: scale(0.85); }
</style>
