<template>
  <div class="stat-card" :class="{ 'stat-card--hoverable': hoverable }">
    <div class="stat-accent" :style="{ background: barColor }" />
    <div class="stat-body">
      <div class="stat-value" :style="{ color }">{{ displayValue }}</div>
      <div class="stat-label">{{ label }}</div>
    </div>
    <div v-if="suffix" class="stat-suffix">{{ suffix }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  value: string | number;
  label: string;
  color?: string;
  suffix?: string;
  hoverable?: boolean;
}>();

const displayValue = computed(() => props.value);
const barColor = computed(() => props.color || '#b8860b');
</script>

<style scoped>
.stat-card {
  position: relative;
  display: flex;
  align-items: stretch;
  background: var(--surface-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: var(--shadow-card);
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}

.stat-card--hoverable:hover {
  box-shadow: var(--shadow-card-hover);
  transform: translateY(-1px);
}

.stat-accent {
  width: 4px;
  flex-shrink: 0;
  border-radius: 2px 0 0 2px;
}

.stat-body {
  flex: 1;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-value {
  font-family: var(--font-display);
  font-size: 32px;
  font-weight: 600;
  line-height: 1.1;
  letter-spacing: -0.01em;
}

.stat-label {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 450;
  letter-spacing: 0.02em;
}

.stat-suffix {
  display: flex;
  align-items: flex-end;
  padding: 20px 20px 20px 0;
  font-size: 13px;
  color: var(--text-muted);
  flex-shrink: 0;
}
</style>
