<script setup lang="ts">
import { ref } from 'vue';
import { useGameStore } from '@/stores/game';
import { teleportTargets, type TeleportTarget } from '@/data/tour';

const store = useGameStore();
const open = ref(false);
const targets = teleportTargets();
function go(t: TeleportTarget) {
  store.teleport(t);
  open.value = false;
}
</script>

<template>
  <div class="tp">
    <button class="glass pill" @click="open = !open">Aller à…</button>
    <ul v-if="open" class="glass list">
      <li v-for="t in targets" :key="t.label + t.x"><button @click="go(t)">{{ t.label }}</button></li>
    </ul>
  </div>
</template>

<style scoped>
.tp { position: relative; }
.pill { padding: 8px 14px; border-radius: 999px; font-size: 0.75rem; letter-spacing: 0.05em; cursor: pointer; border: 0; color: inherit; }
.list {
  position: absolute; top: calc(100% + 6px); left: 0; margin: 0; padding: 6px; list-style: none;
  border-radius: 12px; max-height: 50vh; overflow-y: auto; min-width: 190px; z-index: 10;
}
.list button {
  width: 100%; min-height: 36px; text-align: left; padding: 6px 12px; border: 0; border-radius: 8px;
  background: transparent; color: inherit; font-size: 0.8rem; cursor: pointer;
}
.list button:hover { background: rgba(255, 255, 255, 0.2); }
</style>
