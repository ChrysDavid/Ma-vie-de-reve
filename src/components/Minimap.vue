<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useGameStore } from '@/stores/game';
import { FOOTPRINT, ROOMS, LEVELS } from '@/data/floorplan';
import { roomCenter } from '@/data/tour';

const store = useGameStore();
const canvas = ref<HTMLCanvasElement>();
const open = ref(true);
const SIZE = 180, PAD = 8;
const W = FOOTPRINT.x1 - FOOTPRINT.x0, H = FOOTPRINT.z1 - FOOTPRINT.z0;
const S = Math.min((SIZE - PAD * 2) / W, (SIZE - PAD * 2) / H);
const OX = (SIZE - W * S) / 2, OY = (SIZE - H * S) / 2;
const sx = (x: number) => OX + (x - FOOTPRINT.x0) * S;
const sy = (z: number) => OY + (z - FOOTPRINT.z0) * S;
let raf = 0;

function draw() {
  raf = 0;
  const c = canvas.value?.getContext('2d');
  if (!c) return;
  const p = store.player;
  c.clearRect(0, 0, SIZE, SIZE);
  c.fillStyle = 'rgba(20,20,24,0.35)';
  c.fillRect(sx(FOOTPRINT.x0), sy(FOOTPRINT.z0), W * S, H * S);
  c.strokeStyle = 'rgba(255,255,255,0.8)';
  c.lineWidth = 1.5;
  c.strokeRect(sx(FOOTPRINT.x0), sy(FOOTPRINT.z0), W * S, H * S);
  c.lineWidth = 1;
  c.strokeStyle = 'rgba(255,255,255,0.5)';
  c.fillStyle = 'rgba(255,255,255,0.12)';
  for (const r of ROOMS) {
    if (r.level !== p.level) continue;
    for (const k of r.rects) {
      c.fillRect(sx(k.x0), sy(k.z0), (k.x1 - k.x0) * S, (k.z1 - k.z0) * S);
      c.strokeRect(sx(k.x0), sy(k.z0), (k.x1 - k.x0) * S, (k.z1 - k.z0) * S);
    }
  }
  // Player arrow: forward = (-sin yaw, -cos yaw) -> canvas rotation = -yaw.
  c.save();
  c.translate(sx(p.x), sy(p.z));
  c.rotate(-p.yaw);
  c.fillStyle = '#ffd27a';
  c.strokeStyle = '#000';
  c.beginPath();
  c.moveTo(0, -7); c.lineTo(5, 6); c.lineTo(0, 3); c.lineTo(-5, 6); c.closePath();
  c.fill(); c.stroke();
  c.restore();
}
const schedule = () => { if (!raf && open.value) raf = requestAnimationFrame(draw); };
watch(() => [store.player.x, store.player.z, store.player.level, store.player.yaw, open.value], schedule, { flush: 'post' });
onMounted(schedule);

function onClick(e: MouseEvent) {
  const el = canvas.value!;
  const b = el.getBoundingClientRect();
  const k = SIZE / b.width;
  const x = FOOTPRINT.x0 + ((e.clientX - b.left) * k - OX) / S;
  const z = FOOTPRINT.z0 + ((e.clientY - b.top) * k - OY) / S;
  const room = ROOMS.find((r) => r.level === store.player.level && r.rects.some((q) => x >= q.x0 && x <= q.x1 && z >= q.z0 && z <= q.z1));
  if (!room) return;
  const ctr = roomCenter(room.id);
  store.teleport({ ...ctr, y: LEVELS[room.level].floor, yaw: store.player.yaw, pitch: 0.1 });
}
</script>

<template>
  <div class="minimap" :class="{ touch: store.isTouch }">
    <canvas v-show="open" ref="canvas" class="glass" :width="SIZE" :height="SIZE" @click="onClick" />
    <button class="glass tog" @click="open = !open">{{ open ? '–' : 'Carte' }}</button>
  </div>
</template>

<style scoped>
.minimap {
  position: absolute;
  left: max(16px, env(safe-area-inset-left));
  bottom: 16px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}
.minimap.touch { bottom: 120px; }
canvas { width: 180px; height: 180px; border-radius: 12px; cursor: pointer; touch-action: manipulation; }
.tog { padding: 4px 12px; border-radius: 999px; font-size: 0.72rem; cursor: pointer; border: 0; color: inherit; }
@media (max-width: 600px) { canvas { width: 140px; height: 140px; } }
</style>
