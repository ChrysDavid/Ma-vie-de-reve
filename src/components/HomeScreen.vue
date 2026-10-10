<script setup lang="ts">
defineEmits<{ visit: [] }>();
</script>

<template>
  <div class="home">
    <div class="content">
      <p class="kicker">Villa contemporaine</p>
      <h1>Ma vie de rêve</h1>
      <p class="tagline">Piscine à débordement, jardins tropicaux, lumière dorée.</p>
      <button class="visit glass" @click="$emit('visit')">Visiter</button>
    </div>
  </div>
</template>

<style scoped>
.home {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: flex-end;
  padding: max(6vh, 32px) max(6vw, 16px);
  background: linear-gradient(to top, rgba(10, 9, 7, 0.75) 0%, rgba(10, 9, 7, 0.1) 55%, transparent 100%);
  z-index: 10;
}
.content { max-width: 560px; }
.kicker {
  margin: 0 0 8px;
  font-size: 0.75rem;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--gold);
}
h1 {
  margin: 0;
  font-family: var(--serif);
  font-weight: 500;
  font-size: clamp(3rem, 10vw, 6.5rem);
  line-height: 0.95;
  letter-spacing: 0.01em;
}
.tagline { margin: 16px 0 32px; color: var(--ink-soft); font-size: 1rem; }
.visit {
  padding: 14px 44px;
  border-radius: 999px;
  font-size: 0.85rem;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  transition: background 0.3s, border-color 0.3s;
}
.visit:hover, .visit:focus-visible { background: rgba(216, 183, 122, 0.25); border-color: var(--gold); outline: none; }
</style>
